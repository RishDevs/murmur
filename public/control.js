const select = selector => document.querySelector(selector);
const question = select('#question');
const start = select('#start');

async function post(action, body = {}) {
  await fetch(`/api/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function updateStartButton() {
  start.disabled = !question.value.trim();
}

function renderAnswers(groups) {
  const list = select('#answers');
  list.replaceChildren();
  for (const group of groups) {
    const row = document.createElement('div');
    row.className = 'answer';
    const label = document.createElement('span');
    label.textContent = `${group.answer.toUpperCase()} · ${group.count}`;
    const hide = document.createElement('button');
    hide.className = 'secondary';
    hide.textContent = 'Hide';
    hide.onclick = () => post('hide', { answer: group.answer });
    row.append(label, hide);
    list.append(row);
  }
}

function renderState(state) {
  select('#status').textContent = state.status;
  select('#stamp').hidden = !state.demo;
  select('#login').hidden = state.demo || state.status === 'LIVE';
  select('#connection').textContent = state.demo
    ? 'Simulated viewers are active while a round is open.'
    : state.status === 'LIVE'
      ? 'Connected to your Twitch channel.'
      : 'Connect your Twitch account to listen to your own channel.';
  select('#login-info').textContent = state.login
    ? `Visit ${state.login.url} and enter ${state.login.code}`
    : '';
  select('#error').textContent = state.loginError || '';
  select('#round-question').textContent = state.question || 'No question yet.';
  select('#phase').textContent = state.phase === 'paused'
    ? 'Paused'
    : state.phase === 'open' ? 'Accepting answers from chat.' : 'Start a round to invite answers.';
  select('#pause').textContent = state.phase === 'paused' ? 'Resume' : 'Pause';
  renderAnswers(state.groups);
}

start.onclick = () => post('start', { question: question.value });
question.addEventListener('input', updateStartButton);
for (const id of ['pause', 'clear', 'reset', 'login']) {
  select(`#${id}`).onclick = () => post(id);
}
updateStartButton();
const events = new EventSource('/events');
events.onmessage = message => renderState(JSON.parse(message.data).state);
