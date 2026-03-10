"""
Quid Pro Quo detection engine.
Cross-references donation records, contract awards, and committee oversight
to detect potential pay-to-play patterns.
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from base.neo4j_client import Neo4jConnection
from base.postgres_client import PostgresConnection

logger = logging.getLogger(__name__)


class QuidProQuoDetector:
    """
    Detects quid pro quo patterns by cross-referencing:
    1. Company PAC donations → Politicians
    2. Politicians sitting on committees
    3. Committees overseeing agencies
    4. Agencies awarding contracts to donor companies

    Also detects regulatory capture: donation timing vs. rule changes.
    """

    # Confidence thresholds for flagging
    MIN_CONFIDENCE = 0.4
    HIGH_CONFIDENCE = 0.7

    # Amount thresholds
    MIN_DONATION = 5_000    # $5K minimum donation to flag
    MIN_CONTRACT = 100_000  # $100K minimum contract to flag

    def __init__(self):
        self.neo4j = Neo4jConnection()
        self.postgres = PostgresConnection()

    async def detect_patterns(self, lookback_months: int = 12) -> List[Dict[str, Any]]:
        """
        Run full quid pro quo detection across all entities.
        Returns list of detected patterns with confidence scores.
        """
        patterns = []

        try:
            qpq_patterns = await self._detect_quid_pro_quo(lookback_months)
            patterns.extend(qpq_patterns)
        except Exception as e:
            logger.error(f'Quid pro quo detection failed: {e}')

        try:
            reg_patterns = await self.detect_regulatory_capture(lookback_months)
            patterns.extend(reg_patterns)
        except Exception as e:
            logger.error(f'Regulatory capture detection failed: {e}')

        # Filter by minimum confidence
        filtered = [p for p in patterns if p.get('confidence', 0) >= self.MIN_CONFIDENCE]

        logger.info(f'Detected {len(filtered)} patterns above confidence threshold')
        return filtered

    async def _detect_quid_pro_quo(self, lookback_months: int = 12) -> List[Dict[str, Any]]:
        """
        Core quid pro quo detection:
        Company → PAC_DONATED → Politician → SITS_ON → Committee → OVERSEES → Agency → AWARDED → Contract → RECEIVED → Company
        """
        cutoff_date = (datetime.utcnow() - timedelta(days=lookback_months * 30)).strftime('%Y-%m-%d')

        async with self.neo4j.session() as session:
            result = await session.run(
                """
                MATCH (company:Company)-[:PAC_DONATED]->(politician:Politician)
                MATCH (politician)-[:SITS_ON]->(committee:Committee)
                MATCH (committee)-[:OVERSEES]->(agency:Agency)
                MATCH (agency)-[:AWARDED]->(contract:Contract)<-[:RECEIVED]-(company)
                WHERE contract.award_date >= date($cutoff)
                  AND contract.amount >= $min_contract
                WITH
                    company,
                    politician,
                    agency,
                    committee,
                    sum(contract.amount) as total_contract_amount,
                    count(contract) as contract_count,
                    collect(contract.award_date)[0] as earliest_contract
                RETURN {
                    company: company.name,
                    company_id: company.normalized_name,
                    politician: politician.name,
                    politician_id: politician.bioguide_id,
                    agency: agency.name,
                    committee: committee.name,
                    total_contract_amount: total_contract_amount,
                    contract_count: contract_count,
                    earliest_contract_date: earliest_contract
                } as pattern
                ORDER BY total_contract_amount DESC
                LIMIT 50
                """,
                cutoff=cutoff_date,
                min_contract=self.MIN_CONTRACT
            )

            records = await result.data()

        patterns = []
        for record in records:
            p = record.get('pattern', {})
            confidence = self._calculate_qpq_confidence(p)
            if confidence >= self.MIN_CONFIDENCE:
                patterns.append({
                    'type': 'quid_pro_quo',
                    'company': p.get('company'),
                    'company_id': p.get('company_id'),
                    'politician': p.get('politician'),
                    'politician_id': p.get('politician_id'),
                    'agency': p.get('agency'),
                    'committee': p.get('committee'),
                    'total_contract_amount': p.get('total_contract_amount', 0),
                    'contract_count': p.get('contract_count', 0),
                    'confidence': confidence,
                    'severity': 'HIGH' if confidence >= self.HIGH_CONFIDENCE else 'MEDIUM',
                    'evidence_links': self._build_evidence_links(p),
                    'disclaimer': 'Analytical inference — not legal conclusion.',
                })

        return patterns

    def _calculate_qpq_confidence(self, pattern: Dict) -> float:
        """
        Calculate confidence score for a quid pro quo pattern.
        Factors: contract amount, contract count, donation amount, timing gap.
        """
        score = 0.4  # Base confidence for any complete chain

        # High contract amounts increase confidence
        amount = pattern.get('total_contract_amount', 0) or 0
        if amount > 1e9: score += 0.25
        elif amount > 1e8: score += 0.15
        elif amount > 1e7: score += 0.08

        # Multiple contracts increase confidence
        count = pattern.get('contract_count', 0) or 0
        if count > 5: score += 0.15
        elif count > 2: score += 0.08

        return min(0.95, score)

    def _build_evidence_links(self, pattern: Dict) -> List[str]:
        """Build list of evidence references for a pattern."""
        links = []
        if pattern.get('politician'):
            links.append(f'FEC candidate search: {pattern["politician"]}')
        if pattern.get('company'):
            links.append(f'USASpending.gov: {pattern["company"]} contracts')
        if pattern.get('agency'):
            links.append(f'Agency: {pattern["agency"]} procurement records')
        return links

    async def detect_regulatory_capture(self, lookback_months: int = 18) -> List[Dict[str, Any]]:
        """
        Detect regulatory capture patterns:
        Company submits comment on regulation → Rule changes in company's favor
        → Company had donated to committee chair who oversees that agency
        """
        cutoff_date = (datetime.utcnow() - timedelta(days=lookback_months * 30)).strftime('%Y-%m-%d')

        patterns = []

        try:
            async with self.neo4j.session() as session:
                result = await session.run(
                    """
                    MATCH (company:Company)-[:SUBMITTED_COMMENT]->(regulation:Regulation)
                    WHERE regulation.publication_date >= date($cutoff)
                      AND regulation.significant = true
                    MATCH (regulation)<-[:ISSUED]-(agency:Agency)
                    MATCH (agency)<-[:OVERSEES]-(committee:Committee)<-[:SITS_ON]-(politician:Politician)
                    MATCH (company)-[:PAC_DONATED]->(politician)
                    RETURN {
                        company: company.name,
                        regulation: regulation.title,
                        regulation_id: regulation.document_number,
                        agency: agency.name,
                        politician: politician.name,
                        committee: committee.name
                    } as pattern
                    LIMIT 30
                    """,
                    cutoff=cutoff_date
                )
                records = await result.data()

            for record in records:
                p = record.get('pattern', {})
                patterns.append({
                    'type': 'regulatory_capture',
                    'company': p.get('company'),
                    'regulation': p.get('regulation'),
                    'regulation_id': p.get('regulation_id'),
                    'agency': p.get('agency'),
                    'politician': p.get('politician'),
                    'committee': p.get('committee'),
                    'confidence': 0.65,
                    'severity': 'HIGH',
                    'disclaimer': 'Analytical inference — not legal conclusion.',
                })
        except Exception as e:
            logger.warning(f'Regulatory capture Neo4j query failed: {e}')

        return patterns

    async def get_company_patterns(self, company_id: str, lookback_months: int = 12) -> List[Dict[str, Any]]:
        """Get all quid pro quo patterns for a specific company."""
        all_patterns = await self.detect_patterns(lookback_months)
        return [p for p in all_patterns if p.get('company_id') == company_id or
                company_id.lower() in (p.get('company', '') or '').lower()]
