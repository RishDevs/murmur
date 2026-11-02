import {
  readFile,
  writeFile,
  mkdir
} from 'node:fs/promises';
const base = 'https://id.twitch.tv/oauth2';
const tokenPath = '.murmur/token.json';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
export class Auth {
  constructor(clientId, onStatus) {
    this.clientId = clientId;
    this.onStatus = onStatus;
  }
  async save() {
    await mkdir('.murmur', {
      recursive: true,
      mode: 448
    });
    await writeFile(tokenPath, JSON.stringify(this.token), { mode: 384 });
  }
  async validate() {
    const res = await fetch(`${ base }/validate`, { headers: { Authorization: `OAuth ${ this.token.access_token }` } });
    if (!res.ok)
      return false;
    const user = await res.json();
    if (user.client_id !== this.clientId || !user.user_id || !user.scopes?.includes('user:read:chat'))
      return false;
    this.user = user;
    return true;
  }
  async refresh() {
    if (!this.token?.refresh_token)
      throw new Error('sign in again');
    const res = await fetch(`${ base }/token`, {
      method: 'POST',
      body: new URLSearchParams({
        client_id: this.clientId,
        grant_type: 'refresh_token',
        refresh_token: this.token.refresh_token
      })
    });
    if (!res.ok)
      throw new Error('sign in again');
    this.token = await res.json();
    await this.save();
    if (!await this.validate())
      throw new Error('sign in again');
  }
  async load() {
    try {
      this.token = JSON.parse(await readFile(tokenPath, 'utf8'));
      if (await this.validate())
        return true;
      await this.refresh();
      return true;
    } catch {
      this.token = null;
      return false;
    }
  }
  async login() {
    if (!this.clientId)
      throw new Error('Set MURMUR_TWITCH_CLIENT_ID first');
    const res = await fetch(`${ base }/device`, {
      method: 'POST',
      body: new URLSearchParams({
        client_id: this.clientId,
        scopes: 'user:read:chat'
      })
    });
    if (!res.ok)
      throw new Error('Unable to begin Twitch login');
    const device = await res.json();
    this.onStatus({
      url: device.verification_uri,
      code: device.user_code
    });
    let interval = (device.interval || 5) * 1000;
    const end = Date.now() + device.expires_in * 1000;
    while (Date.now() < end) {
      await wait(interval);
      const poll = await fetch(`${ base }/token`, {
        method: 'POST',
        body: new URLSearchParams({
          client_id: this.clientId,
          device_code: device.device_code,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          scopes: 'user:read:chat'
        })
      });
      const body = await poll.json();
      if (poll.ok) {
        this.token = body;
        if (!await this.validate())
          throw new Error('Twitch token validation failed');
        await this.save();
        this.onStatus(null);
        return;
      }
      if (body.message?.includes('slow_down') || body.error === 'slow_down')
        interval += 5000;
      else if (!String(body.message || body.error || '').toLowerCase().includes('pending'))
        throw new Error('Twitch login expired or was denied');
    }
    throw new Error('Twitch login expired');
  }
  async subscribe(type, sessionId) {
    const request = () => fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
      method: 'POST',
      headers: {
        'Client-Id': this.clientId,
        Authorization: `Bearer ${ this.token.access_token }`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type,
        version: '1',
        condition: {
          broadcaster_user_id: this.user.user_id,
          user_id: this.user.user_id
        },
        transport: {
          method: 'websocket',
          session_id: sessionId
        }
      })
    });
    let res = await request();
    if (res.status === 401) {
      this.refreshing ||= this.refresh().finally(() => {
        this.refreshing = null;
      });
      await this.refreshing;
      res = await request();
      if (res.status === 401)
        throw new Error('sign in again');
    }
    if (!res.ok && res.status !== 409)
      throw new Error('Subscription failed');
  }
}
