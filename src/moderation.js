// Deliberately conservative, local filter; it cannot catch every abusive expression.
const blocked = ['fuck','shit','bitch','asshole','bastard','cunt','nigger','nigga','faggot','retard','slut','whore'];
export function isSafe(text) {
  const folded = text.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[0134578@$!]/g, c => ({'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','8':'b','@':'a','$':'s','!':'i'}[c])).replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
  return !blocked.some(word => folded.includes(word.replace(/(.)\1+/g, '$1')));
}
