const PAPER = '#F3E9DC';
const EMBER = '#E8A15A';
const SERIF = '"Iowan Old Style", Palatino, Georgia, serif';

export function layoutGroups(groups) {
  const positions = [
    { x: 960, y: 400, width: 1250, height: 250, labelY: 565, size: 105 },
    { x: 380, y: 700, width: 540, height: 125, labelY: 790, size: 46 },
    { x: 1540, y: 700, width: 540, height: 125, labelY: 790, size: 46 },
    { x: 665, y: 840, width: 400, height: 95, labelY: 914, size: 40 },
    { x: 1255, y: 840, width: 400, height: 95, labelY: 914, size: 40 },
  ];
  return new Map(groups.slice(0, 5).map((group, index) => [group.answer, positions[index]]));
}

export function interpolateLayout(from, to, progress) {
  const result = {};
  for (const key of Object.keys(to)) {
    result[key] = from[key] + (to[key] - from[key]) * progress;
  }
  return result;
}

export function drawText(context, value, x, y, size, options = {}) {
  context.fillStyle = options.color || PAPER;
  context.font = `${options.italic ? 'italic ' : ''}${size}px ${SERIF}`;
  context.textAlign = options.align || 'left';
  context.fillText(value, x, y);
}

export function drawBackground(context) {
  const sky = context.createLinearGradient(0, 0, 0, 1080);
  sky.addColorStop(0, '#141826');
  sky.addColorStop(0.58, '#34303a');
  sky.addColorStop(1, '#C9714A');
  context.fillStyle = sky;
  context.fillRect(0, 0, 1920, 1080);

  context.fillStyle = '#171923';
  context.beginPath();
  context.moveTo(0, 1020);
  context.bezierCurveTo(300, 995, 480, 1038, 730, 1016);
  context.bezierCurveTo(1010, 988, 1240, 1038, 1500, 1005);
  context.bezierCurveTo(1700, 990, 1820, 1017, 1920, 1003);
  context.lineTo(1920, 1080);
  context.lineTo(0, 1080);
  context.fill();
}

function drawLabel(context, group, position, leader, opacity) {
  context.save();
  context.globalAlpha = Math.max(0, Math.min(1, opacity * (group.opacity ?? 1)));
  const label = `${group.answer.toLocaleUpperCase()} · ${group.count}`;
  let size = position.size;
  context.font = `${size}px ${SERIF}`;
  while (context.measureText(label).width > position.width + 100 && size > 30) {
    size -= 2;
    context.font = `${size}px ${SERIF}`;
  }
  drawText(context, label, position.x, position.labelY, size, { align: 'center' });
  if (leader) {
    const width = Math.min(560, context.measureText(label).width);
    context.fillStyle = EMBER;
    context.fillRect(position.x - width / 2, position.labelY + 25, width, 4);
  }
  context.restore();
}

export function drawLabels(context, state, previous, progress) {
  const currentPositions = layoutGroups(state.groups);
  const previousPositions = layoutGroups(previous.groups);
  const currentLeader = state.groups[0]?.answer;
  const previousLeader = previous.groups[0]?.answer;
  const flipped = currentLeader && previousLeader && currentLeader !== previousLeader;

  if (progress < 1) {
    for (const group of previous.groups.slice(0, 5)) {
      if (!currentPositions.has(group.answer)) {
        drawLabel(context, group, previousPositions.get(group.answer), group.answer === previousLeader, 1 - progress);
      }
    }
  }

  for (const [index, group] of state.groups.slice(0, 5).entries()) {
    const destination = currentPositions.get(group.answer);
    const origin = previousPositions.get(group.answer) || destination;
    const position = interpolateLayout(origin, destination, progress);
    if (flipped && (group.answer === currentLeader || group.answer === previousLeader)) {
      const oldGroup = previous.groups.find(item => item.answer === group.answer);
      if (oldGroup && progress < 1) {
        drawLabel(context, oldGroup, position, group.answer === previousLeader, 1 - progress);
      }
      drawLabel(context, group, position, index === 0, progress);
    } else {
      drawLabel(context, group, position, index === 0, 1);
    }
  }
  if (state.groups.length > 5) {
    drawText(context, `+${state.groups.length - 5} more`, 960, 986, 29, { align: 'center' });
  }
}

export function drawChrome(context, state) {
  drawText(context, 'M U R M U R', 64, 74, 24);
  drawText(context, state.question || 'A question is waiting in the wings.', 64, 137, 40, { italic: true });
  if (!state.groups.length) {
    const hint = state.phase === 'idle'
      ? 'Waiting for the next question'
      : state.phase === 'paused' ? 'Paused' : 'Type your answer in chat';
    drawText(context, hint, 960, 580, 48, { align: 'center', italic: true });
  }
  if (state.phase === 'paused') {
    drawText(context, 'PAUSED', 1856, 85, 26, { align: 'right' });
  }
  if (state.demo) {
    context.save();
    context.translate(1750, 185);
    context.rotate(-0.12);
    context.strokeStyle = '#8F3030';
    context.lineWidth = 5;
    context.strokeRect(-130, -30, 260, 52);
    drawText(context, 'SIMULATED', 0, 8, 29, { align: 'center', color: '#8F3030' });
    context.restore();
  }
  const disclaimer = 'Chat’s opinion — not a fact.';
  drawText(context, disclaimer, 1856, 1041, 24, { align: 'right' });
  context.font = `24px ${SERIF}`;
  const disclaimerWidth = context.measureText(disclaimer).width;
  const status = state.status === 'SIMULATED' ? 'SIMULATED' : state.status;
  const statusRight = 1856 - disclaimerWidth - 55;
  context.font = `22px ${SERIF}`;
  const statusWidth = context.measureText(status).width;
  context.fillStyle = state.status === 'LIVE' ? PAPER : EMBER;
  context.beginPath();
  context.arc(statusRight - statusWidth - 18, 1033, 6, 0, Math.PI * 2);
  context.fill();
  drawText(context, status, statusRight, 1041, 22, { align: 'right' });
}
