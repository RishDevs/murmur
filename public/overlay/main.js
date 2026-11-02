import { Flock, drawBird } from './flock.js';
import { drawBackground, drawChrome, drawLabels, interpolateLayout, layoutGroups } from './scene.js';

const canvas = document.querySelector('#scene');
const context = canvas.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const flock = new Flock();
let state = { groups: [], phase: 'idle', status: 'OFFLINE' };
let previous = state;
let changedAt = performance.now();

function receiveState(message) {
  const update = JSON.parse(message.data);
  const now = performance.now();
  const oldPositions = layoutGroups(state.groups);
  previous = state;
  state = update.state;
  changedAt = now;
  flock.updateState(state, update.event, oldPositions, layoutGroups(state.groups), now, reducedMotion.matches);
}

function resizeCanvas() {
  const ratio = devicePixelRatio || 1;
  const width = Math.round(canvas.clientWidth * ratio);
  const height = Math.round(canvas.clientHeight * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  context.setTransform(canvas.width / 1920, 0, 0, canvas.height / 1080, 0, 0);
}

function animatedPositions(progress) {
  const current = layoutGroups(state.groups);
  const old = layoutGroups(previous.groups);
  for (const [answer, destination] of current) {
    current.set(answer, interpolateLayout(old.get(answer) || destination, destination, progress));
  }
  return current;
}

function drawIdleBirds(now) {
  if (state.phase !== 'idle' || state.groups.length) return;
  for (let index = 0; index < 5; index++) {
    const bird = {
      x: 760 + index * 105,
      y: 420 + (reducedMotion.matches ? 0 : Math.sin(now / 2400 + index) * 10),
      size: 12,
      phase: index,
    };
    drawBird(context, bird, now, 0.55, reducedMotion.matches);
  }
}

function render(now) {
  resizeCanvas();
  const linear = Math.min(1, (now - changedAt) / 600);
  const progress = reducedMotion.matches ? 1 : linear * linear * (3 - 2 * linear);
  const positions = animatedPositions(progress);
  drawBackground(context);
  flock.update(positions, now, reducedMotion.matches);
  flock.draw(context, positions, now, reducedMotion.matches);
  drawIdleBirds(now);
  drawLabels(context, state, previous, reducedMotion.matches ? linear : progress);
  drawChrome(context, state);
  requestAnimationFrame(render);
}

const events = new EventSource('/events');
events.onmessage = receiveState;
requestAnimationFrame(render);
