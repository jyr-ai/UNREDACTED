# UN•REDACTED — Exposing Greed and corporate-related Corruption in Federal Spending Intelligence Platform

> *Because every dollar leaves a trail.*

A civic intelligence platform that cross-references US federal policy, spending, and campaign finance data to surface corruption patterns. Powered by Claude AI and real government APIs.

---

## Architecture

```
User Query (React UI)
      |
      v
POST /api/agent/query (Express + rate-limit)
      |
      v
Orchestrator Agent (Claude claude-opus-4-5)
  -> Decomposes query into tasks
      |
   +--+------------------+
   v                     v
Policy Agent         Spending Agent
(Federal Register)   (USASpending.gov)
   |                     |
   +----------+----------+
              v
      Corruption Agent (Claude)
      -> Cross-references findings
      -> Scores patterns 0-100
      -> Returns { findings, riskLevel, flags }
              |
              v
      Structured JSON -> React UI
```

---

## Data Sources

| Source | API | Auth |
|--------|-----|------|
| USASpending.gov | `api.usaspending.gov/api/v2` | None required |
| Federal Register | `federalregister.gov/api/v1` | None required |
| FEC Campaign Finance | `api.open.fec.gov/v1` | Free key at api.open.fec.gov |
| AI Analysis | Anthropic Claude claude-opus-4-5 | `ANTHROPIC_API_KEY` |

---

## Setup

### Prerequisites
- Node.js 18+
- Anthropic API key (get at console.anthropic.com)
- FEC API key (optional, `DEMO_KEY` works for dev)

### Install & Run

```bash
# Clone
git clone <repo-url>
cd UNREDACTED

# Backend
cd backend
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
npm install
npm run dev        # runs on :3001

# Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev        # runs on :5173
```

Open http://localhost:5173

---

## API Routes

### `GET /health`
Health check.

### `POST /api/agent/query`
Main AI orchestrator. Body: `{ "query": "string" }`
Returns: `{ success, data: { plan, policyResults, spendingResults, findings, summary, riskLevel, flags } }`
Rate limited: 10 req/min.

### `GET /api/spending/contracts?keyword=X&agency=Y&limit=N`
Federal contract search via USASpending.gov.

### `GET /api/spending/grants?keyword=X&limit=N`
Federal grants search via USASpending.gov.

### `GET /api/policy/rules?keyword=X&dateFrom=YYYY-MM-DD&limit=N`
Federal Register rules and regulations search.

### `GET /api/donors/committees?keyword=X&limit=N`
FEC PAC committee search.

### `GET /api/donors/candidates?name=X&office=S&state=TX&limit=N`
FEC candidate search.

---

## Modules

| Module | Status | Description |
|--------|--------|-------------|
| Dashboard | Live | KPIs with real USASpending contract data |
| AI Intel | Live | Claude-powered corruption analysis chat |
| Spending | Live | Federal contract search + table + bar chart |
| Politicians | UI | Politician profiles with conflict signals |
| Entity Graph | UI | SVG relationship graph visualization |
| Donors | Coming | FEC PAC/donor intelligence |
| Dark Money | Coming | 501(c)(4) chain tracing |
| Corporate | Coming | Company political footprint |
| Alerts | Coming | Real-time intelligence alerts |

---

## Legal Notice

All data sourced from public US federal records. AI-generated findings are investigative hypotheses only — not legal conclusions. Signal does not equal proof.

---

*MIT License — Built for civic transparency.*
