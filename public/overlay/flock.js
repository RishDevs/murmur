import { birdAppearance } from './contrast.js';
import { migrationPoint, MIGRATION_DURATION, REDUCED_MIGRATION_DURATION } from './motion.js';

const MAX_BIRDS = 1080;
const BIRDS_PER_VOTER = 36;
const NEIGHBOR_RADIUS = 48;

function hash(value) {
  let result = 2166136261;
  for (const character of value) {
    result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  }
  return result >>> 0;
}

function random(seed, index) {
  return (hash(`${seed}:${index}`) % 10000) / 10000;
}

export function birdsPerVoter(voterCount) {
  return Math.min(BIRDS_PER_VOTER, Math.max(1, Math.floor(MAX_BIRDS / Math.max(1, voterCount))));
}

// Sample ink from a word mask; normalized coordinates make layout changes cheap.
export function sampleLetterforms(answer, count) {
  const mask = document.createElement('canvas');
  mask.width = 1000;
  mask.height = 240;
  const context = mask.getContext('2d', { willReadFrequently: true });
  const word = answer.toLocaleUpperCase();
  let fontSize = 200;
  context.font = `bold ${fontSize}px Georgia`;
  while (context.measureText(word).width > 960 && fontSize > 30) {
    fontSize -= 4;
    context.font = `bold ${fontSize}px Georgia`;
  }
  context.fillStyle = '#fff';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(word, 500, 120);
  const pixels = context.getImageData(0, 0, mask.width, mask.height).data;
  const points = [];
  for (let y = 0; y < mask.height; y += 4) {
    for (let x = 0; x < mask.width; x += 4) {
      if (pixels[(y * mask.width + x) * 4 + 3] > 128) {
        points.push({ x: (x - 500) / 1000, y: (y - 120) / 240 });
      }
    }
  }
  if (!points.length) return Array.from({ length: count }, () => ({ x: 0, y: 0 }));
  // Stratify samples, then shuffle them so each voter spans the whole word.
  const selected = [];
  for (let index = 0; index < count; index++) {
    const offset = Math.floor((index + random(answer, index)) * points.length / count);
    const point = points[Math.min(points.length - 1, offset)];
    selected.push({
      x: point.x + (random(answer, index + 100) - 0.5) * 0.024,
      y: point.y + (random(answer, index + 200) - 0.5) * 0.08,
    });
  }
  for (let index = selected.length - 1; index > 0; index--) {
    const swap = Math.floor(random(answer, index + 300) * (index + 1));
    [selected[index], selected[swap]] = [selected[swap], selected[index]];
  }
  return selected;
}

function worldTarget(point, position) {
  return { x: position.x + point.x * position.width, y: position.y + point.y * position.height };
}

export function drawBird(context, bird, now, opacity = 1, reducedMotion = false) {
  const flap = reducedMotion ? 0.7 : 0.65 + Math.sin(now / 130 + bird.phase) * 0.3;
  const span = bird.size / 2;
  const heading = Math.hypot(bird.vx || 0, bird.vy || 0) > 0.05
    ? Math.atan2(bird.vy, bird.vx)
    : 0;
  const appearance = birdAppearance(bird.y);
  context.save();
  context.globalAlpha *= opacity * appearance.opacity;
  context.fillStyle = appearance.color;
  context.translate(bird.x, bird.y);
  context.rotate(heading);
  context.beginPath();
  context.moveTo(span * 0.8, 0);
  context.lineTo(span * 0.05, -span * 0.23);
  context.lineTo(-span * 0.35, -span * flap);
  context.lineTo(-span * 0.52, -span * flap * 0.92);
  context.lineTo(-span * 0.3, -span * 0.16);
  context.lineTo(-span * 0.9, 0);
  context.lineTo(-span * 0.3, span * 0.16);
  context.lineTo(-span * 0.52, span * flap * 0.92);
  context.lineTo(-span * 0.35, span * flap);
  context.lineTo(span * 0.05, span * 0.23);
  context.fill();
  context.restore();
}

export class Flock {
  constructor({ fixedBirds = null, migrationDuration = MIGRATION_DURATION } = {}) {
    this.fixedBirds = fixedBirds;
    this.migrationDuration = migrationDuration;
    this.roundBirds = null;
    this.roundQuestion = null;
    this.captions = [];
    this.birds = new Map();
    this.migrations = new Map();
    this.masks = new Map();
    this.lastFrame = null;
  }

