import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseEventSub } from '../server/eventsub.js';
import {
  initialRound,
  reduceRound
} from '../src/round.js';
test('fixture notifications drive votes and Twitch moderation', async () => {
  const chat = JSON.parse(await readFile(new URL('./fixtures/chat.json', import.meta.url)));
  const mods = JSON.parse(await readFile(new URL('./fixtures/moderation.json', import.meta.url)));
  let s = reduceRound(initialRound(), {
    type: 'start',
    question: 'Q'
  }).state;
  const action = parseEventSub(chat);
  assert.deepEqual(action, {
    type: 'vote',
    userId: 'u1',
    name: 'Avery',
    messageId: 'm1',
    text: 'Sir Neighs!'
  });
  let at = 10000;
  for (const mod of mods) {
    s = reduceRound(s, {
      ...action,
      at: at += 3000
    }).state;
    assert.ok(s.votes.u1);
    s = reduceRound(s, parseEventSub(mod)).state;
    assert.equal(s.votes.u1, undefined);
  }
  assert.equal(parseEventSub({ metadata: { message_type: 'session_keepalive' } }), null);
});
test('EventSub subscribes, transfers the session and handles revocation', async () => {
  const {EventSub} = await import('../server/eventsub.js');
  const original = globalThis.WebSocket, sockets = [];
  class FakeSocket extends EventTarget {
    constructor(url) {
      super();
      this.url = url;
      this.closed = false;
      sockets.push(this);
    }
    sendMessage(message) {
      this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }));
    }
    close() {
      if (!this.closed) {
        this.closed = true;
        this.dispatchEvent(new Event('close'));
      }
    }
  }
  globalThis.WebSocket = FakeSocket;
  const statuses = [], actions = [], subscriptions = [];
  const client = new EventSub({
    subscribe: async (type, id) => subscriptions.push([
      type,
      id
    ])
  }, action => actions.push(action), status => statuses.push(status));
  try {
    client.start();
    const welcome = id => ({
      metadata: { message_type: 'session_welcome' },
      payload: {
        session: {
          id,
          keepalive_timeout_seconds: 60
        }
      }
    });
    sockets[0].sendMessage(welcome('first'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(subscriptions.length, 4);
    assert.equal(statuses.at(-1), 'LIVE');
    sockets[0].sendMessage({
      metadata: { message_type: 'session_reconnect' },
      payload: { session: { reconnect_url: 'wss://eventsub.wss.twitch.tv/reconnect' } }
    });
    assert.equal(sockets[0].closed, false);
    const chat = JSON.parse(await readFile(new URL('./fixtures/chat.json', import.meta.url)));
    sockets[0].sendMessage(chat);
    assert.equal(actions.length, 1);
    sockets[1].sendMessage(welcome('second'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(sockets[0].closed, true);
    assert.equal(subscriptions.length, 4);
    assert.equal(statuses.at(-1), 'LIVE');
    sockets[1].sendMessage({
      metadata: { message_type: 'revocation' },
      payload: {}
    });
    assert.equal(statuses.at(-1), 'SIGN IN AGAIN');
    assert.equal(sockets[1].closed, true);
  } finally {
    client.stop();
    globalThis.WebSocket = original;
  }
});

test('emote-only message is counted and paused chat is ignored', () => {
  const payload = {
    metadata: { message_type: 'notification' },
    payload: { subscription: { type: 'channel.chat.message' }, event: {
      chatter_user_id: 'u1', chatter_user_name: 'Viewer', message_id: 'm1',
      message: { text: 'Kappa', fragments: [{ type: 'emote', text: 'Kappa' }] },
    } },
  };
  let round = reduceRound(initialRound(), { type: 'start', question: 'Pick one' }).state;
  round = reduceRound(round, { ...parseEventSub(payload), at: 1000 }).state;
  assert.equal(round.votes.u1.answer, 'kappa');
  round = reduceRound(round, { type: 'pause' }).state;
  round = reduceRound(round, { ...parseEventSub(payload), text: 'another', at: 5000 }).state;
  assert.equal(round.votes.u1.answer, 'kappa');
});

test('socket close reconnects and preserves the active round', async () => {
  const { EventSub } = await import('../server/eventsub.js');
  const original = globalThis.WebSocket;
  const sockets = [];
  class FakeSocket extends EventTarget {
    constructor() { super(); sockets.push(this); }
    send(message) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) })); }
    close() { this.dispatchEvent(new Event('close')); }
  }
  globalThis.WebSocket = FakeSocket;
  let round = reduceRound(initialRound(), { type: 'start', question: 'Pick one' }).state;
  const statuses = [];
  const subscriptions = [];
  const client = new EventSub({ subscribe: async (type, id) => subscriptions.push([type, id]) }, action => {
    round = reduceRound(round, action).state;
  }, status => statuses.push(status));
  const welcome = id => ({ metadata: { message_type: 'session_welcome' }, payload: { session: { id, keepalive_timeout_seconds: 60 } } });
  try {
    client.start();
    sockets[0].send(welcome('first'));
    await new Promise(resolve => setImmediate(resolve));
    const chat = JSON.parse(await readFile(new URL('./fixtures/chat.json', import.meta.url)));
    sockets[0].send(chat);
    const before = structuredClone(round);
    assert.equal(before.votes.u1.answer, 'sir neighs');
    client.delay = 1;
    sockets[0].close();
    assert.equal(statuses.at(-1), 'RECONNECTING');
    await new Promise(resolve => setTimeout(resolve, 15));
    assert.equal(sockets.length, 2);
    sockets[1].send(welcome('second'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(statuses.at(-1), 'LIVE');
    assert.deepEqual(round, before);
    assert.equal(subscriptions.length, 8);
  } finally {
    client.stop();
    globalThis.WebSocket = original;
  }
});
