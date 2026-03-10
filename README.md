# UNREDACTED

**The War on Greed starts here.**

UNREDACTED is a corruption intelligence platform that exposes the nexus between government spending, campaign finance, and policy decisions. We are reclaiming transparency in an era of hidden influence and dark money.

---

## 🎯 Our Mission: War on Greed & Monitor-identify federal spending

### The Problem
For too long, the American people have been kept in the dark about how their tax dollars are spent and who truly influences the policies that shape their lives. **Corporate welfare, backroom deals, and dark money** have corrupted the democratic process, leaving ordinary citizens without a voice.

### The Movement
**"War on Greed"** is our rallying cry against the systemic corruption that has eroded public trust in government. We believe that:
- **Every dollar spent** by the government should be traceable and accountable
- **Every policy decision** should be transparent in its origins and beneficiaries
- **Every elected official** should answer to the people, not to wealthy donors

**"No Taxation Without Representation"** isn't just a historical slogan—it's a living principle. When billionaires and corporations write the checks that fund campaigns, they get the representation. When ordinary Americans pay taxes, they get the bill. We're here to change that equation.

### Why This Matters
- **$775 Billion** in federal contracts awarded annually—with little public scrutiny
- **$14 billion** spent on federal elections in 2024—much of it from undisclosed sources
- **Zero** open source tools, comprehensive public intelligence tools to connect the dots between donors, spending, and policy

The UN*REDACTED MONITOR exists to give the American people the intelligence tools to hold power accountable.

---

## 🔗 Data Sources

### Government Spending
| Source | Data Type | Coverage |
|--------|-----------|----------|
| **USASpending.gov** | Federal contracts, grants, loans | All federal agencies, 2017-present |
| **SAM.gov** (via USASpending) | Contract awards, modifications | Real-time updates |

### Campaign Finance & Donor Intelligence
| Source | Data Type | Coverage |
|--------|-----------|----------|
| **FEC.gov API** | Campaign contributions, PACs, candidate committees | All federal candidates, committees, donors |
| **OpenSecrets** (planned) | Industry influence, lobbying data | Historical and current cycles |

### Policy & Regulations
| Source | Data Type | Coverage |
|--------|-----------|----------|
| **Federal Register API** | Proposed rules, final regulations, significant documents | All federal agencies |
| **GovInfo.gov** | Congressional bills, public laws | Current and historical |

### Intelligence Feeds
| Source | Data Type |
|--------|-----------|
| **RSS Feeds** | DOJ press releases, GAO reports, oversight news |

---

## 🤖 AI Agent Architecture

UNREDACTED is powered by a multi-agent AI system that decomposes complex queries, gathers intelligence from multiple sources, and synthesizes actionable insights.

### The Four Core Agents

#### 1. 🔍 PolicyAgent (`backend/agents/policyAgent.js`)
**Purpose:** Track policy movements and regulatory changes

**Capabilities:**
- Searches Federal Register for proposed and final rules
- Identifies significant regulations affecting industries or topics
- Tracks regulatory timelines and comment periods
- Surfaces policy patterns that benefit specific donors

**Data Sources:** Federal Register API

---

#### 2. 💰 SpendingAgent (`backend/agents/spendingAgent.js`)
**Purpose:** Investigate government spending patterns

**Capabilities:**
- Searches USASpending.gov for contracts and grants
- Identifies spending anomalies and outliers
- Cross-references recipients with donor networks
- Surfaces no-bid contracts and sole-source awards

**Data Sources:** USASpending.gov API

---

#### 3. 🗳️ DonorAgent (`backend/agents/donorAgent.js`)
**Purpose:** Map campaign finance and donor networks

**Capabilities:**
- Searches FEC data for committees and candidates
- Builds donor network graphs showing contribution patterns
- Identifies industry influence through employer/occupation analysis
- Cross-references donors with contract recipients

**Data Sources:** FEC.gov API

---

#### 4. 🚨 CorruptionAgent (`backend/agents/corruptionAgent.js`)
**Purpose:** Synthesize intelligence and identify corruption patterns

**Capabilities:**
- Analyzes data from all other agents to find conflicts of interest
- Detects patterns like "revolving door" between industry and government
- Identifies pay-to-play relationships between donors and spending
- Surfaces suspicious timing between contributions and contract awards
- Generates red flags for further investigation

**Synthesis Model:** DeepSeek Chat (default) or Groq (llama-3.3-70b-versatile)

---

### Orchestrator (`backend/agents/orchestrator.js`)

The Orchestrator is the central intelligence coordinator that:
1. **Decomposes** user queries using AI (DeepSeek/Groq)
2. **Dispatches** tasks to the four specialized agents in parallel
3. **Synthesizes** results from all agents into unified intelligence
4. **Surfaces** corruption patterns and actionable insights

**Query Flow:**
```
User Query → Orchestrator → [PolicyAgent + SpendingAgent + DonorAgent]
                                      ↓
                          CorruptionAgent (Analysis & Synthesis)
                                      ↓
                         Unified Intelligence Report
```

---

## 📊 Database Schema & Indexes

### PostgreSQL Relational Database

**Primary Tables:**

| Table | Purpose |
|-------|---------|
| `contracts` | Federal contract awards with recipient details |
| `grants` | Federal grant awards |
| `regulations` | Federal Register documents |
| `politicians` | Elected officials and candidates |
| `contributions` | FEC Schedule A (individual contributions) |
| `pac_committees` | Political action committees |
| `disbursements` | FEC Schedule B (committee spending) |
| `candidate_totals` | Aggregated candidate financial totals |
| `opensecrets_summaries` | Industry influence summaries |

