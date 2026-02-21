"""
ENVISIONGRID — Cron Scheduler
Runs the daily risk report on a configurable schedule using APScheduler.
"""
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from src.config import CRON_HOUR, CRON_MINUTE

logger = logging.getLogger("envisiongrid.cron")

_scheduler = None


def _report_job():
    """Wrapper that imports and runs the report (avoids circular imports)."""
    from src.report_generator import run_daily_report
    try:
        result = run_daily_report()
        logger.info(f"Cron job completed: {result}")
    except Exception as e:
        logger.error(f"Cron job failed: {e}", exc_info=True)


def start_scheduler():
    """Start the background cron scheduler."""
    global _scheduler
    if _scheduler is not None:
        logger.warning("Scheduler already running")
        return

    _scheduler = BackgroundScheduler()
    trigger = CronTrigger(hour=CRON_HOUR, minute=CRON_MINUTE)
    _scheduler.add_job(_report_job, trigger, id="daily_risk_report",
                       name="Daily Risk Report", replace_existing=True)
    _scheduler.start()
    logger.info(f"Cron scheduler started — report runs daily at {CRON_HOUR:02d}:{CRON_MINUTE:02d}")


def stop_scheduler():
    """Gracefully shut down the scheduler."""
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("Cron scheduler stopped")
