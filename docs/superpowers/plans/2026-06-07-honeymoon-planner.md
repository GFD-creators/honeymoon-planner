# ハネムーン・プランナー Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新婚旅行（2026/9/12〜9/23 ヨーロッパ周遊）のスケジュール・行き先・予算を、時差/フライト対応の縦タイムライン・ポップUIで可視化し、夫婦2人がURL共有でリアルタイム共同編集できるWebアプリを作る。

**Architecture:** ビルド不要のバニラ HTML/CSS/JS（ES Modules）。純粋ロジック（時差変換・予算計算）は単体テスト付きで分離。最初は localStorage で完全動作させ、その後 Firebase Firestore のリアルタイム同期レイヤーを被せる。GitHub Pages で公開。

**Tech Stack:** HTML / CSS / Vanilla JS (ES Modules), Node 組み込みテストランナー (`node --test`), Firebase Firestore (CDN/ESM), GitHub Pages。

---

## ファイル構成

```
honeymoon-planner/
├ index.html                  — アプリのシェル（ヘッダ・タブ内容領域・下部タブバー）
├ css/
│  └ styles.css               — ポップUIテーマ（配色トークン・カード・タブバー）
├ js/
│  ├ timezone.js              — タイムゾーンオフセット表 + 現地時刻↔日本時刻変換（純粋・テスト対象）
│  ├ budget.js                — 予算集計（合計・1人あたり・€換算・残額）（純粋・テスト対象）
│  ├ seed.js                  — 初期旅程データ（ユーザーのスプレッドシート由来）
│  ├ store.js                 — 状態保持＋永続化（localStorage / 後でFirestoreに差替）
│  ├ timeline.js              — タイムラインタブの描画
│  ├ places.js                — 行き先＆やることタブの描画
│  ├ budgetView.js            — 予算タブの描画
│  └ app.js                   — エントリ：タブ切替・各ビューの初期化・storeの購読
├ firebase-config.example.js  — Firebase設定キーの雛形（実キーは .local にコピーしgitignore）
├ tests/
│  ├ timezone.test.js         — timezone.js の単体テスト
│  └ budget.test.js           — budget.js の単体テスト
├ .gitignore
└ docs/superpowers/...        — spec / plan
```

設計方針: 純粋ロジック（timezone/budget）は副作用なし＝テスト可能。描画モジュール（timeline/places/budgetView）は「state を受け取り DOM を返す/差し込む」だけにし、Firestore も store.js の裏に隠す。これにより localStorage→Firestore の差し替えが store.js だけで済む。

---

## Task 1: プロジェクト土台と npm テストスクリプト

**Files:**
- Create: `package.json`
- Modify: `.gitignore`（既存）

- [ ] **Step 1: package.json を作成**

```json
{
  "name": "honeymoon-planner",
  "version": "1.0.0",
  "description": "新婚旅行のスケジュール・行き先・予算ダッシュボード",
  "type": "module",
  "scripts": {
    "test": "node --test"
  },
  "license": "MIT"
}
```

- [ ] **Step 2: .gitignore に実キー設定を追加**

`.gitignore` に以下が含まれていることを確認（なければ追記）:

```
node_modules/
.DS_Store
firebase-config.local.js
```

- [ ] **Step 3: テストが実行できることを確認**

Run: `npm test`
Expected: テストファイルがまだ無いので "0 tests" 相当で正常終了（exit 0）。エラーにならないこと。

- [ ] **Step 4: コミット**

```bash
git add package.json .gitignore
git commit -m "chore: project scaffold with node test runner"
```

---

## Task 2: タイムゾーン変換ロジック（純粋・TDD）

旅程中のタイムゾーン: 日本/韓国 = UTC+9、ロンドン(BST) = UTC+1、パリ/ヴェネチア/ローマ(CEST) = UTC+2。
2026年9月は欧州夏時間期間内。固定オフセットで扱う（旅行期間中に切替なし）。

**Files:**
- Create: `js/timezone.js`
- Test: `tests/timezone.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`tests/timezone.test.js`:

```js
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
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test`
Expected: FAIL（`js/timezone.js` が無い / export 未定義）

- [ ] **Step 3: 最小実装を書く**

`js/timezone.js`:

```js
// 旅行期間（2026年9月）固定の UTC オフセット（時間）
export const OFFSETS = {
  '東京': 9,
  '韓国': 9,
  'ロンドン': 1,
  'パリ': 2,
  'ヴェネチア': 2,
  'ローマ': 2,
};

const JAPAN_OFFSET = 9;

function pad(n) {
  return String(n).padStart(2, '0');
}

// 現地時刻を日本時刻へ変換。{ time: 'HH:MM', dayDiff: -1|0|1 } を返す
export function toJapanTime(city, dateStr, timeStr) {
  const offset = OFFSETS[city];
  if (offset === undefined) return null;
  const [h, m] = timeStr.split(':').map(Number);
  const totalMin = h * 60 + m + (JAPAN_OFFSET - offset) * 60;
  let dayDiff = 0;
  let mins = totalMin;
  while (mins < 0) { mins += 1440; dayDiff -= 1; }
  while (mins >= 1440) { mins -= 1440; dayDiff += 1; }
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  return { time: `${pad(hh)}:${pad(mm)}`, dayDiff };
}

