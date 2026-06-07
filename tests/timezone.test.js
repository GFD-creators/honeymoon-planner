import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OFFSETS, toJapanTime, formatLocalAndJapan } from '../js/timezone.js';

test('OFFSETS に主要都市が定義されている', () => {
  assert.equal(OFFSETS['東京'], 9);
  assert.equal(OFFSETS['韓国'], 9);
  assert.equal(OFFSETS['ロンドン'], 1);
  assert.equal(OFFSETS['パリ'], 2);
  assert.equal(OFFSETS['ヴェネチア'], 2);
  assert.equal(OFFSETS['ローマ'], 2);
});

test('toJapanTime: ロンドン14:20 は日本22:20（同日）', () => {
  const r = toJapanTime('ロンドン', '2026-09-12', '14:20');
  assert.equal(r.time, '22:20');
  assert.equal(r.dayDiff, 0);
});

test('toJapanTime: ローマ14:55 は日本21:55（同日）', () => {
  const r = toJapanTime('ローマ', '2026-09-22', '14:55');
  assert.equal(r.time, '21:55');
  assert.equal(r.dayDiff, 0);
});

test('toJapanTime: 日付をまたぐ場合 dayDiff=+1', () => {
  const r = toJapanTime('ロンドン', '2026-09-12', '20:00'); // +8h => 翌日04:00
  assert.equal(r.time, '04:00');
  assert.equal(r.dayDiff, 1);
});

test('formatLocalAndJapan: 現地と日本を併記文字列で返す', () => {
  const s = formatLocalAndJapan('ロンドン', '2026-09-12', '14:20');
  assert.equal(s, '14:20 / 🇯🇵22:20');
});

test('formatLocalAndJapan: 翌日になる場合は +1 を付ける', () => {
  const s = formatLocalAndJapan('ロンドン', '2026-09-12', '20:00');
  assert.equal(s, '20:00 / 🇯🇵04:00(+1)');
});

test('未知の都市はオフセット未定義として日本併記を省く', () => {
  const s = formatLocalAndJapan('火星', '2026-09-12', '10:00');
  assert.equal(s, '10:00');
});
