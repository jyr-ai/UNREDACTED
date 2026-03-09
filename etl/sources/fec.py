"""FEC Campaign Finance ETL worker."""
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import asyncio
import logging

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from base.worker import BaseETLWorker
from base.postgres_client import PostgresConnection
from base.neo4j_client import Neo4jConnection
from base.redis_client import RedisConnection

logger = logging.getLogger(__name__)


class FECWorker(BaseETLWorker):
    """ETL worker for FEC Campaign Finance API."""

    def __init__(self):
        super().__init__("fec", "https://api.open.fec.gov/v1")
        self.redis = RedisConnection()
        self.postgres = PostgresConnection()
        self.neo4j = Neo4jConnection()
        self.api_key = os.getenv("FEC_API_KEY", "DEMO_KEY")

    async def extract(self, cycles: int = 2, candidate_types: List[str] = None, **kwargs) -> List[Dict]:
        """Extract FEC campaign finance data."""

        if candidate_types is None:
            candidate_types = ["S", "H"]  # Senate, House

        all_records = []
        current_year = datetime.now().year
        cycles_to_fetch = [current_year - (current_year % 2) - (2 * i) for i in range(cycles)]

        logger.info(f"Fetching FEC data for cycles: {cycles_to_fetch}")

        # 1. Extract candidates
        candidates = await self._extract_candidates(cycles_to_fetch, candidate_types)
        all_records.extend(candidates)

        # 2. Extract committees (PACs)
        committees = await self._extract_committees(cycles_to_fetch)
        all_records.extend(committees)

        # 3. Extract contributions (Schedule A) - limited to recent
        contributions = await self._extract_contributions(cycles_to_fetch, limit_per_cycle=1000)
        all_records.extend(contributions)

        # 4. Extract candidate totals
        totals = await self._extract_candidate_totals(cycles_to_fetch)
        all_records.extend(totals)

        logger.info(f"Total FEC records extracted: {len(all_records)}")
        return all_records

    async def _extract_candidates(self, cycles: List[int], candidate_types: List[str]) -> List[Dict]:
        """Extract candidate information."""
        candidates = []

        for cycle in cycles:
            for office in candidate_types:
                page = 1
                while True:
                    try:
                        params = {
                            "api_key": self.api_key,
                            "cycle": cycle,
                            "office": office,
                            "per_page": 100,
                            "page": page,
                            "sort": "name",
                            "election_year": cycle,
                        }

                        response = await self.fetch("/candidates/", params=params)
                        results = response.get("results", [])

                        if not results:
                            break

                        for candidate in results:
                            candidate["_record_type"] = "candidate"
                            candidate["_cycle"] = cycle
                            candidates.append(candidate)

                        logger.info(f"Fetched {len(results)} candidates for cycle {cycle}, office {office}, page {page}")

                        if len(results) < 100:
                            break

                        page += 1
                        if page > 10:  # Limit to 1000 candidates per cycle/office
                            break

                    except Exception as e:
                        logger.error(f"Error fetching candidates for cycle {cycle}, office {office}: {e}")
                        break

        return candidates

    async def _extract_committees(self, cycles: List[int]) -> List[Dict]:
        """Extract committee/PAC information."""
        committees = []

        for cycle in cycles:
            page = 1
            while True:
                try:
                    params = {
                        "api_key": self.api_key,
                        "cycle": cycle,
                        "per_page": 100,
                        "page": page,
                        "sort": "-receipts",
                        "designation": ["P", "U", "B", "J"],  # Principal, Unauthorized, Joint, Leadership PAC
                    }

                    response = await self.fetch("/committees/", params=params)
                    results = response.get("results", [])

                    if not results:
                        break

                    for committee in results:
                        committee["_record_type"] = "committee"
                        committee["_cycle"] = cycle
                        committees.append(committee)

                    logger.info(f"Fetched {len(results)} committees for cycle {cycle}, page {page}")

                    if len(results) < 100:
                        break

                    page += 1
                    if page > 5:  # Limit to 500 committees per cycle
                        break

                except Exception as e:
                    logger.error(f"Error fetching committees for cycle {cycle}: {e}")
                    break

        return committees

    async def _extract_contributions(self, cycles: List[int], limit_per_cycle: int = 1000) -> List[Dict]:
        """Extract individual contributions (Schedule A)."""
        contributions = []

        for cycle in cycles:
            # Get recent contributions (last 90 days)
            min_date = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")

            page = 1
            total_fetched = 0

            while total_fetched < limit_per_cycle:
                try:
                    params = {
                        "api_key": self.api_key,
                        "two_year_transaction_period": cycle,
                        "min_date": min_date,
                        "per_page": 100,
                        "page": page,
                        "sort": "-contribution_receipt_date",
                        "is_individual": True,
                    }

                    response = await self.fetch("/schedules/schedule_a/", params=params)
                    results = response.get("results", [])

                    if not results:
                        break

                    for contribution in results:
                        contribution["_record_type"] = "contribution"
                        contribution["_cycle"] = cycle
                        contributions.append(contribution)
                        total_fetched += 1

                    logger.info(f"Fetched {len(results)} contributions for cycle {cycle}, page {page}")

                    if len(results) < 100 or total_fetched >= limit_per_cycle:
                        break

                    page += 1
                    if page > 10:  # Safety limit
                        break

                except Exception as e:
                    logger.error(f"Error fetching contributions for cycle {cycle}: {e}")
                    break

        return contributions

    async def _extract_candidate_totals(self, cycles: List[int]) -> List[Dict]:
        """Extract candidate fundraising totals."""
        totals = []

        # Note: This would require first getting candidate IDs from the candidates endpoint
        # For now, we'll implement a simplified version that gets totals for candidates
        # we've already extracted

        # This is a placeholder - in a full implementation, we'd fetch totals for each candidate
        logger.info("Candidate totals extraction would be implemented here")

        return totals

    async def transform(self, data: List[Dict]) -> pd.DataFrame:
        """Transform FEC data to normalized format."""
        records = []

        for item in data:
            record_type = item.get("_record_type")
            cycle = item.get("_cycle")

            if record_type == "candidate":
                record = self._transform_candidate(item, cycle)
                if record:
                    records.append(record)

            elif record_type == "committee":
                record = self._transform_committee(item, cycle)
                if record:
                    records.append(record)

            elif record_type == "contribution":
                record = self._transform_contribution(item, cycle)
                if record:
                    records.append(record)

        df = pd.DataFrame(records)
        if not df.empty:
            df["created_at"] = datetime.utcnow()
            df["updated_at"] = datetime.utcnow()

        logger.info(f"Transformed {len(df)} FEC records")
        return df

    def _transform_candidate(self, candidate: Dict, cycle: int) -> Optional[Dict]:
        """Transform candidate data."""
        try:
            # Parse candidate ID
            candidate_id = candidate.get("candidate_id")
            if not candidate_id:
                return None

            # Get bioguide_id if available
            bioguide_id = None
            if "candidate_inactive" in candidate and candidate["candidate_inactive"]:
                # Inactive candidates might have bioguide_id in other fields
                pass

            record = {
                "bioguide_id": bioguide_id,
                "fec_candidate_id": candidate_id,
                "name": candidate.get("name", ""),
                "party": candidate.get("party_full", ""),
                "state": candidate.get("state", ""),
                "district": candidate.get("district", ""),
                "chamber": "senate" if candidate.get("office") == "S" else "house",
                "office": candidate.get("office_full", ""),
                "in_office": not candidate.get("candidate_inactive", True),
                "first_elected": None,  # Would need additional API call
                "next_election": cycle + 2 if candidate.get("office") in ["S", "H"] else None,
                "committees": [],  # Would need to fetch separately
                "raw_data": candidate,
                "_record_type": "politician",
            }

            return record

        except Exception as e:
            logger.error(f"Error transforming candidate {candidate.get('candidate_id')}: {e}")
            return None

    def _transform_committee(self, committee: Dict, cycle: int) -> Optional[Dict]:
        """Transform committee/PAC data."""
        try:
            committee_id = committee.get("committee_id")
            if not committee_id:
                return None

            # Parse total amounts
            total_receipts = self._parse_amount(committee.get("receipts"))
            total_disbursements = self._parse_amount(committee.get("disbursements"))
            cash_on_hand = self._parse_amount(committee.get("cash_on_hand"))

            record = {
                "committee_id": committee_id,
                "name": committee.get("name", ""),
                "committee_type": committee.get("committee_type_full", ""),
                "designation": committee.get("designation", ""),
                "party": committee.get("party_full", ""),
                "connected_org_name": committee.get("connected_organization_name", ""),
                "total_receipts": total_receipts,
                "total_disbursements": total_disbursements,
                "cash_on_hand": cash_on_hand,
                "cycle": cycle,
                "raw_data": committee,
                "_record_type": "pac_committee",
            }

            return record

        except Exception as e:
            logger.error(f"Error transforming committee {committee.get('committee_id')}: {e}")
            return None

    def _transform_contribution(self, contribution: Dict, cycle: int) -> Optional[Dict]:
        """Transform contribution data."""
        try:
            contribution_id = contribution.get("sub_id")
            if not contribution_id:
                return None

            # Parse date
            date_str = contribution.get("contribution_receipt_date")
            date_obj = None
            if date_str:
                try:
                    date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
                except ValueError:
                    pass

            # Parse amount
            amount = self._parse_amount(contribution.get("contribution_receipt_amount"))

            record = {
                "contribution_id": contribution_id,
                "contributor_name": contribution.get("contributor_name", ""),
                "contributor_employer": contribution.get("contributor_employer", ""),
                "contributor_occupation": contribution.get("contributor_occupation", ""),
                "contributor_city": contribution.get("contributor_city", ""),
                "contributor_state": contribution.get("contributor_state", ""),
                "contributor_zip": contribution.get("contributor_zip", ""),
                "amount": amount,
                "date": date_obj,
                "committee_id": contribution.get("committee", {}).get("committee_id"),
                "candidate_id": contribution.get("candidate", {}).get("candidate_id"),
                "receipt_type": contribution.get("receipt_type_full", ""),
                "memo_text": contribution.get("memo_text", ""),
                "raw_data": contribution,
                "_record_type": "contribution",
            }

            return record

        except Exception as e:
            logger.error(f"Error transforming contribution {contribution.get('sub_id')}: {e}")
            return None

    def _parse_amount(self, amount_str: Any) -> float:
        """Parse amount string to float."""
        if amount_str is None:
            return 0.0

        try:
            if isinstance(amount_str, (int, float)):
                return float(amount_str)

            # Remove commas and dollar signs
            cleaned = str(amount_str).replace("$", "").replace(",", "").strip()
            return float(cleaned) if cleaned else 0.0

        except (ValueError, TypeError):
            return 0.0

    async def load(self, df: pd.DataFrame) -> int:
        """Load FEC data to PostgreSQL and Neo4j."""
        if df.empty:
            return 0

        count = 0

        # Load politicians
        politicians_df = df[df["_record_type"] == "politician"]
        if not politicians_df.empty:
            politician_cols = [
                "bioguide_id", "fec_candidate_id", "name", "party", "state",
                "district", "chamber", "office", "in_office", "first_elected",
                "next_election", "committees", "raw_data", "created_at", "updated_at"
            ]

            politician_values = []
            for _, row in politicians_df.iterrows():
                values = tuple(row.get(col) for col in politician_cols)
                politician_values.append(values)

            inserted = self.postgres.insert_many("politicians", politician_cols, politician_values)
            logger.info(f"Inserted {inserted} politicians to PostgreSQL")
            count += inserted

            # Sync politicians to Neo4j
            await self._sync_politicians_to_neo4j(politicians_df)

        # Load PAC committees
        pacs_df = df[df["_record_type"] == "pac_committee"]
        if not pacs_df.empty:
            pac_cols = [
                "committee_id", "name", "committee_type", "designation", "party",
                "connected_org_name", "total_receipts", "total_disbursements",
                "cash_on_hand", "cycle", "raw_data", "created_at", "updated_at"
            ]

            pac_values = []
            for _, row in pacs_df.iterrows():
                values = tuple(row.get(col) for col in pac_cols)
                pac_values.append(values)

            inserted = self.postgres.insert_many("pac_committees", pac_cols, pac_values)
            logger.info(f"Inserted {inserted} PAC committees to PostgreSQL")
            count += inserted

            # Sync PACs to Neo4j
            await self._sync_pacs_to_neo4j(pacs_df)

        # Load contributions
        contributions_df = df[df["_record_type"] == "contribution"]
        if not contributions_df.empty:
            # Filter to significant contributions (> $2,000) to avoid graph explosion
            significant_contributions = contributions_df[contributions_df["amount"] > 2000]

            if not significant_contributions.empty:
                contribution_cols = [
                    "contribution_id", "contributor_name", "contributor_employer",
                    "contributor_occupation", "contributor_city", "contributor_state",
                    "contributor_zip", "amount", "date", "committee_id", "candidate_id",
                    "receipt_type", "memo_text", "raw_data", "created_at"
                ]

                contribution_values = []
                for _, row in significant_contributions.iterrows():
                    values = tuple(row.get(col) for col in contribution_cols)
                    contribution_values.append(values)

                inserted = self.postgres.insert_many("contributions", contribution_cols, contribution_values)
                logger.info(f"Inserted {inserted} contributions to PostgreSQL")
                count += inserted

                # Sync significant contributions to Neo4j
                await self._sync_contributions_to_neo4j(significant_contributions)

        return count

    async def _sync_politicians_to_neo4j(self, df: pd.DataFrame):
        """Sync politicians to Neo4j graph."""
        for _, row in df.iterrows():
            try:
                self.neo4j.run("""
                    MERGE (p:Politician {fec_candidate_id: $fec_id})
                    ON CREATE SET p.name = $name,
                                 p.party = $party,
                                 p.state = $state,
                                 p.district = $district,
                                 p.chamber = $chamber,
                                 p.in_office = $in_office,
                                 p.created_at = datetime()
                    ON MATCH SET p.updated_at = datetime(),
                                 p.in_office = $in_office
                """, {
                    "fec_id": row.get("fec_candidate_id"),
                    "name": row.get("name", ""),
                    "party": row.get("party", ""),
                    "state": row.get("state", ""),
                    "district": row.get("district", ""),
                    "chamber": row.get("chamber", ""),
                    "in_office": bool(row.get("in_office", False)),
                })

            except Exception as e:
                logger.error(f"Neo4j sync error for politician {row.get('fec_candidate_id')}: {e}")

    async def _sync_pacs_to_neo4j(self, df: pd.DataFrame):
        """Sync PACs to Neo4j graph."""
        for _, row in df.iterrows():
            try:
                self.neo4j.run("""
                    MERGE (p:PAC {committee_id: $committee_id})
                    ON CREATE SET p.name = $name,
                                 p.type = $type,
                                 p.party = $party,
                                 p.connected_org = $connected_org,
                                 p.total_receipts = $total_receipts,
                                 p.created_at = datetime()
                    ON MATCH SET p.updated_at = datetime(),
                                 p.total_receipts = $total_receipts
                """, {
                    "committee_id": row.get("committee_id"),
                    "name": row.get("name", ""),
                    "type": row.get("committee_type", ""),
                    "party": row.get("party", ""),
                    "connected_org": row.get("connected_org_name", ""),
                    "total_receipts": float(row.get("total_receipts", 0)),
                })

            except Exception as e:
                logger.error(f"Neo4j sync error for PAC {row.get('committee_id')}: {e}")

    async def _sync_contributions_to_neo4j(self, df: pd.DataFrame):
        """Sync significant contributions to Neo4j graph."""
        for _, row in df.iterrows():
            try:
                # Create Contribution node
                self.neo4j.run("""
                    MERGE (c:Contribution {contribution_id: $contribution_id})
                    ON CREATE SET c.amount = $amount,
                                 c.date = date($date),
                                 c.contributor_name = $contributor_name,
                                 c.contributor_employer = $contributor_employer,
                                 c.created_at = datetime()
                """, {
                    "contribution_id": row.get("contribution_id"),
                    "amount": float(row.get("amount", 0)),
                    "date": str(row.get("date")) if row.get("date") else None,
                    "contributor_name": row.get("contributor_name", ""),
                    "contributor_employer": row.get("contributor_employer", ""),
                })

                # Link to Politician if candidate_id exists
                candidate_id = row.get("candidate_id")
                if candidate_id:
                    self.neo4j.run("""
                        MATCH (p:Politician {fec_candidate_id: $candidate_id})
                        MATCH (c:Contribution {contribution_id: $contribution_id})
                        MERGE (c)-[:DONATED_TO {amount: $amount, date: date($date)}]->(p)
                    """, {
                        "candidate_id": candidate_id,
                        "contribution_id": row.get("contribution_id"),
                        "amount": float(row.get("amount", 0)),
                        "date": str(row.get("date")) if row.get("date") else None,
                    })

                # Link to PAC if committee_id exists
                committee_id = row.get("committee_id")
                if committee_id:
                    self.neo4j.run("""
                        MATCH (pac:PAC {committee_id: $committee_id})
                        MATCH (c:Contribution {contribution_id: $contribution_id})
                        MERGE (c)-[:FUNDED {amount: $amount, date: date($date)}]->(pac)
                    """, {
                        "committee_id": committee_id,
                        "contribution_id": row.get("contribution_id"),
                        "amount": float(row.get("amount", 0)),
                        "date": str(row.get("date")) if row.get("date") else None,
                    })

            except Exception as e:
                logger.error(f"Neo4j sync error for contribution {row.get('contribution_id')}: {e}")
