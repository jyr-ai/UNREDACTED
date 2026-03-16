"""Corruption Detection Agent using LangGraph."""
from typing import Dict, Any, List, Optional
from agents.llm_factory import get_llm
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field
import httpx
import os
import logging
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

FEC_BASE = 'https://api.open.fec.gov/v1'
FEC_KEY  = os.getenv('FEC_API_KEY', 'DEMO_KEY')


class CorruptionState(BaseModel):
    query: str = Field(description="User's corruption analysis query")
    context: Optional[Dict[str, Any]] = Field(default=None)
    entities: Optional[Dict[str, Any]] = Field(default=None)
    corruption_patterns: Optional[List[Dict[str, Any]]] = Field(default=None)
    risk_scores: Optional[Dict[str, Any]] = Field(default=None)
    evidence_chain: Optional[List[Dict[str, Any]]] = Field(default=None)
    summary: str = Field(default="")
    sources: List[str] = Field(default_factory=list)


class CorruptionDetectionAgent:
    """AI agent for detecting corruption patterns across government data sources."""

    # Pattern descriptions for scoring
    PATTERNS = {
        'quid_pro_quo': {
            'description': 'Company donates to politician → politician oversees agency → agency awards contract to same company',
            'score': 'HIGH',
            'lookback_months': 12,
        },
        'regulatory_capture': {
            'description': 'Company comments on proposed rule → final rule changes in company favor → company donated to committee chair',
            'score': 'HIGH',
            'lookback_months': 18,
        },
        'revolving_door': {
            'description': 'Official leaves agency → joins industry within 24 months → company receives favorable treatment',
            'score': 'MEDIUM-HIGH',
            'lookback_months': 24,
        },
        'stock_act': {
            'description': 'Politician trades stock → company has pending committee hearing within 30 days',
            'score': 'HIGH',
            'window_days': 30,
        },
        'dark_money': {
            'description': '501(c)(4) receives large donation → donates to Super PAC → Super PAC supports candidate → favorable legislation',
            'score': 'MEDIUM',
            'lookback_months': 24,
        },
    }

    def __init__(self):
        self.llm = get_llm(temperature=0.1)
        self.http = httpx.AsyncClient(timeout=30.0)
        self.workflow = self._build_workflow()

    def _build_workflow(self):
        workflow = StateGraph(CorruptionState)
        workflow.add_node('extract_entities', self._extract_entities)
        workflow.add_node('query_corruption_db', self._query_corruption_db)
        workflow.add_node('detect_patterns', self._detect_patterns)
        workflow.add_node('score_risk', self._score_risk)
        workflow.add_node('generate_report', self._generate_report)

        workflow.set_entry_point('extract_entities')
        workflow.add_edge('extract_entities', 'query_corruption_db')
        workflow.add_edge('query_corruption_db', 'detect_patterns')
        workflow.add_edge('detect_patterns', 'score_risk')
        workflow.add_edge('score_risk', 'generate_report')
        workflow.add_edge('generate_report', END)

        return workflow.compile()

    async def _extract_entities(self, state: CorruptionState) -> Dict[str, Any]:
        """Extract relevant entities from user query."""
        messages = [
            SystemMessage(content="""You are a government corruption analyst.
Extract entities from the query: company names, politician names, agencies, industries, dates, states.
Return JSON only: {"companies": [], "politicians": [], "agencies": [], "industries": [], "states": [], "date_range": null}"""),
            HumanMessage(content=state.query),
        ]

        try:
            response = await self.llm.ainvoke(messages)
            import json, re
            m = re.search(r'\{.*\}', response.content, re.DOTALL)
            entities = json.loads(m.group()) if m else {}
        except Exception:
            entities = {'companies': [], 'politicians': [], 'agencies': [], 'industries': [], 'states': []}

        return {'entities': entities}

    async def _query_corruption_db(self, state: CorruptionState) -> Dict[str, Any]:
        """Query FEC and other public APIs for corruption-relevant data."""
        entities = state.entities or {}
        corruption_data = {'fec': {}, 'candidates': [], 'committees': [], 'contributions': []}
        sources = []

        # Search for candidates mentioned
        for politician in (entities.get('politicians') or [])[:3]:
            try:
                resp = await self.http.get(f'{FEC_BASE}/candidates/search/', params={
                    'q': politician, 'api_key': FEC_KEY, 'per_page': 5,
                })
                if resp.status_code == 200:
                    results = resp.json().get('results', [])
                    corruption_data['candidates'].extend(results)
                    sources.append('FEC Candidates API')
            except Exception as e:
                logger.warning(f'FEC candidates query failed: {e}')

        # Search for company PACs
        for company in (entities.get('companies') or [])[:3]:
            try:
                resp = await self.http.get(f'{FEC_BASE}/committees/', params={
                    'q': company, 'api_key': FEC_KEY, 'per_page': 5,
                    'committee_type': 'Q',  # Non-qualified PAC
                })
                if resp.status_code == 200:
                    results = resp.json().get('results', [])
                    corruption_data['committees'].extend(results)
                    sources.append('FEC Committees API')
            except Exception as e:
                logger.warning(f'FEC committees query failed: {e}')

        return {
            'corruption_patterns': corruption_data.get('candidates', []),
            'sources': sources,
        }

    async def _detect_patterns(self, state: CorruptionState) -> Dict[str, Any]:
        """Detect corruption patterns across the collected data."""
        entities = state.entities or {}
        patterns_found = []

        query_lower = state.query.lower()

        # Pattern 1: Quid Pro Quo signals
        if any(kw in query_lower for kw in ['contract', 'donat', 'pac', 'contribution']):
            for company in (entities.get('companies') or []):
                for politician in (entities.get('politicians') or []):
                    patterns_found.append({
                        'type': 'quid_pro_quo',
                        'entities': {'company': company, 'politician': politician},
                        'description': self.PATTERNS['quid_pro_quo']['description'],
                        'confidence': 0.65,
                        'severity': 'HIGH',
                        'requires_verification': True,
                    })

        # Pattern 2: Revolving Door
        if any(kw in query_lower for kw in ['revolv', 'lobby', 'former', 'alumni', 'retired']):
            for company in (entities.get('companies') or []):
                for agency in (entities.get('agencies') or []):
                    patterns_found.append({
                        'type': 'revolving_door',
                        'entities': {'company': company, 'agency': agency},
                        'description': self.PATTERNS['revolving_door']['description'],
                        'confidence': 0.55,
                        'severity': 'MEDIUM-HIGH',
                        'requires_verification': True,
                    })

        # Pattern 3: STOCK Act signals
        if any(kw in query_lower for kw in ['stock', 'trade', 'buy', 'sell', 'insider']):
            for politician in (entities.get('politicians') or []):
                patterns_found.append({
                    'type': 'stock_act',
                    'entities': {'politician': politician},
                    'description': self.PATTERNS['stock_act']['description'],
                    'confidence': 0.7,
                    'severity': 'HIGH',
                    'requires_verification': True,
                })

        # Pattern 4: Dark Money
        if any(kw in query_lower for kw in ['dark money', '501c4', 'super pac', 'undisclosed']):
            patterns_found.append({
                'type': 'dark_money',
                'entities': {'scope': 'general'},
                'description': self.PATTERNS['dark_money']['description'],
                'confidence': 0.5,
                'severity': 'MEDIUM',
                'requires_verification': True,
            })

        # Pattern 5: Regulatory Capture
        if any(kw in query_lower for kw in ['regulat', 'rule', 'comment', 'agency', 'oversight']):
            for company in (entities.get('companies') or []):
                for agency in (entities.get('agencies') or []):
                    patterns_found.append({
                        'type': 'regulatory_capture',
                        'entities': {'company': company, 'agency': agency},
                        'description': self.PATTERNS['regulatory_capture']['description'],
                        'confidence': 0.6,
                        'severity': 'HIGH',
                        'requires_verification': True,
                    })

        return {'corruption_patterns': patterns_found}

    async def _score_risk(self, state: CorruptionState) -> Dict[str, Any]:
        """Score overall corruption risk from detected patterns."""
        patterns = state.corruption_patterns or []

        severity_weights = {'HIGH': 30, 'MEDIUM-HIGH': 20, 'MEDIUM': 10, 'LOW': 5}
        base_score = 0

        for pattern in patterns:
            severity = pattern.get('severity', 'MEDIUM')
            confidence = pattern.get('confidence', 0.5)
            base_score += severity_weights.get(severity, 10) * confidence

        overall_score = min(100, int(base_score))
        risk_level = (
            'CRITICAL' if overall_score >= 80 else
            'HIGH' if overall_score >= 60 else
            'MEDIUM' if overall_score >= 35 else
            'LOW'
        )

        risk_scores = {
            'overall': overall_score,
            'level': risk_level,
            'pattern_count': len(patterns),
            'high_severity_count': sum(1 for p in patterns if p.get('severity') == 'HIGH'),
            'breakdown': {p['type']: p.get('confidence', 0) for p in patterns},
        }

        return {'risk_scores': risk_scores}

    async def _generate_report(self, state: CorruptionState) -> Dict[str, Any]:
        """Generate AI-powered corruption analysis summary."""
        patterns = state.corruption_patterns or []
        risk = state.risk_scores or {}

        context_str = f"""
Query: {state.query}
Risk Level: {risk.get('level', 'UNKNOWN')} (Score: {risk.get('overall', 0)}/100)
Patterns Detected: {len(patterns)}
High Severity: {risk.get('high_severity_count', 0)}
Pattern Types: {', '.join(set(p['type'] for p in patterns)) or 'None identified'}
        """.strip()

        messages = [
            SystemMessage(content="""You are a senior government accountability analyst.
Based on the corruption analysis context, provide a concise 2-3 sentence summary of:
1. What corruption patterns were detected
2. Overall risk assessment
3. Key evidence points (if any)

Always end with: "Note: All signals are analytical hypotheses — not legal conclusions."
Keep under 200 words."""),
            HumanMessage(content=context_str),
        ]

        try:
            response = await self.llm.ainvoke(messages)
            summary = response.content
        except Exception as e:
            logger.error(f'Summary generation failed: {e}')
            level = risk.get('level', 'UNKNOWN')
            count = len(patterns)
            summary = (
                f"Corruption analysis complete. Risk level: {level}. "
                f"{count} potential pattern(s) detected based on query context. "
                "Note: All signals are analytical hypotheses — not legal conclusions."
            )

        return {'summary': summary}

    async def analyze(self, query: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Main entry point for corruption analysis."""
        try:
            initial_state = CorruptionState(query=query, context=context)
            result = await self.workflow.ainvoke(initial_state)

            return {
                'data': {
                    'patterns': result.corruption_patterns or [],
                    'risk_scores': result.risk_scores or {},
                    'entities': result.entities or {},
                    'evidence_chain': result.evidence_chain or [],
                },
                'summary': result.summary,
                'sources': result.sources or ['FEC Public API', 'Pattern Analysis Engine'],
            }
        except Exception as e:
            logger.error(f'Corruption agent workflow failed: {e}')
            return await self._simple_analysis(query, context)

    async def _simple_analysis(self, query: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Fallback analysis when LangGraph workflow fails."""
        messages = [
            SystemMessage(content="""You are a government corruption analyst.
Analyze the query for potential corruption patterns. Identify:
1. Which corruption pattern types may be present (quid pro quo, revolving door, STOCK Act, regulatory capture, dark money)
2. Key entities involved
3. Risk level (LOW/MEDIUM/HIGH/CRITICAL)
4. What evidence would be needed to confirm

Always note: "Analytical inference — not legal conclusion." Keep under 150 words."""),
            HumanMessage(content=query),
        ]

        try:
            response = await self.llm.ainvoke(messages)
            summary = response.content[:600]
        except Exception as e:
            summary = f'Analysis unavailable: {str(e)}'

        return {
            'data': {'patterns': [], 'risk_scores': {'level': 'UNKNOWN', 'overall': 0}},
            'summary': summary,
            'sources': ['AI Analysis'],
        }


if __name__ == '__main__':
    import asyncio

    async def test():
        agent = CorruptionDetectionAgent()
        result = await agent.analyze(
            'Did Lockheed Martin donate to Armed Services Committee members who then awarded them F-35 contracts?'
        )
        print('Summary:', result['summary'])
        print('Risk:', result['data']['risk_scores'])

    asyncio.run(test())
