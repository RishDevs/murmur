import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTransition, migrationPoint, transitionFrame } from './motion.js';

test('staggered quadratic paths rise above their chord and land at their own targets', () => {
  const start = { x: 100, y: 500 };
  const end = { x: 900, y: 700 };
  assert.deepEqual(migrationPoint(start, end, 0, 250, 220, 20), { ...start, progress: 0 });
  const midpoint = migrationPoint(start, end, 925, 250, 220, 20);
  assert.ok(midpoint.y < 600);
  assert.ok(midpoint.x > 500);
  assert.deepEqual(migrationPoint(start, end, 1600, 250, 220, 20), { ...end, progress: 1 });
  assert.notDeepEqual(migrationPoint(start, end, 800, 0, 180, -30), migrationPoint(start, end, 800, 250, 260, 30));
});

test('leader layout remains held until landing before a 600 ms restage', () => {
  const previous = { groups: [{ answer: 'horse', count: 2 }, { answer: 'biscuit', count: 1 }] };
  const target = { groups: [{ answer: 'biscuit', count: 2 }, { answer: 'horse', count: 1 }] };
  const transition = createTransition(previous, target, 100, true, false);
  assert.equal(transitionFrame(transition, 1699).state.groups[0].answer, 'horse');
  const landing = transitionFrame(transition, 1700);
  assert.equal(landing.previous.groups[0].answer, 'horse');
  assert.equal(landing.state.groups[0].answer, 'biscuit');
  assert.equal(landing.progress, 0);
  assert.equal(transitionFrame(transition, 2000).progress, 0.5);
  assert.equal(transitionFrame(transition, 2300).complete, true);
  const reduced = createTransition(previous, target, 100, true, true);
  assert.equal(transitionFrame(reduced, 449).state.groups[0].answer, 'horse');
  assert.equal(transitionFrame(reduced, 450).progress, 0);
});
