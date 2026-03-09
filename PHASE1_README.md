# UNREDACTED - Phase 1 Implementation

## Overview
Phase 1 MVP is now complete with the following infrastructure:

### Backend Infrastructure

| Component | Status | Description |
|-----------|--------|-------------|
| **Neo4j Graph DB** | ✅ | Full schema with constraints/indexes for entities and relationships |
| **PostgreSQL** | ✅ | Time-series data, full-text search, audit logs |
| **Redis Cache** | ✅ | API response caching, job locking, agent state |
| **Python ETL Workers** | ✅ | Async workers with Celery for USASpending & FederalRegister |
| **Entity Resolution** | ✅ | Company name normalization, fuzzy matching, cross-source linking |
| **Graph Query Service** | ✅ | Neo4j queries for corruption pattern detection |

### Data Sources Integrated

| Source | ETL Worker | Storage | Graph |
|--------|-----------|---------|-------|
| USASpending.gov | ✅ | PostgreSQL + Neo4j | Contracts, Companies, Agencies |
| Federal Register | ✅ | PostgreSQL + Neo4j | Regulations, Agencies |
| FEC API | ✅ | API proxy | - |

### Corruption Detection Patterns

| Pattern | Implementation |
|-----------|----------------|
| **Quid Pro Quo** | Graph query: Company → Contract → Agency → Committee → Politician |
| **Spending Concentration** | Aggregate analysis in Neo4j |
| **Regulatory Pattern** | Regulation → Agency → Contract → Company correlation |
| **Risk Scoring** | Composite score based on spending + regulations + connections |

## Quick Start

### 1. Start Infrastructure
```bash
# Using Docker
docker-compose up -d neo4j postgres redis

# Or manually install and start services
```

### 2. Initialize Databases
```bash
cd etl
pip install -r requirements.txt
python init_databases.py
```

### 3. Run ETL Pipeline
```bash
# Start Celery worker
celery -A scheduler.celery_app worker --loglevel=info

# Start Celery beat for scheduled jobs
celery -A scheduler.celery_app beat --loglevel=info

# Or run once manually
python -c "from scheduler.tasks import run_usa_spending_etl; print(run_usa_spending_etl.delay().get())"
```

### 4. Start Backend
```bash
cd backend
npm install
npm start
```

### 5. Start Frontend
```bash
cd frontend
npm install
npm run dev
```

## Database Schema

### Neo4j Graph Model
```cypher
(:Company {normalized_name, name, uei})
(:Agency {name})
(:Contract {award_id, amount, award_date, description})
(:Regulation {document_number, title, publication_date, type, significant})
(:Politician {name, bioguide_id, party, state})
(:PAC {committee_id, name})
(:Committee {name, chamber})

(:Company)-[:RECEIVED {amount, date}]->(:Contract)
(:Agency)-[:AWARDED {amount, date}]->(:Contract)
(:Agency)-[:ISSUED {date}]->(:Regulation)
(:Politician)-[:SITS_ON {role}]->(:Committee)
(:Committee)-[:OVERSEES]->(:Agency)
(:Company)-[:SIMILAR_TO {score}]->(:Company)
```

### PostgreSQL Tables
- `contracts` - Full contract data with JSONB raw data
- `grants` - Grant awards
- `regulations` - Federal Register documents
- `etl_jobs` - ETL job tracking
- `api_logs` - Request logging

## Environment Variables

```bash
# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# PostgreSQL
POSTGRES_URI=postgresql://postgres:password@localhost:5432/unredacted

# Redis
REDIS_URL=redis://localhost:6379/0
CACHE_TTL=3600

# APIs
FEC_API_KEY=your_fec_key
GROQ_API_KEY=your_groq_key
```

## Next Steps (Phase 2)

1. **Donor Intelligence**
   - FEC Schedule A/B ETL workers
   - PAC donation graph relationships
   - Politician profiles

2. **Real-time Ingestion**
   - Webhook support for Federal Register
   - USASpending delta sync

3. **Advanced Analytics**
   - Time-series aggregation
   - Predictive corruption scoring
   - Network analysis algorithms
