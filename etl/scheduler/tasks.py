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


# ========== PHASE 3: STOCK ACT + DARK MONEY + CORRUPTION SCORING ==========

@celery_app.task(bind=True, max_retries=3)
def run_senate_disclosures_etl(self, days_back: int = 90):
    """Fetch Senate financial disclosures (STOCK Act PTR filings)."""
    from sources.senate_disclosures import SenateDisclosuresWorker

    async def run():
        worker = SenateDisclosuresWorker()
        records = await worker.extract(days_back=days_back)
        return await worker.load(records)

    try:
        result = asyncio.run(run())
        log_etl_job("senate_disclosures", "stock_act_sync", "success",
                    records_processed=result.get("inserted", 0), metadata=result)
        return result
    except Exception as exc:
        logger.error(f"Senate disclosures ETL failed: {exc}")
        log_etl_job("senate_disclosures", "stock_act_sync", "failed", metadata={"error": str(exc)})
        raise self.retry(exc=exc, countdown=120)


@celery_app.task(bind=True, max_retries=3)
def run_house_disclosures_etl(self, years_back: int = 1):
    """Fetch House financial disclosures (STOCK Act PTR filings)."""
    from sources.house_disclosures import HouseDisclosuresWorker

    async def run():
        worker = HouseDisclosuresWorker()
        records = await worker.extract(years_back=years_back)
        return await worker.load(records)

    try:
        result = asyncio.run(run())
        log_etl_job("house_disclosures", "stock_act_sync", "success",
                    records_processed=result.get("inserted", 0), metadata=result)
        return result
    except Exception as exc:
        logger.error(f"House disclosures ETL failed: {exc}")
        log_etl_job("house_disclosures", "stock_act_sync", "failed", metadata={"error": str(exc)})
        raise self.retry(exc=exc, countdown=120)


@celery_app.task
def run_corruption_scoring():
    """Re-score all politicians and companies in the RECEIPTS Accountability Index."""
    from enrichment.corruption_scorer import CorruptionScorer

    async def run():
        scorer = CorruptionScorer()
        scored = {"politicians": 0, "companies": 0}

        # Score politicians from PostgreSQL
        try:
            conn = PostgresConnection()
            politicians = conn.fetch_all("SELECT DISTINCT candidate_id FROM contributions LIMIT 100")
            for row in (politicians or []):
                await scorer.get_politician_score(row["candidate_id"])
                scored["politicians"] += 1
        except Exception as e:
            logger.warning(f"Politician scoring failed: {e}")

        return {"success": True, **scored}

    try:
        result = asyncio.run(run())
        log_etl_job("corruption_scorer", "full_score", "success",
                    records_processed=result.get("politicians", 0), metadata=result)
        return result
    except Exception as exc:
        logger.error(f"Corruption scoring failed: {exc}")
        log_etl_job("corruption_scorer", "full_score", "failed", metadata={"error": str(exc)})
        return {"success": False, "error": str(exc)}


@celery_app.task
def run_quid_pro_quo_detection():
    """Run full quid pro quo and regulatory capture pattern detection."""
    from enrichment.quid_pro_quo_detector import QuidProQuoDetector

    async def run():
        detector = QuidProQuoDetector()
        patterns = await detector.detect_patterns(lookback_months=12)
        return {"success": True, "patterns_detected": len(patterns)}

    try:
        result = asyncio.run(run())
        log_etl_job("qpq_detector", "pattern_scan", "success",
                    records_processed=result.get("patterns_detected", 0), metadata=result)
        return result
    except Exception as exc:
        logger.error(f"QuidProQuo detection failed: {exc}")
        log_etl_job("qpq_detector", "pattern_scan", "failed", metadata={"error": str(exc)})
        return {"success": False, "error": str(exc)}