// 「現地 / 🇯🇵日本」併記文字列。未知都市は現地のみ。
export function formatLocalAndJapan(city, dateStr, timeStr) {
  const jp = toJapanTime(city, dateStr, timeStr);
  if (!jp) return timeStr;
  let suffix = '';
  if (jp.dayDiff > 0) suffix = `(+${jp.dayDiff})`;
  else if (jp.dayDiff < 0) suffix = `(${jp.dayDiff})`;
  return `${timeStr} / 🇯🇵${jp.time}${suffix}`;
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm test`
Expected: PASS（timezone のテスト全て緑）

- [ ] **Step 5: コミット**

```bash
git add js/timezone.js tests/timezone.test.js
git commit -m "feat: timezone conversion (local <-> Japan time)"
```

---

## Task 3: 予算計算ロジック（純粋・TDD）

**Files:**
- Create: `js/budget.js`
- Test: `tests/budget.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`tests/budget.test.js`:

```js
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
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test`
Expected: FAIL（`js/budget.js` が無い）

- [ ] **Step 3: 最小実装を書く**

`js/budget.js`:

```js
const sum = (items, key) =>
  items.reduce((acc, it) => acc + (Number(it[key]) || 0), 0);

export function totalPlanned(items) {
  return sum(items, 'planned');
}

export function totalActual(items) {
  return sum(items, 'actual');
}

export function perPerson(total, people = 2) {
  return Math.floor(total / people);
}

export function toEUR(yen, rate) {
  return Math.round((yen / rate) * 10) / 10;
}

export function remaining(items) {
  return totalPlanned(items) - totalActual(items);
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm test`
Expected: PASS（timezone + budget 全て緑）

- [ ] **Step 5: コミット**

```bash
git add js/budget.js tests/budget.test.js
git commit -m "feat: budget calculations (totals, per-person, EUR, remaining)"
```

---

## Task 4: 初期旅程データ（シード）

ユーザーのスプレッドシートを構造化データに変換。spec の §6 表と一致させる。

**Files:**
- Create: `js/seed.js`

- [ ] **Step 1: seed.js を作成**

`js/seed.js`:

```js
// 初期旅程データ。store が空のとき投入される。
export const SEED = {
  meta: {
    title: '新婚旅行 2026 ヨーロッパ',
    startDate: '2026-09-12',
    endDate: '2026-09-23',
    rates: { EUR: 180, GBP: 210 },
    people: 2,
  },
  events: [
    { id: 'e1', date: '2026-09-12', time: '01:30', city: '東京', type: 'flight', title: '羽田 出発', meals: {} },
    { id: 'e2', date: '2026-09-12', time: '04:10', city: '韓国', type: 'flight', title: '仁川 到着・乗継（3時間40分待ち）', meals: {} },
    { id: 'e3', date: '2026-09-12', time: '07:50', city: '韓国', type: 'flight', title: 'ロンドンへ出発', meals: {} },
    { id: 'e4', date: '2026-09-12', time: '14:20', city: 'ロンドン', type: 'hotel', title: 'ホテルチェックイン・夕食', meals: { dinner: true } },
    { id: 'e5', date: '2026-09-13', time: '', city: 'ロンドン', type: 'sightseeing', title: 'ロンドン観光', hotel: 'ロンドン', meals: { breakfast: true, lunch: true, dinner: true } },
    { id: 'e6', date: '2026-09-14', time: '', city: 'ロンドン', type: 'sightseeing', title: 'ロンドン観光', meals: { lunch: true } },
    { id: 'e7', date: '2026-09-15', time: '11:00', city: 'ロンドン', type: 'flight', title: 'ユーロスター乗車', meals: {} },
    { id: 'e8', date: '2026-09-15', time: '13:30', city: 'パリ', type: 'sightseeing', title: 'パリ観光', hotel: 'パリ', meals: { lunch: true } },
    { id: 'e9', date: '2026-09-16', time: '', city: 'パリ', type: 'sightseeing', title: '前撮り', hotel: 'パリ', meals: { dinner: true } },
    { id: 'e10', date: '2026-09-17', time: '', city: 'パリ', type: 'sightseeing', title: 'パリ観光', hotel: 'パリ', meals: { lunch: true, dinner: true } },
    { id: 'e11', date: '2026-09-18', time: '', city: 'パリ', type: 'sightseeing', title: 'パリ観光', hotel: 'パリ', meals: { lunch: true, dinner: true } },
    { id: 'e12', date: '2026-09-19', time: '06:45', city: 'パリ', type: 'flight', title: 'エールフランス搭乗', meals: { breakfast: true, lunch: true, dinner: true } },
    { id: 'e13', date: '2026-09-19', time: '08:30', city: 'ヴェネチア', type: 'hotel', title: 'ヴェネチア到着・チェックイン', hotel: 'ヴェネチア', meals: { lunch: true, dinner: true } },
    { id: 'e14', date: '2026-09-20', time: '', city: 'ヴェネチア', type: 'sightseeing', title: 'ヴェネチア観光', hotel: 'ヴェネチア', meals: { lunch: true, dinner: true } },
    { id: 'e15', date: '2026-09-21', time: '', city: 'ヴェネチア', type: 'sightseeing', title: 'ヴェネチア観光', hotel: 'ヴェネチア', meals: { lunch: true, dinner: true } },
    { id: 'e16', date: '2026-09-22', time: '11:20', city: 'ヴェネチア', type: 'flight', title: 'ローマへ出発', meals: { dinner: true } },
    { id: 'e17', date: '2026-09-22', time: '12:30', city: 'ローマ', type: 'flight', title: 'ローマ到着・乗継', meals: { dinner: true } },
    { id: 'e18', date: '2026-09-22', time: '14:55', city: 'ローマ', type: 'flight', title: 'ITA AIRWAYS 日本へ出発', meals: {} },
    { id: 'e19', date: '2026-09-23', time: '10:25', city: '東京', type: 'flight', title: '羽田 到着', meals: {} },
  ],
  cities: [
    { name: 'ロンドン', days: '2日', sights: [
      { name: '大英博物館', done: false },
      { name: 'バッキンガム宮殿', done: false },
      { name: 'ビッグベン', done: false },
    ]},
    { name: 'パリ', days: '2.5日', sights: [
      { name: 'エッフェル塔', done: false },
      { name: 'エトワール凱旋門(シャンゼリゼ通り)', done: false },
      { name: 'ルーブル美術館', done: false },
    ]},
    { name: 'ヴェネチア', days: '2.5日', sights: [
      { name: 'ベネチア（街歩き）', done: false },
    ]},
    { name: 'ローマ', days: '乗継', sights: [
      { name: 'バチカン市国', done: false },
    ]},
  ],
  budget: [
    { category: '航空券 日本→イギリス', planned: 280400, actual: 0, note: 'アシアナ航空' },
    { category: '航空券 イギリス→パリ', planned: 50000, actual: 0, note: 'ユーロスター、2時間半' },
    { category: '航空券 パリ→ヴェネチア', planned: 100000, actual: 0, note: 'エールフランス/イージージェット、1時間半' },
    { category: '航空券 ヴェネチア→日本', planned: 471010, actual: 0, note: 'ITA AIRWAYS' },
    { category: 'ホテル', planned: 270000, actual: 0, note: '' },
    { category: '食事', planned: 410000, actual: 0, note: '' },
    { category: '交通', planned: 30000, actual: 0, note: '' },
    { category: '観光チケット', planned: 42000, actual: 0, note: '' },
    { category: 'Wi-Fi・eSIM', planned: 35000, actual: 0, note: '' },
    { category: '海外保険', planned: 0, actual: 0, note: '未定' },
    { category: '前撮り', planned: 230000, actual: 0, note: '' },
  ],
};
```

- [ ] **Step 2: 合計が 1,918,410 になることを確認（一時テスト）**

Run:
```bash
node -e "import('./js/seed.js').then(m=>console.log(m.SEED.budget.reduce((a,b)=>a+b.planned,0)))"
```
Expected: `1918410`

- [ ] **Step 3: コミット**

```bash
git add js/seed.js
git commit -m "feat: seed itinerary, cities and budget data"
```

---

## Task 5: 状態ストア（localStorage 永続化 + 購読）

store は「state を持ち、変更を localStorage に保存し、購読者へ通知する」だけ。後で Firestore に差し替えられるよう、API を `getState / update / subscribe` に限定する。

**Files:**
- Create: `js/store.js`

- [ ] **Step 1: store.js を作成**

`js/store.js`:

```js
import { SEED } from './seed.js';

const KEY = 'honeymoon-planner-state';
let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('state load failed, using seed', e);
  }
  return structuredClone(SEED);
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('state persist failed', e);
  }
}

export function getState() {
  return state;
}

// updater(state) を受け取り state を書き換える。保存＋通知。
export function update(updater) {
  updater(state);
  if (state.meta) state.meta.updatedAt = Date.now();
  persist();
  notify();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn(state);
}

// 開発用：シードに戻す
export function resetToSeed() {
  state = structuredClone(SEED);
  persist();
  notify();
}
```

- [ ] **Step 2: Node 環境では localStorage が無いため、ブラウザで確認する旨をメモ**

このモジュールは `localStorage` 依存のためブラウザでのみ動作。Task 11 のブラウザ確認でまとめて検証する。ここでは構文エラーが無いことだけ確認:

Run: `node --check js/store.js`
Expected: 出力なし・exit 0（構文OK）

- [ ] **Step 3: コミット**

```bash
git add js/store.js
git commit -m "feat: state store with localStorage persistence and subscribe"
```

---

## Task 6: HTML シェル + ポップUIテーマ

**Files:**
- Create: `index.html`
- Create: `css/styles.css`

- [ ] **Step 1: index.html を作成**

`index.html`:

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <title>💍 新婚旅行プランナー</title>
  <link rel="stylesheet" href="css/styles.css" />
</head>
<body>
  <header class="app-header">
    <h1>💍 ハネムーン・プランナー</h1>
    <p class="subtitle" id="trip-range">2026/9/12 → 9/23 ヨーロッパ</p>
  </header>

  <main id="view" class="view"><!-- 各タブがここに描画される --></main>

  <nav class="tabbar">
    <button class="tab is-active" data-tab="timeline">📅<span>旅程</span></button>
    <button class="tab" data-tab="places">🗺<span>行き先</span></button>
    <button class="tab" data-tab="budget">💰<span>予算</span></button>
  </nav>

  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: css/styles.css を作成（ポップテーマ）**

`css/styles.css`:

```css
:root {
  --bg: #fff7fb;
  --card: #ffffff;
  --ink: #3a2f3a;
  --muted: #9b8a98;
  --pink: #ff7eb6;
  --pink-soft: #ffe1ef;
  --mint: #5ed6c0;
  --mint-soft: #d8f7f0;
  --lemon: #ffd166;
  --sky: #6ec6ff;
  --sky-soft: #e2f2ff;
  --shadow: 0 6px 18px rgba(255, 126, 182, 0.15);
  --radius: 18px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, "Hiragino Kaku Gothic ProN", "Yu Gothic UI", sans-serif;
  background: var(--bg);
  color: var(--ink);
  padding-bottom: 84px; /* タブバー分 */
  line-height: 1.6;
}

.app-header {
  background: linear-gradient(135deg, var(--pink), var(--lemon));
  color: #fff;
  padding: 20px 18px 16px;
  border-radius: 0 0 26px 26px;
  box-shadow: var(--shadow);
  text-align: center;
}
.app-header h1 { font-size: 1.25rem; }
.app-header .subtitle { font-size: 0.85rem; opacity: 0.95; margin-top: 2px; }

.view { padding: 16px 14px 24px; max-width: 560px; margin: 0 auto; }

/* タブバー */
.tabbar {
  position: fixed; left: 0; right: 0; bottom: 0;
  display: flex; justify-content: space-around;
  background: #fff; box-shadow: 0 -4px 16px rgba(0,0,0,0.06);
  padding: 8px 0 calc(8px + env(safe-area-inset-bottom));
}
.tab {
  border: none; background: none; font-size: 1.4rem;
  display: flex; flex-direction: column; align-items: center;
  color: var(--muted); cursor: pointer; gap: 2px;
}
.tab span { font-size: 0.7rem; }
.tab.is-active { color: var(--pink); font-weight: 700; }

/* 汎用カード */
.card {
  background: var(--card); border-radius: var(--radius);
  box-shadow: var(--shadow); padding: 14px; margin-bottom: 12px;
}

/* 日付見出し */
.day-head {
  display: flex; align-items: baseline; gap: 8px;
  margin: 18px 4px 8px;
}
.day-head .date { font-size: 1.05rem; font-weight: 800; color: var(--pink); }
.day-head .weekday { font-size: 0.8rem; color: var(--muted); }

/* イベントカード種別色 */
.event { border-left: 6px solid var(--sky); }
.event.flight { border-left-color: var(--sky); }
.event.sightseeing { border-left-color: var(--pink); }
.event.hotel { border-left-color: var(--mint); }
.event.food { border-left-color: var(--lemon); }

.event .time { font-weight: 700; font-size: 0.95rem; }
.event .jp { color: var(--muted); font-size: 0.8rem; }
.event .ttl { font-size: 1rem; margin-top: 2px; }
.event .meta { font-size: 0.78rem; color: var(--muted); margin-top: 4px; }

.badge {
  display: inline-block; font-size: 0.72rem; padding: 2px 8px;
  border-radius: 999px; margin-right: 4px;
}
.badge.flight { background: var(--sky-soft); color: #2b7fb8; }
.badge.layover { background: var(--lemon); color: #7a5b00; }

/* チェックリスト */
.sight { display: flex; align-items: center; gap: 10px; padding: 8px 4px; }
.sight input { width: 22px; height: 22px; accent-color: var(--pink); }
.sight.done label { text-decoration: line-through; color: var(--muted); }

/* 予算バー */
.bar-row { margin: 10px 0; }
.bar-row .label { display: flex; justify-content: space-between; font-size: 0.85rem; }
.bar-track { height: 12px; background: var(--pink-soft); border-radius: 999px; overflow: hidden; }
.bar-fill { height: 100%; background: linear-gradient(90deg, var(--pink), var(--lemon)); }

.total-card { text-align: center; }
.total-card .yen { font-size: 1.8rem; font-weight: 800; color: var(--pink); }
.total-card .sub { font-size: 0.82rem; color: var(--muted); }

.fab {
  position: fixed; right: 18px; bottom: 92px;
  width: 56px; height: 56px; border-radius: 50%; border: none;
  background: var(--pink); color: #fff; font-size: 1.8rem;
  box-shadow: var(--shadow); cursor: pointer;
}

button.link { background: none; border: none; color: var(--pink); cursor: pointer; font-size: 0.8rem; }
input.edit, select.edit, textarea.edit {
  width: 100%; padding: 8px 10px; border: 1.5px solid var(--pink-soft);
  border-radius: 10px; font: inherit; margin: 4px 0;
}
```

- [ ] **Step 3: ブラウザで開いて土台が表示されることを確認**

Playwright で `index.html` を `file://` で開き、ヘッダ「💍 ハネムーン・プランナー」とタブバー3つが見えることをスクリーンショットで確認する。
（app.js 未作成のためコンソールに404が出るが、この時点では許容。次タスクで作成。）

- [ ] **Step 4: コミット**

```bash
git add index.html css/styles.css
git commit -m "feat: app shell and pop UI theme"
```

---

## Task 7: アプリ・エントリ（タブ切替）

**Files:**
- Create: `js/app.js`

- [ ] **Step 1: app.js を作成**

`js/app.js`:

```js
import { getState, subscribe } from './store.js';
import { renderTimeline } from './timeline.js';
import { renderPlaces } from './places.js';
import { renderBudget } from './budgetView.js';

const viewEl = document.getElementById('view');
let current = 'timeline';

const renderers = {
  timeline: renderTimeline,
  places: renderPlaces,
  budget: renderBudget,
};

function render() {
  const state = getState();
  viewEl.innerHTML = '';
  renderers[current](viewEl, state);
}

document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    current = btn.dataset.tab;
    render();
  });
});

// 旅行期間をヘッダに反映
const meta = getState().meta;
if (meta) {
  document.getElementById('trip-range').textContent =
    `${meta.startDate.replaceAll('-', '/')} → ${meta.endDate.slice(5).replaceAll('-', '/')} ヨーロッパ`;
}

subscribe(render); // state 変化（自分の編集 / 後でFirestore）で再描画
render();
```

- [ ] **Step 2: 構文チェック**

Run: `node --check js/app.js`
Expected: exit 0（timeline/places/budgetView は次タスクで作成。import先が無くてもこの時点では構文のみ確認）

- [ ] **Step 3: コミット**

```bash
git add js/app.js
git commit -m "feat: app entry with tab switching and store subscription"
```

---

## Task 8: タイムラインビュー

**Files:**
- Create: `js/timeline.js`

- [ ] **Step 1: timeline.js を作成**

`js/timeline.js`:

```js
import { formatLocalAndJapan } from './timezone.js';
import { update } from './store.js';

const TYPE_META = {
  flight: { cls: 'flight', icon: '🛫' },
  sightseeing: { cls: 'sightseeing', icon: '📸' },
  hotel: { cls: 'hotel', icon: '🏨' },
  food: { cls: 'food', icon: '🍽' },
};

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function weekdayOf(dateStr) {
  // タイムゾーン非依存で曜日を計算（UTC固定）
  const [y, m, d] = dateStr.split('-').map(Number);
  const idx = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return WEEKDAYS[idx];
}

function mealLabel(meals = {}) {
  const parts = [];
  if (meals.breakfast) parts.push('朝');
  if (meals.lunch) parts.push('昼');
  if (meals.dinner) parts.push('夕');
  return parts.length ? `🍽 ${parts.join('・')}` : '';
}

export function renderTimeline(root, state) {
  const byDate = {};
  for (const ev of state.events) {
    (byDate[ev.date] ||= []).push(ev);
  }
  const dates = Object.keys(byDate).sort();

  for (const date of dates) {
    const head = document.createElement('div');
    head.className = 'day-head';
    head.innerHTML =
      `<span class="date">${date.slice(5).replace('-', '/')}</span>` +
      `<span class="weekday">(${weekdayOf(date)})</span>`;
    root.appendChild(head);

    const events = byDate[date].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    for (const ev of events) {
      root.appendChild(eventCard(ev));
    }
  }

  const fab = document.createElement('button');
  fab.className = 'fab';
  fab.textContent = '＋';
  fab.title = '予定を追加';
  fab.addEventListener('click', () => addEvent(dates[0]));
  root.appendChild(fab);
}

function eventCard(ev) {
  const meta = TYPE_META[ev.type] || TYPE_META.sightseeing;
  const el = document.createElement('div');
  el.className = `card event ${meta.cls}`;

  let timeHtml = '';
  if (ev.time) {
    const t = formatLocalAndJapan(ev.city, ev.date, ev.time);
    const [local, jp] = t.split(' / ');
    timeHtml = `<div class="time">${meta.icon} ${local}` +
      (jp ? ` <span class="jp">/ ${jp}</span>` : '') + `</div>`;
  } else {
    timeHtml = `<div class="time">${meta.icon} 終日</div>`;
  }

  const layover = /待ち/.test(ev.title)
    ? `<span class="badge layover">乗継待ち</span>` : '';
  const flightBadge = ev.type === 'flight'
    ? `<span class="badge flight">${ev.city}</span>` : '';

  el.innerHTML =
    timeHtml +
    `<div class="ttl">${flightBadge}${layover}${ev.title}</div>` +
    (ev.hotel ? `<div class="meta">🏨 宿: ${ev.hotel}</div>` : '') +
    (mealLabel(ev.meals) ? `<div class="meta">${mealLabel(ev.meals)}</div>` : '');

  el.addEventListener('click', () => editEvent(ev));
  return el;
}

function editEvent(ev) {
  const title = prompt('内容を編集', ev.title);
  if (title === null) return;
  const time = prompt('時刻（HH:MM、終日は空欄）', ev.time || '');
  if (time === null) return;
  update((s) => {
    const target = s.events.find((e) => e.id === ev.id);
    if (target) { target.title = title; target.time = time; }
  });
}

function addEvent(defaultDate) {
  const date = prompt('日付（YYYY-MM-DD）', defaultDate);
  if (!date) return;
  const title = prompt('内容', '');
  if (!title) return;
  const time = prompt('時刻（HH:MM、終日は空欄）', '') || '';
  const city = prompt('都市（東京/韓国/ロンドン/パリ/ヴェネチア/ローマ）', 'パリ') || '';
  update((s) => {
    s.events.push({ id: 'e' + Date.now(), date, time, city, type: 'sightseeing', title, meals: {} });
  });
}
```

- [ ] **Step 2: 構文チェック**

Run: `node --check js/timeline.js`
Expected: exit 0

- [ ] **Step 3: コミット**

```bash
git add js/timeline.js
git commit -m "feat: timeline view with timezone-aware event cards"
```

---

## Task 9: 行き先ビュー

**Files:**
- Create: `js/places.js`

- [ ] **Step 1: places.js を作成**

`js/places.js`:

```js
import { update } from './store.js';

export function renderPlaces(root, state) {
  for (const city of state.cities) {
    const card = document.createElement('div');
    card.className = 'card';
    const doneCount = city.sights.filter((s) => s.done).length;
    card.innerHTML =
      `<div class="day-head" style="margin:0 0 6px">` +
      `<span class="date">${city.name}</span>` +
      `<span class="weekday">${city.days}・${doneCount}/${city.sights.length} 達成</span></div>`;

    city.sights.forEach((sight, i) => {
      const row = document.createElement('div');
      row.className = 'sight' + (sight.done ? ' done' : '');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = sight.done;
      cb.id = `${city.name}-${i}`;
      cb.addEventListener('change', () => {
        update((s) => {
          const c = s.cities.find((x) => x.name === city.name);
          if (c) c.sights[i].done = cb.checked;
        });
      });
      const label = document.createElement('label');
      label.setAttribute('for', cb.id);
      label.textContent = sight.name;
      row.appendChild(cb);
      row.appendChild(label);
      card.appendChild(row);
    });

    const add = document.createElement('button');
    add.className = 'link';
    add.textContent = '＋ 行きたい場所を追加';
    add.addEventListener('click', () => {
      const name = prompt(`${city.name}で行きたい場所`, '');
      if (!name) return;
      update((s) => {
        const c = s.cities.find((x) => x.name === city.name);
        if (c) c.sights.push({ name, done: false });
      });
    });
    card.appendChild(add);
    root.appendChild(card);
  }
}
```

- [ ] **Step 2: 構文チェック**

Run: `node --check js/places.js`
Expected: exit 0

- [ ] **Step 3: コミット**

```bash
git add js/places.js
git commit -m "feat: places view with sightseeing checklist"
```

---

## Task 10: 予算ビュー

**Files:**
- Create: `js/budgetView.js`

- [ ] **Step 1: budgetView.js を作成**

`js/budgetView.js`:

```js
import { totalPlanned, totalActual, perPerson, toEUR, remaining } from './budget.js';
import { update } from './store.js';

const COLORS = ['#ff7eb6', '#ffd166', '#5ed6c0', '#6ec6ff', '#c08cff', '#ff9f7e'];

export function renderBudget(root, state) {
  const items = state.budget;
  const rate = state.meta?.rates?.EUR || 180;
  const people = state.meta?.people || 2;
  const planned = totalPlanned(items);

  // 合計カード
  const total = document.createElement('div');
  total.className = 'card total-card';
  total.innerHTML =
    `<div class="sub">総予算</div>` +
    `<div class="yen">¥${planned.toLocaleString()}</div>` +
    `<div class="sub">1人あたり ¥${perPerson(planned, people).toLocaleString()}` +
    ` ／ €${toEUR(planned, rate).toLocaleString()}</div>` +
    `<div class="sub">実績 ¥${totalActual(items).toLocaleString()}` +
    `（残 ¥${remaining(items).toLocaleString()}）</div>`;
  root.appendChild(total);

  // 内訳バー
  const breakdown = document.createElement('div');
  breakdown.className = 'card';
  items.forEach((it, i) => {
    const pct = planned ? Math.round((it.planned / planned) * 100) : 0;
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML =
      `<div class="label"><span>${it.category}</span>` +
      `<span>¥${it.planned.toLocaleString()}（${pct}%）</span></div>` +
      `<div class="bar-track"><div class="bar-fill" style="width:${pct}%;` +
      `background:${COLORS[i % COLORS.length]}"></div></div>`;
    row.addEventListener('click', () => editBudget(it));
    breakdown.appendChild(row);
  });
  root.appendChild(breakdown);

  const hint = document.createElement('p');
  hint.className = 'sub';
  hint.style.textAlign = 'center';
  hint.textContent = '項目をタップで予算/実績を編集';
  root.appendChild(hint);
}