**Full-Text Search Indexes:**

```sql
-- Contract search (recipient + description)
idx_contracts_search: GIN index on to_tsvector(description || recipient_name)

-- Grant search (recipient + description)
idx_grants_search: GIN index on to_tsvector(description || recipient_name)

-- Regulation search (title + abstract)
idx_regulations_search: GIN index on to_tsvector(title || abstract)

-- Contribution search (donor + employer + occupation)
idx_contributions_search: GIN index on to_tsvector(donor || employer || occupation)
```

**Performance Indexes:**

```sql
-- Geographic and political indexes
idx_politicians_state_party: (state, party)
idx_politicians_chamber: chamber
idx_politicians_name: name

-- Campaign finance indexes
idx_contributions_committee: committee_id
idx_contributions_candidate: candidate_id
idx_contributions_date: date
idx_contributions_employer: contributor_employer
idx_pac_committees_type: committee_type
idx_pac_committees_party: party
idx_candidate_totals_cycle: cycle
```

### Neo4j Graph Database

**Node Types:**
- `:Company` - Contract/grant recipients (UEI-based)
- `:Politician` - Elected officials (Bioguide ID)
- `:Agency` - Federal agencies
- `:Contract` - Individual contract awards
- `:Regulation` - Federal Register documents
- `:PAC` - Political committees
- `:Contribution` - Individual donations

**Constraints (Uniqueness):**
```
company_uei: Company.uei IS UNIQUE
company_name: Company.name IS UNIQUE
politician_id: Politician.bioguide_id IS UNIQUE
agency_code: Agency.code IS UNIQUE
contract_id: Contract.award_id IS UNIQUE
regulation_id: Regulation.document_number IS UNIQUE
pac_id: PAC.committee_id IS UNIQUE
contribution_id: Contribution.contribution_id IS UNIQUE
```

**Performance Indexes:**
```
contract_date: (Contract.award_date)
contract_amount: (Contract.award_amount)
regulation_date: (Regulation.publication_date)
contribution_date: (Contribution.date)
company_normalized: (Company.normalized_name)
politician_state: (Politician.state)
politician_party: (Politician.party)
```

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Backend API   │────▶│   AI Agents     │
│   (React/Vite)  │     │   (Node.js)     │     │   (4 Agents)    │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                              ┌──────────────────────────┼──────────┐
                              │                          │         │
                              ▼                          ▼         ▼
                       ┌────────────┐            ┌────────────┐ ┌────────────┐
                       │ PostgreSQL │            │   Neo4j    │ │    FEC     │
                       │(Relational)│            │   (Graph)  │ │   API      │
                       └────────────┘            └────────────┘ └────────────┘
                              ▲                          │         ▲
                              │                          │         │
                              │                   ┌────────┴─────────┘
                              │                   │
                       ┌────────────┐            ▼
                       │   Redis    │      USASpending.gov
                       │   (Cache)  │      Federal Register
                       └────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)
- Python 3.10+ (for ETL processes)

### Using Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/policybot-io/UNREDACTED.git
cd UNREDACTED

# Start databases
docker-compose up -d neo4j postgres redis

# Set up environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys

# Install dependencies and start backend
cd backend
npm install
npm run dev

# In a new terminal, start frontend
cd frontend
npm install
npm run dev
```

The application will be available at `http://localhost:5173`

### Required API Keys

**Government Data (required):**

| Service | Variable | How to Get |
|---------|----------|-----------|
| **FEC API** | `FEC_API_KEY` | [api.open.fec.gov](https://api.open.fec.gov/developers/) — free |

**AI Provider (choose one):**

| Provider | Variable | Notes |
|----------|----------|-------|
| **DeepSeek** | `DEEPSEEK_API_KEY` | Default. Best price/performance |
| **OpenAI** | `OPENAI_API_KEY` | GPT-4o, GPT-4-turbo |
| **Anthropic Claude** | `ANTHROPIC_API_KEY` | Claude 3.5 Sonnet |
| **Groq** | `GROQ_API_KEY` | Ultra-fast. Free tier available |
| **Alibaba Qwen** | `QWEN_API_KEY` | Qwen 2.5 series |
| **xAI Grok** | `XAI_API_KEY` | Grok by xAI |
| **Ollama** | `OLLAMA_BASE_URL` | Local models — no key required |

Set `AI_PROVIDER=deepseek|openai|anthropic|groq|qwen|xai|ollama` in `backend/.env` to select your provider.

> **Tip:** You can also configure providers from the app UI — click **⚙ Settings** in the navigation bar to enter API keys without touching the `.env` file.

---

## 📖 Documentation

- [Contributing Guide](CONTRIBUTOR.md) - How to contribute and set up development environment
- [Phase 1 Implementation](PHASE1_README.md) - Original Phase 1 architecture

---

## 🛡️ License

MIT License - See LICENSE file

---

## 💪 Join the War on Greed

UNREDACTED is an open-source intelligence platform for the public good. We believe that transparency is the antidote to corruption, and that technology should serve democracy—not undermine it.

**Star this repo** ⭐ to support the movement
**Open an issue** 🐛 to report problems
**Submit a PR** 📝 to contribute code
**Share the platform** 📢 to spread awareness

*Paid for by PolicyBot.io - Because democracy needs open-source intelligence.*
