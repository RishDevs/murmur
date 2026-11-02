const MAX_BIRDS = 1080;
const BIRDS_PER_VOTER = 36;
const FLIGHT_DURATION = 1600;
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

function ease(value) {
  return value * value * (3 - 2 * value);
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
  // Traverse the mask with a coprime stride so even a small flock spans the word.
  const selected = [];
  for (let index = 0; index < count; index++) {
    const offset = Math.floor((index + random(answer, index)) * points.length / count);
    selected.push(points[Math.min(points.length - 1, offset)]);
  }
  return selected;
}

function worldTarget(point, position) {
  return { x: position.x + point.x * position.width, y: position.y + point.y * position.height };
}

export function drawBird(context, bird, now, opacity = 1, reducedMotion = false) {
  const wing = reducedMotion ? 0.3 : Math.sin(now / 130 + bird.phase) * 0.8;
  const halfSpan = bird.size / 2;
  context.save();
  context.globalAlpha *= opacity;
  context.strokeStyle = '#0E0F14';
  context.lineWidth = 2.4;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(bird.x - halfSpan, bird.y - wing * halfSpan);
  context.lineTo(bird.x, bird.y);
  context.lineTo(bird.x + halfSpan, bird.y - wing * halfSpan);
  context.stroke();
  context.restore();
}

export class Flock {
  constructor() {
    this.birds = new Map();
    this.migrations = new Map();
    this.masks = new Map();
    this.lastFrame = null;
  }

  updateState(state, event, oldPositions, newPositions, now, reducedMotion) {
    const total = state.groups.reduce((sum, group) => sum + group.count, 0);
    const perVoter = birdsPerVoter(total);
    const active = new Set();
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
              size: 9 + random(id, 1) * 5, phase: random(id, 2) * Math.PI * 2 };
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
      if (migration && now - migration.start < (migration.reducedMotion ? 350 : FLIGHT_DURATION)) continue;
      const target = worldTarget(bird.point, position);
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

  draw(context, positions, now, reducedMotion) {
    for (const bird of this.birds.values()) {
      const migration = this.migrations.get(bird.userId);
      if (migration) {
        const duration = migration.reducedMotion ? 350 : FLIGHT_DURATION;
        const progress = Math.min(1, (now - migration.start) / duration);
        const start = migration.starts.get(bird.id);
        const position = positions.get(bird.answer);
        if (start && position && progress < 1) {
          const target = worldTarget(bird.point, position);
          if (migration.reducedMotion) {
            drawBird(context, { ...bird, ...start }, now, 1 - progress, true);
            drawBird(context, { ...bird, ...target }, now, progress, true);
          } else {
            const offset = Number(bird.id.split(':').at(-1));
            const t = ease(Math.max(0, Math.min(1, (progress * 1.18) - offset / 36 * 0.18)));
            const gather = Math.min(1, t * 5);
            const settle = Math.max(0, (t - 0.8) * 5);
            const flightX = migration.origin.x + (position.x - migration.origin.x) * t;
            const flightY = migration.origin.y + (position.y - migration.origin.y) * t - Math.sin(Math.PI * t) * 180;
            bird.x = flightX + (start.x - migration.origin.x) * (1 - gather) + (target.x - position.x) * settle;
            bird.y = flightY + (start.y - migration.origin.y) * (1 - gather) + (target.y - position.y) * settle + Math.sin(offset * 1.7) * 8 * Math.sin(Math.PI * t);
            drawBird(context, bird, now);
          }
          continue;
        }
      }
      drawBird(context, bird, now, 1, reducedMotion);
    }
    for (const [userId, migration] of this.migrations) {
      const duration = migration.reducedMotion ? 350 : FLIGHT_DURATION;
      const progress = Math.min(1, (now - migration.start) / duration);
      if (progress >= 1) {
        this.migrations.delete(userId);
        continue;
      }
      if (migration.reducedMotion) continue;
      const moving = [...this.birds.values()].filter(bird => bird.userId === userId);
      if (!moving.length) continue;
      const center = moving.reduce((sum, bird) => ({ x: sum.x + bird.x / moving.length, y: sum.y + bird.y / moving.length }), { x: 0, y: 0 });
      context.save();
      context.strokeStyle = '#E8A15A';
      context.globalAlpha = 0.7 * Math.sin(Math.PI * progress);
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(moving[0].x, moving[0].y);
      for (const bird of moving.slice(1)) context.lineTo(bird.x, bird.y);
      context.stroke();
      context.globalAlpha = 1;
      context.fillStyle = '#F3E9DC';
      context.font = 'italic 30px Georgia';
      context.textAlign = 'center';
      context.fillText(`${migration.name} changed their mind`, center.x, center.y - 42);
      context.restore();
    }
  }
}