function editBudget(item) {
  const planned = prompt(`${item.category} の予算（円）`, item.planned);
  if (planned === null) return;
  const actual = prompt(`${item.category} の実績（円）`, item.actual);
  if (actual === null) return;
  update((s) => {
    const t = s.budget.find((b) => b.category === item.category);
    if (t) { t.planned = Number(planned) || 0; t.actual = Number(actual) || 0; }
  });
}
```

- [ ] **Step 2: 構文チェック**

Run: `node --check js/budgetView.js`
Expected: exit 0

- [ ] **Step 3: 全テスト緑を確認**

Run: `npm test`
Expected: PASS（timezone + budget）

- [ ] **Step 4: コミット**

```bash
git add js/budgetView.js
git commit -m "feat: budget view with breakdown bars and edit"
```

---

## Task 11: ブラウザ実機確認（localページ全体）

**Files:** なし（検証のみ）

- [ ] **Step 1: ローカルサーバを起動**

ES Modules は `file://` だと CORS で読めないため、ローカルサーバ経由で開く。

Run（バックグラウンド）: `npx --yes serve -l 5180 .` もしくは `python -m http.server 5180`
Expected: `http://localhost:5180` で配信開始

- [ ] **Step 2: Playwright で3タブを確認**

`http://localhost:5180/index.html` を開き、以下をスクリーンショット＆スナップショットで確認:
- 📅 旅程: 9/12〜9/23 の日付見出しが並び、各カードに現地時刻＋🇯🇵日本時刻が出る。ロンドン到着 14:20 に「🇯🇵22:20」が併記される。韓国の乗継カードに「乗継待ち」バッジ。
- 🗺 行き先: ロンドン/パリ/ヴェネチア/ローマのカードと見どころチェックボックス。チェックすると取り消し線。
- 💰 予算: 総予算 ¥1,918,410、1人あたり ¥959,205、内訳バーが11項目。

