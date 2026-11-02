export function normalize(value) {
  if (typeof value !== 'string' || value.length > 80) return null;
  const text = value.trim();
  if (!text || text.startsWith('!') || /@|(?:https?:\/\/|www\.|\b[\w-]+\.(?:com|net|org|gg|tv)\b)/i.test(text)) return null;
  const key = text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
  if (!key || key.length > 28 || key.split(' ').length > 4) return null;
  return key;
}
