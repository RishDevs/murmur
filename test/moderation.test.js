import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSafe } from '../src/moderation.js';
import {
  initialRound,
  reduceRound
} from '../src/round.js';
test('abusive text, leet and repeats are rejected before snapshot', () => {
  for (const s of [
      'fuck',
      'fuuuck',
      'sh1t',
      'b!tch',
      'f4gg0t',
      'n1gg3r'
    ])
    assert.equal(isSafe(s), false, s);
  assert.equal(isSafe('sir neighs'), true);
  let state = reduceRound(initialRound(), {
    type: 'start',
    question: 'Q'
  }).state;
  for (const text of [
      'fuuuck',
      'sh1t'
    ])
    state = reduceRound(state, {
      type: 'vote',
      userId: text,
      text,
      at: 0
    }).state;
  assert.deepEqual(state.votes, {});
});

test('ordinary words and punctuation are not substring matches', () => {
  for (const text of ['class', 'assess', 'cocktail', 'yes!', 'this is class!', 'scunthorpe']) {
    assert.equal(isSafe(text), true, text);
  }
  for (const text of ['b!tch', 'sh1t!', 'f4gg0t', 'a fuuuck!']) {
    assert.equal(isSafe(text), false, text);
  }
});

test('hate, harassment and masked spellings are rejected', () => {
  for (const text of [
    'f*ck', 'f**k', 'sh**', 'sh*t', 'b*tch', 'n#gga', 'f@gg*t', 'c*nt', '****',
    'kys', 'k y s', 'kill yourself', 'go kill urself', 'heil hitler', '1488',
    'chink', 'spics', 'kike', 'tranny', 'dyke', 'raghead', 'retarded', 'motherfucker',
    'rapist', 'n i g g a', 'niggggerr', 'fuuuuck', 'asshhole', 'fvck', 'phuck', 'fuk', 'stfu',
  ]) {
    assert.equal(isSafe(text), false, text);
  }
});

test('innocent words containing short slurs still pass', () => {
  for (const text of [
    'grape', 'raccoon', 'spice', 'pakistan', 'class', 'assess', 'japan', 'cocktail',
    'scunthorpe', 'shipshape', 'night', 'nigeria', 'niger', 'fukushima', 'mango', 'yes!', 'a b c', 'dickens', '5 stars',
  ]) {
    assert.equal(isSafe(text), true, text);
  }
});

test('compounds and spaced-out letters are rejected', () => {
  for (const text of ['fuckyou', 'shitty', 'dumbbitch', 'f u c k', 's h 1 t']) {
    assert.equal(isSafe(text), false, text);
  }
  for (const text of ['a b c', 'shipshape', 'biscuit', 'sir neighs']) {
    assert.equal(isSafe(text), true, text);
  }
});
