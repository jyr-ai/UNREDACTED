"""Policy Analysis Agent using LangGraph."""
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

FED_REG_BASE = 'https://www.federalregister.gov/api/v1'
USA_SPENDING_BASE = 'https://api.usaspending.gov/api/v2'


class PolicyState(BaseModel):
    query: str = Field(description="User's policy analysis query")
    context: Optional[Dict[str, Any]] = Field(default=None)
    regulations: Optional[List[Dict[str, Any]]] = Field(default=None)
    spending_data: Optional[Dict[str, Any]] = Field(default=None)
    correlations: Optional[List[Dict[str, Any]]] = Field(default=None)
    insights: Optional[List[str]] = Field(default=None)
    summary: str = Field(default="")
    sources: List[str] = Field(default_factory=list)


class PolicyAnalysisAgent:
    """AI agent for policy analysis and regulatory context."""

    def __init__(self):
        self.llm = get_llm(temperature=0.1)
        self.http = httpx.AsyncClient(timeout=30.0)
        self.workflow = self._build_workflow()

    def _build_workflow(self):
        workflow = StateGraph(PolicyState)
        workflow.add_node('extract_policy_entities', self._extract_policy_entities)
        workflow.add_node('fetch_regulations', self._fetch_regulations)
        workflow.add_node('correlate_spending', self._correlate_spending)
        workflow.add_node('analyze_influence', self._analyze_influence)
        workflow.add_node('generate_insights', self._generate_insights)

        workflow.set_entry_point('extract_policy_entities')
        workflow.add_edge('extract_policy_entities', 'fetch_regulations')
        workflow.add_edge('fetch_regulations', 'correlate_spending')
        workflow.add_edge('correlate_spending', 'analyze_influence')
        workflow.add_edge('analyze_influence', 'generate_insights')
        workflow.add_edge('generate_insights', END)

        return workflow.compile()

    async def _extract_policy_entities(self, state: PolicyState) -> Dict[str, Any]:
        """Extract policy-relevant entities from query."""
        messages = [
            SystemMessage(content="""You are a policy analyst. Extract entities from the query.
Return JSON only: {"agencies": [], "topics": [], "industries": [], "regulations": [], "time_period": null, "bills": []}"""),
            HumanMessage(content=state.query),
        ]

        try:
            response = await self.llm.ainvoke(messages)
            import json, re
            m = re.search(r'\{.*\}', response.content, re.DOTALL)
            entities = json.loads(m.group()) if m else {}
        except Exception:
            entities = {'agencies': [], 'topics': [], 'industries': [], 'regulations': [], 'bills': []}

        return {'context': {'entities': entities}}

    async def _fetch_regulations(self, state: PolicyState) -> Dict[str, Any]:
        """Fetch relevant regulations from Federal Register API."""
        entities = (state.context or {}).get('entities', {})
        regulations = []
        sources = []

        # Build search terms from entities
        search_terms = []
        search_terms.extend(entities.get('topics', [])[:2])
        search_terms.extend(entities.get('industries', [])[:2])

        if not search_terms:
            # Fall back to keywords from query
            query_words = [w for w in state.query.split() if len(w) > 4]
            search_terms = query_words[:3]

        for term in search_terms[:3]:
            try:
                resp = await self.http.get(f'{FED_REG_BASE}/documents', params={
                    'conditions[term]': term,
                    'conditions[type][]': ['RULE', 'PROPOSED_RULE', 'NOTICE'],
                    'per_page': 5,
                    'order': 'newest',
                    'fields[]': ['title', 'publication_date', 'agency_names', 'document_number',
                                 'significant', 'abstract', 'type'],
                })
                if resp.status_code == 200:
                    data = resp.json()
                    results = data.get('results', [])
                    regulations.extend(results)
                    if results:
                        sources.append('Federal Register API')
            except Exception as e:
                logger.warning(f'Federal Register query failed for term "{term}": {e}')

        return {'regulations': regulations[:20], 'sources': sources}

    async def _correlate_spending(self, state: PolicyState) -> Dict[str, Any]:
        """Correlate regulations with spending data."""
        entities = (state.context or {}).get('entities', {})
        spending_data = {'contracts': [], 'agencies': []}
        sources = list(state.sources or [])

        # Get agency spending data
        for agency in (entities.get('agencies') or [])[:2]:
            try:
                resp = await self.http.post(f'{USA_SPENDING_BASE}/search/spending_by_award/', json={
                    'filters': {
                        'award_type_codes': ['A', 'B', 'C', 'D'],
                        'agencies': [{'type': 'awarding', 'tier': 'toptier', 'name': agency}],
                        'time_period': [{'start_date': '2023-01-01', 'end_date': '2024-12-31'}],
                    },
                    'fields': ['Award ID', 'Recipient Name', 'Award Amount', 'Awarding Agency', 'Award Date'],
                    'limit': 10,
                    'sort': 'Award Amount',
                    'order': 'desc',
                })
                if resp.status_code == 200:
                    results = resp.json().get('results', [])
                    spending_data['contracts'].extend(results)
                    if results:
                        sources.append('USASpending.gov API')
            except Exception as e:
                logger.warning(f'USASpending query failed for agency "{agency}": {e}')

        return {'spending_data': spending_data, 'sources': sources}

    async def _analyze_influence(self, state: PolicyState) -> Dict[str, Any]:
        """Analyze regulatory influence patterns."""
        regulations = state.regulations or []
        spending = state.spending_data or {}
        correlations = []

        # Find significant rules
        significant_rules = [r for r in regulations if r.get('significant')]
        if significant_rules:
            correlations.append({
                'type': 'significant_regulations',
                'count': len(significant_rules),
                'titles': [r.get('title', '')[:80] for r in significant_rules[:3]],
                'description': f'{len(significant_rules)} significant rule(s) found — these require White House review',
            })

        # Check for industry concentration in spending
        contracts = spending.get('contracts', [])
        if contracts:
            top_recipients = {}
            for c in contracts:
                name = c.get('Recipient Name', 'Unknown')
                amount = c.get('Award Amount', 0) or 0
                top_recipients[name] = top_recipients.get(name, 0) + amount

            if top_recipients:
                top = max(top_recipients, key=top_recipients.get)
                correlations.append({
                    'type': 'spending_concentration',
                    'description': f'Top recipient: {top} with ${top_recipients[top]:,.0f}',
                    'concentration_risk': len(top_recipients) < 3,
                })

        # Regulatory timing correlation
        if regulations and contracts:
            correlations.append({
                'type': 'timing_correlation',
                'description': f'{len(regulations)} regulations found in query context period alongside active contracts',
                'requires_review': True,
            })

        return {'correlations': correlations}

    async def _generate_insights(self, state: PolicyState) -> Dict[str, Any]:
        """Generate AI-powered policy insights."""
        context_parts = [f'Query: {state.query}']

        if state.regulations:
            context_parts.append(f'Regulations found: {len(state.regulations)}')
            sig = [r for r in state.regulations if r.get('significant')]
            if sig:
                context_parts.append(f'Significant rules: {len(sig)}')
                context_parts.append('Sample titles: ' + '; '.join(r.get('title', '')[:60] for r in sig[:2]))

        if state.correlations:
            context_parts.append(f'Correlations: {len(state.correlations)}')
            for c in state.correlations:
                context_parts.append(f'  - {c.get("description", "")}')

        messages = [
            SystemMessage(content="""You are a senior policy analyst for a government accountability platform.
Provide a concise policy analysis summary (2-3 sentences) covering:
1. Key regulatory findings
2. Policy-spending correlations identified
3. Accountability implications

Be factual and professional. Keep under 150 words."""),
            HumanMessage(content='\n'.join(context_parts)),
        ]

        try:
            response = await self.llm.ainvoke(messages)
            summary = response.content
        except Exception as e:
            logger.error(f'Insights generation failed: {e}')
            reg_count = len(state.regulations or [])
            summary = f'Policy analysis complete. Found {reg_count} relevant regulation(s). Review correlations for accountability implications.'

        insights = [c.get('description', '') for c in (state.correlations or [])]

        return {'insights': insights, 'summary': summary}

    async def analyze(self, query: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Main entry point for policy analysis."""
        try:
            initial_state = PolicyState(query=query, context=context)
            result = await self.workflow.ainvoke(initial_state)

            return {
                'data': {
                    'regulations': result.regulations or [],
                    'spending_data': result.spending_data or {},
                    'correlations': result.correlations or [],
                    'insights': result.insights or [],
                },
                'summary': result.summary,
                'sources': result.sources or ['Federal Register API', 'USASpending.gov'],
            }
        except Exception as e:
            logger.error(f'Policy agent workflow failed: {e}')
            return await self._simple_analysis(query, context)

    async def _simple_analysis(self, query: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Fallback analysis when LangGraph workflow fails."""
        messages = [
            SystemMessage(content="""You are a policy analyst specializing in government accountability.
Analyze the query and provide insights about:
1. Relevant regulatory landscape
2. Policy-spending patterns to investigate
3. Key agencies and oversight mechanisms
4. Accountability implications

Keep under 150 words. Be factual."""),
            HumanMessage(content=query),
        ]

        try:
            response = await self.llm.ainvoke(messages)
            summary = response.content[:600]
        except Exception as e:
            summary = f'Policy analysis unavailable: {str(e)}'

        return {
            'data': {'regulations': [], 'correlations': [], 'insights': []},
            'summary': summary,
            'sources': ['AI Analysis'],
        }


if __name__ == '__main__':
    import asyncio

    async def test():
        agent = PolicyAnalysisAgent()
        result = await agent.analyze('What regulations has the EPA issued related to fossil fuel companies in 2024?')
        print('Summary:', result['summary'])
        print('Regulations found:', len(result['data']['regulations']))

    asyncio.run(test())
