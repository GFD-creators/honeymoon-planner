import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totalPlanned, totalActual, perPerson, toEUR, remaining } from '../js/budget.js';

const sample = [
  { category: 'ホテル', planned: 270000, actual: 200000 },
  { category: '食事', planned: 410000, actual: 0 },
  { category: '前撮り', planned: 230000, actual: 230000 },
];

test('totalPlanned: 予算合計', () => {
  assert.equal(totalPlanned(sample), 910000);
});

test('totalActual: 実績合計', () => {
  assert.equal(totalActual(sample), 430000);
});

test('perPerson: 2人で割る（端数は切り捨て）', () => {
  assert.equal(perPerson(910000, 2), 455000);
});

test('toEUR: レート180で割って小数1桁', () => {
  assert.equal(toEUR(90000, 180), 500);
  assert.equal(toEUR(91000, 180), 505.6);
});

test('remaining: 予算-実績', () => {
  assert.equal(remaining(sample), 480000);
});

test('空配列でも0を返す', () => {
  assert.equal(totalPlanned([]), 0);
  assert.equal(totalActual([]), 0);
});
