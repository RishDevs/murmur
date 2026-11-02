import { test } from 'node:test';
import assert from 'node:assert/strict';
import { birdsPerVoter, Flock, sampleLetterforms } from '../public/overlay/flock.js';
import { drawChrome, layoutGroups } from '../public/overlay/scene.js';

function mockMask() {
  const pixels = new Uint8ClampedArray(1000 * 240 * 4);
  for (let y = 40; y < 200; y += 4) {
    for (let x = 100; x < 900; x += 4) pixels[(y * 1000 + x) * 4 + 3] = 255;
  }
  return {
    measureText: () => ({ width: 500 }),
    fillText() {},
    getImageData: () => ({ data: pixels }),
  };
}

function mockDrawingContext() {
  const labels = [];
  const context = {
    labels,
    save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    fill() {}, arc() {}, fillRect() {}, strokeRect() {}, translate() {}, rotate() {},
    measureText: text => ({ width: text.length * 12 }),
    fillText: (text, x, y) => labels.push({ text, x, y }),
  };
  return context;
}

test('letterform samples and voter allocation stay bounded', () => {
  assert.equal(birdsPerVoter(2), 36);
  assert.equal(birdsPerVoter(30), 36);
  assert.equal(birdsPerVoter(60), 18);
  globalThis.document = { createElement: () => ({ getContext: mockMask }) };
  try {
    const points = sampleLetterforms('horse', 36);
    assert.equal(points.length, 36);
    assert.ok(new Set(points.map(point => point.x)).size > 10);
    assert.ok(new Set(points.map(point => point.y)).size > 10);
  } finally {
    delete globalThis.document;
  }
});

test('migration keeps voter birds and carries them toward their new roost', () => {
  globalThis.document = { createElement: () => ({ getContext: mockMask }) };
  try {
    const first = { groups: [{ answer: 'horse', count: 1, voters: [{ id: 'a' }] }] };
    const second = { groups: [{ answer: 'biscuit', count: 1, voters: [{ id: 'a' }] }] };
    const flock = new Flock();
    flock.updateState(first, null, new Map(), layoutGroups(first.groups), 0, false);
    assert.equal(flock.birds.size, 36);
    const originalBirds = [...flock.birds.values()];
    flock.updateState(second, { type: 'migrate', userId: 'a', name: 'Avery', from: 'horse', to: 'biscuit' }, layoutGroups(first.groups), layoutGroups(second.groups), 10, false);
    assert.deepEqual([...flock.birds.values()], originalBirds);
    const context = mockDrawingContext();
    flock.draw(context, layoutGroups(second.groups), 810, false);
    assert.ok(context.labels.some(label => label.text === 'Avery changed their mind'));
    assert.ok(originalBirds.some(bird => bird.y < 300));
    flock.update(layoutGroups(second.groups), 1611, false);
    flock.draw(context, layoutGroups(second.groups), 1611, false);
    assert.equal(flock.migrations.size, 0);
  } finally {
    delete globalThis.document;
  }
});

test('status and disclaimer occupy separate horizontal regions', () => {
  const context = mockDrawingContext();
  drawChrome(context, { groups: [], phase: 'open', status: 'RECONNECTING', demo: false });
  const status = context.labels.find(label => label.text === 'RECONNECTING');
  const disclaimer = context.labels.find(label => label.text.startsWith('Chat’s opinion'));
  assert.ok(status.x < disclaimer.x - disclaimer.text.length * 12);
});
