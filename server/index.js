import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { initialRound, reduceRound, snapshot } from '../src/round.js';
import { Auth } from './auth.js';
import { EventSub } from './eventsub.js';
const demo=process.argv.includes('--demo');
// A simple .env reader for the documented local configuration.
try { for (const line of (await readFile('.env','utf8')).split(/\r?\n/)) { const m=line.match(/^\s*([A-Z_][A-Z_0-9]*)\s*=\s*(.*?)\s*$/); if(m && process.env[m[1]]===undefined) process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,''); } } catch {}
let round=initialRound(), status=demo?'SIMULATED':'OFFLINE', loginInfo=null, loginError='', connector, loginBusy=false;
const clients=new Set();
const view=()=>({ ...snapshot(round),status,demo,login:loginInfo,loginError });
function broadcast(event=null) { const data=JSON.stringify({state:view(),event}); for(const res of clients) res.write(`data: ${data}\n\n`); }
function act(action) { const result=reduceRound(round,action); round=result.state; broadcast(result.event); }
const auth=new Auth(process.env.MURMUR_TWITCH_CLIENT_ID,info=>{loginInfo=info; broadcast();});
function connect() { connector?.stop(); connector=new EventSub(auth,act,s=>{status=s; broadcast();}); connector.start(); }
async function login() { if(loginBusy || demo) return; loginBusy=true; loginError=''; try { await auth.login(); connect(); } catch(e) { loginInfo=null; loginError=e.message; status='OFFLINE'; broadcast(); } finally { loginBusy=false; } }
if (!demo && auth.clientId) auth.load().then(ok=>{if(ok) connect();}).catch(()=>{});
const publicDir=resolve('public');
const server=http.createServer(async (req,res)=>{
  const url=new URL(req.url,'http://localhost');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method==='GET' && url.pathname==='/events') { res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'}); clients.add(res); res.write(`data: ${JSON.stringify({state:view(),event:null})}\n\n`); req.on('close',()=>clients.delete(res)); return; }
  if(req.method==='POST' && url.pathname.startsWith('/api/')) {
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) { res.writeHead(403).end(); return; }
    let raw=''; try { for await (const chunk of req) { raw+=chunk; if(raw.length>4096) throw Error(); } } catch {res.writeHead(413).end();return;}
    let body={}; try { if(raw) body=JSON.parse(raw); } catch {res.writeHead(400).end();return;}
    const action=url.pathname.slice(5);
    if(action==='login') void login();
    else if(['start','pause','clear','reset','hide'].includes(action)) act({type:action,question:body.question,answer:body.answer});
    else {res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({ok:true})); return;
  }
  if(req.method!=='GET') {res.writeHead(405).end();return;}
  const file= url.pathname==='/' || url.pathname==='/control' ? 'control.html' : url.pathname==='/overlay' ? 'overlay.html' : url.pathname.slice(1);
  const path=resolve(publicDir,file); if(!path.startsWith(publicDir+'/')) {res.writeHead(403).end();return;}
  try { const content=await readFile(path); res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'})[extname(path)] || 'application/octet-stream','Cache-Control':'no-store'}).end(content); } catch {res.writeHead(404).end();}
});
server.listen(Number(process.env.PORT)||4747,'127.0.0.1',()=>console.log(`Murmur ${demo?'SIMULATED':'ready'}: http://localhost:${Number(process.env.PORT)||4747}/control`));
if(demo) {
  const people=[['sim-a','Avery','sir neighs'],['sim-b','Blair','sir neighs'],['sim-c','Casey','biscuit']]; let step=0;
  setInterval(()=>{ if(round.phase!=='open') return; const p=people[step%people.length]; const answer=step<3?p[2]:(Math.floor((step-3)/3)%2===0 ? (p[0]==='sim-a'?'biscuit':p[2]) : p[2]); act({type:'vote',userId:p[0],name:p[1],text:answer,messageId:`sim-${step}`,at:Date.now()}); step++; },2200);
}