  updateState(state, event, oldPositions, newPositions, now, reducedMotion) {
    const total = state.groups.reduce((sum, group) => sum + group.count, 0);
    if (state.phase === 'idle' || (state.question !== undefined && state.question !== this.roundQuestion)) {
      this.roundBirds = null;
      this.roundQuestion = state.question;
    }
    if (this.fixedBirds === 'round' && this.roundBirds === null && total > 0) {
      this.roundBirds = total <= 3 ? 60 : birdsPerVoter(total);
    }
    const perVoter = this.fixedBirds === 'round'
      ? this.roundBirds ?? 60
      : this.fixedBirds ?? birdsPerVoter(total);
    const active = new Set();
    if (state.phase === 'idle') this.captions = [];
    for (const group of state.groups.slice(0, 5)) {
      const position = newPositions.get(group.answer);
      const count = group.voters.length * perVoter;
      const maskKey = `${group.answer}:${count}`;
      if (!this.masks.has(maskKey)) this.masks.set(maskKey, sampleLetterforms(group.answer, count));
      const points = this.masks.get(maskKey);
      group.voters.forEach((voter, voterIndex) => {
        for (let index = 0; index < perVoter; index++) {
          const id = `${voter.id}:${index}`;
          active.add(id);
          let bird = this.birds.get(id);
          if (!bird) {
            const target = worldTarget(points[voterIndex * perVoter + index], position);
            bird = { id, userId: voter.id, x: target.x, y: target.y, vx: 0, vy: 0,
              size: 12 + random(id, 1) * 4, phase: random(id, 2) * Math.PI * 2 };
            this.birds.set(id, bird);
          }
          bird.answer = group.answer;
          bird.point = points[voterIndex * perVoter + index];
        }
      });
    }
    for (const id of this.birds.keys()) {
      if (!active.has(id)) this.birds.delete(id);
    }
    if (event?.type === 'migrate') {
      const moving = [...this.birds.values()].filter(bird => bird.userId === event.userId);
      const destination = newPositions.get(event.to);
      const origin = oldPositions.get(event.from) || destination;
      if (moving.length && destination && origin) {
        this.captions.push({ name: event.name, start: now });
        this.migrations.set(event.userId, {
          ...event, start: now, origin, destination, reducedMotion,
          starts: new Map(moving.map(bird => [bird.id, { x: bird.x, y: bird.y }])),
        });
      }
    }
    if (this.masks.size > 100) this.masks.clear();
  }

