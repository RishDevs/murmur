export function parseEventSub(message) {
  if (message?.metadata?.message_type !== 'notification') return null;
  const e = message.payload?.event || {};
  switch (message.payload?.subscription?.type) {
    case 'channel.chat.message': return {type:'vote', userId:e.chatter_user_id, name:e.chatter_user_name, messageId:e.message_id, text:e.message?.text};
    case 'channel.chat.message_delete': return {type:'delete',userId:e.target_user_id,messageId:e.message_id};
    case 'channel.chat.clear_user_messages': return {type:'clearUser',userId:e.target_user_id};
    case 'channel.chat.clear': return {type:'chatClear'};
    default: return null;
  }
}
const WS_URL = 'wss://eventsub.wss.twitch.tv/ws';
const types = ['channel.chat.message','channel.chat.message_delete','channel.chat.clear_user_messages','channel.chat.clear'];
export class EventSub {
  constructor(auth, onAction, onStatus) { Object.assign(this,{auth,onAction,onStatus}); this.seen = new Set(); this.delay=1000; this.generation=0; }
  start() { this.stopped=false; this.connect(WS_URL, false); }
  stop() { this.stopped=true; this.generation++; clearTimeout(this.timer); clearTimeout(this.retry); this.socket?.close(); }
  connect(url, transferred, previous) {
    if (this.stopped) return;
    const generation = ++this.generation;
    this.onStatus('RECONNECTING');
    let ws;
    try { ws = new WebSocket(url); } catch { this.schedule(); return; }
    this.socket=ws; this.previous=previous || null; let welcomed=false;
    const arm = seconds => { clearTimeout(this.timer); this.timer=setTimeout(()=>ws.close(), (seconds+1)*1000); };
    ws.addEventListener('message', async ({data}) => {
      if (generation !== this.generation && ws !== this.previous) return;
      let msg; try { msg=JSON.parse(data); } catch { return; }
      const type=msg.metadata?.message_type;
      if (generation !== this.generation && type !== 'notification') return;
      if (generation === this.generation && this.timeout) arm(this.timeout);
      if (type === 'session_welcome') {
        welcomed=true; this.timeout=msg.payload.session.keepalive_timeout_seconds || 10; arm(this.timeout);
        if (transferred) { this.previous=null; previous?.close(); }
        else {
          try { await Promise.all(types.map(type=>this.auth.subscribe(type,msg.payload.session.id))); }
          catch (err) { this.onStatus(err.message === 'sign in again' ? 'SIGN IN AGAIN' : 'RECONNECTING'); if (err.message === 'sign in again') {this.stopped=true; clearTimeout(this.timer);} ws.close(); return; }
        }
        if (generation !== this.generation) return;
        this.delay=1000; this.onStatus('LIVE');
      } else if (type === 'session_reconnect') {
        const next=msg.payload?.session?.reconnect_url;
        if (next) this.connect(next,true,ws);
      } else if (type === 'revocation') {
        this.onStatus('SIGN IN AGAIN'); this.stopped=true; clearTimeout(this.timer); ws.close();
      } else if (type === 'notification') {
        const id=msg.metadata.message_id; if (id && this.seen.has(id)) return;
        if (id) { this.seen.add(id); if (this.seen.size>2000) this.seen.delete(this.seen.values().next().value); }
        const action=parseEventSub(msg); if (action) this.onAction({...action,at:Date.now()});
      }
    });
    arm(15);
    ws.addEventListener('error',()=>{});
    ws.addEventListener('close',()=> { if (generation!==this.generation || this.stopped) return; clearTimeout(this.timer); if (transferred && !welcomed) previous?.close(); this.schedule(); });
  }
  schedule() { if(this.stopped) return; this.onStatus('RECONNECTING'); clearTimeout(this.retry); this.retry=setTimeout(()=>this.connect(WS_URL,false),this.delay); this.delay=Math.min(this.delay*2,30000); }
}
