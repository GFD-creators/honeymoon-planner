import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findLinkedEvent, isScheduled } from '../js/link.js';

const events = [
  { id: 'e1', title: 'A' },
  { id: 'e2', title: 'B' },
];

test('findLinkedEvent: eventId 一致で event を返す', () => {
  assert.equal(findLinkedEvent(events, { name: 'x', eventId: 'e2' }).title, 'B');
});

test('findLinkedEvent: 一致しない eventId は null', () => {
  assert.equal(findLinkedEvent(events, { name: 'x', eventId: 'zzz' }), null);
});

test('findLinkedEvent: eventId 未設定は null', () => {
  assert.equal(findLinkedEvent(events, { name: 'x' }), null);
});

test('isScheduled: リンク先があれば true', () => {
  assert.equal(isScheduled(events, { eventId: 'e1' }), true);
  assert.equal(isScheduled(events, { eventId: 'zzz' }), false);
  assert.equal(isScheduled(events, {}), false);
});
