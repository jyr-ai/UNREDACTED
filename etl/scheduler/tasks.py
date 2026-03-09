"""Celery task definitions."""
import asyncio
import logging
from datetime import datetime, timedelta
from .celery_app import celery_app
from base.postgres_client import PostgresConnection

logger = logging.getLogger(__name__)


def log_etl_job(source: str, job_type: str, status: str, **kwargs):
    """Log ETL job to PostgreSQL."""
    try:
        conn = PostgresConnection()
        conn.execute(
            """
            INSERT INTO etl_jobs (source_name, job_type, status, duration_seconds, records_processed, metadata, completed_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                source,
                job_type,
                status,
                kwargs.get("duration_seconds"),
                kwargs.get("records_processed", 0),
                kwargs.get("metadata"),
                datetime.utcnow(),
            )
        )
    except Exception as e:
        logger.error(f"Failed to log ETL job: {e}")


@celery_app.task(bind=True, max_retries=3)
def run_usa_spending_etl(self, days_back: int = 7):
    """Run USASpending ETL for recent contracts."""
    from sources.usa_spending import USASpendingWorker

    async def run():
        worker = USASpendingWorker()

        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_back)

        result = await worker.run(
            start_date=start_date.strftime("%Y-%m-%d"),
            end_date=end_date.strftime("%Y-%m-%d"),
        )
        return result

    try:
        result = asyncio.run(run())
        log_etl_job(
            "usa_spending",
            "full_sync",
            "success" if result["success"] else "failed",
            duration_seconds=result.get("duration_seconds"),
            records_processed=result.get("records_processed"),
            metadata=result,
        )
        return result
    except Exception as exc:
        logger.error(f"USASpending ETL failed: {exc}")
        log_etl_job(
            "usa_spending",
            "full_sync",
            "failed",
            metadata={"error": str(exc)},
        )
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(bind=True, max_retries=3)
def run_federal_register_etl(self, days_back: int = 7):
    """Run Federal Register ETL for recent documents."""
    from sources.federal_register import FederalRegisterWorker

    async def run():
        worker = FederalRegisterWorker()

        result = await worker.run(days_back=days_back)
        return result

    try:
        result = asyncio.run(run())
        log_etl_job(
            "federal_register",
            "full_sync",
            "success" if result["success"] else "failed",
            duration_seconds=result.get("duration_seconds"),
            records_processed=result.get("records_processed"),
            metadata=result,
        )
        return result
    except Exception as exc:
        logger.error(f"Federal Register ETL failed: {exc}")
        log_etl_job(
            "federal_register",
            "full_sync",
            "failed",
            metadata={"error": str(exc)},
        )
        raise self.retry(exc=exc, countdown=60)


@celery_app.task
def sync_entity_graph():
    """Sync PostgreSQL data to Neo4j graph."""
    from enrichment.entity_resolution import sync_contracts_to_graph

    async def run():
        return await sync_contracts_to_graph()

    try:
        result = asyncio.run(run())
        log_etl_job(
            "entity_graph",
            "sync",
            "success",
            records_processed=result.get("entities_created", 0),
        )
        return result
    except Exception as exc:
        logger.error(f"Entity graph sync failed: {exc}")
        log_etl_job(
            "entity_graph",
            "sync",
            "failed",
            metadata={"error": str(exc)},
        )
        return {"success": False, "error": str(exc)}
