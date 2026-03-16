"""FastAPI + LangGraph AI Agent Service for UNREDACTED."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import asyncio
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import agent modules
from agents.donor_agent import DonorIntelligenceAgent
from agents.corruption_agent import CorruptionDetectionAgent
from agents.policy_agent import PolicyAnalysisAgent

app = FastAPI(
    title="UNREDACTED AI Agent Service",
    description="AI-powered donor intelligence and corruption detection",
    version="1.0.0"
)

# CORS — allow frontend + Express backend via env var (comma-separated)
_raw_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:3000"
)
CORS_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize agents
donor_agent = DonorIntelligenceAgent()
corruption_agent = CorruptionDetectionAgent()
policy_agent = PolicyAnalysisAgent()

# Request/Response models
class QueryRequest(BaseModel):
    query: str
    context: Optional[Dict[str, Any]] = None

class AgentResponse(BaseModel):
    success: bool
    data: Dict[str, Any]
    summary: str
    sources: List[str] = []
    error: Optional[str] = None

class MultiAgentRequest(BaseModel):
    query: str
    use_donor_agent: bool = True
    use_corruption_agent: bool = True
    use_policy_agent: bool = False

class MultiAgentResponse(BaseModel):
    success: bool
    donor_analysis: Optional[Dict[str, Any]] = None
    corruption_analysis: Optional[Dict[str, Any]] = None
    policy_analysis: Optional[Dict[str, Any]] = None
    integrated_summary: str
    error: Optional[str] = None

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "ai-agent-service"}

# Single agent endpoints
@app.post("/api/agent/donor", response_model=AgentResponse)
async def donor_agent_endpoint(request: QueryRequest):
    """Analyze donor networks and campaign finance data."""
    try:
        result = await donor_agent.analyze(request.query, request.context)
        return AgentResponse(
            success=True,
            data=result.get("data", {}),
            summary=result.get("summary", ""),
            sources=result.get("sources", [])
        )
    except Exception as e:
        return AgentResponse(
            success=False,
            data={},
            summary="",
            error=str(e)
        )

@app.post("/api/agent/corruption", response_model=AgentResponse)
async def corruption_agent_endpoint(request: QueryRequest):
    """Detect potential corruption patterns."""
    try:
        result = await corruption_agent.analyze(request.query, request.context)
        return AgentResponse(
            success=True,
            data=result.get("data", {}),
            summary=result.get("summary", ""),
            sources=result.get("sources", [])
        )
    except Exception as e:
        return AgentResponse(
            success=False,
            data={},
            summary="",
            error=str(e)
        )

@app.post("/api/agent/policy", response_model=AgentResponse)
async def policy_agent_endpoint(request: QueryRequest):
    """Analyze policy implications and regulatory context."""
    try:
        result = await policy_agent.analyze(request.query, request.context)
        return AgentResponse(
            success=True,
            data=result.get("data", {}),
            summary=result.get("summary", ""),
            sources=result.get("sources", [])
        )
    except Exception as e:
        return AgentResponse(
            success=False,
            data={},
            summary="",
            error=str(e)
        )

# Multi-agent orchestration
@app.post("/api/agent/orchestrate", response_model=MultiAgentResponse)
async def orchestrate_agents(request: MultiAgentRequest):
    """Orchestrate multiple agents for comprehensive analysis."""
    try:
        results = {}

        # Run selected agents in parallel
        tasks = {}
        if request.use_donor_agent:
            tasks["donor"] = donor_agent.analyze(request.query)
        if request.use_corruption_agent:
            tasks["corruption"] = corruption_agent.analyze(request.query)
        if request.use_policy_agent:
            tasks["policy"] = policy_agent.analyze(request.query)

        if tasks:
            task_results = await asyncio.gather(*tasks.values(), return_exceptions=True)
            for key, result in zip(tasks.keys(), task_results):
                results[key] = {"error": str(result)} if isinstance(result, Exception) else result

        # Generate integrated summary
        integrated_summary = generate_integrated_summary(results)

        return MultiAgentResponse(
            success=True,
            donor_analysis=results.get("donor"),
            corruption_analysis=results.get("corruption"),
            policy_analysis=results.get("policy"),
            integrated_summary=integrated_summary
        )
    except Exception as e:
        return MultiAgentResponse(
            success=False,
            integrated_summary="",
            error=str(e)
        )

def generate_integrated_summary(results: Dict[str, Any]) -> str:
    """Generate an integrated summary from multiple agent results."""
    parts = []

    donor_data = results.get("donor", {})
    corruption_data = results.get("corruption", {})
    policy_data = results.get("policy", {})

    if donor_data and not donor_data.get("error"):
        donor_summary = donor_data.get("summary", "")
        if donor_summary:
            parts.append(f"Donor Analysis: {donor_summary}")

    if corruption_data and not corruption_data.get("error"):
        corruption_summary = corruption_data.get("summary", "")
        if corruption_summary:
            parts.append(f"Corruption Risk: {corruption_summary}")

    if policy_data and not policy_data.get("error"):
        policy_summary = policy_data.get("summary", "")
        if policy_summary:
            parts.append(f"Policy Context: {policy_summary}")

    if not parts:
        return "No comprehensive analysis available from the selected agents."

    return " ".join(parts)

# Data endpoints for frontend integration
@app.get("/api/data/donor/{donor_name}")
async def get_donor_data(donor_name: str):
    """Get detailed donor data from the database."""
    # This would query PostgreSQL/Neo4j in production
    return {
        "donor": donor_name,
        "data": {
            "total_contributions": 0,
            "top_recipients": [],
            "network_strength": "unknown"
        }
    }

@app.get("/api/data/candidate/{candidate_id}")
async def get_candidate_data(candidate_id: str):
    """Get detailed candidate data from the database."""
    # This would query PostgreSQL/Neo4j in production
    return {
        "candidate_id": candidate_id,
        "data": {
            "total_raised": 0,
            "top_donors": [],
            "spending_breakdown": {}
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
