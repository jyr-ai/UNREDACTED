-- Bulk ingest migration: FEC + USASpending hot-tier tables, indexes, MV.
-- Applies on top of supabase/schema.sql. Safe to re-run.

BEGIN;

-- ─── New tables not in schema.sql ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS candidate_committee_links (
  fec_candidate_id VARCHAR(20) NOT NULL,
  committee_id     VARCHAR(20) NOT NULL,
  cycle            INT         NOT NULL,
  link_type        VARCHAR(10),           -- P=principal, A=authorized, J=joint, U=unauth
  linkage_id       BIGINT,
  PRIMARY KEY (fec_candidate_id, committee_id, cycle)
);
CREATE INDEX IF NOT EXISTS idx_ccl_committee ON candidate_committee_links(committee_id, cycle);

CREATE TABLE IF NOT EXISTS committee_transfers (
  sub_id             BIGINT PRIMARY KEY,
  from_committee_id  VARCHAR(20) NOT NULL,
  to_committee_id    VARCHAR(20),
  transaction_type   VARCHAR(10),
  transfer_date      DATE,
  transfer_amount    NUMERIC(15,2),
  cycle              INT NOT NULL,
  entity_type        VARCHAR(10),
  memo_code          VARCHAR(1),
  memo_text          TEXT,
  raw_data           JSONB
);
CREATE INDEX IF NOT EXISTS idx_transfers_from   ON committee_transfers(from_committee_id, cycle);
CREATE INDEX IF NOT EXISTS idx_transfers_to     ON committee_transfers(to_committee_id, cycle);
CREATE INDEX IF NOT EXISTS idx_transfers_date   ON committee_transfers(transfer_date);

CREATE TABLE IF NOT EXISTS lobbyist_bundles (
  sub_id             BIGINT PRIMARY KEY,
  committee_id       VARCHAR(20),
  candidate_id       VARCHAR(20),
  lobbyist_registrant_id VARCHAR(50),
  lobbyist_name      TEXT,
  bundled_amount     NUMERIC(15,2),
  report_period      VARCHAR(20),
  cycle              INT,
  raw_data           JSONB
);
CREATE INDEX IF NOT EXISTS idx_bundles_candidate ON lobbyist_bundles(candidate_id);
CREATE INDEX IF NOT EXISTS idx_bundles_committee ON lobbyist_bundles(committee_id);

CREATE TABLE IF NOT EXISTS independent_expenditures (
  sub_id             BIGINT PRIMARY KEY,
  committee_id       VARCHAR(20),
  candidate_id       VARCHAR(20),
  support_oppose     VARCHAR(1),        -- S=support, O=oppose
  expenditure_date   DATE,
  expenditure_amount NUMERIC(15,2),
  payee_name         TEXT,
  purpose            TEXT,
  cycle              INT,
  raw_data           JSONB
);
CREATE INDEX IF NOT EXISTS idx_ie_candidate ON independent_expenditures(candidate_id, cycle);
CREATE INDEX IF NOT EXISTS idx_ie_committee ON independent_expenditures(committee_id, cycle);

CREATE TABLE IF NOT EXISTS electioneering_comms (
  sub_id             BIGINT PRIMARY KEY,
  committee_id       VARCHAR(20),
  candidate_mentioned VARCHAR(20),
  comm_date          DATE,
  amount             NUMERIC(15,2),
  payee_name         TEXT,
  purpose            TEXT,
  cycle              INT,
  raw_data           JSONB
);

CREATE TABLE IF NOT EXISTS communication_costs (
  sub_id             BIGINT PRIMARY KEY,
  committee_id       VARCHAR(20),
  candidate_id       VARCHAR(20),
  support_oppose     VARCHAR(1),
  comm_date          DATE,
  amount             NUMERIC(15,2),
  comm_type          VARCHAR(20),
  cycle              INT,
  raw_data           JSONB
);

CREATE TABLE IF NOT EXISTS candidate_statements (
  fec_candidate_id   VARCHAR(20) NOT NULL,
  cycle              INT NOT NULL,
  filed_date         DATE,
  principal_cmte_id  VARCHAR(20),
  raw_data           JSONB,
  PRIMARY KEY (fec_candidate_id, cycle)
);

CREATE TABLE IF NOT EXISTS committee_statements (
  committee_id       VARCHAR(20) NOT NULL,
  cycle              INT NOT NULL,
  filed_date         DATE,
  committee_type     VARCHAR(10),
  designation        VARCHAR(10),
  treasurer_name     TEXT,
  raw_data           JSONB,
  PRIMARY KEY (committee_id, cycle)
);

CREATE TABLE IF NOT EXISTS loans (
  sub_id             BIGINT PRIMARY KEY,
  committee_id       VARCHAR(20),
  candidate_id       VARCHAR(20),
  lender_name        TEXT,
  loan_amount        NUMERIC(15,2),
  loan_date          DATE,
  due_date           DATE,
  interest_rate      NUMERIC(6,3),
  balance            NUMERIC(15,2),
  cycle              INT,
  raw_data           JSONB
);
CREATE INDEX IF NOT EXISTS idx_loans_candidate ON loans(candidate_id, cycle);
CREATE INDEX IF NOT EXISTS idx_loans_committee ON loans(committee_id, cycle);

CREATE TABLE IF NOT EXISTS debts (
  sub_id             BIGINT PRIMARY KEY,
  committee_id       VARCHAR(20),
  creditor_name      TEXT,
  debt_purpose       TEXT,
  debt_amount        NUMERIC(15,2),
  amount_owed        NUMERIC(15,2),
  incurred_date      DATE,
  cycle              INT,
  raw_data           JSONB
);
CREATE INDEX IF NOT EXISTS idx_debts_committee ON debts(committee_id, cycle);

