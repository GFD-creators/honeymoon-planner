# 週タブの旅行期間ページ化 設計仕様書

作成日: 2026-06-07
ステータス: 設計確定（ユーザー承認済み）
対象アプリ: ハネムーン・プランナー（既存。週カレンダー表示の修正）

## 1. 目的 / 背景

週タブが日〜土のカレンダー週で、前後どの週にも移動でき、初週（9/6〜9/12）に空き日が多い。
旅行は9/12〜9/23しか使わないため、週タブを**出発日起点の旅行ページ**に変更し、期間内だけを表示する。

## 2. 確定要件

- 日〜土のカレンダー週をやめ、**出発日（meta.startDate）起点の7日ページ**にする
  - ページ1: 9/12〜9/18（7日）／ページ2: 9/19〜9/23（5日。期間末 meta.endDate でクランプ）
- 各列の曜日見出しは、その日付の実際の曜日を表示
- ナビ「‹ 前」「次 ›」は旅行ページ内だけ移動（先頭で「前」、末尾で「次」は無効化＝押しても動かない）
- 初期表示はページ1（出発日を含むページ）
- 既存機能（空きマスタップ作成・ドラッグ移動/リサイズ・タップ編集・終日行・横スクロール）は維持

## 3. スコープ外（YAGNI）

- 旅行期間外の予定の週表示（期間内のみ。期間外の予定はリスト表示には出る）
- ページ番号インジケータ等の追加UI
- 「旅程の週へ」ボタン（ページ制限により不要なので削除）

## 4. アーキテクチャ / ファイル構成

```
js/
├ week.js     — 変更。addDays / weekdayIndex / daysBetween を追加（純粋・テスト対象）
├ weekview.js — 変更。currentWeekStart（日曜起点）→ currentPage（0始まり）。ページ計算とナビ制限
tests/
└ week.test.js — 変更。追加関数のテスト
```

`editor.js` / `drag.js` / `store.js` / `timeline.js` / `places.js` / `link.js` / `seed.js` / `css` は変更しない。
グリッド定数 `GRID = { startHour: 0, endHour: 24, hourHeight: 48 }` は流用。

## 5. week.js に追加する純粋関数

```
addDays(dateStr, n) -> 'YYYY-MM-DD'
  日付を n 日進める（負も可）。UTC基準。

weekdayIndex(dateStr) -> 0..6
  曜日番号（0=日 … 6=土）。UTC基準。

daysBetween(startStr, endStr) -> number
  end - start の日数差（整数）。例: daysBetween('2026-09-12','2026-09-23') = 11。
```

既存の内部関数（dateToUTC/utcToDateStr/DAY_MS）を再利用する。

## 6. weekview.js の変更

- モジュール状態 `currentWeekStart` を **`currentPage`（0始まりの整数、初期 0）** に置き換え
- `renderWeekView` 冒頭で旅行範囲からページを計算:
  - `start = state.meta.startDate`（無ければ '2026-09-12'）, `end = state.meta.endDate`（無ければ '2026-09-23'）
  - `lastPage = Math.floor(daysBetween(start, end) / 7)`
  - `currentPage` を 0..lastPage にクランプ
  - `pageStart = addDays(start, currentPage * 7)`
  - `pageEndCandidate = addDays(pageStart, 6)`
  - 当該ページの最終日 = `pageEndCandidate <= end ? pageEndCandidate : end`
  - `days` = pageStart から最終日まで（1〜7日）の配列
- ナビ:
  - 「‹ 前」: `currentPage > 0` のとき `currentPage--` して再描画。0 のときは無効（クリックしても何もしない＋見た目を薄く）
  - 「次 ›」: `currentPage < lastPage` のとき `currentPage++` して再描画。末尾では無効
  - ラベルは現状どおり「`pageStart.slice(5)` 〜 `最終日.slice(5)`」
  - 既存の「旅程の週へ」ボタンは削除
- 曜日見出し: 列インデックス固定の `WEEKDAYS[i]` をやめ、`WEEKDAYS[weekdayIndex(d)]` を使う
- in-trip 判定は不要（表示する日付は常に期間内）だが、既存の in-trip ハイライトはそのまま全列に適用されても可（全列が期間内＝全列ハイライト）。視覚上の整合のため `inTrip` 判定は維持してよい
- 列数が 5 でも既存 CSS（flex 列・横スクロール）で成立する

## 7. テスト方針

- **week.js**: addDays（月またぎ・負）/ weekdayIndex（9/12=6土, 9/13=0日）/ daysBetween（11、0、逆順で負）の単体テスト
- **ブラウザ実機（Playwright）**:
  - 週タブ初期表示が 9/12〜9/18（ページ1）で、列の曜日が正しい（土,日,月…）
  - 「次 ›」で 9/19〜9/23（5列）に移動
  - 末尾で「次」がそれ以上進まない、先頭で「前」が戻らない
  - 既存の予定ブロック・空きマス作成・ドラッグが従来どおり動く

## 8. 成功基準

- 週タブが 9/12 から始まり、9/6〜の空き週や期間外の週が出ない
- 2ページ（9/12〜9/18 / 9/19〜9/23）だけを行き来できる
- 列の曜日表示が日付に対して正しい
- ドラッグ・空きマス作成・編集など既存機能が壊れない
