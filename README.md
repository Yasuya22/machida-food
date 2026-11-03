# MACHIDA FOOD

町田駅周辺の飲食店の集客を支援するWebアプリ（運営：YSY総合サービス）。

| ファイル | 内容 |
|---|---|
| `PROJECT_BRIEF.md` | 事業構想・決定事項・機能とPhase割り当て |
| `CLAUDE.md` | 開発のルール（Claude Codeが毎回読み込む） |
| `docs/DB_DESIGN.md` | データベース設計（Phase 1） |
| `docs/SETUP_ACCOUNTS.md` | GitHub・Supabase・Vercelの準備手順 |
| `docs/APP_RELEASE.md` | PWA公開・Google Play・App Storeの手順とチェックリスト |
| `docs/STORE_LISTING.md` | ストア掲載文の下書き |
| `supabase/migrations/` | データベースの定義（テーブル・アクセス制御・関数） |
| `supabase/seed.sql` | デモ用の架空5店舗などの初期データ |
| `supabase/tests/` | アクセステスト（本番では実行しない） |
| `scripts/test-db.sh` | ローカルの使い捨てDBでテストを実行 |
| `src/` | アプリ本体（Next.js）。色は `src/app/globals.css` のトークン、ブランド名は `src/config/brand.ts` |
| `.github/workflows/` | 自動チェック（型チェック・組み立て・DBテスト）と画面のスクリーンショット撮影 |

## データベースのテスト

PostgreSQL が入った環境で次を実行すると、使い捨てのDBを作ってマイグレーションと28項目のアクセステストを行います。本番のSupabaseには接続しません。

```bash
bash scripts/test-db.sh
```

## 画面の一覧

| パス | 内容 |
|---|---|
| `/` `/search` `/stores/[id]` `/deals` | ホーム・探す・店舗詳細・お得（ログイン不要） |
| `/login` `/register` | メールのリンクでログイン・会員登録 |
| `/mypage` `/mypage/card` `/rewards` | マイページ・会員証QR・特典 |
| `/store/[id]`（`/scan` `/deals` `/logs` `/manage`） | 店舗管理（その店のオーナー・スタッフ、運営） |
| `/admin` | 運営管理（`admins` に登録された人だけ） |

## アプリを手元で動かす

Node.js 20.9 以上が必要です。

```bash
cp .env.example .env.local   # Supabase のURLと公開用キー（Publishable key）を入れる
npm install
npm run dev                  # http://localhost:3000
```

Mac では `MACHIDA FOODを起動.command` をダブルクリックしても同じことができます（Node.js が未導入なら案内ページが開きます）。

`service_role` キーは使いません。`.env.local` はGitHubに保存されません。
