import { normalize } from './normalize.js';
import { isSafe } from './moderation.js';

export function initialRound() {
  return { question: '', phase: 'idle', votes: {}, hidden: [], changes: {} };
}

function applyVote(round, action) {
  if (round.phase !== 'open' || !action.userId || !Number.isFinite(action.at)) return null;
  if (typeof action.text !== 'string' || !isSafe(action.text)) return null;
  const answer = normalize(action.text);
  if (!answer || round.hidden.includes(answer)) return null;

  const previousVote = round.votes[action.userId];
  if (previousVote?.answer === answer) {
    previousVote.messageId = action.messageId;
    return null;
  }
  const lastChange = round.changes[action.userId];
  if (lastChange !== undefined && action.at - lastChange < 3000) return null;

  round.votes[action.userId] = { answer, messageId: action.messageId || '' };
  round.changes[action.userId] = action.at;
  if (!previousVote) return null;
  return {
    type: 'migrate',
    userId: action.userId,
    name: String(action.name || 'A viewer').slice(0, 25),
    from: previousVote.answer,
    to: answer,
  };
}

function hideAnswer(round, answer) {
  const key = normalize(answer);
  if (!key) return;
  if (!round.hidden.includes(key)) round.hidden.push(key);
  for (const [userId, vote] of Object.entries(round.votes)) {
    if (vote.answer === key) delete round.votes[userId];
  }
}

// The caller supplies the clock; the reducer never mutates its input.
export function reduceRound(state, action) {
  const round = structuredClone(state);
  let event = null;
  switch (action.type) {
    case 'start': {
      const question = String(action.question || '').trim().slice(0, 120);
      if (!question) return { state, event };
      return { state: { ...initialRound(), question, phase: 'open' }, event };
    }
    case 'pause':
      if (round.phase !== 'idle') round.phase = round.phase === 'paused' ? 'open' : 'paused';
      break;
    case 'clear':
    case 'chatClear':
      round.votes = {};
      round.changes = {};
      break;
    case 'reset':
      return { state: initialRound(), event };
    case 'hide':
      hideAnswer(round, action.answer);
      break;
    case 'vote':
      event = applyVote(round, action);
      break;
    case 'delete': {
      const vote = round.votes[action.userId];
      if (vote && vote.messageId === action.messageId) delete round.votes[action.userId];
      break;
    }
    case 'clearUser':
      delete round.votes[action.userId];
      break;
    default:
      return { state, event };
  }
  return { state: round, event };
}

export function snapshot(round) {
  const groups = {};
  for (const [id, vote] of Object.entries(round.votes)) {
    (groups[vote.answer] ||= []).push({ id });
  }
  const answers = Object.entries(groups)
    .map(([answer, voters]) => ({ answer, voters, count: voters.length }))
    .sort((first, second) => second.count - first.count || first.answer.localeCompare(second.answer));
  return { question: round.question, phase: round.phase, groups: answers };
}
