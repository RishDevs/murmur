import { test } from 'node:test';
import assert from 'node:assert/strict';
import { birdAppearance } from '../public/overlay/contrast.js';

test('birds use the higher contrast colour for the sky behind them', () => {
  assert.deepEqual(birdAppearance(0), { color: '#E9DCCB', opacity: 0.85 });
  assert.deepEqual(birdAppearance(400), { color: '#E9DCCB', opacity: 0.85 });
  assert.deepEqual(birdAppearance(950), { color: '#0E0F14', opacity: 1 });
  assert.deepEqual(birdAppearance(1040), { color: '#E9DCCB', opacity: 0.85 });
});
