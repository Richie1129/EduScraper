#!/usr/bin/env bash
# 手動部署 EduScraper 到 Proxmox VM（同步設定檔 → 從 ghcr 拉映像 → 重啟）。
#
# 正常情況不需要跑這支：push 到 main 後由 .github/workflows/deploy.yml 自動建構並部署。
# 這支用於：GitHub Actions 不可用時的備援、回滾到指定版本、或只同步 app.env（機密不進 GitHub）。
#
# 用法：
#   deploy/deploy-vm.sh                      部署 ghcr 上的 :main
#   deploy/deploy-vm.sh --tag <commit-sha>   部署／回滾到指定版本
#   deploy/deploy-vm.sh --env-only           只同步 app.env 與 compose 設定，不重啟
#   DEPLOY_HOST=richie@1.2.3.4 deploy/deploy-vm.sh
#
# 拉取私有映像需先在 VM 上登入 ghcr（GitHub PAT 需 read:packages 權限）：
#   ssh richie@192.168.30.111 'echo <PAT> | docker login ghcr.io -u Richie1129 --password-stdin'
#   （workflow 自動部署時用的是當次的 GITHUB_TOKEN，不受此影響）
#
# 伺服器上的 ~/eduscraper/.env（compose 變數）由人工維護，本腳本不會覆寫：
#   POSTGRES_PASSWORD=...            （openssl rand -hex 24；首次建立資料庫後不可隨意更改）
#   NEXT_PUBLIC_SITE_URL=https://eduscraper.wuretedu.com
#   NEXT_PUBLIC_ADSENSE_ID=
#   IMAGE_TAG=...                    （部署流程自動寫入）
# 對外的 Cloudflare Tunnel 由 VM 共用的 ~/cloudflared（richie-cloudflared）負責，
# 不需要在此設定 CLOUDFLARE_TUNNEL_TOKEN / COMPOSE_PROFILES。
set -euo pipefail

HOST="${DEPLOY_HOST:-richie@192.168.30.111}"
DIR="${DEPLOY_DIR:-eduscraper}"
TAG="main"
ENV_ONLY=0
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

while [ $# -gt 0 ]; do
  case "$1" in
    --tag) TAG="${2:?--tag 需要指定值}"; shift 2 ;;
    --env-only) ENV_ONLY=1; shift ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) echo "未知參數：$1" >&2; exit 1 ;;
  esac
done

cd "$ROOT"

[ -f .env ] || { echo "找不到本機 .env，無法產生伺服器的 app.env" >&2; exit 1; }

ssh "$HOST" "mkdir -p ~/$DIR/logs"

# compose 檔與 schema：以 repo 為準（原始碼本身已在映像內，不需要 rsync）
rsync -az deploy/docker-compose.vm.yml "$HOST:$DIR/docker-compose.yml"
rsync -az db/schema.sql "$HOST:$DIR/schema.sql"

# 執行期機密：權限 600。已停用的 Supabase 變數不帶上伺服器；DATABASE_URL 由 compose 注入
grep -v -E '^(SUPABASE_|NEXT_PUBLIC_SUPABASE_|DATABASE_URL=)' .env \
  | ssh "$HOST" "umask 077 && cat > ~/$DIR/app.env"

if [ "$ENV_ONLY" = "1" ]; then
  echo "已同步 compose / schema / app.env（未重啟）。套用變更請執行："
  echo "  ssh $HOST 'cd ~/$DIR && docker compose up -d'"
  exit 0
fi

ssh "$HOST" "cd ~/$DIR && set -euo pipefail
  test -f .env || { echo '伺服器缺少 ~/$DIR/.env（compose 變數）' >&2; exit 1; }

  # 寫入要部署的 IMAGE_TAG
  if grep -q '^IMAGE_TAG=' .env; then
    sed -i 's|^IMAGE_TAG=.*|IMAGE_TAG=$TAG|' .env
  else
    printf '\nIMAGE_TAG=%s\n' '$TAG' >> .env
  fi

  docker compose config -q
  docker compose pull app || {
    echo '拉取映像失敗；若是私有映像，請先在 VM 上 docker login ghcr.io（見本腳本說明）' >&2; exit 1; }

  docker compose up -d --wait --wait-timeout 120 db
  # 套用 schema（可重複執行；首次啟動時 initdb 已執行過一次，這裡負責後續的 schema 變更）
  docker compose exec -T db psql -U eduscraper -d eduscraper -v ON_ERROR_STOP=1 -q < schema.sql
  docker compose up -d --wait --wait-timeout 180 --remove-orphans app
  docker compose ps
  docker inspect \$(docker compose ps -q app | head -1) --format '執行中映像：{{.Config.Image}}'"
