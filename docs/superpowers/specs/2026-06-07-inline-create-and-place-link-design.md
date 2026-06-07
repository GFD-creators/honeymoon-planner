# 旅程への直接入力＋行き先連動 設計仕様書

作成日: 2026-06-07
ステータス: 設計確定（ユーザー承認済み）
対象アプリ: ハネムーン・プランナー（既存。ドラッグ編集 `2026-06-07-drag-edit-design.md` の続き）

## 1. 目的 / 背景

(1) 週グリッド上で予定を直接作れるようにする。(2) 行き先（sight）に日時を設定すると
旅程（event）に自動で反映され、リンクが維持される（双方向で一致）ようにする。

## 2. 確定要件

### 機能① 旅程への直接入力
- **週グリッドの空き時間帯をタップ**→その列の日付＋タップ位置の時刻（30分スナップ）が入った状態で編集シートが開く→保存で予定追加
- **リスト表示**：各日付ヘッダに小さな「＋」を付け、その日付で新規追加
- 既存の右下「＋」FAB は残す（初期日付で追加）

### 機能② 行き先 → 旅程 自動連動（単一ソース方式）
- 予定（event）を唯一の正とし、行き先（sight）は `eventId` でリンクするだけ
- 行き先の各項目に「🗓 旅程に追加」→ 編集シートで日付・時刻入力→保存→旅程に予定生成（type=sightseeing、city=その行き先の都市）し、sight に eventId を保存
- 追加済みの項目は「🗓 M/D HH:MM（タップで編集）／解除」を表示。**表示日時はリンク先 event から読む**（旅程側でドラッグ移動しても行き先表示に反映）
- 「解除」→ リンク先 event を削除し sight.eventId をクリア
- リンク切れ（event が見つからない）→ 未追加表示に戻し、stale な eventId を描画時にクリア

## 3. スコープ外（YAGNI）

- 行き先名と予定タイトルの常時同期（作成時にコピーのみ）
- 終日予定の空きマス作成（時刻ありブロック作成に集中。終日は既存 FAB から）
- 予定を旅程側で削除したときに sight.eventId を即時クリア（描画時のリンク切れ判定で吸収）

## 4. アーキテクチャ / ファイル構成

```
js/
├ editor.js     — 変更。openEditor のシグネチャ拡張（初期値・保存後コールバック）
├ weekview.js   — 変更。空きマスのタップで作成
├ timeline.js   — 変更。リスト各日ヘッダに「＋」
├ places.js     — 変更。行き先に「追加/編集/解除」、リンク先予定の日時表示
├ link.js       — 新規。行き先↔予定のリンク解決の純粋関数（テスト対象）
css/styles.css  — 追加。日ヘッダ＋ / 行き先の日時バッジ・ボタン
tests/
└ link.test.js  — 新規。link.js の単体テスト
```

`store.js` / `seed.js` / `week.js` / `drag.js` / `budget*.js` は変更しない。

## 5. データモデル変更（後方互換）

- `sight` に任意 `eventId`（リンク先 event の id）を追加。未設定なら未スケジュール
- `event` は既存構造のまま（date/time/endTime/city/type/title）。行き先由来でも通常の予定と同一に扱う（ドラッグ・編集・リサイズが効く）

## 6. editor.js のインターフェース変更

現在: `openEditor(event, defaultDate)`
変更後: `openEditor(event, opts)` ただし opts は任意オブジェクト:

```
opts = {
  defaultDate,                 // 新規時の初期日付（'YYYY-MM-DD'）
  defaultTime,                 // 新規時の初期開始時刻（'HH:MM'、省略可）
  prefill: { title, city, type }, // 新規時の初期値（省略可）
  onSaved(eventId, isNew),     // 保存後コールバック（省略可）
}
```

- 後方互換: opts が文字列で渡された場合は従来通り defaultDate として扱う
- 新規イベントの初期値に defaultDate/defaultTime/prefill を反映
- 保存時、`update` で作成/更新した後に `opts.onSaved?.(ev.id, isNew)` を呼ぶ（isNew は新規か）

## 7. link.js のインターフェース（純粋関数・テスト対象）

```
findLinkedEvent(events, sight) -> event | null
  sight.eventId に一致する event を返す。無ければ null。

isScheduled(events, sight) -> boolean
  findLinkedEvent が非 null なら true。
```

## 8. weekview.js の変更（空きマス作成）

- 各 `.col-body` に click ハンドラを追加:
  - `if (e.target.closest('.event-block')) return;`（ブロック上は従来の編集）
  - クリックの clientY と当該列の `getBoundingClientRect().top` から
    `minutesToTime(snapMinutes(topToMinutes(clientY - top, GRID), 30))` で時刻算出
  - `openEditor(null, { defaultDate: body.dataset.date, defaultTime: 算出時刻 })`
- ブロックのドラッグ/タップは現状維持（ブロックは pointer、空きマス作成は click なので競合しない）

## 9. timeline.js の変更（リスト各日に＋）

- `renderList` の各 `.day-head` に小さな「＋」ボタンを追加し、
  `openEditor(null, { defaultDate: その日付 })` を呼ぶ
- 既存 FAB は `openEditor(null, { defaultDate: firstDate })` に置き換え（opts 形式へ統一）

## 10. places.js の変更（行き先連動）

各 sight 行に、リンク状態に応じた表示:
- `findLinkedEvent(state.events, sight)` で解決
- 見つかった場合: 「🗓 M/D HH:MM」（event.date/time から整形）を表示。タップで
  `openEditor(linkedEvent)`（通常の編集）。「解除」ボタンで
  `update` により該当 event を削除し sight.eventId を削除
- 見つからない場合: sight.eventId が残っていれば描画時に削除（stale クリア）。
  「🗓 旅程に追加」ボタンを表示 → クリックで
  `openEditor(null, { defaultDate: tripStart, defaultTime: '10:00', prefill: { title: sight.name, city: cityName, type: 'sightseeing' }, onSaved: (id) => update((s)=>{ 対象sight.eventId = id; }) })`
  - cityName は sight が属する都市カードの名前
  - tripStart は `state.meta.startDate`

## 11. CSS 追加

- `.day-head .add-day`（リストの日ヘッダ＋）: 小さな丸ボタン
- `.sight-schedule`（行き先の日時バッジ）, `.sight-actions`（追加/解除ボタン）

## 12. テスト方針

- **link.js**: 単体テスト（findLinkedEvent 一致/不一致/eventId未設定、isScheduled）
- **ブラウザ実機（Playwright）**:
  - 週グリッドの空きマスをタップ→その日時で編集シートが開き、保存で予定が増える
  - リスト日ヘッダの＋→その日付で追加
  - 行き先「旅程に追加」→日時入力→保存→旅程（週/リスト）に観光予定が出る、行き先に日時バッジ
  - その予定を旅程側でドラッグ移動→行き先の日時表示も変わる（双方向一致）
  - 行き先「解除」→旅程から消える／旅程側で削除→行き先が未追加に戻る
  - 変更が Firestore 同期で2タブ目に反映

## 13. 成功基準

- 週グリッドの空き時間をタップして、その日付・時刻で予定を作れる
- リストの各日に＋で予定を追加できる
- 行き先に日時を入れると旅程に観光予定が出て、都市の時差も併記される
- 行き先と旅程がリンクで一致し、片方の変更がもう片方に反映される
- 既存データ（eventId 未設定の行き先）がそのまま動作する