-- ─── Ingest run tracking ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bulk_ingest_runs (
  id               BIGSERIAL PRIMARY KEY,
  source           VARCHAR(50) NOT NULL,  -- 'fec_cn', 'fec_indiv', 'usaspending_contracts', etc.
  cycle_or_period  TEXT,
  file_url         TEXT,
  file_checksum    TEXT,
  started_at       TIMESTAMPTZ DEFAULT NOW(),
  finished_at      TIMESTAMPTZ,
  rows_read        BIGINT DEFAULT 0,
  rows_upserted    BIGINT DEFAULT 0,
  rows_parquet     BIGINT DEFAULT 0,
  status           VARCHAR(20) DEFAULT 'running',  -- running|ok|error|skipped
  error            TEXT
);
CREATE INDEX IF NOT EXISTS idx_ingest_runs_source ON bulk_ingest_runs(source, started_at DESC);

-- ─── Indexes on existing tables needed at bulk scale ─────────────────────────

CREATE INDEX IF NOT EXISTS idx_contributions_candidate_id ON contributions(candidate_id) WHERE candidate_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contributions_committee_id ON contributions(committee_id) WHERE committee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contributions_date         ON contributions(date);
CREATE INDEX IF NOT EXISTS idx_contributions_amount_hi    ON contributions(amount) WHERE amount >= 2000;
CREATE INDEX IF NOT EXISTS idx_contributions_employer     ON contributions(contributor_employer) WHERE contributor_employer IS NOT NULL;

-- ─── Flags on pac_committees for quick filtering ─────────────────────────────

ALTER TABLE pac_committees ADD COLUMN IF NOT EXISTS is_leadership_pac BOOLEAN DEFAULT FALSE;
ALTER TABLE pac_committees ADD COLUMN IF NOT EXISTS is_lobbyist_pac   BOOLEAN DEFAULT FALSE;
ALTER TABLE pac_committees ADD COLUMN IF NOT EXISTS is_super_pac      BOOLEAN DEFAULT FALSE;
ALTER TABLE pac_committees ADD COLUMN IF NOT EXISTS is_501c4          BOOLEAN DEFAULT FALSE;

-- ─── Money-flow materialized view (5-tier layered DAG for Sankey) ────────────
-- Drop/recreate rather than REFRESH to allow structure changes between ingests.

DROP MATERIALIZED VIEW IF EXISTS money_flow_edges;

CREATE MATERIALIZED VIEW money_flow_edges AS
-- Tier 1 → 2: employer/industry → committee (aggregated from individual contribs ≥ $200)
SELECT
  'employer'                              AS source_type,
  1                                       AS source_tier,
  LOWER(TRIM(contributor_employer))       AS source_id,
  contributor_employer                    AS source_label,
  'committee'                             AS target_type,
  2                                       AS target_tier,
  committee_id                            AS target_id,
  NULL::TEXT                              AS target_label,
  SUM(amount)                             AS amount,
  COUNT(*)                                AS txn_count,
  EXTRACT(YEAR FROM date)::INT            AS cycle
FROM contributions
WHERE contributor_employer IS NOT NULL
  AND TRIM(contributor_employer) <> ''
  AND amount >= 200
  AND committee_id IS NOT NULL
GROUP BY LOWER(TRIM(contributor_employer)), contributor_employer, committee_id, EXTRACT(YEAR FROM date)

UNION ALL
-- Tier 2 → 4: committee-to-committee transfers (oth)
SELECT
  'committee',  2, from_committee_id, NULL,
  'committee',  4, to_committee_id,   NULL,
  SUM(transfer_amount), COUNT(*), cycle
FROM committee_transfers
WHERE to_committee_id IS NOT NULL
GROUP BY from_committee_id, to_committee_id, cycle

UNION ALL
-- Tier 4 → 5: committee → candidate (pas2)
SELECT
  'committee',  4, committee_id,   NULL,
  'candidate',  5, candidate_id,   NULL,
  SUM(amount), COUNT(*), EXTRACT(YEAR FROM date)::INT
FROM contributions
WHERE candidate_id IS NOT NULL
  AND committee_id IS NOT NULL
GROUP BY committee_id, candidate_id, EXTRACT(YEAR FROM date);

CREATE INDEX IF NOT EXISTS idx_mfe_target ON money_flow_edges(target_type, target_id, cycle);
CREATE INDEX IF NOT EXISTS idx_mfe_source ON money_flow_edges(source_type, source_id, cycle);
CREATE INDEX IF NOT EXISTS idx_mfe_amount ON money_flow_edges(amount DESC);

-- ─── RLS: public read on new tables ──────────────────────────────────────────

ALTER TABLE candidate_committee_links   ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_transfers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobbyist_bundles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE independent_expenditures    ENABLE ROW LEVEL SECURITY;
ALTER TABLE electioneering_comms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_costs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_statements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_statements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_ingest_runs            ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'candidate_committee_links','committee_transfers','lobbyist_bundles',
    'independent_expenditures','electioneering_comms','communication_costs',
    'candidate_statements','committee_statements','loans','debts'
  ] LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I_public_select ON %I; CREATE POLICY %I_public_select ON %I FOR SELECT USING (true);',
      t, t, t, t
    );
  END LOOP;
END$$;

-- bulk_ingest_runs: admin-only read (keep ingest internals private)
DROP POLICY IF EXISTS bulk_ingest_runs_no_public ON bulk_ingest_runs;
CREATE POLICY bulk_ingest_runs_no_public ON bulk_ingest_runs FOR SELECT USING (false);

COMMIT;
