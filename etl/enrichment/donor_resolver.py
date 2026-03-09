"""Donor entity resolution and enrichment."""
import re
from typing import List, Dict, Any, Optional, Tuple
import logging
from difflib import SequenceMatcher
from collections import defaultdict

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from base.postgres_client import PostgresConnection
from base.neo4j_client import Neo4jConnection

logger = logging.getLogger(__name__)


class DonorResolver:
    """Resolve and enrich donor entities across multiple data sources."""

    def __init__(self):
        self.postgres = PostgresConnection()
        self.neo4j = Neo4jConnection()

    def resolve_donor_entity(self, name: str, employer: str = None, occupation: str = None) -> Dict:
        """Resolve a donor entity to a canonical representation."""

        # Step 1: Normalize inputs
        normalized_name = self._normalize_name(name)
        normalized_employer = self._normalize_employer(employer) if employer else None

        # Step 2: Check existing matches in PostgreSQL
        existing_match = self._find_existing_donor(normalized_name, normalized_employer)

        if existing_match:
            logger.info(f"Found existing donor match: {existing_match.get('canonical_name')}")
            return existing_match

        # Step 3: Create new canonical entity
        canonical_entity = self._create_canonical_entity(
            name=name,
            normalized_name=normalized_name,
            employer=employer,
            normalized_employer=normalized_employer,
            occupation=occupation
        )

        # Step 4: Store in PostgreSQL and Neo4j
        self._store_canonical_entity(canonical_entity)

        logger.info(f"Created new canonical donor entity: {canonical_entity['canonical_name']}")
        return canonical_entity

    def _normalize_name(self, name: str) -> str:
        """Normalize donor name for matching."""
        if not name:
            return ""

        # Convert to lowercase
        normalized = name.lower()

        # Remove common prefixes/suffixes
        prefixes = ["mr.", "mrs.", "ms.", "dr.", "hon.", "rep.", "sen.", "gov."]
        for prefix in prefixes:
            if normalized.startswith(prefix):
                normalized = normalized[len(prefix):].strip()

        # Remove extra whitespace
        normalized = re.sub(r'\s+', ' ', normalized).strip()

        # Remove punctuation except hyphens and apostrophes
        normalized = re.sub(r'[^\w\s\-\']', '', normalized)

        # Standardize common name variations
        variations = {
            "jr": "",
            "sr": "",
            "ii": "",
            "iii": "",
            "iv": "",
            "phd": "",
            "esq": "",
            "cpa": "",
        }

        for variation, replacement in variations.items():
            normalized = re.sub(rf'\b{variation}\b', replacement, normalized)

        return normalized.strip()

    def _normalize_employer(self, employer: str) -> str:
        """Normalize employer name for matching."""
        if not employer:
            return ""

        # Convert to lowercase
        normalized = employer.lower()

        # Remove common corporate suffixes
        suffixes = [
            "inc", "incorporated", "llc", "ltd", "limited", "corp", "corporation",
            "co", "company", "plc", "group", "holdings", "enterprises", "partners"
        ]

        for suffix in suffixes:
            normalized = re.sub(rf'\b{suffix}\b', '', normalized)

        # Remove punctuation and extra whitespace
        normalized = re.sub(r'[^\w\s]', '', normalized)
        normalized = re.sub(r'\s+', ' ', normalized).strip()

        return normalized

    def _find_existing_donor(self, normalized_name: str, normalized_employer: str = None) -> Optional[Dict]:
        """Find existing donor entity in PostgreSQL."""

        # First, try exact name match
        query = """
            SELECT DISTINCT ON (canonical_name)
                   canonical_name, entity_type, confidence_score,
                   fec_contributor_id, opensecrets_id, metadata
            FROM donor_entities
            WHERE normalized_name = %s
            ORDER BY canonical_name, confidence_score DESC
            LIMIT 1
        """

        result = self.postgres.fetchone(query, (normalized_name,))

        if result:
            return dict(result)

        # If no exact match, try fuzzy matching
        if normalized_employer:
            # Look for donors with similar employer
            query = """
                SELECT canonical_name, entity_type, confidence_score,
                       fec_contributor_id, opensecrets_id, metadata,
                       normalized_name, normalized_employer
                FROM donor_entities
                WHERE normalized_employer = %s
                ORDER BY confidence_score DESC
                LIMIT 10
            """

            results = self.postgres.fetchall(query, (normalized_employer,))

            if results:
                # Find best name match among same-employer donors
                best_match = None
                best_score = 0.0

                for row in results:
                    existing_name = row.get("normalized_name", "")
                    score = SequenceMatcher(None, normalized_name, existing_name).ratio()

                    if score > best_score and score > 0.8:  # 80% similarity threshold
                        best_score = score
                        best_match = dict(row)

                if best_match:
                    logger.info(f"Found fuzzy match with score {best_score:.2f}")
                    return best_match

        return None

    def _create_canonical_entity(self, name: str, normalized_name: str,
                                employer: str = None, normalized_employer: str = None,
                                occupation: str = None) -> Dict:
        """Create a new canonical donor entity."""

        # Determine entity type
        entity_type = self._determine_entity_type(name, employer, occupation)

        # Generate canonical name
        canonical_name = self._generate_canonical_name(name, entity_type)

        # Build metadata
        metadata = {
            "original_name": name,
            "normalized_name": normalized_name,
            "original_employer": employer,
            "normalized_employer": normalized_employer,
            "occupation": occupation,
            "entity_type": entity_type,
            "source_systems": ["fec"],
            "match_confidence": 1.0,  # New entity, high confidence
        }

        return {
            "canonical_name": canonical_name,
            "entity_type": entity_type,
            "confidence_score": 1.0,
            "fec_contributor_id": None,
            "opensecrets_id": None,
            "metadata": metadata,
            "normalized_name": normalized_name,
            "normalized_employer": normalized_employer,
        }

    def _determine_entity_type(self, name: str, employer: str = None, occupation: str = None) -> str:
        """Determine the type of donor entity."""

        # Check if it's a corporate entity
        corporate_indicators = ["inc", "llc", "ltd", "corp", "co", "company", "group"]
        if employer and any(indicator in employer.lower() for indicator in corporate_indicators):
            return "corporate"

        # Check if it's a PAC
        pac_indicators = ["pac", "political action committee", "committee"]
        if name and any(indicator in name.lower() for indicator in pac_indicators):
            return "pac"

        # Check occupation for professional categories
        if occupation:
            occupation_lower = occupation.lower()

            if any(prof in occupation_lower for prof in ["attorney", "lawyer", "esq"]):
                return "legal"
            elif any(prof in occupation_lower for prof in ["doctor", "physician", "md"]):
                return "medical"
            elif any(prof in occupation_lower for prof in ["executive", "ceo", "cfo", "president"]):
                return "executive"
            elif any(prof in occupation_lower for prof in ["retired"]):
                return "retired"

        # Default to individual
        return "individual"

    def _generate_canonical_name(self, name: str, entity_type: str) -> str:
        """Generate a canonical name for the entity."""

        if entity_type in ["corporate", "pac"]:
            # For organizations, use the name as-is but cleaned up
            cleaned = re.sub(r'\s+', ' ', name).strip()
            return cleaned.title()
        else:
            # For individuals, standardize name format
            parts = name.split()

            if len(parts) >= 2:
                # Assume last part is surname
                surname = parts[-1].title()
                given_names = " ".join(parts[:-1]).title()
                return f"{surname}, {given_names}"
            else:
                return name.title()

    def _store_canonical_entity(self, entity: Dict):
        """Store canonical entity in PostgreSQL and Neo4j."""

        # Store in PostgreSQL
        query = """
            INSERT INTO donor_entities (
                canonical_name, entity_type, confidence_score,
                fec_contributor_id, opensecrets_id, metadata,
                normalized_name, normalized_employer,
                created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (canonical_name)
            DO UPDATE SET
                confidence_score = EXCLUDED.confidence_score,
                metadata = EXCLUDED.metadata,
                updated_at = NOW()
        """

        params = (
            entity["canonical_name"],
            entity["entity_type"],
            entity["confidence_score"],
            entity.get("fec_contributor_id"),
            entity.get("opensecrets_id"),
            entity["metadata"],
            entity["normalized_name"],
            entity.get("normalized_employer"),
        )

        self.postgres.execute(query, params)

        # Store in Neo4j
        self._sync_to_neo4j(entity)

    def _sync_to_neo4j(self, entity: Dict):
        """Sync canonical entity to Neo4j graph."""

        try:
            node_label = entity["entity_type"].title()

            self.neo4j.run(f"""
                MERGE (e:{node_label} {{canonical_name: $canonical_name}})
                ON CREATE SET e.created_at = datetime(),
                             e.entity_type = $entity_type,
                             e.confidence_score = $confidence_score,
                             e.metadata = $metadata
                ON MATCH SET e.updated_at = datetime(),
                             e.confidence_score = $confidence_score,
                             e.metadata = $metadata
            """, {
                "canonical_name": entity["canonical_name"],
                "entity_type": entity["entity_type"],
                "confidence_score": entity["confidence_score"],
                "metadata": entity["metadata"],
            })

        except Exception as e:
            logger.error(f"Neo4j sync error for donor entity {entity['canonical_name']}: {e}")

    def enrich_contributions(self, batch_size: int = 1000):
        """Enrich contributions with resolved donor entities."""

        logger.info("Starting contribution enrichment...")

        # Get contributions without resolved entities
        query = """
            SELECT c.id, c.contributor_name, c.contributor_employer, c.contributor_occupation
            FROM contributions c
            LEFT JOIN contribution_donor_links l ON c.id = l.contribution_id
            WHERE l.id IS NULL
            LIMIT %s
        """

        contributions = self.postgres.fetchall(query, (batch_size,))

        enriched_count = 0

        for contribution in contributions:
            try:
                # Resolve donor entity
                donor_entity = self.resolve_donor_entity(
                    name=contribution["contributor_name"],
                    employer=contribution["contributor_employer"],
                    occupation=contribution["contributor_occupation"]
                )

                # Create link between contribution and donor entity
                link_query = """
                    INSERT INTO contribution_donor_links (
                        contribution_id, canonical_name, match_confidence,
                        created_at
                    ) VALUES (%s, %s, %s, NOW())
                    ON CONFLICT (contribution_id, canonical_name) DO NOTHING
                """

                self.postgres.execute(link_query, (
                    contribution["id"],
                    donor_entity["canonical_name"],
                    donor_entity["confidence_score"]
                ))

                enriched_count += 1

                # Also create Neo4j relationship
                self._create_neo4j_relationship(
                    contribution_id=contribution["id"],
                    canonical_name=donor_entity["canonical_name"],
                    entity_type=donor_entity["entity_type"]
                )

            except Exception as e:
                logger.error(f"Error enriching contribution {contribution.get('id')}: {e}")

        logger.info(f"Enriched {enriched_count} contributions with donor entities")
        return enriched_count

    def _create_neo4j_relationship(self, contribution_id: int, canonical_name: str, entity_type: str):
        """Create Neo4j relationship between contribution and donor entity."""

        try:
            node_label = entity_type.title()

            self.neo4j.run(f"""
                MATCH (c:Contribution {{contribution_id: $contribution_id}})
                MATCH (e:{node_label} {{canonical_name: $canonical_name}})
                MERGE (e)-[:MADE_CONTRIBUTION]->(c)
            """, {
                "contribution_id": str(contribution_id),
                "canonical_name": canonical_name,
            })

        except Exception as e:
            logger.error(f"Neo4j relationship error: {e}")

    def analyze_donor_network(self, canonical_name: str, depth: int = 2) -> Dict:
        """Analyze donor network in Neo4j."""

        try:
            # Find the donor entity
            query = """
                MATCH (d {canonical_name: $canonical_name})
                RETURN d.entity_type as entity_type, d.metadata as metadata
                LIMIT 1
            """

            donor_info = self.neo4j.run(query, {"canonical_name": canonical_name})

            if not donor_info:
                return {"error": "Donor not found"}

            # Get network connections
            network_query = f"""
                MATCH path = (d {{canonical_name: $canonical_name}})-[*1..{depth}]-(connected)
                WHERE connected:Contribution OR connected:Politician OR connected:PAC
                RETURN
                    nodes(path) as nodes,
                    relationships(path) as relationships,
                    length(path) as distance
                ORDER BY distance
                LIMIT 100
            """

            network_results = self.neo4j.run(network_query, {"canonical_name": canonical_name})

            # Process network results
            nodes = set()
            edges = []

            for result in network_results:
                path_nodes = result.get("nodes", [])
                path_rels = result.get("relationships", [])

                for node in path_nodes:
                    node_id = node.get("id")
                    if node_id:
                        nodes.add(node_id)

                for rel in path_rels:
                    edges.append({
                        "source": rel.start_node.get("id"),
                        "target": rel.end_node.get("id"),
                        "type": rel.type,
                        "properties": dict(rel)
                    })

            return {
                "donor": donor_info[0],
                "network": {
                    "node_count": len(nodes),
                    "edge_count": len(edges),
                    "nodes": list(nodes)[:50],  # Limit for response size
                    "edges": edges[:100],  # Limit for response size
                }
            }

        except Exception as e:
            logger.error(f"Network analysis error for {canonical_name}: {e}")
            return {"error": str(e)}


