#!/usr/bin/env python3
"""
EduScraper 排程器
每天 UTC 18:00（台灣時間 02:00）自動執行 pipeline，無需系統 cron。
"""
import datetime
import logging
import os
import subprocess
import sys
import time
import urllib.request
import json

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("/app/logs/scheduler.log", mode="a"),
    ],
)
logger = logging.getLogger("scheduler")

# 每天 UTC 18:00 執行（台灣時間 02:00 UTC+8）
SCHEDULED_HOUR_UTC = 18
SCHEDULED_MINUTE_UTC = 0

# 每週一 UTC 09:00（台灣時間 17:00）寄送電子報
NEWSLETTER_DAY = 0  # 0=Monday
NEWSLETTER_HOUR_UTC = 9


def next_run_time() -> datetime.datetime:
    now = datetime.datetime.utcnow()
    target = now.replace(
        hour=SCHEDULED_HOUR_UTC,
        minute=SCHEDULED_MINUTE_UTC,
        second=0,
        microsecond=0,
    )
    if target <= now:
        target += datetime.timedelta(days=1)
    return target


def _run_module(module_name: str) -> bool:
    logger.info("開始執行 %s...", module_name)
    result = subprocess.run(
        [sys.executable, "-m", module_name],
        capture_output=False,
    )
    if result.returncode == 0:
        logger.info("%s 執行完成", module_name)
        return True

    logger.error("%s 執行失敗，exit code: %d", module_name, result.returncode)
    return False


def run_pipeline() -> None:
    _run_module("pipeline.main")
    _run_module("pipeline.discovery")


def send_newsletter() -> None:
    """透過 Next.js API Route 觸發電子報寄送"""
    site_url = os.environ.get("NEXT_PUBLIC_SITE_URL", "http://localhost:3000")
    secret = os.environ.get("NEWSLETTER_SECRET", "")
    if not secret:
        logger.warning("NEWSLETTER_SECRET 未設定，跳過電子報寄送")
        return

    url = f"{site_url}/api/newsletter/send"
    headers = {
        "Authorization": f"Bearer {secret}",
        "Content-Type": "application/json",
    }

    try:
        req = urllib.request.Request(url, data=b"{}", headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read().decode())
            logger.info("電子報寄送完成：%s", body.get("message", "OK"))
    except Exception as exc:
        logger.error("電子報寄送失敗：%s", exc)


def next_newsletter_time() -> datetime.datetime:
    """計算下一次電子報寄送時間（每週一 UTC 09:00）"""
    now = datetime.datetime.utcnow()
    days_ahead = NEWSLETTER_DAY - now.weekday()
    if days_ahead < 0 or (days_ahead == 0 and now.hour >= NEWSLETTER_HOUR_UTC):
        days_ahead += 7
    target = now.replace(
        hour=NEWSLETTER_HOUR_UTC, minute=0, second=0, microsecond=0
    ) + datetime.timedelta(days=days_ahead)
    return target


if __name__ == "__main__":
    logger.info("EduScraper 排程器啟動，每天 UTC %02d:%02d 執行 pipeline，每週一 UTC %02d:00 寄送電子報",
                SCHEDULED_HOUR_UTC, SCHEDULED_MINUTE_UTC, NEWSLETTER_HOUR_UTC)
    while True:
        pipeline_target = next_run_time()
        newsletter_target = next_newsletter_time()

        # 取較近的排程執行
        if newsletter_target < pipeline_target:
            target = newsletter_target
            task = "newsletter"
        else:
            target = pipeline_target
            task = "pipeline"

        wait_seconds = (target - datetime.datetime.utcnow()).total_seconds()
        logger.info("下次執行：%s（%s），等待 %.0f 秒（%.1f 小時）",
                    target.strftime("%Y-%m-%d %H:%M:%S UTC"),
                    task,
                    wait_seconds,
                    wait_seconds / 3600)
        time.sleep(max(wait_seconds, 0))

        if task == "newsletter":
            send_newsletter()
        else:
            run_pipeline()
