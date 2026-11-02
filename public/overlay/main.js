import { Flock, drawBird } from './flock.js';
import { drawBackground, drawChrome, drawLabels, interpolateLayout, layoutGroups } from './scene.js';
import { createTransition, transitionFrame } from './motion.js';

const canvas = document.querySelector('#scene');
const context = canvas.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const flock = new Flock();
let state = { groups: [], phase: 'idle', status: 'OFFLINE' };
let transition = null;

function sameAnswerOrder(first, second) {
  return first.groups.map(group => group.answer).join('\0') ===
    second.groups.map(group => group.answer).join('\0');
}

function receiveState(message) {
  const update = JSON.parse(message.data);
  const now = performance.now();
  const visible = transition ? transitionFrame(transition, now).state : state;
  const oldPositions = layoutGroups(visible.groups);
  const migration = update.event?.type === 'migrate';
  const roundChanged = update.state.question !== state.question || update.state.phase === 'idle';

  if (roundChanged || !update.state.groups.length) {
    transition = null;
  } else if (migration || (!transition && !sameAnswerOrder(state, update.state))) {
    transition = createTransition(visible, update.state, now, migration, reducedMotion.matches);
  } else if (transition) {
    transition.target = update.state;
    transition.held = { ...transition.held, status: update.state.status, demo: update.state.demo, phase: update.state.phase };
  }
  state = update.state;
  const destinationLayout = transition ? layoutGroups(transition.held.groups) : layoutGroups(state.groups);
  for (const [answer, position] of layoutGroups(state.groups)) {
    if (!destinationLayout.has(answer)) destinationLayout.set(answer, position);
  }
  flock.updateState(state, update.event, oldPositions, destinationLayout, now, reducedMotion.matches);
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

function animatedPositions(frame) {
  const current = layoutGroups(frame.state.groups);
  const old = layoutGroups(frame.previous.groups);
  for (const [answer, destination] of current) {
    current.set(answer, interpolateLayout(old.get(answer) || destination, destination, frame.progress));
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
  const frame = transition ? transitionFrame(transition, now) : { state, previous: state, progress: 1 };
  const positions = animatedPositions(frame);
  if (frame.complete) transition = null;
  drawBackground(context);
  flock.update(positions, now, reducedMotion.matches);
  flock.draw(context, positions, now, reducedMotion.matches, 'roosts');
  drawIdleBirds(now);
  drawLabels(context, frame.state, frame.previous, frame.progress);
  drawChrome(context, state);
  flock.draw(context, positions, now, reducedMotion.matches, 'migrations');
  requestAnimationFrame(render);
}

const events = new EventSource('/events');
events.onmessage = receiveState;
requestAnimationFrame(render);