- [ ] **Step 3: 編集の永続化を確認**

予算タブで1項目の実績を入力 → リロード → 入力値が残っている（localStorage 永続化）ことを確認。

- [ ] **Step 4: 問題があれば修正してコミット**

```bash
git add -A
git commit -m "fix: adjustments from local browser verification"
```

（修正が無ければこのコミットはスキップ）

---

## Task 12: Firebase リアルタイム同期レイヤー（ユーザーと一緒に設定）

store.js の永続化を localStorage から Firestore に差し替え、`onSnapshot` で双方向同期する。Firebase プロジェクト作成はユーザーと共同で実施。

**Files:**
- Create: `firebase-config.example.js`
- Modify: `js/store.js`
- Modify: `index.html`（URLに tripId が無い場合の生成）

- [ ] **Step 1: 設定キーの雛形を作成**

`firebase-config.example.js`:

```js
// このファイルを firebase-config.local.js にコピーし、
// Firebase コンソールの「ウェブアプリ」設定値を貼り付ける。
// firebase-config.local.js は .gitignore 済み（キーを公開リポジトリに入れない）。
export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};
```

- [ ] **Step 2: ユーザーと一緒に Firebase 設定（対話手順）**

実装担当はここで停止し、ユーザーに以下を案内して一緒に進める:
1. https://console.firebase.google.com でプロジェクト作成（無料 Spark プラン）
2. 「ウェブアプリを追加」→ 表示される config を `firebase-config.local.js` に貼り付け
3. Firestore Database を作成（本番モードで作成し、下記ルールを貼る）
4. セキュリティルール（2人共有・認証なし運用。tripId を知る人のみ読書き可）:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /trips/{tripId} {
      allow read, write: if true; // tripIdが推測困難な前提の簡易運用
    }
  }
}
```
   ※ より安全にしたい場合は後タスクで Firebase 匿名認証を追加可能（スコープ外）。

- [ ] **Step 3: store.js を Firestore 同期に差し替え**

`js/store.js` を以下に置き換える（localStorage はオフライン保険として残す）:

```js
import { SEED } from './seed.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { firebaseConfig } from '../firebase-config.local.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const KEY = 'honeymoon-planner-state';
let state = loadLocal();
let tripRef = null;
let applyingRemote = false;
const listeners = new Set();

