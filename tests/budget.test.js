import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totalPlanned, totalActual, perPerson, toEUR, remaining, totalCost, costByCategory, COST_CATEGORIES } from '../js/budget.js';

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

const costEvents = [
  { cost: 50000, costCategory: '航空券' },
  { cost: 3000, costCategory: '食事' },
  { cost: 2000, costCategory: '食事' },
  { cost: 1000, costCategory: '' },     // 未分類
  { cost: 500, costCategory: '謎' },    // 未知カテゴリ→未分類
  { cost: 0, costCategory: '航空券' },  // 0は除外
  { costCategory: '食事' },              // cost無し→除外
];

test('COST_CATEGORIES に主要カテゴリが含まれる', () => {
  assert.ok(COST_CATEGORIES.includes('航空券'));
  assert.ok(COST_CATEGORIES.includes('食事'));
});

test('totalCost: cost の総和（無効値・空は0）', () => {
  assert.equal(totalCost(costEvents), 56500);
  assert.equal(totalCost([]), 0);
  assert.equal(totalCost([{ cost: 'x' }, {}]), 0);
});

test('costByCategory: カテゴリ別集計＋未分類を末尾にまとめる', () => {
  assert.deepEqual(costByCategory(costEvents), [
    { category: '航空券', amount: 50000 },
    { category: '食事', amount: 5000 },
    { category: '未分類', amount: 1500 },
  ]);
});

test('costByCategory: 空配列は空', () => {
  assert.deepEqual(costByCategory([]), []);
});
