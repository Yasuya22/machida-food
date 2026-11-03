#!/bin/bash
# MACHIDA FOOD を手元のMacで動かす（外部には公開されません）
# ダブルクリックで起動。終了するときはこの画面で control + C を押すか、画面を閉じる
cd "$(dirname "$0")" || exit 1
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

echo "=== MACHIDA FOOD 起動 ==="
if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "Node.js が入っていません。"
  echo "開いたページから「LTS（推奨版）」の macOS インストーラーをダウンロードして入れてから、"
  echo "もう一度このファイルをダブルクリックしてください。"
  open "https://nodejs.org/ja/download"
  read -n 1 -s -r -p "（何かキーを押すと閉じます）"
  exit 1
fi
echo "Node.js $(node -v) を確認しました"

if [ ! -d node_modules ]; then
  echo ""
  echo "初回のみ：必要な部品をダウンロードしています（数分かかります）..."
  npm install --no-audit --no-fund || { echo "部品のダウンロードに失敗しました。ネット接続を確認してください。"; read -n 1 -s -r; exit 1; }
fi

echo ""
echo "起動中...準備ができるとブラウザが自動で開きます（http://localhost:3000）"
( for i in $(seq 1 60); do sleep 2; if curl -s -o /dev/null http://localhost:3000; then open "http://localhost:3000"; break; fi; done ) &
npm run dev
