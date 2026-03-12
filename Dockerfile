# ── 第一階段：建構 Next.js 前端 ────────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

# ── 第二階段：執行環境 ──────────────────────────────────────────────────────
FROM python:3.11-slim-bookworm

WORKDIR /app

# 安裝 supervisord 與 Node.js（用來啟動 Next.js）
RUN apt-get update && \
    apt-get install -y --no-install-recommends supervisor curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

# 安裝 Python 套件
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

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