  update(positions, now, reducedMotion) {
    const dt = Math.min(2, Math.max(0.2, (now - (this.lastFrame ?? now - 16.7)) / 16.7));
    this.lastFrame = now;
    const grid = new Map();
    for (const bird of this.birds.values()) {
      const key = `${bird.answer}:${Math.floor(bird.x / NEIGHBOR_RADIUS)}:${Math.floor(bird.y / NEIGHBOR_RADIUS)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(bird);
    }
    for (const bird of this.birds.values()) {
      const position = positions.get(bird.answer);
      if (!position) continue;
      const migration = this.migrations.get(bird.userId);
      if (migration && now - migration.start < (migration.reducedMotion ? REDUCED_MIGRATION_DURATION : this.migrationDuration)) continue;
      const target = worldTarget(bird.point, position);
      if (!reducedMotion) {
        const wheel = now / 1800 + bird.phase;
        target.x += Math.cos(wheel) * 5;
        target.y += Math.sin(wheel) * 4;
      }
      if (reducedMotion) {
        bird.x = target.x;
        bird.y = target.y;
        continue;
      }
      let separationX = 0;
      let separationY = 0;
      let velocityX = 0;
      let velocityY = 0;
      let centerX = 0;
      let centerY = 0;
      let neighbors = 0;
      const cellX = Math.floor(bird.x / NEIGHBOR_RADIUS);
      const cellY = Math.floor(bird.y / NEIGHBOR_RADIUS);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const nearby = grid.get(`${bird.answer}:${cellX + dx}:${cellY + dy}`) || [];
          for (const other of nearby) {
            if (other === bird) continue;
            const x = bird.x - other.x;
            const y = bird.y - other.y;
            const distance = Math.hypot(x, y);
            if (distance >= NEIGHBOR_RADIUS) continue;
            if (distance > 0 && distance < 12) {
              separationX += x / distance;
              separationY += y / distance;
            }
            velocityX += other.vx;
            velocityY += other.vy;
            centerX += other.x;
            centerY += other.y;
            neighbors++;
          }
        }
      }
      const alignmentX = neighbors ? velocityX / neighbors - bird.vx : 0;
      const alignmentY = neighbors ? velocityY / neighbors - bird.vy : 0;
      const cohesionX = neighbors ? centerX / neighbors - bird.x : 0;
      const cohesionY = neighbors ? centerY / neighbors - bird.y : 0;
      bird.vx += ((target.x - bird.x) * 0.018 + separationX * 0.09 + alignmentX * 0.025 + cohesionX * 0.001) * dt;
      bird.vy += ((target.y - bird.y) * 0.018 + separationY * 0.09 + alignmentY * 0.025 + cohesionY * 0.001) * dt;
      bird.vx *= Math.pow(0.87, dt);
      bird.vy *= Math.pow(0.87, dt);
      bird.x += bird.vx * dt;
      bird.y += bird.vy * dt;
    }
  }

  draw(context, positions, now, reducedMotion, layer = 'all') {
    for (const bird of this.birds.values()) {
      const migration = this.migrations.get(bird.userId);
      if (layer === 'roosts' && migration) continue;
      if (layer === 'migrations' && !migration) continue;
      if (migration) {
        const duration = migration.reducedMotion ? REDUCED_MIGRATION_DURATION : this.migrationDuration;
        const progress = Math.min(1, (now - migration.start) / duration);
        const start = migration.starts.get(bird.id);
        const position = positions.get(bird.answer);
        if (start && position && progress < 1) {
          const target = worldTarget(bird.point, position);
          if (migration.reducedMotion) {
            drawBird(context, { ...bird, ...start }, now, 1 - progress, true);
            drawBird(context, { ...bird, ...target }, now, progress, true);
          } else {
            const stagger = random(bird.id, 11) * 250;
            const lift = 180 + random(bird.id, 12) * 80;
            const offset = (random(bird.id, 13) - 0.5) * 80;
            const elapsed = now - migration.start;
            const point = migrationPoint(start, target, elapsed, stagger, lift, offset, this.migrationDuration);
            const before = migrationPoint(start, target, elapsed - 24, stagger, lift, offset, this.migrationDuration);
            bird.vx = point.x - before.x;
            bird.vy = point.y - before.y;
            bird.x = point.x;
            bird.y = point.y;
            if (point.progress > 0 && point.progress < 1) {
              context.save();
              context.strokeStyle = '#E8A15A';
              context.lineWidth = 3;
              for (let segment = 1; segment <= 3; segment++) {
                const ahead = migrationPoint(start, target, elapsed - (segment - 1) * 55, stagger, lift, offset, this.migrationDuration);
                const behind = migrationPoint(start, target, elapsed - segment * 55, stagger, lift, offset, this.migrationDuration);
                context.globalAlpha = (4 - segment) * 0.27 * Math.sin(Math.PI * point.progress);
                context.beginPath();
                context.moveTo(ahead.x, ahead.y);
                context.lineTo(behind.x, behind.y);
                context.stroke();
              }
              context.restore();
            }
            drawBird(context, bird, now);
          }
          continue;
        }
      }
      drawBird(context, bird, now, 1, reducedMotion);
    }
    if (layer === 'roosts') return;
    for (const [userId, migration] of this.migrations) {
      const duration = migration.reducedMotion ? REDUCED_MIGRATION_DURATION : this.migrationDuration;
      if (now - migration.start >= duration) this.migrations.delete(userId);
    }
    this.captions = this.captions.filter(caption => now - caption.start < 2800);
    for (const caption of this.captions) {
      context.save();
      context.globalAlpha = 1;
      context.fillStyle = '#F3E9DC';
      context.font = 'italic 40px Georgia';
      context.lineWidth = 5;
      context.strokeStyle = '#141826';
      context.lineJoin = 'round';
      context.textAlign = 'center';
      const text = `${caption.name} changed their mind`;
      context.strokeText?.(text, 960, 220);
      context.fillText(text, 960, 220);
      context.restore();
    }
  }
}