# Create the donor_entities table if it doesn't exist
def create_donor_entities_table():
    """Create the donor_entities table."""

    conn = PostgresConnection()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS donor_entities (
            id SERIAL PRIMARY KEY,
            canonical_name VARCHAR(500) UNIQUE NOT NULL,
            entity_type VARCHAR(50) NOT NULL,
            confidence_score DECIMAL(3, 2) DEFAULT 1.0,
            fec_contributor_id VARCHAR(50),
            opensecrets_id VARCHAR(50),
            metadata JSONB,
            normalized_name VARCHAR(500),
            normalized_employer VARCHAR(500),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_donor_entities_normalized_name
        ON donor_entities(normalized_name);
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_donor_entities_normalized_employer
        ON donor_entities(normalized_employer);
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_donor_entities_entity_type
        ON donor_entities(entity_type);
    """)

    # Create contribution_donor_links table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS contribution_donor_links (
            id SERIAL PRIMARY KEY,
            contribution_id INTEGER REFERENCES contributions(id),
            canonical_name VARCHAR(500) REFERENCES donor_entities(canonical_name),
            match_confidence DECIMAL(3, 2) DEFAULT 1.0,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(contribution_id, canonical_name)
        );
    """)

    logger.info("Donor entities tables created")


if __name__ == "__main__":
    # Test the resolver
    resolver = DonorResolver()
    create_donor_entities_table()

    # Test with sample data