function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return structuredClone(SEED);
}

function persistLocal() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

// URLの ?trip=xxxx を取得（無ければ生成してURLに付与）
function getTripId() {
  const url = new URL(location.href);
  let id = url.searchParams.get('trip');
  if (!id) {
    id = 't-' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
    url.searchParams.set('trip', id);
    history.replaceState(null, '', url.toString());
  }
  return id;
}

export async function initSync() {
  const tripId = getTripId();
  tripRef = doc(db, 'trips', tripId);
  const snap = await getDoc(tripRef);
  if (snap.exists()) {
    state = snap.data();
    persistLocal();
    notify();
  } else {
    await setDoc(tripRef, state); // 初回：ローカル（シード）をクラウドへ
  }
  onSnapshot(tripRef, (s) => {
    if (!s.exists()) return;
    applyingRemote = true;
    state = s.data();
    persistLocal();
    notify();
    applyingRemote = false;
  });
}

export function getState() { return state; }

export function update(updater) {
  updater(state);
  if (state.meta) state.meta.updatedAt = Date.now();
  persistLocal();
  notify();
  if (tripRef && !applyingRemote) {
    setDoc(tripRef, state).catch((e) => console.warn('cloud save failed', e));
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() { for (const fn of listeners) fn(state); }

export function shareUrl() { return location.href; }
```

- [ ] **Step 4: app.js で同期を初期化＋共有ボタンを追加**

`js/app.js` の先頭 import に `initSync, shareUrl` を追加し、`render()` 前に同期開始する。
`import { getState, subscribe } from './store.js';` を
`import { getState, subscribe, initSync, shareUrl } from './store.js';` に変更し、
ファイル末尾の `render();` の直前に以下を追加:

```js
// 共有ボタン（ヘッダに追加）
const shareBtn = document.createElement('button');
shareBtn.className = 'link';
shareBtn.textContent = '🔗 共有リンクをコピー';
shareBtn.style.cssText = 'display:block;margin:8px auto 0;color:#fff;';
shareBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shareUrl());
    shareBtn.textContent = '✅ コピーしました！LINEで送ろう';
    setTimeout(() => (shareBtn.textContent = '🔗 共有リンクをコピー'), 2000);
  } catch (e) {
    prompt('このURLをコピーして共有してください', shareUrl());
  }
});
document.querySelector('.app-header').appendChild(shareBtn);

