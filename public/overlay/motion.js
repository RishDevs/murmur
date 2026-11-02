export const MIGRATION_DURATION = 1600;
export const REDUCED_MIGRATION_DURATION = 350;
export const RESTAGE_DURATION = 600;
const MAX_STAGGER = 250;

export function migrationPoint(start, end, elapsed, stagger, lift, offset = 0) {
  const delay = Math.max(0, Math.min(MAX_STAGGER, stagger));
  const duration = MIGRATION_DURATION - MAX_STAGGER;
  const progress = Math.max(0, Math.min(1, (elapsed - delay) / duration));
  const t = progress * progress * (3 - 2 * progress);
  const control = {
    x: (start.x + end.x) / 2 + offset,
    y: (start.y + end.y) / 2 - Math.max(180, Math.min(260, lift)),
  };
  const inverse = 1 - t;
  return {
    x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
    y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
    progress,
  };
}

export function heldState(previous, target) {
  const priorAnswers = new Set(previous.groups.map(group => group.answer));
  const groups = [...previous.groups];
  for (const group of target.groups) {
    if (!priorAnswers.has(group.answer)) groups.push(group);
  }
  return { ...target, groups };
}

export function transitionFrame(transition, now) {
  const elapsed = now - transition.start;
  if (elapsed < transition.hold) {
    return { state: transition.held, previous: transition.held, progress: 1, complete: false };
  }
  const linear = Math.max(0, Math.min(1, (elapsed - transition.hold) / RESTAGE_DURATION));
  const progress = transition.reduced ? linear : linear * linear * (3 - 2 * linear);
  return { state: transition.target, previous: transition.held, progress, complete: linear >= 1 };
}

export function createTransition(previous, target, now, migration, reduced) {
  const hold = migration ? (reduced ? REDUCED_MIGRATION_DURATION : MIGRATION_DURATION) : 0;
  return { held: migration ? heldState(previous, target) : previous, target, start: now, hold, reduced };
}
