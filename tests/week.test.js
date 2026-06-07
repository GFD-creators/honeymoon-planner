import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  weekStartSunday, weekDays, addWeeks,
  timeToMinutes, minutesToTop, blockHeight, splitTimedAllDay,
} from '../js/week.js';

const OPTS = { startHour: 5, hourHeight: 48 };

test('weekStartSunday: 土曜(9/12)が属する週の日曜は9/6', () => {
  assert.equal(weekStartSunday('2026-09-12'), '2026-09-06');
});

test('weekStartSunday: 日曜(9/13)はその日自身', () => {
  assert.equal(weekStartSunday('2026-09-13'), '2026-09-13');
});

test('weekDays: 日曜起点で7日分', () => {
  assert.deepEqual(weekDays('2026-09-13'), [
    '2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16',
    '2026-09-17', '2026-09-18', '2026-09-19',
  ]);
});

test('addWeeks: 月をまたいで1週進む', () => {
  assert.equal(addWeeks('2026-09-27', 1), '2026-10-04');
});

test('addWeeks: 1週戻る', () => {
  assert.equal(addWeeks('2026-09-13', -1), '2026-09-06');
});

test('timeToMinutes: 14:20 -> 860', () => {
  assert.equal(timeToMinutes('14:20'), 860);
});

test('minutesToTop: 開始5時から14:20は448px', () => {
  assert.equal(minutesToTop(860, OPTS), 448);
});

test('minutesToTop: 5:00ちょうどは0px', () => {
  assert.equal(minutesToTop(300, OPTS), 0);
});

test('blockHeight: 14:00-15:30は72px', () => {
  assert.equal(blockHeight('14:00', '15:30', OPTS), 72);
});

test('blockHeight: 終了なしは既定60分=48px', () => {
  assert.equal(blockHeight('14:00', '', OPTS), 48);
});

test('blockHeight: 終了が開始より前なら既定60分扱い', () => {
  assert.equal(blockHeight('14:00', '13:00', OPTS), 48);
});

test('splitTimedAllDay: time有無で分割', () => {
  const evs = [
    { id: 'a', time: '10:00' },
    { id: 'b', time: '' },
    { id: 'c', time: '14:00' },
  ];
  const { timed, allDay } = splitTimedAllDay(evs);
  assert.deepEqual(timed.map((e) => e.id), ['a', 'c']);
  assert.deepEqual(allDay.map((e) => e.id), ['b']);
});
