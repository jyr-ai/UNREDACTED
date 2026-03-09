"""Entity resolution for cross-source entity linking."""
import logging
from typing import List, Dict, Optional, Tuple
from fuzzywuzzy import fuzz
from fuzzywuzzy import process

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from base.postgres_client import PostgresConnection
from base.neo4j_client import Neo4jConnection

logger = logging.getLogger(__name__)


class EntityResolver:
    """Resolves entities across different data sources."""

    def __init__(self):
        self.postgres = PostgresConnection()
        self.neo4j = Neo4jConnection()

    def normalize_company_name(self, name: str) -> str:
        """Normalize company name for matching."""
        if not name:
            return ""

        # Remove common suffixes and normalize
        suffixes = [
            " INC.", " INC", " LLC", " L.L.C.", " L.L.C",
            " CORP.", " CORP", " CORPORATION",
            " LTD.", " LTD", " LIMITED",
            " LP", " L.P.", " L.P",
            " LLP", " L.L.P.", " L.L.P",
        ]

        normalized = name.upper().strip()
        for suffix in suffixes:
            if normalized.endswith(suffix):
                normalized = normalized[:-len(suffix)].strip()

        return normalized

    def match_company(self, name: str, uei: Optional[str] = None, threshold: int = 85) -> Optional[Dict]:
        """Match a company name against known entities."""
        normalized = self.normalize_company_name(name)

        # First try exact UEI match
        if uei:
            result = self.postgres.fetchone(
                "SELECT * FROM contracts WHERE recipient_uei = %s LIMIT 1",
                (uei,)
            )
            if result:
                return dict(result)

        # Try normalized name match
        result = self.postgres.fetchone(
            "SELECT * FROM contracts WHERE normalized_name = %s LIMIT 1",
            (normalized,)
        )
        if result:
            return dict(result)

        # Fuzzy match against known recipients
        results = self.postgres.fetchall(
            "SELECT DISTINCT recipient_name, recipient_uei FROM contracts WHERE recipient_name IS NOT NULL LIMIT 10000"
        )

        if results:
            names = [r["recipient_name"] for r in results]
            best_match = process.extractOne(name, names, scorer=fuzz.token_sort_ratio)
            if best_match and best_match[1] >= threshold:
                matched_name = best_match[0]
                return self.postgres.fetchone(
                    "SELECT * FROM contracts WHERE recipient_name = %s LIMIT 1",
                    (matched_name,)
                )

        return None

    def resolve_company_uei(self, name: str) -> Optional[str]:
        """Resolve a company name to its UEI."""
        match = self.match_company(name)
        if match:
            return match.get("recipient_uei")
        return None

    def get_company_spending_summary(self, normalized_name: str) -> Dict:
        """Get spending summary for a company."""
        # Contracts summary
        contracts = self.postgres.fetchone("""
            SELECT COUNT(*) as contract_count,
                   SUM(award_amount) as total_contracts,
                   MAX(award_date) as latest_contract
            FROM contracts
            WHERE normalized_name = %s
        """, (normalized_name,))

        # Grants summary
        grants = self.postgres.fetchone("""
            SELECT COUNT(*) as grant_count,
                   SUM(award_amount) as total_grants
            FROM grants
            WHERE recipient_name ILIKE %s
        """, (f"%{normalized_name}%",))

        return {
            "company": normalized_name,
            "contract_count": contracts.get("contract_count", 0) if contracts else 0,
            "total_contract_amount": float(contracts.get("total_contracts", 0)) if contracts else 0,
            "latest_contract_date": contracts.get("latest_contract"),
            "grant_count": grants.get("grant_count", 0) if grants else 0,
            "total_grant_amount": float(grants.get("total_grants", 0)) if grants else 0,
        }

    def link_similar_companies(self, threshold: int = 90) -> int:
        """Find and link similar company names in Neo4j."""
        results = self.neo4j.run("""
            MATCH (c:Company)
            RETURN c.normalized_name as name, c.uei as uei
        """)

        companies = [r["name"] for r in results if r.get("name")]
        links_created = 0

        for i, name1 in enumerate(companies):
            for name2 in companies[i+1:]:
                score = fuzz.ratio(name1, name2)
                if score >= threshold:
                    # Create SIMILAR_TO relationship
                    self.neo4j.run("""
                        MATCH (c1:Company {normalized_name: $name1})
                        MATCH (c2:Company {normalized_name: $name2})
                        MERGE (c1)-[:SIMILAR_TO {score: $score}]-(c2)
                    """, {"name1": name1, "name2": name2, "score": score})
                    links_created += 1

        logger.info(f"Created {links_created} similarity links between companies")
        return links_created

    def get_company_network(self, normalized_name: str, depth: int = 2) -> Dict:
        """Get company network from Neo4j."""
        query = """
            MATCH path = (c:Company {normalized_name: $name})-[:RECEIVED|SIMILAR_TO|AFFILIATED_WITH*1..$depth]-(related)
            RETURN c.name as company,
                   [node in nodes(path) | node.normalized_name] as path_nodes,
                   [rel in relationships(path) | type(rel)] as path_rels
            LIMIT 100
        """

        results = self.neo4j.run(query, {"name": normalized_name, "depth": depth})

        return {
            "company": normalized_name,
            "network_size": len(results),
            "connections": results
        }


async def sync_contracts_to_graph() -> Dict:
    """Sync all contracts to Neo4j graph."""
    postgres = PostgresConnection()
    neo4j = Neo4jConnection()

    # Get all contracts not yet in graph
    contracts = postgres.fetchall("""
        SELECT * FROM contracts
        WHERE award_date >= CURRENT_DATE - INTERVAL '30 days'
    """)

    entities_created = 0

    for contract in contracts:
        try:
            # Create Company
            neo4j.run("""
                MERGE (c:Company {normalized_name: $normalized_name})
                ON CREATE SET c.name = $name, c.uei = $uei, c.created_at = datetime()
            """, {
                "normalized_name": contract.get("normalized_name", ""),
                "name": contract.get("recipient_name", ""),
                "uei": contract.get("recipient_uei"),
            })

            # Create Agency
            neo4j.run("""
                MERGE (a:Agency {name: $agency_name})
                ON CREATE SET a.created_at = datetime()
            """, {"agency_name": contract.get("awarding_agency", "")})

            # Create Contract and relationships
            neo4j.run("""
                MATCH (c:Company {normalized_name: $normalized_name})
                MATCH (a:Agency {name: $agency_name})
                MERGE (contract:Contract {award_id: $award_id})
                ON CREATE SET contract.amount = $amount,
                             contract.award_date = $award_date,
                             contract.description = $description
                MERGE (c)-[:RECEIVED]->(contract)
                MERGE (a)-[:AWARDED]->(contract)
            """, {
                "normalized_name": contract.get("normalized_name", ""),
                "agency_name": contract.get("awarding_agency", ""),
                "award_id": contract.get("award_id", ""),
                "amount": float(contract.get("award_amount", 0)),
                "award_date": contract.get("award_date"),
                "description": contract.get("description", "")[:100],
            })

            entities_created += 1

        except Exception as e:
            logger.error(f"Error syncing contract to graph: {e}")

    return {
        "success": True,
        "entities_created": entities_created,
        "contracts_processed": len(contracts)
    }
