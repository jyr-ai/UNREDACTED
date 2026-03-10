"""USASpending ETL worker."""
import pandas as pd
from datetime import datetime
from typing import List, Dict, Any

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from base.worker import BaseETLWorker
from base.postgres_client import PostgresConnection
from base.neo4j_client import Neo4jConnection
from base.redis_client import RedisConnection


class USASpendingWorker(BaseETLWorker):
    """ETL worker for USASpending.gov API."""

    def __init__(self):
        super().__init__("usa_spending", "https://api.usaspending.gov/api/v2")
        self.redis = RedisConnection()
        self.postgres = PostgresConnection()
        self.neo4j = Neo4jConnection()

    async def extract(self, start_date: str = None, end_date: str = None, limit: int = 1000) -> List[Dict]:
        """Extract contract and grant data from USASpending."""

        # Check cache first
        cache_params = {"start": start_date, "end": end_date, "limit": limit}
        cached = self.redis.get_cached_api_response("spending_by_award", cache_params)
        if cached:
            self.logger.info("Using cached USASpending data")
            return cached.get("results", [])

        all_records = []

        # Fetch contracts
        for award_type in ["A", "B", "C", "D"]:  # Contract types
            filters = {
                "award_type_codes": [award_type],
                "time_period": [{"start_date": start_date, "end_date": end_date}],
            }

            page = 1
            while True:
                try:
                    response = await self.fetch(
                        "/search/spending_by_award/",
                        method="POST",
                        json_data={
                            "filters": filters,
                            "fields": [
                                "Award ID", "Recipient Name", "Recipient DUNS",
                                "Awarding Agency", "Awarding Sub Agency", "Award Amount",
                                "Award Date", "Description", "NAICS", "NAICS Description",
                                "Contract Award Type", "Funding Agency", "Place of Performance State",
                                "Place of Performance Country", "Recipient Country Code",
                                "Recipient State Code", "Recipient Zip", "Base and All Options Value",
                                "Current Total Value Award Amount"
                            ],
                            "limit": 100,
                            "page": page,
                            "sort": "Award Amount",
                            "order": "desc",
                        }
                    )

                    records = response.get("results", [])
                    if not records:
                        break

                    # Tag as contracts
                    for r in records:
                        r["_record_type"] = "contract"

                    all_records.extend(records)
                    self.logger.info(f"Fetched {len(records)} contracts (page {page})")

                    if len(records) < 100:
                        break

                    page += 1
                    if page > 10:  # Limit to 1000 records
                        break

                except Exception as e:
                    self.logger.error(f"Error fetching contracts: {e}")
                    break

        # Fetch grants
        for award_type in ["02", "03", "04", "05"]:
            filters = {
                "award_type_codes": [award_type],
                "time_period": [{"start_date": start_date, "end_date": end_date}],
            }

            try:
                response = await self.fetch(
                    "/search/spending_by_award/",
                    method="POST",
                    json_data={
                        "filters": filters,
                        "fields": [
                            "Award ID", "Recipient Name", "Recipient DUNS",
                            "Awarding Agency", "Award Amount", "Award Date",
                            "Description", "CFDA Number", "CFDA Title", "Award Type",
                            "Funding Opportunity Number"
                        ],
                        "limit": 100,
                        "sort": "Award Amount",
                        "order": "desc",
                    }
                )

                records = response.get("results", [])
                for r in records:
                    r["_record_type"] = "grant"

                all_records.extend(records)
                self.logger.info(f"Fetched {len(records)} grants (type {award_type})")

            except Exception as e:
                self.logger.error(f"Error fetching grants: {e}")

        # Cache results
        self.redis.cache_api_response("spending_by_award", cache_params, {"results": all_records}, ttl=3600)

        return all_records

    async def transform(self, data: List[Dict]) -> pd.DataFrame:
        """Transform USASpending data to normalized format."""
        records = []

        for item in data:
            record_type = item.get("_record_type", "contract")

            # Parse amount
            amount = item.get("Award Amount") or item.get("Current Total Value Award Amount") or 0
            try:
                amount = float(amount)
            except (ValueError, TypeError):
                amount = 0

            # Parse date
            award_date = item.get("Award Date")
            if award_date and isinstance(award_date, str):
                try:
                    award_date = datetime.strptime(award_date, "%Y-%m-%d").date()
                except ValueError:
                    award_date = None

            # Normalize recipient name
            recipient = item.get("Recipient Name", "")
            normalized_recipient = self.normalize_entity_name(recipient)

            # Extract UEI from DUNS (USASpending uses DUNS, newer data has UEI)
            uei = item.get("Recipient DUNS", "")

            base_record = {
                "award_id": str(item.get("Award ID", "")),
                "recipient_name": recipient[:500],
                "recipient_uei": uei[:50] if uei else None,
                "normalized_name": normalized_recipient,
                "awarding_agency": item.get("Awarding Agency", "")[:255],
                "award_amount": amount,
                "award_date": award_date,
                "description": item.get("Description", "")[:1000] if item.get("Description") else None,
                "record_type": record_type,
                "raw_data": item,
            }

            if record_type == "contract":
                base_record.update({
                    "awarding_sub_agency": item.get("Awarding Sub Agency", "")[:255],
                    "naics_code": str(item.get("NAICS", ""))[:10] if item.get("NAICS") else None,
                    "naics_description": item.get("NAICS Description", "")[:255],
                    "contract_award_type": item.get("Contract Award Type", "")[:50],
                    "funding_agency": item.get("Funding Agency", "")[:255],
                    "place_of_performance_state": item.get("Place of Performance State", "")[:10],
                    "place_of_performance_country": item.get("Place of Performance Country", "")[:100],
                    "recipient_country_code": item.get("Recipient Country Code", "")[:10],
                    "recipient_state_code": item.get("Recipient State Code", "")[:10],
                    "recipient_zip": str(item.get("Recipient Zip", ""))[:20],
                    "base_and_all_options_value": item.get("Base and All Options Value", 0),
                    "current_total_value": item.get("Current Total Value Award Amount", 0),
                })
            else:  # grant
                base_record.update({
                    "cfda_number": item.get("CFDA Number", "")[:20],
                    "cfda_title": item.get("CFDA Title", "")[:255],
                    "award_type": item.get("Award Type", "")[:50],
                    "funding_opportunity_number": item.get("Funding Opportunity Number", "")[:100],
                })

            records.append(base_record)

        df = pd.DataFrame(records)
        df["created_at"] = datetime.utcnow()
        df["updated_at"] = datetime.utcnow()

        return df

    async def load(self, df: pd.DataFrame) -> int:
        """Load data to PostgreSQL and Neo4j."""
        if df.empty:
            return 0

        count = 0

        # Insert contracts to PostgreSQL
        contracts_df = df[df["record_type"] == "contract"]
        if not contracts_df.empty:
            contract_cols = [
                "award_id", "recipient_name", "recipient_uei", "awarding_agency",
                "awarding_sub_agency", "award_amount", "award_date", "description",
                "naics_code", "naics_description", "contract_award_type", "funding_agency",
                "place_of_performance_state", "place_of_performance_country",
                "recipient_country_code", "recipient_state_code", "recipient_zip",
                "base_and_all_options_value", "current_total_value", "raw_data",
                "created_at", "updated_at"
            ]

            contract_values = []
            for _, row in contracts_df.iterrows():
                values = tuple(row.get(col) for col in contract_cols)
                contract_values.append(values)

            inserted = self.postgres.insert_many("contracts", contract_cols, contract_values)
            self.logger.info(f"Inserted {inserted} contracts to PostgreSQL")
            count += inserted

        # Insert grants to PostgreSQL
        grants_df = df[df["record_type"] == "grant"]
        if not grants_df.empty:
            grant_cols = [
                "award_id", "recipient_name", "recipient_uei", "awarding_agency",
                "award_amount", "award_date", "description", "cfda_number",
                "cfda_title", "award_type", "funding_opportunity_number", "raw_data",
                "created_at", "updated_at"
            ]

            grant_values = []
            for _, row in grants_df.iterrows():
                values = tuple(row.get(col) for col in grant_cols)
                grant_values.append(values)

            inserted = self.postgres.insert_many("grants", grant_cols, grant_values)
            self.logger.info(f"Inserted {inserted} grants to PostgreSQL")
            count += inserted

        # Sync to Neo4j graph
        await self._sync_to_neo4j(df)

        return count

    async def _sync_to_neo4j(self, df: pd.DataFrame):
        """Sync records to Neo4j graph database."""
        if df.empty:
            return

        for _, row in df.iterrows():
            try:
                # Merge Company node
                self.neo4j.run("""
                    MERGE (c:Company {normalized_name: $normalized_name})
                    ON CREATE SET c.name = $name, c.uei = $uei, c.created_at = datetime()
                    ON MATCH SET c.last_seen = datetime()
                    RETURN c
                """, {
                    "normalized_name": row.get("normalized_name", ""),
                    "name": row.get("recipient_name", ""),
                    "uei": row.get("recipient_uei"),
                })

                # Merge Agency node
                self.neo4j.run("""
                    MERGE (a:Agency {name: $agency_name})
                    ON CREATE SET a.created_at = datetime()
                    ON MATCH SET a.last_seen = datetime()
                    RETURN a
                """, {"agency_name": row.get("awarding_agency", "")})

                # Create Contract node and relationships
                if row.get("record_type") == "contract":
                    self.neo4j.run("""
                        MATCH (c:Company {normalized_name: $normalized_name})
                        MATCH (a:Agency {name: $agency_name})
                        MERGE (contract:Contract {award_id: $award_id})
                        ON CREATE SET contract.amount = $amount,
                                     contract.award_date = date($award_date),
                                     contract.description = $description,
                                     contract.created_at = datetime()
                        MERGE (c)-[:RECEIVED {amount: $amount, date: date($award_date)}]->(contract)
                        MERGE (a)-[:AWARDED {amount: $amount, date: date($award_date)}]->(contract)
                    """, {
                        "normalized_name": row.get("normalized_name", ""),
                        "agency_name": row.get("awarding_agency", ""),
                        "award_id": row.get("award_id", ""),
                        "amount": float(row.get("award_amount", 0)),
                        "award_date": str(row.get("award_date")) if row.get("award_date") else None,
                        "description": row.get("description", "")[:200],
                    })

            except Exception as e:
                self.logger.error(f"Neo4j sync error for {row.get('award_id')}: {e}")

        self.logger.info(f"Synced {len(df)} records to Neo4j")
