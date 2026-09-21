#!/usr/bin/env bash
# 部署 EduScraper 到 Proxmox VM（rsync 原始碼 → 遠端 docker compose build + up）。
#
# 用法：
#   deploy/deploy-vm.sh            同步、建構並重啟
#   DEPLOY_HOST=richie@1.2.3.4 deploy/deploy-vm.sh
#
# 伺服器上的 ~/eduscraper/.env（compose 變數）由人工維護，本腳本不會覆寫：
#   POSTGRES_PASSWORD=...            （openssl rand -hex 24；首次建立資料庫後不可隨意更改）
#   NEXT_PUBLIC_SITE_URL=https://eduscraper.wuretedu.com
#   NEXT_PUBLIC_ADSENSE_ID=
# 對外的 Cloudflare Tunnel 由 VM 共用的 ~/cloudflared（richie-cloudflared）負責，
# 不需要在此設定 CLOUDFLARE_TUNNEL_TOKEN / COMPOSE_PROFILES。
set -euo pipefail

HOST="${DEPLOY_HOST:-richie@192.168.30.111}"
DIR="${DEPLOY_DIR:-eduscraper}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT"

[ -f .env ] || { echo "找不到本機 .env，無法產生伺服器的 app.env" >&2; exit 1; }

ssh "$HOST" "mkdir -p ~/$DIR/src ~/$DIR/logs"

# 原始碼：排除機密、虛擬環境、建構產物（映像檔內不可含 .env）
rsync -az --delete \
  --exclude '.git/' \
  --exclude '.venv/' \
  --exclude '.env' \
  --exclude '.claude/' \
  --exclude '.ruff_cache/' \
  --exclude '__pycache__/' \
  --exclude '*.pyc' \
  --exclude 'logs/' \
  --exclude 'frontend/node_modules/' \
  --exclude 'frontend/.next/' \
  --exclude 'frontend/.next-validation/' \
  --exclude 'frontend/.env.local' \
  ./ "$HOST:$DIR/src/"

rsync -az deploy/docker-compose.vm.yml "$HOST:$DIR/docker-compose.yml"

# 執行期機密：權限 600。已停用的 Supabase 變數不帶上伺服器；DATABASE_URL 由 compose 注入
grep -v -E '^(SUPABASE_|NEXT_PUBLIC_SUPABASE_|DATABASE_URL=)' .env \
  | ssh "$HOST" "umask 077 && cat > ~/$DIR/app.env"

ssh "$HOST" "cd ~/$DIR && test -f .env || { echo '伺服器缺少 ~/$DIR/.env（compose 變數）' >&2; exit 1; }
  docker compose config -q && docker compose up -d --build --remove-orphans
  # 套用 schema（可重複執行；首次啟動時 initdb 已執行過一次，這裡負責後續的 schema 變更）
  docker compose exec -T db psql -U eduscraper -d eduscraper -v ON_ERROR_STOP=1 -q < src/db/schema.sql
  docker compose ps"
