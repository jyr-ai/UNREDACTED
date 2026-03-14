"""
Dark money chain inference module.
Traces funding from 501(c)(4) organizations through Super PACs to candidates.
"""
import logging
import httpx
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from base.neo4j_client import Neo4jConnection
from base.postgres_client import PostgresConnection

logger = logging.getLogger(__name__)

FEC_BASE = 'https://api.open.fec.gov/v1'
FEC_KEY = os.getenv('FEC_API_KEY', 'DEMO_KEY')

# Disclosure level classification
DISCLOSURE_LEVELS = {
    'GREEN': 'fully_disclosed',   # All donors known
    'YELLOW': 'partial',          # Some donors known
    'RED': 'dark',                # No known donors
}

# Industry keyword mapping for issue-based inference
INDUSTRY_KEYWORDS = {
    'defense': 'Defense Contractors',
    'military': 'Defense Contractors',
    'security': 'Defense Contractors',
    'health': 'Pharmaceutical/Healthcare',
    'pharma': 'Pharmaceutical/Healthcare',
    'medical': 'Pharmaceutical/Healthcare',
    'energy': 'Fossil Fuel Industry',
    'oil': 'Fossil Fuel Industry',
    'gas': 'Fossil Fuel Industry',
    'coal': 'Fossil Fuel Industry',
    'climate': 'Fossil Fuel Industry',
    'finance': 'Finance & Banking',
    'bank': 'Finance & Banking',
    'wall street': 'Finance & Banking',
    'tech': 'Technology',
    'digital': 'Technology',
    'data': 'Technology',
    'antitrust': 'Technology',
    'real estate': 'Real Estate',
    'housing': 'Real Estate',
    'agriculture': 'Agriculture',
    'farm': 'Agriculture',
    'telecom': 'Telecommunications',
}


