# 旅程の料金入力＋予算の実費集計 設計仕様書

作成日: 2026-06-07
ステータス: 設計確定（ユーザー承認済み）
対象アプリ: ハネムーン・プランナー（既存）

## 1. 目的 / 背景

旅程の各予定に料金とカテゴリ（航空券・食事など）を入力でき、予算タブで
「実費」としてカテゴリ別に集計し合計を表示する。既存の「予算（見積もり）」内訳は残す。

## 2. 確定要件

### 機能① 旅程に料金入力
- 予定の編集シートに「料金（円・任意）」と「カテゴリ（選択）」を追加
- カテゴリ固定リスト: 航空券 / ホテル / 食事 / 交通 / 観光チケット / Wi-Fi・eSIM / 海外保険 / 前撮り / その他、加えて未設定（空）
- リスト表示の予定カードに料金を「💴 ¥12,000」と小さく表示（料金>0のときのみ）

### 機能② 予算タブで実費集計
- 既存「予算（見積もり）」内訳・合計はそのまま
- 新セクション「🧾 旅程の実費」: 旅程の料金をカテゴリ別に自動集計（amount>0 のみ表示）、未分類は最後に表示
- 「実費合計 ¥Z」を表示。料金未入力なら案内文を表示
- 上部の合計カードに「実費合計 ¥Z」を1行追加

## 3. スコープ外（YAGNI）

- 予算（見積もり）側との自動連動・置き換え
- 実費の通貨換算・1人あたり実費
- 週グリッドのブロックへの料金表示（リストのみ）

## 4. アーキテクチャ / ファイル構成

```
js/
├ budget.js     — 変更。COST_CATEGORIES / totalCost(events) / costByCategory(events) 追加（純粋・テスト）
├ editor.js     — 変更。料金・カテゴリの入力欄、保存に cost/costCategory を追加
├ budgetView.js — 変更。実費セクション＋合計カードへの実費合計
├ timeline.js   — 変更。リストカードに料金表示
css/styles.css  — 追加（料金表示・実費セクション）
tests/
└ budget.test.js — 変更。totalCost / costByCategory のテスト
```

`store.js` / `weekview.js` / `drag.js` / `week.js` / `places.js` / `link.js` / `seed.js` は変更しない。

## 5. データモデル変更（後方互換）

- `event` に任意 `cost`（数値・円）と `costCategory`（カテゴリ名 or 空文字）を追加
- 既存データ（cost 未設定）はそのまま動作（未入力＝集計対象外）

## 6. budget.js に追加（純粋関数）

```
COST_CATEGORIES -> ['航空券','ホテル','食事','交通','観光チケット','Wi-Fi・eSIM','海外保険','前撮り','その他']
  カテゴリの固定順リスト（編集シートの選択肢・集計表示順に使う）。

totalCost(events) -> number
  events の cost（数値化、無効は0）の総和。

costByCategory(events) -> [{ category, amount }]
  cost>0 の予定をカテゴリ別に合計。COST_CATEGORIES の順で amount>0 のものを並べ、
  COST_CATEGORIES に無い／空のカテゴリでコストがあるものは末尾に { category:'未分類', amount } として1件にまとめる。
```

## 7. editor.js の変更

- フィールド追加（種別/日付/時刻の下あたり）:
  - 料金: `<input type="number" id="ed-cost" min="0" step="100">`（初期値 ev.cost || ''）
  - カテゴリ: `<select id="ed-costcat">`（先頭に「（未分類）」= 空、続けて COST_CATEGORIES）
- 保存 patch に追加:
  - `cost`: 入力を数値化（空や NaN は 0）
  - `costCategory`: 選択値（空可）

## 8. budgetView.js の変更

- 上部の合計カードに行追加: 「実費合計 ¥{totalCost(events)}」
- 内訳カードの後に新カード「🧾 旅程の実費」:
  - `costByCategory(events)` を行表示（カテゴリ名 … ¥amount）
  - フッターに「実費合計 ¥{totalCost}」
  - 配列が空なら案内文「旅程の予定に料金を入れると、ここに集計されます」
- `renderBudget(root, state)` は state.events を参照する（既に state を受け取っている）

## 9. timeline.js の変更

- `renderList` の `eventCard` に、`ev.cost > 0` のとき meta 行を追加: `💴 ¥{ev.cost.toLocaleString()}`（カテゴリがあれば「💴 ¥X（カテゴリ）」）

## 10. テスト方針

- **budget.js**: totalCost（合算・無効値0・空配列0）、costByCategory（カテゴリ別集計、順序、未分類まとめ、空配列）
- **ブラウザ実機（Playwright）**:
  - 予定編集シートで料金・カテゴリを入力→保存→リストカードに「💴 ¥」表示
  - 予算タブの「旅程の実費」にカテゴリ別＋実費合計が出る
  - 複数予定・複数カテゴリ・未分類の集計が正しい
  - 変更が Firestore 同期で2タブ目に反映

## 11. 成功基準

- 旅程の予定に料金とカテゴリを入力でき、リストに料金が見える
- 予算タブにカテゴリ別の実費と実費合計が表示される
- 既存の予算（見積もり）内訳はそのまま残る
- 既存データ（料金未設定）がそのまま動作する
