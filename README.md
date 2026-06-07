# 💍 ハネムーン・プランナー

新婚旅行（2026/9/12〜9/23 ヨーロッパ周遊）のスケジュール・行き先・予算を可視化し、
夫婦2人がURL共有でリアルタイム共同編集できるWebアプリ。

## 特徴

- 📅 **旅程タイムライン** — 日付ごとの縦タイムライン。現地時刻＋日本時刻を併記、フライト/乗継待ちを可視化
- 🗺 **行き先＆やること** — 都市ごとの見どころチェックリスト
- 💰 **予算** — 内訳バー、総額/1人あたり/ユーロ換算、予算 vs 実績
- 🔗 **リアルタイム共同編集** — `?trip=xxxx` 付きURLを共有すれば2人で同時編集、Firebaseで即同期

## 技術構成

- バニラ HTML / CSS / JavaScript（ES Modules、ビルド不要）
- Firebase Firestore（リアルタイム同期）
- GitHub Pages（ホスティング）

## 使い方

1. 公開URLを開く（初回アクセス時に `?trip=ランダムID` が自動付与される）
2. ヘッダの「🔗 共有リンクをコピー」でURLをコピー
3. LINE等で妻に送る → 同じURLを開けば2人で同時編集できる

## ローカル開発

ES Modules はローカルサーバ経由で開く必要がある（`file://` 不可）。

```bash
npx serve -l 5180 .
# → http://localhost:5180/ を開く
```

テスト（時差変換・予算計算の純粋ロジック）：

```bash
npm test
```

## Firebase 設定

`firebase-config.js` に Firebase ウェブアプリの設定値を記載。
web apiKey は秘密鍵ではなく公開前提の識別子で、アクセス制御は Firestore セキュリティルールで行う。

Firestore ルール（2人共有・tripID を知る人のみアクセスの簡易運用）：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /trips/{tripId} {
      allow read, write: if true;
    }
  }
}
```

## 設計ドキュメント

- 仕様: `docs/superpowers/specs/2026-06-07-honeymoon-planner-design.md`
- 実装計画: `docs/superpowers/plans/2026-06-07-honeymoon-planner.md`
