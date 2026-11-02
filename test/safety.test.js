import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  initialRound,
  reduceRound
} from '../src/round.js';
test('HTML-like chat stays inert and views avoid HTML injection', async () => {
  let s = reduceRound(initialRound(), {
    type: 'start',
    question: 'Q'
  }).state;
  s = reduceRound(s, {
    type: 'vote',
    userId: 'a',
    text: '<img onerror>',
    at: 0
  }).state;
  assert.equal(s.votes.a.answer, 'img onerror');
  for (const file of [
      '../public/control.js',
      '../public/overlay/main.js',
      '../public/overlay/flock.js',
      '../public/overlay/scene.js'
    ])
    assert.doesNotMatch(await readFile(new URL(file, import.meta.url), 'utf8'), /innerHTML|eval\s*\(/);
});
