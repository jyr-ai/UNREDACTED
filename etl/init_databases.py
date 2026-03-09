"""Initialize all databases for Phase 1."""
import asyncio
import logging
from base.neo4j_client import init_schema
from base.postgres_client import init_tables

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init_all():
    """Initialize PostgreSQL and Neo4j databases."""
    logger.info("=== Initializing UNREDACTED Databases ===")

    # PostgreSQL
    logger.info("Initializing PostgreSQL tables...")
    init_tables()
    logger.info("PostgreSQL initialization complete")

    # Neo4j
    logger.info("Initializing Neo4j schema...")
    init_schema()
    logger.info("Neo4j initialization complete")

    logger.info("=== Database initialization complete ===")


if __name__ == "__main__":
    init_all()
