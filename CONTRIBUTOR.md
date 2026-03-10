# Contributing to UNREDACTED

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
| **Docker Desktop** | Latest | Containerized databases |
| **Node.js** | 18+ | Backend & Frontend runtime |
| **Python** | 3.10+ | ETL processes |
| **npm** | 9+ | Package management |
| **Git** | Latest | Version control |

### Step-by-Step Setup

#### 1. Clone the Repository

```bash
git clone https://github.com/policybot-io/UNREDACTED.git
cd UNREDACTED
```

#### 2. Start the Infrastructure (Databases)

We use Docker Compose to run PostgreSQL, Neo4j, and Redis:

```bash
# Start all databases
docker-compose up -d neo4j postgres redis

# Verify services are running
docker ps

# Expected output:
# unredacted-neo4j    (ports 7474, 7687)
# unredacted-postgres (port 5432)
# unredacted-redis    (port 6379)
```

**Database Credentials:**

| Service | URL/Host | Default Credentials |
|---------|----------|---------------------|
| Neo4j | `http://localhost:7474` | neo4j / password |
| PostgreSQL | `localhost:5432` | postgres / password |
| Redis | `localhost:6379` | (no auth) |

#### 3. Set Up Environment Variables

```bash
# Copy the example environment file
cp backend/.env.example backend/.env

# Edit with your API keys
code backend/.env  # or nano, vim, etc.
```

**Government Data API Keys:**

