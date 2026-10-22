# ── 第一階段：建構 Next.js 前端 ────────────────────────────────────────────
# Node 20 已 EOL；釘到確切修補版 22.23.4（含 2026-10 安全修補，CVE-2026-111497 等）。
# 與執行環境同為 Node 22 + bookworm，複製過去的 node_modules 原生模組 ABI 才對得上
FROM node:22.23.4-bookworm-slim AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .

# NEXT_PUBLIC_* 會在建構時內嵌進產物，必須以 build args 帶入（僅存在於此建構階段）
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_ADSENSE_ID
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_ADSENSE_ID=$NEXT_PUBLIC_ADSENSE_ID

RUN npm run build

# ── 第二階段：執行環境 ──────────────────────────────────────────────────────
FROM python:3.11-slim-bookworm

WORKDIR /app

# 安裝 supervisord 與 Node.js（用來啟動 Next.js）
# NodeSource 只保留最新版，無法釘死版號，改在建構時檢查不低於 22.23.4（2026-10 安全修補）
RUN apt-get update && \
    apt-get install -y --no-install-recommends supervisor curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/* && \
    node -e "const [a,b,c]=process.versions.node.split('.').map(Number); if (a!==22 || b<23 || (b===23 && c<4)) { console.error('Node.js ' + process.version + ' 低於 22.23.4'); process.exit(1) }"

# 安裝 Python 套件
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Playwright 的 pip 套件內附一份舊版 Node（1.41.2 帶的是 20.11.0），改用上面裝的系統 Node 執行 driver，
# 並刪掉內附的 node，避免留下有漏洞的執行檔
ENV PLAYWRIGHT_NODEJS_PATH=/usr/bin/node
RUN rm -f "$(python -c 'import os, playwright; print(os.path.dirname(playwright.__file__))')/driver/node"

# 複製 Python 原始碼
COPY . .

# 複製建構好的 Next.js 產物
COPY --from=frontend-builder /app/frontend/.next ./frontend/.next
COPY --from=frontend-builder /app/frontend/node_modules ./frontend/node_modules
COPY --from=frontend-builder /app/frontend/package.json ./frontend/package.json

# 複製 supervisord 設定
COPY supervisord.conf /etc/supervisor/conf.d/eduscraper.conf

# 建立日誌目錄，並新增非 root 執行使用者
RUN mkdir -p /app/logs && \
    useradd -r -u 1001 -s /sbin/nologin appuser && \
    chown -R appuser:appuser /app /etc/supervisor/conf.d

USER appuser

EXPOSE 3000

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/eduscraper.conf"]
