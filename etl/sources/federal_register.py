"""Federal Register ETL worker."""
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Any

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from base.worker import BaseETLWorker
from base.postgres_client import PostgresConnection
from base.neo4j_client import Neo4jConnection
from base.redis_client import RedisConnection


class FederalRegisterWorker(BaseETLWorker):
    """ETL worker for Federal Register API."""

    def __init__(self):
        super().__init__("federal_register", "https://www.federalregister.gov/api/v1")
        self.redis = RedisConnection()
        self.postgres = PostgresConnection()
        self.neo4j = Neo4jConnection()

    async def extract(self, days_back: int = 7, **kwargs) -> List[Dict]:
        """Extract recent documents from Federal Register."""

        start_date = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")

        # Check cache
        cache_params = {"start": start_date}
        cached = self.redis.get_cached_api_response("federal_register_documents", cache_params)
        if cached:
            self.logger.info("Using cached Federal Register data")
            return cached.get("results", [])

        fields = [
            "title", "agency_names", "publication_date", "type",
            "abstract", "document_number", "html_url", "pdf_url",
            "significant", "citation", "docket_ids", "regulation_id_number"
        ]

        all_records = []
        page = 1

        while True:
            try:
                params = {
                    "conditions[publication_date][gte]": start_date,
                    "conditions[type][]": ["RULE", "PROPOSED RULE", "NOTICE"],
                    "per_page": 100,
                    "page": page,
                    "order": "newest",
                }

                # Build URL with fields
                url = f"{self.base_url}/documents.json"
                for f in fields:
                    params[f"fields[]"] = f

                response = await self.fetch("/documents.json", params=params)

                records = response.get("results", [])
                if not records:
                    break

                all_records.extend(records)
                self.logger.info(f"Fetched {len(records)} documents (page {page})")

                if len(records) < 100:
                    break

                page += 1
                if page > 5:  # Limit to 500 records
                    break

            except Exception as e:
                self.logger.error(f"Error fetching Federal Register: {e}")
                break

        # Cache results
        self.redis.cache_api_response("federal_register_documents", cache_params, {"results": all_records}, ttl=1800)

        return all_records

    async def transform(self, data: List[Dict]) -> pd.DataFrame:
        """Transform Federal Register data."""
        records = []

        for item in data:
            # Parse publication date
            pub_date = item.get("publication_date")
            if pub_date and isinstance(pub_date, str):
                try:
                    pub_date = datetime.strptime(pub_date, "%Y-%m-%d").date()
                except ValueError:
                    pub_date = None

            agencies = item.get("agency_names", [])
            primary_agency = agencies[0] if agencies else ""

            record = {
                "document_number": item.get("document_number", ""),
                "title": item.get("title", "")[:1000],
                "agency_names": agencies,
                "primary_agency": primary_agency[:255],
                "publication_date": pub_date,
                "type": item.get("type", ""),
                "abstract": item.get("abstract", "")[:2000] if item.get("abstract") else None,
                "html_url": item.get("html_url", ""),
                "pdf_url": item.get("pdf_url", ""),
                "significant": item.get("significant", False),
                "citation": item.get("citation", ""),
                "docket_ids": item.get("docket_ids", []),
                "regulation_id_number": item.get("regulation_id_number", ""),
                "raw_data": item,
            }

            records.append(record)

        df = pd.DataFrame(records)
        df["created_at"] = datetime.utcnow()
        df["updated_at"] = datetime.utcnow()

        return df

    async def load(self, df: pd.DataFrame) -> int:
        """Load data to PostgreSQL and Neo4j."""
        if df.empty:
            return 0

        # Insert to PostgreSQL
        cols = [
            "document_number", "title", "agency_names", "publication_date", "type",
            "abstract", "html_url", "pdf_url", "significant", "citation",
            "docket_ids", "regulation_id_number", "raw_data", "created_at", "updated_at"
        ]

        values = []
        for _, row in df.iterrows():
            val = tuple(row.get(col) for col in cols)
            values.append(val)

        inserted = self.postgres.insert_many("regulations", cols, values)
        self.logger.info(f"Inserted {inserted} regulations to PostgreSQL")

        # Sync to Neo4j
        await self._sync_to_neo4j(df)

        return inserted

    async def _sync_to_neo4j(self, df: pd.DataFrame):
        """Sync regulations to Neo4j."""
        if df.empty:
            return

        for _, row in df.iterrows():
            try:
                agencies = row.get("agency_names", [])
                primary_agency = agencies[0] if agencies else "Unknown"

                # Create Regulation node
                self.neo4j.run("""
                    MERGE (r:Regulation {document_number: $doc_num})
                    ON CREATE SET r.title = $title,
                                 r.type = $type,
                                 r.publication_date = date($pub_date),
                                 r.significant = $significant,
                                 r.created_at = datetime()
                    ON MATCH SET r.updated_at = datetime()
                """, {
                    "doc_num": row.get("document_number", ""),
                    "title": row.get("title", "")[:200],
                    "type": row.get("type", ""),
                    "pub_date": str(row.get("publication_date")) if row.get("publication_date") else None,
                    "significant": bool(row.get("significant", False)),
                })

                # Create Agency and relationship
                if primary_agency:
                    self.neo4j.run("""
                        MERGE (a:Agency {name: $agency_name})
                        ON CREATE SET a.created_at = datetime()
                        MERGE (r:Regulation {document_number: $doc_num})
                        MERGE (a)-[:ISSUED {date: date($pub_date)}]->(r)
                    """, {
                        "agency_name": primary_agency,
                        "doc_num": row.get("document_number", ""),
                        "pub_date": str(row.get("publication_date")) if row.get("publication_date") else None,
                    })

            except Exception as e:
                self.logger.error(f"Neo4j sync error for {row.get('document_number')}: {e}")

        self.logger.info(f"Synced {len(df)} regulations to Neo4j")
