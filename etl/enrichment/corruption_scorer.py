"""
Corruption scoring enrichment module.
Implements RECEIPTS Accountability Score for politicians and companies.
"""
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from base.neo4j_client import Neo4jConnection
from base.postgres_client import PostgresConnection

logger = logging.getLogger(__name__)


class CorruptionScorer:
    """
    Computes RECEIPTS Accountability Scores for politicians and companies.

    Score components for politicians (0–25 each, total 0–100):
      - donor_transparency: Proportion of itemized vs. dark contributions
      - stock_act_compliance: Trade timing vs. committee hearings
      - vote_donor_alignment: Correlation between votes and donor industries
      - disclosure_timeliness: Lateness of financial disclosures

    Risk levels for companies (0–100):
      - 0–25: LOW
      - 26–50: MEDIUM
      - 51–75: HIGH
      - 76–100: CRITICAL
    """

    PATTERN_WEIGHTS = {
        'quid_pro_quo':       {'base': 35, 'confidence_factor': True},
        'regulatory_capture': {'base': 30, 'confidence_factor': True},
        'revolving_door':     {'base': 20, 'confidence_factor': True},
        'stock_act':          {'base': 25, 'confidence_factor': True},
        'dark_money':         {'base': 15, 'confidence_factor': True},
    }

    def __init__(self):
        self.neo4j = Neo4jConnection()
        self.postgres = PostgresConnection()

    async def get_politician_score(self, politician_id: str) -> Dict[str, Any]:
        """
        Compute the full RECEIPTS Accountability Score for a politician.
        Returns score breakdown with evidence chain.
        """
        try:
            components = await self._score_politician_components(politician_id)
            overall = round(sum(components.values()))
            tier = self._get_tier(overall)

            evidence = await self._build_politician_evidence(politician_id, components)

            return {
                'politician_id': politician_id,
                'overall_score': overall,
                'tier': tier,
                'components': {
                    'donor_transparency': components.get('donor_transparency', 0),
                    'stock_act_compliance': components.get('stock_act_compliance', 0),
                    'vote_donor_alignment': components.get('vote_donor_alignment', 0),
                    'disclosure_timeliness': components.get('disclosure_timeliness', 0),
                },
                'evidence': evidence,
                'scored_at': datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.error(f'get_politician_score failed for {politician_id}: {e}')
            return {'politician_id': politician_id, 'overall_score': 0, 'tier': 'F', 'error': str(e)}

    async def _score_politician_components(self, politician_id: str) -> Dict[str, float]:
        """Score each component of the politician accountability score."""
        components = {}

        # 1. Donor Transparency (0–25): ratio of itemized to total contributions
        try:
            async with self.postgres.connect() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT
                        SUM(amount) FILTER (WHERE itemized = true) as itemized_total,
                        SUM(amount) as total
                    FROM contributions
                    WHERE candidate_id = $1
                    """,
                    politician_id
                )
                if row and row['total'] and row['total'] > 0:
                    ratio = (row['itemized_total'] or 0) / row['total']
                    components['donor_transparency'] = round(ratio * 25, 1)
                else:
                    components['donor_transparency'] = 12.5  # Neutral if no data
        except Exception as e:
            logger.warning(f'Donor transparency score failed: {e}')
            components['donor_transparency'] = 12.5

        # 2. STOCK Act Compliance (0–25): inverse of violations
        try:
            async with self.postgres.connect() as conn:
                violations = await conn.fetchval(
                    """
                    SELECT COUNT(*) FROM stock_trades
                    WHERE politician_id = $1 AND potential_violation = true
                    """,
                    politician_id
                )
                # Each violation costs 5 points from 25
                components['stock_act_compliance'] = max(0, 25 - (violations or 0) * 5)
        except Exception as e:
            logger.warning(f'STOCK Act compliance score failed: {e}')
            components['stock_act_compliance'] = 17.5  # Neutral

        # 3. Vote-Donor Alignment (0–25): cross-reference votes with donor industries
        # Higher alignment = lower score (voting for donors = less accountable)
        try:
            async with self.neo4j.session() as session:
                result = await session.run(
                    """
                    MATCH (p:Politician {politician_id: $pid})-[:DONATED_BY]-(c:Contribution)
                    WITH p, count(c) as donorCount
                    MATCH (p)-[:VOTED_FOR]-(b:Bill)
                    WHERE b.primary_beneficiary IS NOT NULL
                    RETURN donorCount, count(b) as voteCount
                    """,
                    pid=politician_id
                )
                records = await result.data()
                if records:
                    # Simplified: high donor count with many bills = potential alignment
                    donor_count = records[0].get('donorCount', 0)
                    vote_count = records[0].get('voteCount', 0)
                    alignment_risk = min(1.0, (donor_count / 100) * (vote_count / 10))
                    components['vote_donor_alignment'] = round((1 - alignment_risk) * 25, 1)
                else:
                    components['vote_donor_alignment'] = 15.0
        except Exception as e:
            logger.warning(f'Vote-donor alignment score failed: {e}')
            components['vote_donor_alignment'] = 15.0

        # 4. Disclosure Timeliness (0–25): fraction of on-time filings
        try:
            async with self.postgres.connect() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT
                        COUNT(*) FILTER (WHERE filed_on_time = true) as on_time,
                        COUNT(*) as total
                    FROM financial_disclosures
                    WHERE politician_id = $1
                    """,
                    politician_id
                )
                if row and row['total'] and row['total'] > 0:
                    ratio = row['on_time'] / row['total']
                    components['disclosure_timeliness'] = round(ratio * 25, 1)
                else:
                    components['disclosure_timeliness'] = 17.5  # Neutral
        except Exception as e:
            logger.warning(f'Disclosure timeliness score failed: {e}')
            components['disclosure_timeliness'] = 17.5

        return components

    async def _build_politician_evidence(self, politician_id: str, components: Dict) -> List[Dict]:
        """Build evidence chain supporting the score."""
        evidence = []

        if components.get('donor_transparency', 25) < 15:
            evidence.append({
                'category': 'donor_transparency',
                'flag': 'HIGH',
                'description': 'Large proportion of contributions are unitemized (dark money / small-donor exemptions)',
            })

        if components.get('stock_act_compliance', 25) < 15:
            evidence.append({
                'category': 'stock_act',
                'flag': 'HIGH',
                'description': 'Multiple potential STOCK Act violations detected — trades near committee hearings',
            })

        if components.get('vote_donor_alignment', 25) < 12:
            evidence.append({
                'category': 'vote_donor_alignment',
                'flag': 'HIGH',
                'description': 'Voting record shows strong correlation with top donor industries',
            })

        if components.get('disclosure_timeliness', 25) < 15:
            evidence.append({
                'category': 'disclosure',
                'flag': 'MEDIUM',
                'description': 'History of late or incomplete financial disclosures',
            })

        return evidence

    async def get_company_score(self, company_id: str) -> Dict[str, Any]:
        """
        Compute the company corruption risk profile.
        Returns risk score 0–100 with component breakdown.
        """
        try:
            components = await self._score_company_components(company_id)
            weights = {'contract_concentration': 0.3, 'donor_links': 0.3, 'regulatory_capture': 0.2, 'revolving_door': 0.2}
            overall = round(sum(components.get(k, 0) * w for k, w in weights.items()))
            risk_level = self._get_risk_level(overall)

            return {
                'company_id': company_id,
                'overall_score': overall,
                'risk_level': risk_level,
                'components': components,
                'scored_at': datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.error(f'get_company_score failed for {company_id}: {e}')
            return {'company_id': company_id, 'overall_score': 0, 'risk_level': 'UNKNOWN', 'error': str(e)}

    async def _score_company_components(self, company_id: str) -> Dict[str, float]:
        """Score each risk component for a company."""
        components = {}

        # 1. Contract Concentration: how dominant is the company in contracts?
        try:
            async with self.neo4j.session() as session:
                result = await session.run(
                    """
                    MATCH (c:Company {normalized_name: $cid})-[:RECEIVED]->(contract:Contract)
                    RETURN sum(contract.amount) as total_amount, count(contract) as contract_count
                    """,
                    cid=company_id
                )
                records = await result.data()
                if records:
                    total = records[0].get('total_amount', 0) or 0
                    count = records[0].get('contract_count', 0) or 0
                    # Scale: >$1B = 90, >$100M = 70, >$10M = 50, else 20
                    if total > 1e9: score = 90
                    elif total > 1e8: score = 70
                    elif total > 1e7: score = 50
                    else: score = 20
                    components['contract_concentration'] = score
                else:
                    components['contract_concentration'] = 10
        except Exception as e:
            logger.warning(f'Contract concentration score failed: {e}')
            components['contract_concentration'] = 10

        # 2. Donor Links: PAC donations to politicians
        try:
            async with self.neo4j.session() as session:
                result = await session.run(
                    """
                    MATCH (c:Company {normalized_name: $cid})-[:PAC_DONATED]->(p:Politician)
                    RETURN count(p) as politician_count
                    """,
                    cid=company_id
                )
                records = await result.data()
                count = records[0].get('politician_count', 0) if records else 0
                components['donor_links'] = min(100, count * 15) if count > 0 else 10
        except Exception as e:
            logger.warning(f'Donor links score failed: {e}')
            components['donor_links'] = 10

        # 3. Regulatory Capture: significant rules issued by agencies that gave contracts
        try:
            async with self.neo4j.session() as session:
                result = await session.run(
                    """
                    MATCH (c:Company {normalized_name: $cid})-[:RECEIVED]->(:Contract)<-[:AWARDED]-(a:Agency)
                    MATCH (a)-[:ISSUED]->(r:Regulation {significant: true})
                    RETURN count(r) as sig_rules
                    """,
                    cid=company_id
                )
                records = await result.data()
                sig_rules = records[0].get('sig_rules', 0) if records else 0
                components['regulatory_capture'] = min(100, sig_rules * 15) if sig_rules > 0 else 10
        except Exception as e:
            logger.warning(f'Regulatory capture score failed: {e}')
            components['regulatory_capture'] = 10

        # 4. Revolving Door: former officials now at company
        try:
            async with self.postgres.connect() as conn:
                count = await conn.fetchval(
                    """
                    SELECT COUNT(*) FROM revolving_door
                    WHERE company_id = $1 AND gap_months <= 24
                    """,
                    company_id
                )
                components['revolving_door'] = min(100, (count or 0) * 20) if count else 10
        except Exception as e:
            logger.warning(f'Revolving door score failed: {e}')
            components['revolving_door'] = 10

        return components

    async def score_entity(self, entity_id: str, entity_type: str) -> Dict[str, Any]:
        """Score any entity by type: 'politician' or 'company'."""
        if entity_type == 'politician':
            return await self.get_politician_score(entity_id)
        elif entity_type == 'company':
            return await self.get_company_score(entity_id)
        else:
            raise ValueError(f'Unknown entity type: {entity_type}')

    @staticmethod
    def _get_tier(score: int) -> str:
        if score >= 85: return 'A'
        if score >= 70: return 'B'
        if score >= 55: return 'C'
        if score >= 40: return 'D'
        return 'F'

    @staticmethod
    def _get_risk_level(score: int) -> str:
        if score >= 76: return 'CRITICAL'
        if score >= 51: return 'HIGH'
        if score >= 26: return 'MEDIUM'
        return 'LOW'
