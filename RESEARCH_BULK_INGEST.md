# Bulk Ingest Plan — FEC + USASpending → Supabase

**Branch:** `feature/research`
**Author:** research doc, 2026-04-13
**Status:** proposal — awaiting approval before implementation

---

## 1. Problem

The app's "Follow the Money" and related research surfaces only return ~10 rows because:

1. `src/api/client.js:41-48` — frontend hard-defaults `limit=10`.
2. `server/services/fec.js` — every call uses `per_page: Math.min(limit, 20)` and **does not paginate**. Ceiling per request is 20 items, ever.
3. FEC rate limits (25/hr DEMO, 950/hr registered) make live-paging the full corpus infeasible.
4. `etl/sources/fec.py` + `etl/sources/usa_spending.py` exist but (a) cap at page 5–10, (b) write to a **local Postgres + Neo4j** via `etl/base/postgres_client.py` — **not** the Supabase the frontend reads from. Result: Supabase tables (`politicians`, `pac_committees`, `contributions`, `contracts`, `grants`) are largely empty.
5. The REST APIs are the wrong tool for "entire database." Both agencies publish bulk files designed for this.

---

## 2. Strategy: bulk files, not REST APIs

### 2.1 FEC bulk data (https://www.fec.gov/data/browse-data/?tab=bulk-data)

Stable per-cycle ZIP files, refreshed weekly, no API key required:

| File | Contents | Size (2024 cycle, approx) | Supabase target |
|---|---|---|---|
| `cn{YY}.zip` | All candidates | <5 MB | `politicians` (fec_candidate_id) |
| `cm{YY}.zip` | All committees | <10 MB | `pac_committees` |
| `ccl{YY}.zip` | Candidate↔committee links | <5 MB | new: `candidate_committee_links` |
| `webl{YY}.zip` | Candidate summary totals | <5 MB | `candidate_totals` |
| `webk{YY}.zip` | PAC summary totals | <5 MB | `pac_committees` (totals cols) |
| `itcont{YY}.zip` | Individual contributions (Schedule A) | **5–20 GB uncompressed** | `contributions` |
| `itpas2{YY}.zip` | PAC → candidate contribs (Schedule B) | ~500 MB | `contributions` (type=pac_to_cand) |
| `oppexp{YY}.zip` | Operating expenditures | ~1 GB | new: `disbursements_detail` |
| `oth{YY}.zip` | Committee-to-committee transfers | ~100 MB | new: `committee_transfers` |

URL pattern: `https://www.fec.gov/files/bulk-downloads/{YYYY}/{file}.zip`
Layouts: pipe-delimited `.txt` inside each zip; headers documented at fec.gov/campaign-finance-data.

**Update cadence:** FEC refreshes weekly during active cycles, less during off-cycle.

### 2.2 USASpending bulk (https://files.usaspending.gov/)

Two options — use both:

**(a) Monthly archive ZIPs** — `https://files.usaspending.gov/award_data_archive/FY{YYYY}_All_Contracts_Full_{YYYYMMDD}.zip` and `..._Assistance_Full_...zip`. Full snapshot monthly.

**(b) Custom Award Data API** — `POST https://api.usaspending.gov/api/v2/bulk_download/awards/` for filtered slices (date range, agency, award type). Returns a job ID; poll `GET /api/v2/bulk_download/status/?file_name=...` until `status=finished`, then download signed S3 URL. Useful for incremental refreshes.

| Source | Cadence | Supabase target |
|---|---|---|
| Monthly contracts archive | monthly full | `contracts` |
| Monthly assistance archive | monthly full | `grants` |
| Bulk-download API (delta) | weekly filtered | `contracts`, `grants` |

No API key required.

---

## 3. Supabase schema changes

Existing tables (`contracts`, `grants`, `politicians`, `contributions`, `pac_committees`, `candidate_totals`) mostly fit. Additions needed:

