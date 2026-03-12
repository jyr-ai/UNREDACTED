# Contributing to UNREDACTED MONITOR

Thank you for your interest in joining the UNREDACTED Monitor and **War on Greed**! This document will help you set up your development environment and understand how to contribute to the UNREDACTED corruption intelligence platform.

---

## Table of Contents

- [Development Environment Setup](#development-environment-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Contributing Guidelines](#contributing-guidelines)
- [Adding New Features](#adding-new-features)
- [Testing](#testing)
- [Code Standards](#code-standards)

---

## Development Environment Setup

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | 18+ | Backend & Frontend runtime |
| **npm** | 9+ | Package management |
| **Python** | 3.10+ | ETL processes (optional) |
| **Git** | Latest | Version control |

> **Note:** The project is a unified monorepo. There is only **one** `package.json` at the root — no separate frontend/backend installs needed.

### Step-by-Step Setup

#### 1. Clone the Repository

```bash
git clone https://github.com/policybot-io/UNREDACTED.git
cd UNREDACTED
```

#### 2. Install Dependencies

```bash
npm install
npm run dev:all
```

#### 3. Set Up Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit with your API keys
code .env  # or nano, vim, etc.
```

**Government Data API Keys:**

| Variable | Source | Notes |
|----------|--------|-------|
| `FEC_API_KEY` | [api.data.gov/signup](https://api.data.gov/signup/) | Free key — use `DEMO_KEY` to get started |

**AI Provider Keys (choose one or more):**

| Variable | Provider | Get Key |
|----------|----------|---------|
| `DEEPSEEK_API_KEY` | DeepSeek Chat (recommended) | [platform.deepseek.com](https://platform.deepseek.com/) |
| `OPENAI_API_KEY` | OpenAI GPT-4o | [platform.openai.com](https://platform.openai.com/api-keys) |
| `ANTHROPIC_API_KEY` | Claude 3.5 Sonnet | [console.anthropic.com](https://console.anthropic.com/) |
| `GROQ_API_KEY` | Groq (free tier) | [console.groq.com](https://console.groq.com/) |
| `QWEN_API_KEY` | Alibaba Qwen 2.5 | [dashscope.aliyuncs.com](https://dashscope.aliyuncs.com/) |
| `XAI_API_KEY` | xAI Grok | [console.x.ai](https://console.x.ai/) |
| `OLLAMA_BASE_URL` | Local Ollama | No key — [ollama.com](https://ollama.com/) |

Set `AI_PROVIDER=deepseek|openai|anthropic|groq|qwen|xai|ollama` in `.env` to select your provider.

> **Tip:** API keys can also be configured live from the app UI via the **⚙ Settings** tab, without restarting the server.

**Optional — Vercel KV / Upstash Redis (graph query caching):**

| Variable | Notes |
|----------|-------|
| `KV_REST_API_URL` | Vercel KV / Upstash endpoint |
| `KV_REST_API_TOKEN` | Vercel KV / Upstash token |

Without these, the app uses in-memory caching (works fine locally, resets on cold start).

Example `.env`:
```bash
PORT=3001
NODE_ENV=development

FEC_API_KEY=DEMO_KEY

AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_deepseek_key_here

# Optional
GROQ_API_KEY=your_groq_key_here
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

#### 4. Start the Development Servers

**Option A — Run everything together (recommended):**
```bash
npm run dev:all
```
This starts both the Vite frontend and Express backend concurrently with color-coded output.

**Option B — Run separately:**

*Terminal 1 — Frontend (Vite):*
```bash
npm run dev
# Runs on http://localhost:3000
```

*Terminal 2 — Backend (Express):*
```bash
npm run dev:server
# Runs on http://localhost:3001
```

**Ports at a glance:**

| Service | URL | Notes |
|---------|-----|-------|
| Frontend (Vite) | `http://localhost:3000` | React app |
| Backend (Express) | `http://localhost:3001` | API server |
| Health check | `http://localhost:3001/api/health` | Confirms backend is up |

> Vite automatically proxies `/api/*` requests from port 3000 to the Express backend on port 3001 — no manual CORS wrangling needed in local dev.

---

## Project Structure

```
UNREDACTED/
├── src/                        # React frontend (Vite)
│   ├── components/             # Reusable UI components
│   │   ├── charts/             # Chart components (Score, RedactedBlock, …)
│   │   ├── layout/             # App shell (Masthead, NavBar, Footer, Ticker)
│   │   └── ui/                 # Primitives (Card, Band, Legend, Tooltip, …)
│   ├── pages/                  # Route-level page components
│   │   ├── Overview.jsx
│   │   ├── Spending.jsx
│   │   ├── Policy.jsx
│   │   ├── Donation.jsx
│   │   └── Corruption.jsx
│   ├── data/                   # Static/mock data files
│   ├── hooks/                  # Custom React hooks
│   ├── theme/                  # Design tokens (light/dark themes)
│   ├── api/                    # API client utilities
│   └── assets/                 # Images and static assets
├── server/                     # Express API server
│   ├── agents/                 # AI agents (4 core agents + orchestrator)
│   │   ├── policyAgent.js      # Federal Register intelligence
│   │   ├── spendingAgent.js    # USASpending.gov analysis
│   │   ├── donorAgent.js       # FEC campaign finance
│   │   ├── corruptionAgent.js  # Pattern detection & synthesis
│   │   └── orchestrator.js     # Agent coordination
│   ├── routes/                 # API route handlers
│   │   ├── spending.js         # /api/spending
│   │   ├── policy.js           # /api/policy
│   │   ├── donors.js           # /api/donors
│   │   ├── corruption.js       # /api/corruption
│   │   ├── companies.js        # /api/companies
│   │   ├── stockact.js         # /api/stockact
│   │   ├── darkmoney.js        # /api/darkmoney
│   │   ├── feed.js             # /api/feed (RSS)
│   │   ├── settings.js         # /api/settings
│   │   ├── agent.js            # /api/agent
│   │   └── ai_agent.js         # /api/ai-agent
│   ├── services/               # External API & utility services
│   ├── app.js                  # Express app definition
│   └── dev.js                  # Local dev entry point
├── api/
│   └── [[...path]].js          # Vercel serverless catch-all
├── etl/                        # Python ETL processes (optional)
│   ├── sources/                # Data source connectors
│   ├── enrichment/             # Entity resolution & enrichment
│   ├── base/                   # DB clients (Postgres, Neo4j, Redis)
│   └── scheduler/              # Celery task scheduler
├── .env.example                # Environment variable template
├── package.json                # Single root package (monorepo)
├── vite.config.js              # Vite + proxy config
└── docker-compose.yml          # Optional: local database infrastructure
```

---

## Development Workflow

### Branch Strategy

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes
git add .
git commit -m "feat: add new corruption pattern detection"

# Push and create PR
git push origin feature/your-feature-name
```

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Type | Description |
|------|-------------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation changes |
| `refactor:` | Code refactoring |
| `test:` | Adding tests |
| `chore:` | Maintenance tasks |

Examples:
```bash
feat: add PAC committee network visualization
fix: resolve rate limiter false positive on agent route
docs: update contributor guide with monorepo setup
```

---

## Contributing Guidelines

### What to Contribute

**High Priority Areas:**

1. **New Data Sources**
   - State-level spending data
   - Lobbying disclosure databases
   - International corruption indices

2. **Agent Improvements**
   - Better natural language query parsing
   - Enhanced corruption pattern detection
   - Multi-source data correlation

3. **Visualization**
   - Interactive donor network graphs
   - Timeline visualizations for spending/policies
   - Geographic heat maps

4. **Dark Money & Stock Act Monitoring**
   - Expand `server/routes/darkmoney.js` and `server/routes/stockact.js`
   - Improve detection heuristics in `server/services/`

5. **Data Quality**
   - Entity resolution improvements
   - Data validation pipelines
   - Deduplication algorithms

### How to Submit Changes

1. **Check existing issues** — Look for `good-first-issue` or `help-wanted` labels
2. **Discuss major changes** — Open an issue before large architectural changes
3. **Write tests** — Include tests for new features
4. **Update documentation** — Keep README and docs current
5. **Follow code style** — Run `npm run lint` before submitting

---

## Adding New Features

### Adding a New API Route

1. Create a route file in `server/routes/`:

```javascript
// server/routes/newFeature.js
import { Router } from 'express'
import { fetchNewData } from '../services/newFeatureService.js'

const router = Router()

router.get('/search', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query
    const results = await fetchNewData(q, { limit })
    res.json({ success: true, data: results })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
```

2. Register in `server/app.js`:

```javascript
import newFeatureRouter from './routes/newFeature.js'

app.use('/api/new-feature', generalLimiter, newFeatureRouter)
```

### Adding a New AI Agent

1. Create a new agent in `server/agents/`:

```javascript
// server/agents/customAgent.js
import { searchData } from '../services/customService.js'

export async function customAgent(query, filters = {}) {
  // 1. Fetch data from your source
  const data = await searchData(query, filters)

  // 2. Return structured results
  return {
    agent: 'customAgent',
    query,
    results: data.results || [],
    summary: `Found ${data.results?.length ?? 0} results`,
    suggestions: []
  }
}
```

2. Wire into the orchestrator in `server/agents/orchestrator.js`:

```javascript
import { customAgent } from './customAgent.js'

// Add to the parallel agent dispatch
const [spending, policy, donors, custom] = await Promise.all([
  spendingAgent(query, filters),
  policyAgent(query, filters),
  donorAgent(query, filters),
  customAgent(query, filters),
])
```

### Adding a New Service

```javascript
// server/services/newSource.js
import axios from 'axios'

const API_KEY = process.env.NEW_SOURCE_API_KEY
const BASE_URL = 'https://api.new-source.gov'

export async function fetchNewData(query, filters = {}) {
  const { data } = await axios.get(`${BASE_URL}/search`, {
    params: { q: query, ...filters, api_key: API_KEY },
    timeout: 10_000,
  })
  return data
}
```

### Adding a New Frontend Page

1. Create a page component in `src/pages/`:

```jsx
// src/pages/NewFeature.jsx
import { Card, CardTitle } from '../components/ui'

export default function NewFeature() {
  return (
    <div>
      <CardTitle>New Feature</CardTitle>
      {/* your content */}
    </div>
  )
}
```

2. Export from `src/pages/index.js` and wire into `src/App.jsx`.

---

## Testing

### Linting

```bash
# Run ESLint across the whole repo
npm run lint
```

### Manual API Testing

```bash
# Health check
curl http://localhost:3001/api/health

# Test a route
curl "http://localhost:3001/api/spending/search?q=defense&limit=5"

# Test the AI agent
curl -X POST http://localhost:3001/api/agent \
  -H "Content-Type: application/json" \
  -d '{"query": "defense contractors in Virginia"}'
```

### ETL Tests (Python, optional)

```bash
cd etl

# Install dependencies
pip install -r requirements.txt

# Run tests
python -m pytest

# Run a specific test
python -m pytest tests/test_fec.py -v
```

---

## Code Standards

### JavaScript / Node.js

We use ESLint (configured in `eslint.config.js`):

```bash
npm run lint
```

Key conventions:
- **Module system:** ES Modules (`import`/`export`) throughout — no CommonJS `require()`
- **Quotes:** Single quotes for strings
- **Semicolons:** Required
- **Indent:** 2 spaces
- **Async:** `async/await` preferred over raw `.then()` chains
- **Error handling:** Always wrap route handlers in try/catch and return `{ success: false, error }` on failure

### React / Frontend

- Functional components with hooks — no class components
- Import aliases: use `@/` for `src/` (e.g. `import { Card } from '@/components/ui'`)
- Theme tokens from `src/theme/` — avoid hardcoded colors

### Python (ETL)

Follow PEP 8:

```bash
# Format
black etl/

# Lint
flake8 etl/
```

---

## Deployment

The app is deployed on **Vercel**:

- The React frontend (`src/`) is built with `npm run build` → `dist/`
- The Express server is adapted for Vercel serverless via `api/[[...path]].js`
- Environment variables are set in the Vercel dashboard (same keys as `.env.example`)

For local production preview:

```bash
npm run build
npm run preview
# Preview at http://localhost:4173
```

---

## Getting Help

- **Issues:** Open a GitHub issue for bugs or feature requests
- **Discussions:** Use GitHub Discussions for questions and ideas
- **Discord:** Coming soon

---

## Recognition

Contributors will be recognized in our release notes and mentioned in the project.

Thank you for helping us wage the **War on Greed**! 🎯

---

*Paid for by PolicyBot.io - Building corruption intelligence for the public good.*
