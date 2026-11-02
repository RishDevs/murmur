export const MIGRATION_DURATION = 1600;
export const HERO_MIGRATION_DURATION = 2600;
export const REDUCED_MIGRATION_DURATION = 350;
export const RESTAGE_DURATION = 600;
const MAX_STAGGER = 250;

export function migrationPoint(start, end, elapsed, stagger, lift, offset = 0, totalDuration = MIGRATION_DURATION) {
  const burstDuration = totalDuration > MIGRATION_DURATION ? 300 : 0;
  const burstProgress = Math.max(0, Math.min(1, elapsed / (burstDuration || 1)));
  const burstEase = burstProgress * burstProgress * (3 - 2 * burstProgress);
  if (burstDuration && elapsed < burstDuration) {
    return { x: start.x, y: start.y - 85 * burstEase, progress: burstProgress * 0.1 };
  }
  const arcStart = { x: start.x, y: start.y - (burstDuration ? 85 : 0) };
  const delay = Math.max(0, Math.min(MAX_STAGGER, stagger));
  const duration = totalDuration - burstDuration - MAX_STAGGER;
  const progress = Math.max(0, Math.min(1, (elapsed - burstDuration - delay) / duration));
  const t = progress * progress * (3 - 2 * progress);
  const control = {
    x: (arcStart.x + end.x) / 2 + offset,
    y: (arcStart.y + end.y) / 2 - Math.max(180, Math.min(260, lift)),
  };
  const inverse = 1 - t;
  return {
    x: inverse * inverse * arcStart.x + 2 * inverse * t * control.x + t * t * end.x,
    y: inverse * inverse * arcStart.y + 2 * inverse * t * control.y + t * t * end.y,
    progress,
  };
}

export function heldState(previous, target, migration = null) {
  const priorAnswers = new Set(previous.groups.map(group => group.answer));
  const current = new Map(target.groups.map(group => [group.answer, group]));
  const groups = previous.groups.map(group => {
    const latest = current.get(group.answer);
    const count = latest?.count ?? 0;
    return {
      ...(latest || group),
      count,
      ...(migration?.from === group.answer ? { departing: true } : {}),
    };
  });
  for (const group of target.groups) {
    if (!priorAnswers.has(group.answer)) groups.push(group);
  }
  return { ...target, groups };
}

export function transitionFrame(transition, now) {
  const elapsed = now - transition.start;
  if (elapsed < transition.hold) {
    const groups = transition.held.groups.map(group => group.departing
      ? { ...group, opacity: group.count ? 0.45 : 0.45 * Math.max(0, 1 - elapsed / 300) }
      : group);
    const state = { ...transition.held, groups };
    return { state, previous: state, progress: 1, complete: false };
  }
  const linear = Math.max(0, Math.min(1, (elapsed - transition.hold) / RESTAGE_DURATION));
  const progress = transition.reduced ? linear : linear * linear * (3 - 2 * linear);
  const groups = transition.held.groups.map(group => group.departing
    ? { ...group, opacity: group.count ? 0.45 : 0 }
    : group);
  return { state: transition.target, previous: { ...transition.held, groups }, progress, complete: linear >= 1 };
}

export function createTransition(previous, target, now, migration, reduced, duration = MIGRATION_DURATION) {
  const hold = migration ? (reduced ? REDUCED_MIGRATION_DURATION : duration) : 0;
  return { held: migration ? heldState(previous, target, migration) : previous, target, start: now, hold, reduced };
}