```sql
-- New tables
CREATE TABLE candidate_committee_links (
  fec_candidate_id VARCHAR(20),
  committee_id VARCHAR(20),
  cycle INT,
  link_type VARCHAR(10),  -- P=principal, A=authorized, J=joint
  PRIMARY KEY (fec_candidate_id, committee_id, cycle)
);

CREATE TABLE disbursements_detail (
  sub_id BIGINT PRIMARY KEY,
  committee_id VARCHAR(20),
  cycle INT,
  recipient_name TEXT,
  recipient_city TEXT,
  recipient_state VARCHAR(2),
  disbursement_date DATE,
  disbursement_amount NUMERIC(15,2),
  disbursement_description TEXT,
  purpose_category TEXT
);

CREATE TABLE committee_transfers (
  sub_id BIGINT PRIMARY KEY,
  from_committee_id VARCHAR(20),
  to_committee_id VARCHAR(20),
  transfer_date DATE,
  transfer_amount NUMERIC(15,2),
  cycle INT
);

-- Ingest tracking
CREATE TABLE bulk_ingest_runs (
  id BIGSERIAL PRIMARY KEY,
  source VARCHAR(50),      -- 'fec_cn', 'fec_itcont', 'usaspending_contracts', etc.
  cycle_or_period TEXT,
  file_url TEXT,
  file_checksum TEXT,      -- skip if unchanged
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  rows_inserted BIGINT,
  rows_upserted BIGINT,
  status TEXT,             -- running|ok|error
  error TEXT
);

-- Required indexes on contributions (likely missing for bulk-scale queries)
CREATE INDEX IF NOT EXISTS idx_contributions_candidate_id ON contributions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_contributions_committee_id ON contributions(committee_id);
CREATE INDEX IF NOT EXISTS idx_contributions_date ON contributions(date);
CREATE INDEX IF NOT EXISTS idx_contributions_amount ON contributions(amount) WHERE amount >= 2000;

-- RLS: public SELECT on all new tables (matches existing patterns)
```

Also: verify `contributions.contribution_id` / `contributions.sub_id` is `BIGINT PRIMARY KEY` — required for the 20M+ rows per cycle.

---

## 4. Ingest pipeline design

### 4.1 Runtime: Node, not the existing Python ETL

The existing Python ETL targets local Postgres+Neo4j and is architecturally mismatched. Build a Node-based ingester under `etl/bulk/` using:

- `@supabase/supabase-js` with **service-role key** (server-side only; already in env)
- `adm-zip` (already a dep) for FEC zips
- Node streams + `csv-parse` for line-by-line processing (itcont is too big for memory)
- Supabase REST `upsert` in batches of 1,000–5,000

### 4.2 File structure

```
etl/bulk/
  fec/
    download.js          # fetch + checksum + cache to /tmp
    parse-candidates.js  # cn.zip -> politicians upsert
    parse-committees.js  # cm.zip -> pac_committees upsert
    parse-links.js       # ccl.zip -> candidate_committee_links
    parse-totals.js      # webl/webk -> candidate_totals / pac totals
    parse-contribs.js    # itcont.zip streamed -> contributions
    parse-pac2cand.js    # itpas2.zip -> contributions
    parse-disbursements.js
    parse-transfers.js
    schemas.js           # FEC bulk file column layouts
  usaspending/
    download.js
    parse-contracts.js
    parse-assistance.js
    bulk-api-job.js      # async POST+poll+download for deltas
  shared/
    upsert.js            # batched upsert with conflict-on-pk
    run-tracker.js       # bulk_ingest_runs writer
    checksum.js
  run.js                 # CLI: node etl/bulk/run.js --source fec --cycle 2024
```

### 4.3 Upsert strategy (idempotent)

For each table, declare a natural PK:

