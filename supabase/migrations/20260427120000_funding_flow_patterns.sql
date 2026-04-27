-- supabase/migrations/20260427120000_funding_flow_patterns.sql
-- Funding Flow Galaxy — AI-detected money flow patterns
-- Spec: docs/superpowers/specs/2026-04-27-funding-flow-galaxy-design.md

CREATE TABLE IF NOT EXISTS funding_flow_patterns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type    TEXT NOT NULL CHECK (pattern_type IN (
                    'sector_concentration',
                    'dark_money_pathway',
                    'committee_alignment',
                    'sudden_surge'
                  )),
  title           TEXT NOT NULL,
  narrative       TEXT NOT NULL,
  explanation     TEXT NOT NULL,
  sector          TEXT,
  node_ids        TEXT[] NOT NULL DEFAULT '{}',
  evidence        JSONB NOT NULL DEFAULT '{}'::jsonb,
  cycle           TEXT NOT NULL,
  severity_score  INT  NOT NULL DEFAULT 5
                  CHECK (severity_score BETWEEN 0 AND 10),
  generated_at    TIMESTAMPTZ DEFAULT NOW(),
  generated_by    TEXT DEFAULT 'claude-sonnet-4-6',
  visible         BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_patterns_node_ids
  ON funding_flow_patterns USING GIN (node_ids);

CREATE INDEX IF NOT EXISTS idx_patterns_cycle_visible
  ON funding_flow_patterns (cycle, visible, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_patterns_sector
  ON funding_flow_patterns (sector) WHERE visible = TRUE;

COMMENT ON TABLE funding_flow_patterns IS
  'AI-detected money flow patterns surfaced in the Funding Flow Galaxy. Generated weekly by etl/patterns/detectFundingPatterns.js.';
