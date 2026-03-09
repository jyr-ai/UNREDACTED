"""FastAPI + LangGraph AI Agent Service for Donor Intelligence."""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
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

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Vite dev server
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

        # Run selected agents in parallel (in production, use asyncio.gather)
        if request.use_donor_agent:
            try:
                donor_result = await donor_agent.analyze(request.query)
                results["donor"] = donor_result
            except Exception as e:
                results["donor"] = {"error": str(e)}

        if request.use_corruption_agent:
            try:
                corruption_result = await corruption_agent.analyze(request.query)
                results["corruption"] = corruption_result
            except Exception as e:
                results["corruption"] = {"error": str(e)}

        if request.use_policy_agent:
            try:
                policy_result = await policy_agent.analyze(request.query)
                results["policy"] = policy_result
            except Exception as e:
                results["policy"] = {"error": str(e)}

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
