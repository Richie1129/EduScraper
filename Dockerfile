FROM python:3.11-slim-bookworm

WORKDIR /app

# 安裝 Python 套件
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 複製專案原始碼
COPY . .

# 建立日誌目錄
RUN mkdir -p /app/logs

# 預設啟動 Python 排程器（取代系統 cron）
CMD ["python", "scheduler.py"]
