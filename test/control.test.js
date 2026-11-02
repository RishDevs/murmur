import { test } from 'node:test';
import assert from 'node:assert/strict';

test('control displays the channel and keeps the question through reset and shortcuts', async () => {
  const original = { document: globalThis.document, EventSource: globalThis.EventSource, fetch: globalThis.fetch };
  const elements = new Map();
  const handlers = new Map();
  const calls = [];
  let stream;
  function element() {
    return {
      value: '', textContent: '', hidden: false, disabled: false, dataset: {},
      addEventListener(type, callback) { this[type] = callback; },
      click() { if (!this.disabled) this.onclick?.(); },
      replaceChildren() {}, append() {},
    };
  }
  globalThis.document = {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, element());
      return elements.get(selector);
    },
    createElement: element,
    addEventListener(type, callback) { handlers.set(type, callback); },
  };
  globalThis.EventSource = class {
    constructor() { stream = this; }
  };
  globalThis.fetch = async (url, options) => { calls.push({ url, body: JSON.parse(options.body) }); };
  try {
    await import('../public/control.js');
    const question = elements.get('#question');
    const start = elements.get('#start');
    assert.equal(start.disabled, true);
    question.value = 'Name my horse?';
    question.input();
    assert.equal(start.disabled, false);
    const key = character => handlers.get('keydown')({ key: character, target: { tagName: 'BODY' }, preventDefault() {} });
    key('s');
    key('p');
    key('r');
    assert.deepEqual(calls.map(call => call.url), ['/api/start', '/api/pause', '/api/reset']);
    assert.equal(calls[0].body.question, 'Name my horse?');
    stream.onmessage({ data: JSON.stringify({ state: {
      status: 'LIVE', channel: 'streamer_login', demo: false, phase: 'idle', question: '', groups: [],
    } }) });
    assert.equal(elements.get('#channel').textContent, '@streamer_login');
    assert.equal(elements.get('#status').textContent, 'LIVE');
    assert.equal(question.value, 'Name my horse?');
    key('s');
    assert.equal(calls.at(-1).body.question, 'Name my horse?');
    stream.onerror();
    assert.equal(elements.get('#status').textContent, 'RECONNECTING');
  } finally {
    Object.assign(globalThis, original);
  }
});