| Variable | Source | Notes |
|----------|--------|-------|
| `FEC_API_KEY` | [api.open.fec.gov](https://api.open.fec.gov/developers/) | Free key, 1,000 req/hour |

**AI Provider Keys (choose one or more):**

| Variable | Provider | Get Key |
|----------|----------|---------|
| `DEEPSEEK_API_KEY` | DeepSeek Chat | [platform.deepseek.com](https://platform.deepseek.com/) |
| `OPENAI_API_KEY` | OpenAI GPT-4o | [platform.openai.com](https://platform.openai.com/api-keys) |
| `ANTHROPIC_API_KEY` | Claude 3.5 Sonnet | [console.anthropic.com](https://console.anthropic.com/) |
| `GROQ_API_KEY` | Groq (free tier) | [console.groq.com](https://console.groq.com/) |
| `QWEN_API_KEY` | Alibaba Qwen 2.5 | [dashscope.aliyuncs.com](https://dashscope.aliyuncs.com/) |
| `XAI_API_KEY` | xAI Grok | [console.x.ai](https://console.x.ai/) |
| `OLLAMA_BASE_URL` | Local Ollama | No key — [ollama.com](https://ollama.com/) |

> **Tip:** API keys can also be configured live from the app UI via the **⚙ Settings** tab, without needing to restart the server.

Example `.env` file:
```bash
# Database URLs (using Docker defaults)
POSTGRES_URI=postgresql://postgres:password@localhost:5432/unredacted
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
REDIS_URL=redis://localhost:6379/0

# API Keys
FEC_API_KEY=your_fec_api_key_here
DEEPSEEK_API_KEY=your_deepseek_key_here
GROQ_API_KEY=your_groq_key_here

# Server
PORT=3000
```

#### 4. Install Backend Dependencies

```bash
cd backend
npm install

# Initialize PostgreSQL tables
node -e "require('./services/db').initTables()"

# Verify Neo4j connection
curl http://localhost:7474
```

#### 5. Install Frontend Dependencies

```bash
cd frontend
npm install
```

#### 6. Start the Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Server running on http://localhost:3000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# Frontend running on http://localhost:5173
```

**Verify Setup:**
- Open `http://localhost:5173` in your browser
- Backend API should respond at `http://localhost:3000/api/status`

---

## Project Structure

```
UNREDACTED/
├── backend/                    # Node.js API server
│   ├── agents/                 # AI agents (4 core agents)
│   │   ├── policyAgent.js      # Federal Register intelligence
│   │   ├── spendingAgent.js    # USASpending.gov analysis
│   │   ├── donorAgent.js       # FEC campaign finance
│   │   ├── corruptionAgent.js  # Pattern detection
│   │   └── orchestrator.js     # Agent coordination
│   ├── routes/                 # API endpoints
│   ├── services/               # External API integrations
│   └── server.js               # Express entry point
├── frontend/                   # React + Vite application
│   ├── src/                    # Source code
│   │   ├── components/         # React components
│   │   └── api/                # API client
│   └── index.html              # Entry point
├── etl/                        # Python ETL processes
│   ├── sources/                # Data source connectors
│   ├── enrichment/             # Data enrichment
│   ├── base/                   # Database clients
│   └── scheduler/              # Celery task scheduler
├── agents/                     # Python-based AI agents
│   ├── donor_agent.py          # Donor analysis (Python)
│   └── main.py                 # Agent entry point
└── docker-compose.yml          # Infrastructure definition
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
fix: resolve Neo4j connection timeout issue
docs: update README with new data sources
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

4. **Data Quality**
   - Entity resolution improvements
   - Data validation pipelines
   - Deduplication algorithms

### How to Submit Changes

1. **Check existing issues** - Look for `good-first-issue` or `help-wanted` labels
2. **Discuss major changes** - Open an issue before large architectural changes
3. **Write tests** - Include tests for new features
4. **Update documentation** - Keep README and docs current
5. **Follow code style** - Run linting before submitting

---

## Adding New Features

### Adding a New AI Agent

1. Create a new file in `backend/agents/`:

```javascript
// backend/agents/customAgent.js
import { searchData } from '../services/customService.js'

export async function customAgent(query, filters = {}) {
  // 1. Parse query
  const parsedQuery = parseQuery(query)

  // 2. Fetch data from your source
  const data = await searchData(parsedQuery, filters)

  // 3. Return structured results
  return {
    agent: 'customAgent',
    query: parsedQuery,
    results: data.results || [],
    summary: `Found ${data.results.length} results`,
    suggestions: generateSuggestions(data)
  }
}

function parseQuery(query) {
  // Your query parsing logic
  return { keywords: [], filters: {} }
}

function generateSuggestions(data) {
  // Return follow-up suggestions
  return []
}
```

2. Register in `backend/routes/ai_agent.js`:

```javascript
import { customAgent } from '../agents/customAgent.js'

// Add to agent dispatch
const agentResults = await Promise.all([
  spendingAgent(query, filters),
  policyAgent(query, filters),
  donorAgent(query, filters),
  customAgent(query, filters),  // Your new agent
])
```

3. Add tests in `backend/tests/`:

```javascript
// backend/tests/customAgent.test.js
import { customAgent } from '../agents/customAgent.js'

describe('customAgent', () => {
  test('should parse query correctly', async () => {
    const result = await customAgent('search term')
    expect(result.agent).toBe('customAgent')
  })
})
```

### Adding a New Data Source

1. Create a service file:

```javascript
// backend/services/newSource.js
import axios from 'axios'

const API_KEY = process.env.NEW_SOURCE_API_KEY
const BASE_URL = 'https://api.new-source.gov'

export async function searchNewSource(query, filters) {
  const response = await axios.get(`${BASE_URL}/search`, {
    params: {
      query,
      ...filters,
      api_key: API_KEY
    }
  })
  return response.data
}
```

2. Create an ETL connector:

```python
# etl/sources/new_source.py
from base.postgres_client import PostgresConnection

class NewSourceConnector:
    def __init__(self):
        self.db = PostgresConnection()

    def fetch_data(self, params):
        # API fetch logic
        pass

    def transform(self, raw_data):
        # Data transformation
        pass

    def load(self, transformed_data):
        # Database insertion
        pass
```

3. Add scheduled task:

```python
# etl/scheduler/tasks.py
from etl.sources.new_source import NewSourceConnector

@celery_app.task
def sync_new_source():
    connector = NewSourceConnector()
    data = connector.fetch_data({})
    transformed = connector.transform(data)
    connector.load(transformed)
```

---

## Testing

### Backend Tests

```bash
cd backend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- spending.test.js
```

### Frontend Tests

```bash
cd frontend

# Run tests
npm test

# Run in watch mode
npm run test:watch
```

### ETL Tests

```bash
cd etl

# Run Python tests
python -m pytest

# Run specific test
python -m pytest tests/test_fec.py -v
```

### Integration Testing

```bash
# Start all services
docker-compose up -d

# Run integration tests
npm run test:integration

# Test database connections
node scripts/test-connections.js
```

---

## Code Standards

### JavaScript/Node.js

We use ESLint with the following rules:

```bash
# Run linting
npm run lint

# Auto-fix issues
npm run lint:fix
```

Key conventions:
- **Quotes:** Single quotes for strings
- **Semicolons:** Required
- **Indent:** 2 spaces
- **Line length:** 100 characters max

### Python

Follow PEP 8:

```bash
# Format with black
black etl/

# Lint with flake8
flake8 etl/
```

### Database Migrations

For schema changes:

```bash
# Create migration script
node scripts/create-migration.js add_new_column

# Run migrations
node scripts/run-migrations.js
```

---

## Getting Help

- **Discord:** [Join our community](https://discord.gg/unredacted) (coming soon)
- **Issues:** Open a GitHub issue for bugs or feature requests
- **Discussions:** Use GitHub Discussions for questions

---

## Recognition

Contributors will be recognized in our CONTRIBUTORS.md file and mentioned in release notes.

Thank you for helping us wage the **War on Greed**! 🎯

---

*Paid for by PolicyBot.io - Building corruption intelligence for the public good.*
