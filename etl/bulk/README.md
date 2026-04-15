# Bulk Ingest Pipeline

Feeds FEC and USASpending bulk data into:
- **R2 Parquet** (cold archive, full fidelity, for DuckDB analytics + local ML)
- **Supabase Postgres** (hot tier, filtered summaries, for live UI)

See `RESEARCH_BULK_INGEST.md` at repo root for the full plan.

## Usage

```bash
# Ingest FEC candidate master for 2024 cycle (both R2 + Supabase)
node etl/bulk/run.js --source fec-candidates --cycle 2024

# Ingest everything for both cycles
node etl/bulk/run.js --all --cycle 2024 --cycle 2026

# Dry run (download + parse, no writes)
node etl/bulk/run.js --source fec-candidates --cycle 2024 --dry-run

# Skip Supabase, R2 only (useful while Supabase is paused)
SUPABASE_ENABLED=false node etl/bulk/run.js --source fec-candidates --cycle 2024
```

## Environment

Required in `.env`:
```
# R2 (required)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=unredacted-bulk
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com

# Supabase (optional — set SUPABASE_ENABLED=false to skip)
SUPABASE_ENABLED=true
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

## Sources implemented (Phase 1)

| Flag | FEC file | Hot table | R2 path |
|---|---|---|---|
| `fec-candidates` | `cn` | `politicians` | `fec/candidates/cycle=YYYY/` |
| `fec-committees` | `cm` | `pac_committees` | `fec/committees/cycle=YYYY/` |
| `fec-links` | `ccl` | `candidate_committee_links` | `fec/links/cycle=YYYY/` |
| `fec-totals-all` | `weball` | `candidate_totals` | `fec/totals-all/cycle=YYYY/` |
| `fec-totals-hs` | `webl` | `candidate_totals` (active races) | `fec/totals-hs/cycle=YYYY/` |
| `fec-totals-pac` | `webk` | `pac_committees` (totals) | `fec/totals-pac/cycle=YYYY/` |
| `fec-pas2` | `pas2` | `contributions` (PAC→cand) | `fec/pas2/cycle=YYYY/` |
| `fec-oth` | `oth` | `committee_transfers` | `fec/oth/cycle=YYYY/` |

Phase 2+ (`oppexp`, `indiv`, IEs, `.fec` filings, USASpending) to follow.
