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

test('hero flight bursts upward before its arc and lands at 2.6 seconds', async () => {
  const { HERO_MIGRATION_DURATION } = await import('./motion.js');
  const start = { x: 100, y: 500 };
  const end = { x: 900, y: 700 };
  const burst = migrationPoint(start, end, 300, 200, 220, 10, HERO_MIGRATION_DURATION);
  assert.equal(burst.x, start.x);
  assert.equal(burst.y, start.y - 85);
  assert.deepEqual(migrationPoint(start, end, 2600, 250, 220, 10, HERO_MIGRATION_DURATION), { ...end, progress: 1 });
});

test('flight labels show current counts and fade an empty source', async () => {
  const { HERO_MIGRATION_DURATION } = await import('./motion.js');
  const previous = { groups: [{ answer: 'biscuit', count: 1 }] };
  const target = { groups: [{ answer: 'horse', count: 1 }] };
  const transition = createTransition(previous, target, 100, { from: 'biscuit', to: 'horse' }, false, HERO_MIGRATION_DURATION);
  const atStart = transitionFrame(transition, 100).state.groups;
  assert.equal(atStart[0].count, 0);
  assert.equal(atStart[0].opacity, 0.45);
  assert.equal(atStart[1].count, 1);
  assert.equal(transitionFrame(transition, 400).state.groups[0].opacity, 0);
  assert.equal(transitionFrame(transition, 2699).state.groups[0].answer, 'biscuit');
  assert.equal(transitionFrame(transition, 2700).state.groups[0].answer, 'horse');
});

test('nonempty departing label is dimmed with its updated count', () => {
  const previous = { groups: [{ answer: 'biscuit', count: 2 }, { answer: 'horse', count: 1 }] };
  const target = { groups: [{ answer: 'horse', count: 2 }, { answer: 'biscuit', count: 1 }] };
  const transition = createTransition(previous, target, 0, { from: 'biscuit', to: 'horse' }, false, 2600);
  const groups = transitionFrame(transition, 200).state.groups;
  assert.equal(groups[0].count, 1);
  assert.equal(groups[0].opacity, 0.45);
  assert.equal(groups[1].count, 2);
});