class DarkMoneyTracer:
    """
    Traces dark money funding chains from 501(c)(4) organizations through
    Super PACs to candidates and legislative outcomes.

    Classification:
    - GREEN: All donors publicly disclosed (rare for 501c4)
    - YELLOW: Connected organization known, but individual donors not disclosed
    - RED: No donor information available (fully dark)
    """

    def __init__(self):
        self.neo4j = Neo4jConnection()
        self.postgres = PostgresConnection()
        self.http = httpx.AsyncClient(timeout=30.0)

    async def identify_dark_money_orgs(self, cycle: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Identify 501(c)(4) organizations with significant political activity.
        Sources: FEC committees + Neo4j PAC graph.
        """
        orgs = []

        # Fetch from FEC: Super PACs (V) and hybrid committees (W)
        for committee_type in ['V', 'W']:
            try:
                params = {
                    'committee_type': committee_type,
                    'api_key': FEC_KEY,
                    'per_page': 20,
                    'sort': '-total_disbursements',
                }
                if cycle:
                    params['cycle'] = cycle

                resp = await self.http.get(f'{FEC_BASE}/committees/', params=params)
                if resp.status_code == 200:
                    results = resp.json().get('results', [])
                    for c in results:
                        orgs.append(self._classify_committee(c))
            except Exception as e:
                logger.warning(f'FEC committees fetch failed (type={committee_type}): {e}')

        # Also query Neo4j for PAC nodes
        try:
            async with self.neo4j.session() as session:
                result = await session.run(
                    """
                    MATCH (pac:PAC)
                    OPTIONAL MATCH (pac)-[:INDEPENDENTLY_SPENT]->(politician:Politician)
                    RETURN {
                        id: pac.committee_id,
                        name: pac.name,
                        type: pac.type,
                        total_raised: pac.total_raised
                    } as org, count(politician) as linked_candidates
                    ORDER BY org.total_raised DESC
                    LIMIT 20
                    """
                )
                records = await result.data()
                for record in records:
                    org = record.get('org', {})
                    linked = record.get('linked_candidates', 0)
                    # Only add if not already from FEC
                    if not any(o.get('id') == org.get('id') for o in orgs):
                        orgs.append({
                            'id': org.get('id'),
                            'name': org.get('name'),
                            'type': org.get('type', '501c4'),
                            'total_spend': org.get('total_raised', 0),
                            'linked_candidates': linked,
                            'disclosure_level': 'dark',
                            'issues': self._infer_issues(org.get('name', '')),
                        })
        except Exception as e:
            logger.warning(f'Neo4j PAC query failed: {e}')

        return orgs

    def _classify_committee(self, committee: Dict) -> Dict[str, Any]:
        """Classify a FEC committee by disclosure level."""
        has_connected_org = bool(committee.get('connected_organization_name'))
        org_type = committee.get('organization_type', '')

        if has_connected_org:
            disclosure = 'partial'  # We know the parent org
        elif org_type in ['C', 'L', 'M', 'T', 'V', 'W']:
            disclosure = 'dark'    # No donor disclosure required
        else:
            disclosure = 'partial'

        return {
            'id': committee.get('committee_id'),
            'name': committee.get('name'),
            'type': committee.get('committee_type'),
            'total_spend': committee.get('total_disbursements', 0) or 0,
            'total_raised': committee.get('total_receipts', 0) or 0,
            'cycle': committee.get('cycles', [datetime.utcnow().year])[0] if committee.get('cycles') else datetime.utcnow().year,
            'disclosure_level': disclosure,
            'connected_org': committee.get('connected_organization_name'),
            'treasurer': committee.get('treasurer_name'),
            'state': committee.get('state'),
            'issues': self._infer_issues(committee.get('name', '')),
        }

    def _infer_issues(self, name: str) -> str:
        """Infer political issues from committee name."""
        name_lower = (name or '').lower()
        for keyword, industry in INDUSTRY_KEYWORDS.items():
            if keyword in name_lower:
                return industry
        return 'General political advocacy'

    async def trace_committee(self, committee_id: str) -> Dict[str, Any]:
        """
        Trace the full funding chain for a Super PAC or 501(c)(4).
        Returns flow: unknown donors → org → super PAC → candidate
        """
        chain = {
            'committee_id': committee_id,
            'stages': [],
            'total_amount': 0,
            'disclosure_level': 'dark',
            'confidence': 0.0,
        }

        try:
            # Get committee details
            resp = await self.http.get(f'{FEC_BASE}/committee/{committee_id}/', params={'api_key': FEC_KEY})
            if resp.status_code != 200:
                return chain

            committee = resp.json().get('results', [{}])[0]
            chain['committee_name'] = committee.get('name', 'Unknown')
            chain['committee_type'] = committee.get('committee_type')

            # Get receipts (inflows)
            receipts_resp = await self.http.get(f'{FEC_BASE}/schedules/schedule_a/', params={
                'committee_id': committee_id,
                'api_key': FEC_KEY,
                'per_page': 20,
                'sort': '-contribution_receipt_amount',
            })

            if receipts_resp.status_code == 200:
                receipts = receipts_resp.json().get('results', [])
                total_in = sum(r.get('contribution_receipt_amount', 0) or 0 for r in receipts)
                known_donors = [r for r in receipts if r.get('contributor_name')]
                unknown_ratio = 1 - (len(known_donors) / len(receipts)) if receipts else 1

                chain['stages'].append({
                    'stage': 'funding_in',
                    'description': f'${total_in:,.0f} received — {len(known_donors)}/{len(receipts)} donors identified',
                    'amount': total_in,
                    'disclosure': 'partial' if known_donors else 'dark',
                    'top_donors': [
                        {'name': r.get('contributor_name', 'Unknown'), 'amount': r.get('contribution_receipt_amount', 0)}
                        for r in known_donors[:3]
                    ],
                })
                chain['total_amount'] += total_in

            # Get disbursements (outflows to other committees = laundering indicator)
            disbursements_resp = await self.http.get(f'{FEC_BASE}/schedules/schedule_b/', params={
                'committee_id': committee_id,
                'api_key': FEC_KEY,
                'per_page': 20,
                'disbursement_purpose_category': 'TRANSFER',
                'sort': '-disbursement_amount',
            })

            if disbursements_resp.status_code == 200:
                disbursements = disbursements_resp.json().get('results', [])
                total_out = sum(d.get('disbursement_amount', 0) or 0 for d in disbursements)

                chain['stages'].append({
                    'stage': 'funding_out',
                    'description': f'${total_out:,.0f} transferred to {len(disbursements)} other committee(s)',
                    'amount': total_out,
                    'disclosure': 'partial',
                    'recipients': [
                        {'name': d.get('recipient_name', 'Unknown'), 'amount': d.get('disbursement_amount', 0)}
                        for d in disbursements[:3]
                    ],
                })

            # Set overall disclosure level
            has_known_donors = any(s.get('top_donors') for s in chain['stages'])
            chain['disclosure_level'] = 'partial' if has_known_donors else 'dark'
            chain['confidence'] = 0.7 if has_known_donors else 0.5

        except Exception as e:
            logger.error(f'trace_committee failed for {committee_id}: {e}')

        return chain

    async def get_dark_money_flow(self, candidate_id: str) -> Dict[str, Any]:
        """
        Map full dark money funding chain for a candidate.
        Returns structured flow from unknown sources → 501(c)(4) → Super PAC → Candidate.
        """
        flow = {
            'candidate_id': candidate_id,
            'total_dark_money': 0,
            'total_disclosed': 0,
            'chains': [],
        }

        try:
            # Get independent expenditures supporting/opposing candidate
            resp = await self.http.get(f'{FEC_BASE}/schedules/schedule_e/', params={
                'candidate_id': candidate_id,
                'api_key': FEC_KEY,
                'per_page': 20,
                'sort': '-expenditure_amount',
            })

            if resp.status_code != 200:
                return flow

            expenditures = resp.json().get('results', [])

            for exp in expenditures:
                committee_id = exp.get('committee', {}).get('committee_id')
                amount = exp.get('expenditure_amount', 0) or 0
                committee_name = exp.get('committee_name', 'Unknown Committee')
                committee_type = exp.get('committee', {}).get('committee_type', '')

                # Classify the expenditure's disclosure level
                disclosure = 'dark' if committee_type in ['V', 'O', 'I'] else 'partial'

                chain = {
                    'from_committee': committee_name,
                    'committee_id': committee_id,
                    'amount': amount,
                    'support_oppose': exp.get('support_oppose_indicator', 'U'),
                    'disclosure_level': disclosure,
                    'inference': self._infer_issues(committee_name),
                }

                if disclosure == 'dark':
                    flow['total_dark_money'] += amount
                else:
                    flow['total_disclosed'] += amount

                flow['chains'].append(chain)

        except Exception as e:
            logger.error(f'get_dark_money_flow failed for {candidate_id}: {e}')

        flow['total'] = flow['total_dark_money'] + flow['total_disclosed']
        flow['dark_money_percentage'] = (
            round(flow['total_dark_money'] / flow['total'] * 100, 1)
            if flow['total'] > 0 else 0
        )

        return flow

    async def close(self):
        """Clean up HTTP client."""
        await self.http.aclose()
