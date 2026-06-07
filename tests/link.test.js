import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findLinkedEvent, isScheduled, linkedEventIds } from '../js/link.js';

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

test('linkedEventIds: truthy な eventId だけ集める', () => {
  assert.deepEqual(
    linkedEventIds([{ eventId: 'e1' }, { name: 'x' }, { eventId: 'e3' }]),
    ['e1', 'e3'],
  );
});

test('linkedEventIds: 空配列', () => {
  assert.deepEqual(linkedEventIds([]), []);
});

test('linkedEventIds: eventId 未設定のみは空', () => {
  assert.deepEqual(linkedEventIds([{ name: 'a' }, { name: 'b' }]), []);
});
