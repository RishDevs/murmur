import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Flock } from './flock.js';

function maskContext() {
  const pixels = new Uint8ClampedArray(1000 * 240 * 4);
  for (let y = 40; y < 200; y += 4) {
    for (let x = 100; x < 900; x += 4) pixels[(y * 1000 + x) * 4 + 3] = 255;
  }
  return { measureText: () => ({ width: 500 }), fillText() {}, getImageData: () => ({ data: pixels }) };
}

test('the configured round keeps 60 birds per voter as the audience grows', () => {
  globalThis.document = { createElement: () => ({ getContext: maskContext }) };
  try {
    const flock = new Flock({ fixedBirds: 'round', migrationDuration: 2600 });
    const position = { x: 960, y: 400, width: 1000, height: 200 };
    const positions = new Map([['horse', position]]);
    const group = { answer: 'horse', count: 1, voters: [{ id: 'one' }] };
    flock.updateState({ groups: [group] }, null, positions, positions, 0, false);
    assert.equal(flock.birds.size, 60);
    group.voters.push({ id: 'two' }, { id: 'three' }, { id: 'four' });
    group.count = 4;
    flock.updateState({ groups: [group] }, null, positions, positions, 100, false);
    assert.equal(flock.birds.size, 240);
    assert.equal([...flock.birds.values()].filter(bird => bird.userId === 'one').length, 60);
  } finally {
    delete globalThis.document;
  }
});
