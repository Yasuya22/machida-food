# MACHIDA FOOD

町田駅周辺の飲食店の集客を支援するWebアプリ（運営：YSY総合サービス）。

| ファイル | 内容 |
|---|---|
| `PROJECT_BRIEF.md` | 事業構想・決定事項・機能とPhase割り当て |
| `CLAUDE.md` | 開発のルール（Claude Codeが毎回読み込む） |
| `docs/DB_DESIGN.md` | データベース設計（Phase 1） |
| `docs/SETUP_ACCOUNTS.md` | GitHub・Supabase・Vercelの準備手順 |
| `supabase/migrations/` | データベースの定義（テーブル・アクセス制御・関数） |
| `supabase/seed.sql` | デモ用の架空5店舗などの初期データ |
| `supabase/tests/` | アクセステスト（本番では実行しない） |
| `scripts/test-db.sh` | ローカルの使い捨てDBでテストを実行 |

## データベースのテスト

PostgreSQL が入った環境で次を実行すると、使い捨てのDBを作ってマイグレーションと22項目のアクセステストを行います。本番のSupabaseには接続しません。

```bash
bash scripts/test-db.sh
```
