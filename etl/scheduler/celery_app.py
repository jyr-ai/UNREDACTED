"""Celery application configuration."""
import os
import sys
from celery import Celery
from celery.signals import task_prerun, task_postrun
import logging

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "unredacted_etl",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "scheduler.tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour max
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
    # Beat schedule for periodic tasks
    beat_schedule={
        # Phase 1 + 2
        "usa_spending_daily": {
            "task": "scheduler.tasks.run_usa_spending_etl",
            "schedule": 86400.0,  # Daily
        },
        "federal_register_hourly": {
            "task": "scheduler.tasks.run_federal_register_etl",
            "schedule": 3600.0,  # Hourly
        },
        # Phase 3 — STOCK Act monitoring
        "senate_disclosures_weekly": {
            "task": "scheduler.tasks.run_senate_disclosures_etl",
            "schedule": 604800.0,  # Weekly (Congress updates weekly)
        },
        "house_disclosures_weekly": {
            "task": "scheduler.tasks.run_house_disclosures_etl",
            "schedule": 604800.0,  # Weekly
        },
        # Phase 3 — Corruption scoring
        "corruption_scoring_daily": {
            "task": "scheduler.tasks.run_corruption_scoring",
            "schedule": 86400.0,  # Daily
        },
        # Phase 3 — Pattern detection
        "qpq_detection_daily": {
            "task": "scheduler.tasks.run_quid_pro_quo_detection",
            "schedule": 86400.0,  # Daily
        },
    },
)


@task_prerun.connect
def task_started_handler(sender=None, task_id=None, task=None, **kwargs):
    """Log task start."""
    logging.info(f"Task {task.name}[{task_id}] started")


@task_postrun.connect
def task_completed_handler(sender=None, task_id=None, task=None, retval=None, state=None, **kwargs):
    """Log task completion."""
    logging.info(f"Task {task.name}[{task_id}] completed with state: {state}")