| Table | PK for upsert |
|---|---|
| politicians | `fec_candidate_id` |
| pac_committees | `committee_id, cycle` |
| contributions | `sub_id` (FEC's unique transaction id) |
| candidate_totals | `fec_candidate_id, cycle` |
| contracts | `award_id` |
| grants | `award_id` |

Each run: stream rows → accumulate batch of 2,000 → `supabase.from(table).upsert(batch, { onConflict: pk })` → log progress every 100k rows.

### 4.4 Incremental vs. full

- **First run:** full 2024 + 2022 cycles for FEC (skip older unless requested); full last-12-months for USASpending. Estimated ~30–40M contribution rows, ~5M contract/grant rows. Disk cost on Supabase depends on plan.
- **Refresh runs:** checksum the remote file; if unchanged, skip. If changed, re-upsert (idempotent on PK). For USASpending, prefer the delta bulk-download API with `last_modified_date` filter.

---

## 5. Scheduling

**Option A (recommended): GitHub Actions cron.**
- Runs on GH runners (unlimited time, free for public repos, big disk for the itcont zip).
- Secrets: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`.
- Schedules:
  - FEC weekly: `0 6 * * 1` (Mondays 06:00 UTC)
  - USASpending monthly: `0 7 1 * *` (1st of month)
  - USASpending delta: weekly

**Option B: Vercel cron** — too short on execution time (10s hobby, 60s pro) and disk for itcont. Not suitable.

**Option C: Supabase scheduled edge function** — same timeout issue (~150s).

Pick A. Add `.github/workflows/bulk-ingest-fec.yml` and `.github/workflows/bulk-ingest-usaspending.yml`.

---

## 6. Frontend / API read-path swap

Once Supabase is populated, `server/routes/donors.js`, `server/routes/spending.js`, `server/routes/darkmoney.js` must **stop calling FEC/USASpending live** and **query Supabase** instead. The existing live FEC service stays as a fallback for real-time-freshness endpoints only (e.g. "last 24h contributions").

Also bump `src/api/client.js` defaults: `limit = 10` → `limit = 50` (or remove cap; pagination via offset). The 20-per-page service cap in `server/services/fec.js` becomes irrelevant once reads are from Supabase.

---

## 7. Risks & open questions

1. **Supabase storage + row-count cost.** `itcont` is 20M+ rows/cycle. Confirm current Supabase plan can hold it, or filter to `amount >= 200` at ingest time (still keeps ~80% of $-volume, cuts rows 5–10×).
2. **RLS + service-role writes.** Ingest must use service-role key; frontend keeps anon RLS-gated reads. Already the pattern in `server/lib/supabase.js` — verify.
3. **FEC file schema drift.** Headers occasionally change. Pin layout in `schemas.js` and fail-loud on mismatch.
4. **USASpending award ID collisions** across monthly archives (re-published rows). PK upsert handles it but confirm `award_id` uniqueness.
5. **Neo4j parity.** The Python ETL also syncs to Neo4j. If the graph pages still use Neo4j, add a Neo4j sync step after Supabase upsert, or deprecate Neo4j entirely. Decision needed.
6. **Retention.** Do we keep cycles 2016/2018/2020/2022 or only current+prior? Affects storage 5×.

---

## 8. Proposed implementation order

1. Add new tables + indexes in a Supabase migration (§3).
2. Build `etl/bulk/shared/*` + `etl/bulk/fec/parse-candidates.js` + `parse-committees.js` first — smallest files, proves pipeline end-to-end.
3. Backfill 2024 cycle candidates/committees → verify "Follow the Money" shows thousands, not 10.
4. Add `parse-contribs.js` with streaming + filter `amount >= 200` for v1.
5. USASpending contracts + grants monthly archive.
6. Switch 2–3 read routes to Supabase (donors → candidates; spending → contracts).
7. GH Actions cron.
8. Backfill 2022 cycle; add disbursements/transfers; switch remaining routes.

Estimated effort: 3–5 days of focused work for steps 1–6; cron + remaining surface another 1–2 days.

---

## 9. What you (the user) do

Nothing manual. No website downloads. Approve this plan, provide:

- Confirmation on **Supabase plan / storage budget** (drives the `amount >= 200` filter decision).
- Decision on **Neo4j** (keep-and-sync, or drop).
- Decision on **cycle retention** (just 2024+2022, or deeper history).

Then implementation proceeds in the order above.
