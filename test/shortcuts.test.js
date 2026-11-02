import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shortcutAction } from '../public/shortcuts.js';

test('operator shortcuts avoid stealing typing, modifiers and repeated key presses', () => {
  for (const [key, action] of [['s', 'start'], ['P', 'pause'], ['r', 'reset']]) {
    assert.equal(shortcutAction({ key, target: { tagName: 'BODY' } }), action);
    assert.equal(shortcutAction({ key, target: { tagName: 'TEXTAREA' } }), null);
    assert.equal(shortcutAction({ key, target: { isContentEditable: true } }), null);
    assert.equal(shortcutAction({ key, target: {}, ctrlKey: true }), null);
    assert.equal(shortcutAction({ key, target: {}, repeat: true }), null);
  }
  assert.equal(shortcutAction({ key: 'x', target: {} }), null);
});
