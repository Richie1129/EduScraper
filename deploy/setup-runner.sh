#!/usr/bin/env bash
#
# deploy/setup-runner.sh — 在 Proxmox VM 上安裝 EduScraper 專用的 GitHub Actions self-hosted runner
#
# 只需在 VM 上跑一次（人工執行，不由 CI 呼叫）。
# 採 pull 模式：runner 主動連 GitHub 取工作，不需要把 VM 的 SSH 私鑰交給 GitHub，
# 也不需要為 GitHub 開任何 inbound 埠。GitHub 個人帳號的 runner 是 repo 層級，
# 無法與同機的 grading / daily-stock-alpha / SDL runner 共用，因此本專案要自己裝一個。
#
# ⚠ 安全性：本 repo 是 public。self-hosted runner 只有在 .github/workflows/deploy.yml
#   被觸發時才會跑，而該 workflow 只監聽 push 到 main 與手動觸發——fork 的 PR 不會觸發，
#   所以外部人士無法在這台 VM 上執行程式碼。請不要為本 repo 的 workflow 加上
#   pull_request / pull_request_target 觸發，也不要在 repo 設定放寬 fork PR 的核准條件。
#
# 事前準備：
#   到 https://github.com/Richie1129/EduScraper/settings/actions/runners/new
#   取得 registration token（有效期約 1 小時），設為 RUNNER_TOKEN
#
# 用法（在 VM 上執行）：
#   RUNNER_TOKEN=AXXXX... bash setup-runner.sh
#
# 環境變數：
#   RUNNER_TOKEN   必填，GitHub 產生的 registration token
#   RUNNER_REPO    預設 Richie1129/EduScraper
#   RUNNER_NAME    預設 eduscraper-proxmox-111
#   RUNNER_LABELS  預設 self-hosted,linux,x64,eduscraper（workflow 以 eduscraper 標籤挑選）
#   RUNNER_DIR     預設 $HOME/actions-runner-eduscraper
#   RUNNER_VERSION 預設抓 actions/runner 最新版

set -euo pipefail

RUNNER_REPO="${RUNNER_REPO:-Richie1129/EduScraper}"
RUNNER_NAME="${RUNNER_NAME:-eduscraper-proxmox-111}"
RUNNER_LABELS="${RUNNER_LABELS:-self-hosted,linux,x64,eduscraper}"
RUNNER_DIR="${RUNNER_DIR:-$HOME/actions-runner-eduscraper}"
DEPLOY_DIR="${DEPLOY_DIR:-$HOME/eduscraper}"

log() { printf '[setup-runner] %s\n' "$*"; }
fail() { printf '[setup-runner][錯誤] %s\n' "$*" >&2; exit 1; }

[ -n "${RUNNER_TOKEN:-}" ] || fail "RUNNER_TOKEN 未設。請到 repo Settings → Actions → Runners → New self-hosted runner 取得 token"
[ "$(id -un)" != "root" ] || fail "請用一般使用者（richie）執行，不要用 root"

# 1. 前置檢查：runner 的部署步驟會直接呼叫 docker，且需要既有的機密檔
docker info > /dev/null 2>&1 || fail "目前使用者無法直接使用 docker，請先加入 docker group 後重新登入"
for f in .env app.env; do
  [ -f "$DEPLOY_DIR/$f" ] || log "提醒：尚未建立 $DEPLOY_DIR/$f，部署會在前置檢查就失敗（見 deploy/deploy-vm.sh 說明）"
done

# 2. 下載並解壓 runner
if [ -x "$RUNNER_DIR/config.sh" ]; then
  log "已存在 runner 目錄 $RUNNER_DIR，略過下載"
else
  version="${RUNNER_VERSION:-}"
  if [ -z "$version" ]; then
    log "查詢 actions/runner 最新版本"
    version="$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest \
      | grep -oE '"tag_name": *"v[0-9.]+"' | head -1 | grep -oE '[0-9.]+')"
    [ -n "$version" ] || fail "無法取得 runner 版本，請自行指定 RUNNER_VERSION"
  fi
  log "安裝 runner v${version} 到 $RUNNER_DIR"
  mkdir -p "$RUNNER_DIR"
  tarball="actions-runner-linux-x64-${version}.tar.gz"
  curl -fsSL -o "/tmp/${tarball}" \
    "https://github.com/actions/runner/releases/download/v${version}/${tarball}"
  tar xzf "/tmp/${tarball}" -C "$RUNNER_DIR"
  rm -f "/tmp/${tarball}"
fi

# 3. 註冊
cd "$RUNNER_DIR"
if [ -f .runner ]; then
  log "runner 已註冊過，先移除舊註冊再重新註冊"
  sudo ./svc.sh stop 2>/dev/null || true
  sudo ./svc.sh uninstall 2>/dev/null || true
  ./config.sh remove --token "$RUNNER_TOKEN" || log "移除舊註冊失敗，改用 --replace 覆蓋"
fi

./config.sh \
  --url "https://github.com/${RUNNER_REPO}" \
  --token "$RUNNER_TOKEN" \
  --name "$RUNNER_NAME" \
  --labels "$RUNNER_LABELS" \
  --work _work \
  --unattended \
  --replace

# 4. 安裝成 systemd service（開機自動啟動）
sudo ./svc.sh install "$(id -un)"
sudo ./svc.sh start

log "完成。狀態："
sudo ./svc.sh status || true
log "接著到 GitHub repo → Settings → Actions → Runners 確認 ${RUNNER_NAME} 是 Idle"
