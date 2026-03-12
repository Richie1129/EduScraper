#!/usr/bin/env python3
"""
EduScraper 排程器
每天 UTC 18:00（台灣時間 02:00）自動執行 pipeline，無需系統 cron。
"""
import datetime
import logging
import subprocess
import sys
import time

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


if __name__ == "__main__":
    logger.info("EduScraper 排程器啟動，每天 UTC %02d:%02d 執行",
                SCHEDULED_HOUR_UTC, SCHEDULED_MINUTE_UTC)
    while True:
        target = next_run_time()
        wait_seconds = (target - datetime.datetime.utcnow()).total_seconds()
        logger.info("下次執行時間：%s UTC，等待 %.0f 秒（%.1f 小時）",
                    target.strftime("%Y-%m-%d %H:%M:%S"),
                    wait_seconds,
                    wait_seconds / 3600)
        time.sleep(wait_seconds)
        run_pipeline()
