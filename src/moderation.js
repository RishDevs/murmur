// A local, conservative filter for hate, harassment and profanity. It runs before
// anything reaches the overlay. It cannot catch every abusive expression, which is
// why streamers also have Hide, Clear and Reset.

// Terms that are never innocent inside a longer word ("motherfucker", "dumbbitch").
const anywhere = [
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'whore', 'slut', 'retard',
  'nigger', 'nigga', 'faggot', 'twat', 'wanker', 'skank', 'fvck', 'phuck', 'fck',
];

// Terms that only match at the start or end of a word ("cunts" but not "scunthorpe").
const wordEdge = ['cunt'];

// Terms that are innocent inside other words ("grape", "raccoon", "spice",
// "pakistan", "class"), so they only match as a whole word or simple plural.
const wholeWord = [
  'ass', 'fag', 'dyke', 'tranny', 'shemale', 'kike', 'spic', 'chink', 'gook',
  'coon', 'paki', 'wetback', 'beaner', 'raghead', 'towelhead', 'sandnigger',
  'gypsy', 'jap', 'nazi', 'rape', 'raped', 'rapist', 'kys', 'slag', 'mong',
  'cripple', 'spaz', 'tard', 'incest', 'pedo', 'pedophile', 'fuk', 'fuq', 'sht', 'stfu',
];

// Harassment and hate phrases, matched after the message is joined into one string.
const phrases = [
  'killyourself', 'killurself', 'kilyourself', 'goandie', 'godie', 'neckyourself',
  'heilhitler', 'siegheil', 'whitepower', 'gasthejews', 'hitlerwasright',
];

const hateCodes = ['1488', '14 88'];

const leet = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i', '|': 'l' };
// Characters people use to hide letters ("f*ck", "n#gga"). Each one stands for one letter.
const MASK = /[*#%]/;

function unleet(token) {
  return token.replace(/[0134578@$!|]/g, character => leet[character]);
}

function squeeze(token) {
  return token.replace(/(\p{L})\1+/gu, '$1');
}

// Collapse only runs of three or more, so "niggger" still matches while
// "nigeria" never collapses into a slur.
function squeezeLong(token) {
  return token.replace(/(\p{L})\1{2,}/gu, '$1$1');
}

// Fully collapsing these would read "nigeria" and "niger" as slurs.
const keepDoubles = new Set(['nigger', 'nigga']);

function containsTerm(plain, word) {
  return keepDoubles.has(word)
    ? containsWord(squeezeLong(plain), word)
    : containsWord(squeeze(plain), squeeze(word));
}

// Does `word` fit into `token` starting at `offset`, where mask characters match any letter?
function fitsAt(token, word, offset) {
  if (offset < 0 || offset + word.length > token.length) return false;
  for (let i = 0; i < word.length; i++) {
    const character = token[offset + i];
    if (character !== word[i] && !MASK.test(character)) return false;
  }
  return true;
}

function containsWord(token, word) {
  for (let offset = 0; offset + word.length <= token.length; offset++) {
    if (fitsAt(token, word, offset)) return true;
  }
  return false;
}

function equalsWord(token, word) {
  if (token.length === word.length) return fitsAt(token, word, 0);
  return token.length === word.length + 1 && /[s*#%]$/.test(token) && fitsAt(token, word, 0);
}

function isMostlyMasked(token) {
  const masks = [...token].filter(character => MASK.test(character)).length;
  return masks >= 2 && masks * 2 >= token.length;
}

function isBlockedToken(raw) {
  const plain = unleet(raw);
  const squeezed = squeeze(plain);
  if (isMostlyMasked(plain)) return true;
  if (anywhere.some(word => containsTerm(plain, word))) return true;
  const atEdge = word => [plain, squeezed].some(token =>
    fitsAt(token, word, 0) || fitsAt(token, word, token.length - word.length));
  if (wordEdge.some(atEdge)) return true;
  return wholeWord.some(word => equalsWord(plain, word) || equalsWord(squeezed, squeeze(word)));
}

// Rejoin runs of single characters so "f u c k" or "k.y.s" are read as one word.
function withSpelledWords(tokens) {
  const result = [...tokens];
  let run = [];
  for (const token of [...tokens, '']) {
    if ([...token].length === 1) {
      run.push(token);
      continue;
    }
    if (run.length >= 3) result.push(run.join(''));
    run = [];
  }
  return result;
}

export function isSafe(text) {
  const normalized = text.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');
  if (hateCodes.some(code => normalized.includes(code))) return false;
  // An exclamation mark is leetspeak only inside a token, not trailing punctuation.
  const tokens = normalized.match(/[\p{L}\p{N}@$|*#%]+(?:![\p{L}\p{N}@$|*#%]+)*/gu) || [];
  const joined = squeeze(tokens.map(unleet).join(''));
  if (phrases.some(phrase => joined.includes(squeeze(phrase)))) return false;
  return withSpelledWords(tokens).every(token => !isBlockedToken(token));
}
