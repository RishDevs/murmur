import { normalize } from './normalize.js';
import { isSafe } from './moderation.js';
export const initialRound = () => ({ question: '', phase: 'idle', votes: {}, hidden: [], changes: {} });
// Pure reducer: no clocks, I/O, or mutation. Events supplied by the caller include timestamps.
export function reduceRound(state, action) {
  let s = structuredClone(state); let event = null;
  switch (action.type) {
    case 'start': {
      const question = String(action.question || '').trim().slice(0, 120);
      if (!question) return { state, event };
      return { state: { ...initialRound(), question, phase: 'open' }, event };
    }
    case 'pause': if (s.phase !== 'idle') s.phase = s.phase === 'paused' ? 'open' : 'paused'; break;
    case 'clear': s.votes = {}; s.changes = {}; break;
    case 'reset': return { state: initialRound(), event };
    case 'hide': {
      const key = normalize(action.answer);
      if (!key) return {state,event};
      if (!s.hidden.includes(key)) s.hidden.push(key);
      for (const [id,v] of Object.entries(s.votes)) if (v.answer === key) delete s.votes[id];
      break;
    }
    case 'vote': {
      if (s.phase !== 'open' || !action.userId || !Number.isFinite(action.at) || typeof action.text !== 'string' || !isSafe(action.text)) return {state,event};
      const answer = normalize(action.text);
      if (!answer || s.hidden.includes(answer)) return {state,event};
      const old = s.votes[action.userId];
      if (old?.answer === answer) { s.votes[action.userId].messageId = action.messageId; break; }
      if (s.changes[action.userId] !== undefined && action.at - s.changes[action.userId] < 3000) return {state,event};
      const name = String(action.name || 'A viewer').slice(0, 25);
      s.votes[action.userId] = { answer, messageId: action.messageId || '' };
      s.changes[action.userId] = action.at;
      if (old) event = { type:'migrate', userId: action.userId, name, from:old.answer, to:answer };
      break;
    }
    case 'delete': {
      const vote = s.votes[action.userId];
      if (vote && vote.messageId === action.messageId) delete s.votes[action.userId];
      break;
    }
    case 'clearUser': delete s.votes[action.userId]; break;
    case 'chatClear': s.votes = {}; s.changes = {}; break;
    default: return {state,event};
  }
  return {state:s,event};
}
export function snapshot(s) {
  const groups = {};
  for (const [id,v] of Object.entries(s.votes)) (groups[v.answer] ||= []).push({ id });
  return {question:s.question, phase:s.phase, groups:Object.entries(groups).map(([answer,voters])=>({answer,voters,count:voters.length})).sort((a,b)=>b.count-a.count || a.answer.localeCompare(b.answer))};
}