initSync().catch((e) => console.warn('sync init failed, offline mode', e));
```

- [ ] **Step 5: ブラウザで同期を確認（2タブ）**

ローカルサーバで開き、同じ `?trip=xxxx` URL を2つのタブで開く。片方で予定を編集 → もう片方が数秒以内に自動更新されることを確認。

- [ ] **Step 6: コミット**

```bash
git add firebase-config.example.js js/store.js js/app.js
git commit -m "feat: Firebase Firestore real-time sync with shareable trip URL"
```

---

## Task 13: GitHub Pages 公開

**Files:** なし（デプロイ作業。ユーザーと一緒に実施）

- [ ] **Step 1: GitHub リポジトリ作成＆push**

ユーザーと一緒に GitHub リポジトリ（public）を作成し push する。
注意: `firebase-config.local.js` は .gitignore 済みのため push されない。
→ GitHub Pages では実キーが必要なので、Step 2 で対応する。

- [ ] **Step 2: 公開用に config を配置**

GitHub Pages は静的配信のみで秘密を隠せない。Firestore のルールが「tripId を知る人のみ」運用のため、apiKey 等は公開されても許容範囲（Firebase の web apiKey は秘密鍵ではない）。
公開リポジトリに含めるため、`firebase-config.local.js` の中身を `firebase-config.js` として別名でコミットし、`store.js` / `example` の import を必要に応じ合わせる。
（より厳密に隠したい場合は将来 Firebase 匿名認証＋ドメイン制限を追加。今回はスコープ外。）

- [ ] **Step 3: Pages 有効化**

GitHub リポジトリ Settings → Pages → Branch: main / root を選択。
発行された URL（例: https://USER.github.io/honeymoon-planner/）をスマホで開いて動作確認。

- [ ] **Step 4: 妻へ共有**

アプリで「🔗 共有リンクをコピー」→ `?trip=xxxx` 付きURLを LINE で送信。
両者が同じ URL を開き、同時編集が反映されることを最終確認。

- [ ] **Step 5: README とコミット**

`README.md` に公開URL・共有方法・Firebase設定手順を簡潔に記載しコミット。

---

## Self-Review メモ（spec 対応確認）

- モバイル優先レスポンシブ → Task 6 CSS（max-width 560px、タブバー固定）
- ポップUI → Task 6 配色トークン（ピンク/レモン/ミント）
- カレンダー縦タイムライン → Task 8
- 時差対応（現地＋日本併記）→ Task 2 + Task 8
- フライト/乗継可視化 → Task 8（flightバッジ・乗継待ちバッジ）
- 予算可視化（内訳/合計/1人/€/予算vs実績）→ Task 3 + Task 10
- 共同編集（リアルタイム）→ Task 12
- GitHub Pages 公開・LINE共有 → Task 12（共有URL）+ Task 13
- 初期データ投入 → Task 4
- Firebase初回設定をユーザーと一緒に → Task 12 Step 2 / Task 13

全 spec 要件にタスクが対応。プレースホルダ無し。型整合（getState/update/subscribe/initSync/shareUrl）一貫。
