// This local blocklist is intentionally limited and cannot catch every abuse variant.
const blocked = [
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt',
  'nigger', 'nigga', 'faggot', 'retard', 'slut', 'whore',
];
const substitutions = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i' };

function fold(token) {
  return token.replace(/[0134578@$!]/g, character => substitutions[character])
    .replace(/(.)\1+/g, '$1');
}

const blockedWords = blocked.map(fold);

// Matching at word edges catches compounds ("shitty", "fuckyou") without
// flagging words that merely contain a blocked term ("scunthorpe").
function isBlockedToken(token) {
  const folded = fold(token);
  return blockedWords.some(word => folded.startsWith(word) || folded.endsWith(word));
}

export function isSafe(text) {
  const normalized = text.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');
  // An exclamation mark is leetspeak only inside a token, not trailing punctuation.
  const tokens = normalized.match(/[\p{L}\p{N}@$]+(?:![\p{L}\p{N}@$]+)*/gu) || [];
  // Spaced-out letters ("f u c k") are rejoined into a single token.
  const spelled = tokens.every(token => token.length === 1) ? [tokens.join('')] : [];
  return [...tokens, ...spelled].every(token => !isBlockedToken(token));
}
