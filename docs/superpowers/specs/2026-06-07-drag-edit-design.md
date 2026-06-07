# 週グリッドのドラッグ編集（移動＋リサイズ）設計仕様書

作成日: 2026-06-07
ステータス: 設計確定（ユーザー承認済み）
対象アプリ: ハネムーン・プランナー（既存。週カレンダー表示 `2026-06-07-week-calendar-view-design.md` の続き）

## 1. 目的 / 背景

週グリッド上の時刻ブロックを、ドラッグで直感的に「移動（時刻・日付変更）」「リサイズ（長さ変更）」
できるようにする。タップ編集（編集シート）は残し、ドラッグを追加する。

## 2. 確定要件

- **移動**: 時刻ブロックを上下ドラッグで開始時刻変更、左右の列ドラッグで日付変更。所要時間（長さ）は保持
- **リサイズ**: ブロック下端のハンドルを上下ドラッグで終了時刻（長さ）変更
- **スナップ**: 30分単位
- **リサイズ最小**: 30分
- **タップ**: 指/カーソルを動かさず離したら従来の編集シートを開く
- **対象**: 時刻ありブロックのみ。終日チップはドラッグ対象外（タップ編集のみ）
- **入力**: Pointer Events でマウス/タッチ統一。ブロックは `touch-action: none`
- **タップ/ドラッグ判定**: pointerdown から 6px 以上動いたらドラッグ、未満で離したらタップ
- 確定時は `store.update` で保存し、既存の Firestore リアルタイム同期に乗る

## 3. スコープ外（YAGNI）

- 終日チップのドラッグ移動（タップ編集で対応）
- 長押し（long-press）でのドラッグ起動（採用しない。`touch-action:none`＋移動量判定で代替）
- 重なり予定の高度な再配置（既存の簡易レーン横並びのまま）
- 別の週へまたぐドラッグ（表示中の7日内のみ）

## 4. アーキテクチャ / ファイル構成

```
js/
├ week.js        — 変更。純粋関数を追加（snapMinutes / topToMinutes / minutesToTime）。テスト追加
├ drag.js        — 新規。ポインタのドラッグ／リサイズ処理。確定時に patch を返す
├ weekview.js    — 変更。各ブロックに下端ハンドル追加、drag.js を接続、列座標を渡す
css/styles.css   — 追加。touch-action / ドラッグ中の見た目 / リサイズハンドル
tests/
└ week.test.js   — 変更。追加した純粋関数のテストを足す
```

`editor.js` / `store.js` / `timeline.js` / `seed.js` は変更しない（タップ時は既存 `openEditor` を呼ぶ）。

グリッド定数は weekview.js の既存 `GRID = { startHour: 0, endHour: 24, hourHeight: 48 }` を流用。スナップは30分。

## 5. week.js に追加する純粋関数

```
snapMinutes(min, step=30) -> number
  step 単位に四捨五入。例: snapMinutes(74, 30)=60, snapMinutes(75, 30)=90。

topToMinutes(topPx, opts) -> number
  minutesToTop の逆。startHour*60 + (topPx / hourHeight) * 60。

minutesToTime(min) -> 'HH:MM'
  分を時刻文字列へ。0未満は0、1440以上は1439にクランプ。
```

`opts` は `{ startHour, hourHeight }`（既存と同じ）。

## 6. drag.js のインターフェース

```
attachDrag(blockEl, ev, ctx)
  blockEl: 対象ブロックの DOM 要素
  ev:      対象イベント（id, date, time, endTime…）
  ctx: {
    opts,                  // GRID（startHour, endHour, hourHeight）
    snapStep,              // 30
    getColumns(),          // [{ date, rect }] 各日列の現在の画面座標（getBoundingClientRect）
    bodyTopOf(date),       // その列 col-body の画面上端Y（px）
    onCommit(id, patch),   // 確定時。patch = { time } / { time, endTime } / { date, time, endTime }
    onTap(ev),             // タップ確定時（openEditor を呼ぶ）
  }
```

- blockEl 本体の pointerdown → 移動ドラッグ候補。下端ハンドルの pointerdown → リサイズ。
- 6px 未満で離す→ `onTap(ev)`。6px 以上動く→ドラッグ確定時に `onCommit`。
- 移動: 新 date = ポインタ clientX が入る列の date。新 start 分 = `snapMinutes(topToMinutes(clientY - bodyTop, opts), 30)`。
  endTime があれば start の移動量と同じ分だけずらして維持。patch = { date, time, endTime? }。
- リサイズ: 新 end 分 = `max(start+30, snapMinutes(topToMinutes(pointerY - bodyTop, opts), 30))`。patch = { endTime }。
- 時刻は `minutesToTime` で 'HH:MM' に。

## 7. weekview.js の変更

- 各 `.event-block` 描画時:
  - 末尾に `.resize-handle`（下端の小さな掴み代）を追加
  - 既存の `block.addEventListener('click', openEditor)` を**削除**し、代わりに `attachDrag(block, ev, ctx)` を呼ぶ（タップ時に `openEditor(ev)` が呼ばれる）
- `ctx` を構築:
  - `getColumns()`: 各曜日列の `.col-body` 要素から `{ date, rect: el.getBoundingClientRect() }`
  - `bodyTopOf(date)`: 同上 rect.top
  - `onCommit(id, patch)`: `update((s) => { const t = s.events.find(e=>e.id===id); if (t) Object.assign(t, patch); })`
  - `onTap(ev)`: `openEditor(ev)`
- 列座標はドラッグ開始時に取得（横スクロール位置を反映するため、pointerdown 時点で取得）

## 8. CSS 追加

- `.event-block { touch-action: none; }`（ドラッグ中にスクロールを奪われない）
- `.event-block.dragging { opacity: 0.85; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 5; }`
- `.resize-handle { position:absolute; left:0; right:0; bottom:0; height:10px; cursor: ns-resize; }`

## 9. テスト方針

- **week.js 追加関数**: 単体テスト（snapMinutes の丸め境界、topToMinutes が minutesToTop の逆になること、minutesToTime のクランプ）
- **drag.js / weekview 連携**: ブラウザ実機（Playwright）。
  - ブロックを下へドラッグ→開始時刻が30分刻みで増える
  - ブロックを隣の列へドラッグ→日付が変わる
  - 下端ハンドルをドラッグ→終了時刻（高さ）が変わる
  - ブロックを動かさずクリック→編集シートが開く（タップ判定）
  - 変更が `store.update`→Firestore 同期で2タブ目に反映

## 10. 成功基準

- 週グリッドで時刻ブロックをドラッグして時刻・日付を変更でき、30分にスナップする
- 下端ハンドルで所要時間（終了時刻）を変更できる（最低30分）
- 動かさずにタップすれば従来通り編集シートが開く（誤操作で動かない）
- 変更がリスト表示・予算・Firestore（妻側）に反映される
- スマホ幅でもブロックをドラッグでき、グリッドのスクロールと致命的に競合しない
