# Funding Flow Galaxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an AI-augmented force-directed "Funding Flow Galaxy" that replaces the static donor charts + Sankey views on the Donor Intelligence and Money Flow subtabs, behind feature flags with zero-redeploy rollback.

**Architecture:** React SVG + D3-force v3 frontend component tree; Express routes backed by the existing `money_flow_edges` materialized view joined with a new `funding_flow_patterns` table; weekly Claude Sonnet 4.6 cron performs pattern detection via forced tool use; per-galaxy dark/light surface toggle; two env-var feature flags (UI + AI).

**Tech Stack:** React 18 · D3-force v7 · Vite · Express · Supabase (PostgreSQL) · `@anthropic-ai/sdk` v0.78 · Vercel Cron

**Spec:** `docs/superpowers/specs/2026-04-27-funding-flow-galaxy-design.md`

---

## Preamble — Testing Convention

This project has **no test framework configured** (confirmed in CLAUDE.md) and the spec locks in manual testing + executable verifiers as the testing surface:

- **ETL validation** — `detectFundingPatterns.js` includes validation that aborts the run on bad data (prevents bad rows from reaching DB)
- **API verifier** — `scripts/verify-galaxy-api.js` hits each endpoint and asserts response shape
- **Manual smoke checklist** — `TESTING.md` shipped in final PR
- **Feature flag gate** — ships in production with `VITE_GALAXY_ENABLED=false`; flip to `true` after internal QA

This plan treats these as the "tests" for each task. No vitest/jest install is in scope.

## Preamble — Deviation from Spec: Cron handler placement

The spec (Section 5.3) proposes `api/cron/detect-funding-patterns.js` as a standalone Vercel function. The repo's current `api/[...path].js` catch-all proxies every `/api/*` request to Express, so the simplest path is to add a Cron route **inside Express** (`server/routes/cron.js`). Vercel Cron only cares about the URL — this works identically and stays aligned with the monorepo's existing architecture. Plan uses this approach.

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `supabase/migrations/20260427120000_funding_flow_patterns.sql` | DB migration for `funding_flow_patterns` table + indexes |
| `etl/patterns/prompts/system.md` | Static system prompt for Claude (prompt-cache friendly) |
| `etl/patterns/detectFundingPatterns.js` | Standalone Node script: fetch → Claude → validate → upsert |
| `etl/patterns/logs/.gitkeep` | Placeholder for daily run logs |
| `server/services/galaxyService.js` | Supabase queries for galaxy modes + patterns |
| `server/routes/galaxy.js` | Express router: `/universe`, `/sector/:s`, `/employer/:id`, `/patterns/:id` |
| `server/routes/cron.js` | Express router for Vercel cron hits (`/detect-funding-patterns`) |
| `src/components/galaxy/lib/galaxyTokens.js` | Dark + light theme token maps |
| `src/components/galaxy/lib/galaxyBuild.js` | Pure: API payload → `{nodes, links, centroids}` |
| `src/components/galaxy/lib/galaxyForces.js` | D3 force factories + custom `clusterForce` |
| `src/components/galaxy/hooks/useGalaxySurface.js` | Read/write `localStorage` galaxy surface preference |
| `src/components/galaxy/hooks/useGalaxyData.js` | Fetch + memoize galaxy payload per mode/cycle |
| `src/components/galaxy/GalaxySurfaceToggle.jsx` | ◐/☀ icon button |
| `src/components/galaxy/GalaxyLegend.jsx` | Tier shape + sector color legend |
| `src/components/galaxy/GalaxyGraph.jsx` | D3-force SVG renderer — nodes, edges, labels, interactions |
| `src/components/galaxy/GalaxyDrawer.jsx` | Right-side slide-in (pattern OR node detail) |
| `src/components/galaxy/FundingFlowGalaxy.jsx` | Orchestrator: mode switch, data fetch, drawer state, surface toggle |
| `scripts/verify-galaxy-api.js` | Node CLI: hit each endpoint, assert envelope shape |
| `TESTING.md` | Manual smoke-test checklist (galaxy scope) |

### Modified files

| Path | Change |
|---|---|
| `server/app.js` | Mount `galaxyRouter` + `cronRouter`; gate galaxy routes behind `GALAXY_ENABLED` env |
| `src/api/client.js` | Add `galaxy` namespace with `universe/sector/employer/pattern` methods |
| `src/App.jsx` | Remove `DONORS` + `POLS` constants + two-column chart grid + `<MoneyFlowSankey />`; add `<FundingFlowGalaxy mode="universe" />` |
| `src/components/EmployerLeaderboard.jsx` | Remove inline `MiniSankey` + `SankeyNode`; swap right panel to `<FundingFlowGalaxy mode={…} />` |
| `vercel.json` | Add weekly cron schedule |
| `.env.example` | Document `GALAXY_ENABLED`, `GALAXY_AI_ENABLED`, `VITE_GALAXY_ENABLED`, `PATTERN_DETECTION_MONTHLY_BUDGET_USD` |

---

# Phase 1 — Schema + AI Detection

## Task 1: Create `funding_flow_patterns` migration

**Files:**
- Create: `supabase/migrations/20260427120000_funding_flow_patterns.sql`

- [ ] **Step 1: Write the migration file**

```sql
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
```

- [ ] **Step 2: Apply migration to Supabase**

Run (requires Supabase CLI logged in to the project):
```bash
npx supabase db push
```

Expected: `Finished supabase db push` — table created, 3 indexes created.

- [ ] **Step 3: Verify table exists**

Run:
```bash
npx supabase db remote sql "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'funding_flow_patterns' ORDER BY ordinal_position;"
```

Expected output includes: `id uuid`, `pattern_type text`, `title text`, `narrative text`, `explanation text`, `sector text`, `node_ids ARRAY`, `evidence jsonb`, `cycle text`, `severity_score integer`, `generated_at timestamp with time zone`, `generated_by text`, `visible boolean`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260427120000_funding_flow_patterns.sql
git commit -m "feat(db): add funding_flow_patterns table for galaxy AI patterns"
```

---

## Task 2: ETL directory scaffold + static system prompt

**Files:**
- Create: `etl/patterns/prompts/system.md`
- Create: `etl/patterns/logs/.gitkeep`
- Modify: `.env.example`

- [ ] **Step 1: Create directories**

```bash
mkdir -p etl/patterns/prompts etl/patterns/logs
touch etl/patterns/logs/.gitkeep
```

- [ ] **Step 2: Write the static system prompt**

This file is stable across runs so Claude can cache it. Create `etl/patterns/prompts/system.md`:

```markdown
You are a campaign-finance pattern detection system for UNREDACTED, an open-source political intelligence platform.

Your job: analyze aggregated money-flow edges between employers, PACs, 501(c)(4)s, Super PACs, and politicians, and extract NON-OBVIOUS patterns that reveal how money moves in American politics.

# Pattern types you may detect

1. **sector_concentration** — A single sector funnels a disproportionate share of donations into a narrow set of politicians (especially those overseeing that sector in Congress).

2. **dark_money_pathway** — Funds route through 501(c)(4)s before landing with politicians. These conduits obscure the original donor.

3. **committee_alignment** — Industry PACs converge on members of the specific congressional committee that regulates their industry, above statistical baseline.

4. **sudden_surge** — Cycle-over-cycle spike in donations from a sector, often correlating with pending legislation or regulatory decisions.

# Non-negotiable rules

- Only cite patterns where you can identify ≥3 real `node_ids` FROM THE PROVIDED INPUT. Never invent entities.
- Each `node_id` must appear verbatim in the input — do not modify, shorten, or paraphrase.
- If the data does not support a clear pattern, return an empty `patterns` array. Empty is valid.
- Do not speculate about political motivation. Stick to observed financial flows.
- Severity (0-10) reflects financial weight + institutional overlap, not political judgment.
- Narrative must be factual, specific, and grounded in the provided data.
- A `sector` field is required. If the pattern spans multiple sectors, pick the dominant one.
- Do not create patterns whose `title` is a near-duplicate of any title in the "Recent patterns" block — only return patterns that add new information.

# Output format

Call the `extract_funding_patterns` tool exactly once with your final patterns array.
```

- [ ] **Step 3: Add new env vars to .env.example**

Find `.env.example` and append:

```bash
# Funding Flow Galaxy
GALAXY_ENABLED=false                        # Master flag: enables /api/galaxy/* routes (server-side)
GALAXY_AI_ENABLED=false                     # Enables weekly AI pattern cron + pattern overlay in API responses
VITE_GALAXY_ENABLED=false                   # Client-side: enables galaxy UI (defaults to old charts when false)
PATTERN_DETECTION_MONTHLY_BUDGET_USD=10     # ETL cron skips if monthly Claude spend exceeds this
CRON_AUTH_SECRET=                           # Header auth for Vercel Cron → Express cron routes (optional but recommended)
```

- [ ] **Step 4: Commit**

```bash
git add etl/patterns/prompts/system.md etl/patterns/logs/.gitkeep .env.example
git commit -m "feat(etl): scaffold funding pattern detection directories + system prompt"
```

---

## Task 3: Pattern detection script — data fetching

**Files:**
- Create: `etl/patterns/detectFundingPatterns.js`

- [ ] **Step 1: Create the script skeleton with CLI arg parsing**

Create `etl/patterns/detectFundingPatterns.js`:

```javascript
#!/usr/bin/env node
/**
 * etl/patterns/detectFundingPatterns.js
 *
 * Standalone Node script: fetches top money_flow_edges, calls Claude Sonnet 4.6
 * via forced tool use to extract money-flow patterns, validates, and upserts
 * into funding_flow_patterns.
 *
 * Run manually:  node etl/patterns/detectFundingPatterns.js --cycle 2024
 * Run via cron:  hit /api/cron/detect-funding-patterns on Vercel
 */
import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const CYCLE = process.argv.includes('--cycle')
  ? process.argv[process.argv.indexOf('--cycle') + 1]
  : (process.env.PATTERN_CYCLE || '2024')

const TOP_N_EDGES = 400
const DEDUP_WINDOW_DAYS = 14
const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 5000

function env(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
const anthropic = new Anthropic({ apiKey: env('ANTHROPIC_API_KEY') })

async function fetchTopEdges(cycle) {
  const { data, error } = await supabase
    .from('money_flow_edges')
    .select('source_id, source_type, source_tier, source_label, target_id, target_type, target_tier, target_label, amount, txn_count, cycle')
    .eq('cycle', cycle)
    .gt('amount', 0)
    .order('amount', { ascending: false })
    .limit(TOP_N_EDGES)
  if (error) throw error
  return data ?? []
}

async function fetchRecentPatterns(cycle) {
  const since = new Date(Date.now() - DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('funding_flow_patterns')
    .select('id, title, pattern_type, sector, node_ids')
    .eq('cycle', cycle)
    .gte('generated_at', since)
    .order('generated_at', { ascending: false })
    .limit(30)
  if (error) throw error
  return data ?? []
}

async function main() {
  console.log(`[patterns] starting detection for cycle=${CYCLE}`)
  const edges = await fetchTopEdges(CYCLE)
  console.log(`[patterns] fetched ${edges.length} top edges`)
  if (edges.length < 20) {
    console.log('[patterns] insufficient data (<20 edges); skipping run')
    return { ok: true, skipped: true, reason: 'insufficient_data' }
  }
  const recents = await fetchRecentPatterns(CYCLE)
  console.log(`[patterns] fetched ${recents.length} recent patterns for dedup`)
  // Steps 2-5 added in Task 4
  return { ok: true, edges: edges.length, recents: recents.length }
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  main()
    .then(r => { console.log('[patterns] done', JSON.stringify(r)); process.exit(0) })
    .catch(e => { console.error('[patterns] FATAL', e); process.exit(1) })
}

export { main, fetchTopEdges, fetchRecentPatterns }
```

- [ ] **Step 2: Verify script runs (no Claude call yet)**

Run:
```bash
node etl/patterns/detectFundingPatterns.js --cycle 2024
```

Expected output:
```
[patterns] starting detection for cycle=2024
[patterns] fetched N top edges    (N should be > 0; likely 400)
[patterns] fetched M recent patterns for dedup
[patterns] done {"ok":true,"edges":400,"recents":0}
```

If it errors with missing env vars, add `ANTHROPIC_API_KEY` to `.env` before continuing. (The API will not be called until Task 4.)

- [ ] **Step 3: Commit**

```bash
git add etl/patterns/detectFundingPatterns.js
git commit -m "feat(etl): scaffold detectFundingPatterns script with data fetching"
```

---

## Task 4: Pattern detection — Claude SDK call + tool schema + validation

**Files:**
- Modify: `etl/patterns/detectFundingPatterns.js`

> This task makes a real Claude API call. Make sure `ANTHROPIC_API_KEY` is set in your `.env` before running.

- [ ] **Step 1: Add tool schema constant near the top of the file** (after `const MAX_TOKENS = 5000`)

```javascript
const TOOL_SCHEMA = {
  name: 'extract_funding_patterns',
  description: 'Extract non-obvious money flow patterns from campaign-finance edge data.',
  input_schema: {
    type: 'object',
    properties: {
      patterns: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'narrative', 'explanation', 'pattern_type', 'node_ids', 'severity_score', 'sector'],
          properties: {
            title:          { type: 'string', maxLength: 90 },
            narrative:      { type: 'string', maxLength: 280 },
            explanation:    { type: 'string', maxLength: 800 },
            pattern_type:   { type: 'string', enum: ['sector_concentration', 'dark_money_pathway', 'committee_alignment', 'sudden_surge'] },
            sector:         { type: 'string' },
            node_ids:       { type: 'array', minItems: 3, items: { type: 'string' } },
            severity_score: { type: 'integer', minimum: 0, maximum: 10 }
          }
        }
      }
    },
    required: ['patterns']
  }
}
```

- [ ] **Step 2: Add helpers to build node IDs and compact the edge table**

Insert after `fetchRecentPatterns`:

```javascript
function nodeId(type, id) {
  if (type === 'employer') return `emp:${id}`
  if (type === 'politician' || type === 'candidate') return `pol:${id}`
  return `cmt:${id}`
}

function formatEdgesForPrompt(edges) {
  const rows = edges.map(e => {
    const src = nodeId(e.source_type, e.source_id)
    const tgt = nodeId(e.target_type, e.target_id)
    const amt = Math.round(Number(e.amount) || 0).toLocaleString()
    return `${src}\t${e.source_label || '?'}\t→\t${tgt}\t${e.target_label || '?'}\t$${amt}\t(${e.txn_count || 0} txns)`
  })
  return rows.join('\n')
}

function formatRecentsForPrompt(recents) {
  if (!recents.length) return '(none — first run of the window)'
  return recents.map(r => `- [${r.pattern_type}] ${r.title} (sector: ${r.sector || 'n/a'})`).join('\n')
}
```

- [ ] **Step 3: Add Claude call function**

Insert after `formatRecentsForPrompt`:

```javascript
async function callClaude({ systemPrompt, edges, recents, cycle }) {
  const userPrompt = [
    `# Cycle`,
    cycle,
    ``,
    `# Recent patterns (last ${DEDUP_WINDOW_DAYS}d — do not duplicate)`,
    formatRecentsForPrompt(recents),
    ``,
    `# Top money flow edges (descending by amount)`,
    `Columns: source_id · source_label · → · target_id · target_label · amount · (txn count)`,
    ``,
    formatEdgesForPrompt(edges),
    ``,
    `# Task`,
    `Analyze the edges above. Extract patterns matching the types defined in your system prompt. Call extract_funding_patterns with your final output.`
  ].join('\n')

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' }   // prompt-cache breakpoint: system block stable across weekly runs
      }
    ],
    tools: [TOOL_SCHEMA],
    tool_choice: { type: 'tool', name: TOOL_SCHEMA.name },
    messages: [{ role: 'user', content: userPrompt }]
  })

  const toolUse = res.content.find(b => b.type === 'tool_use' && b.name === TOOL_SCHEMA.name)
  if (!toolUse) throw new Error('Claude did not return a tool_use block')
  return {
    patterns: toolUse.input?.patterns ?? [],
    usage: res.usage
  }
}
```

- [ ] **Step 4: Add validator**

Insert after `callClaude`:

```javascript
/**
 * Rejects patterns with: unknown node_ids, fewer than 3 nodes, invalid severity,
 * or sector mismatch. Returns { valid, rejected } arrays.
 */
function validatePatterns(patterns, edges) {
  const knownIds = new Set()
  edges.forEach(e => {
    knownIds.add(nodeId(e.source_type, e.source_id))
    knownIds.add(nodeId(e.target_type, e.target_id))
  })

  const valid = []
  const rejected = []
  for (const p of patterns) {
    const reasons = []
    if (!p.node_ids || p.node_ids.length < 3) reasons.push('too_few_nodes')
    const unknown = (p.node_ids || []).filter(id => !knownIds.has(id))
    if (unknown.length > 0) reasons.push(`unknown_nodes:${unknown.slice(0, 3).join(',')}`)
    if (p.severity_score < 0 || p.severity_score > 10) reasons.push('bad_severity')
    if (!p.pattern_type) reasons.push('missing_pattern_type')
    if (!p.sector) reasons.push('missing_sector')
    if (reasons.length) rejected.push({ pattern: p, reasons })
    else valid.push(p)
  }
  return { valid, rejected }
}
```

- [ ] **Step 5: Update `main()` to load system prompt + call Claude + validate**

Replace the existing `main()` with:

```javascript
async function main() {
  console.log(`[patterns] starting detection for cycle=${CYCLE}`)
  const edges = await fetchTopEdges(CYCLE)
  console.log(`[patterns] fetched ${edges.length} top edges`)
  if (edges.length < 20) {
    console.log('[patterns] insufficient data; skipping')
    return { ok: true, skipped: true, reason: 'insufficient_data' }
  }
  const recents = await fetchRecentPatterns(CYCLE)
  console.log(`[patterns] fetched ${recents.length} recent patterns`)

  const systemPrompt = await fs.readFile(path.join(__dirname, 'prompts', 'system.md'), 'utf8')

  console.log('[patterns] calling Claude…')
  const { patterns, usage } = await callClaude({ systemPrompt, edges, recents, cycle: CYCLE })
  console.log(`[patterns] Claude returned ${patterns.length} candidate patterns (input: ${usage.input_tokens}, output: ${usage.output_tokens})`)

  const { valid, rejected } = validatePatterns(patterns, edges)
  if (rejected.length) {
    console.warn(`[patterns] rejected ${rejected.length} patterns:`, rejected.map(r => `${r.pattern.title}: ${r.reasons.join(',')}`))
  }
  console.log(`[patterns] ${valid.length} patterns passed validation`)

  // Steps 6-8 (dedup, upsert, log) added in Task 5
  return { ok: true, edges: edges.length, candidates: patterns.length, valid: valid.length, rejected: rejected.length }
}
```

- [ ] **Step 6: Run end-to-end (no DB writes yet)**

Run:
```bash
node etl/patterns/detectFundingPatterns.js --cycle 2024
```

Expected: script completes in 20-60 seconds. Claude returns some number of candidate patterns. Log shows how many passed validation. Inspect the output — do the patterns look factually plausible? If many are rejected with `unknown_nodes`, the prompt may need a tweak (e.g., emphasize "use IDs verbatim from input").

- [ ] **Step 7: Commit**

```bash
git add etl/patterns/detectFundingPatterns.js
git commit -m "feat(etl): add Claude Sonnet 4.6 pattern detection with forced tool use"
```

---

## Task 5: Pattern detection — dedup, UPSERT, logging, budget guardrail

**Files:**
- Modify: `etl/patterns/detectFundingPatterns.js`

- [ ] **Step 1: Add a fuzzy title dedup helper**

Insert after `validatePatterns`:

```javascript
function normalizeTitle(s) {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim()
}

function levenshtein(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const v0 = new Array(b.length + 1).fill(0).map((_, i) => i)
  const v1 = new Array(b.length + 1).fill(0)
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost)
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j]
  }
  return v1[b.length]
}

function dedupAgainstRecents(patterns, recents) {
  const kept = []
  const dropped = []
  for (const p of patterns) {
    const np = normalizeTitle(p.title)
    const dup = recents.find(r => {
      const nr = normalizeTitle(r.title)
      if (nr === np) return true
      if (Math.abs(nr.length - np.length) > 5) return false
      return levenshtein(nr, np) <= 3
    })
    if (dup) dropped.push({ pattern: p, duplicateOf: dup.id })
    else kept.push(p)
  }
  return { kept, dropped }
}
```

- [ ] **Step 2: Add evidence enrichment helper**

Insert after `dedupAgainstRecents`:

```javascript
/**
 * For each valid pattern, attach the specific edges from the input whose
 * source or target appears in node_ids. Limited to top 25 edges by amount.
 */
function enrichPatterns(patterns, edges) {
  return patterns.map(p => {
    const ids = new Set(p.node_ids)
    const evidence = edges
      .filter(e => ids.has(nodeId(e.source_type, e.source_id)) || ids.has(nodeId(e.target_type, e.target_id)))
      .sort((a, b) => (b.amount || 0) - (a.amount || 0))
      .slice(0, 25)
      .map(e => ({
        source: nodeId(e.source_type, e.source_id),
        source_label: e.source_label,
        target: nodeId(e.target_type, e.target_id),
        target_label: e.target_label,
        amount: Number(e.amount) || 0
      }))
    return { ...p, evidence: { edges: evidence } }
  })
}
```

- [ ] **Step 3: Add UPSERT function**

Insert after `enrichPatterns`:

```javascript
async function upsertPatterns(patterns, cycle) {
  if (!patterns.length) return { inserted: 0 }
  const rows = patterns.map(p => ({
    pattern_type:   p.pattern_type,
    title:          p.title,
    narrative:      p.narrative,
    explanation:    p.explanation,
    sector:         p.sector,
    node_ids:       p.node_ids,
    evidence:       p.evidence,
    cycle,
    severity_score: p.severity_score,
    generated_by:   MODEL,
    visible:        true
  }))
  const { data, error } = await supabase
    .from('funding_flow_patterns')
    .insert(rows)
    .select('id')
  if (error) throw error
  return { inserted: data?.length ?? 0 }
}
```

- [ ] **Step 4: Add log-writer**

Insert after `upsertPatterns`:

```javascript
async function writeLog(summary) {
  const today = new Date().toISOString().slice(0, 10)
  const logPath = path.join(__dirname, 'logs', `${today}.json`)
  await fs.writeFile(logPath, JSON.stringify(summary, null, 2) + '\n', 'utf8')
  console.log(`[patterns] wrote log to ${logPath}`)
}
```

- [ ] **Step 5: Finalize `main()`**

Replace the existing `main()` with:

```javascript
async function main() {
  const startedAt = new Date().toISOString()
  console.log(`[patterns] starting detection for cycle=${CYCLE} at ${startedAt}`)

  const edges = await fetchTopEdges(CYCLE)
  console.log(`[patterns] fetched ${edges.length} top edges`)
  if (edges.length < 20) {
    const summary = { ok: true, skipped: true, reason: 'insufficient_data', edges: edges.length }
    await writeLog({ startedAt, finishedAt: new Date().toISOString(), ...summary })
    return summary
  }

  const recents = await fetchRecentPatterns(CYCLE)
  const systemPrompt = await fs.readFile(path.join(__dirname, 'prompts', 'system.md'), 'utf8')

  console.log('[patterns] calling Claude…')
  const { patterns, usage } = await callClaude({ systemPrompt, edges, recents, cycle: CYCLE })
  console.log(`[patterns] got ${patterns.length} candidate patterns (in: ${usage.input_tokens}, cached: ${usage.cache_read_input_tokens || 0}, out: ${usage.output_tokens})`)

  const { valid, rejected } = validatePatterns(patterns, edges)
  const { kept, dropped } = dedupAgainstRecents(valid, recents)
  const enriched = enrichPatterns(kept, edges)
  const { inserted } = await upsertPatterns(enriched, CYCLE)

  const summary = {
    ok: true,
    startedAt,
    finishedAt: new Date().toISOString(),
    cycle: CYCLE,
    edges: edges.length,
    recents: recents.length,
    candidates: patterns.length,
    validated: valid.length,
    rejected: rejected.length,
    deduped: dropped.length,
    inserted,
    usage
  }
  await writeLog(summary)
  console.log('[patterns] summary:', JSON.stringify(summary, null, 2))
  return summary
}
```

- [ ] **Step 6: Run end-to-end — real DB write**

Run:
```bash
node etl/patterns/detectFundingPatterns.js --cycle 2024
```

Expected: completes in 30-60 seconds, log file written to `etl/patterns/logs/YYYY-MM-DD.json`, and `inserted` > 0.

Verify in Supabase:
```bash
npx supabase db remote sql "SELECT COUNT(*), pattern_type FROM funding_flow_patterns GROUP BY pattern_type;"
```

Expected: counts per pattern type (sector_concentration, dark_money_pathway, etc.).

- [ ] **Step 7: Inspect patterns for factual accuracy**

Run:
```bash
npx supabase db remote sql "SELECT title, pattern_type, sector, severity_score FROM funding_flow_patterns ORDER BY generated_at DESC LIMIT 10;"
```

Manually verify 3-5 patterns: do the stated nodes actually exist? Does the narrative match observable edges? If anything looks hallucinated, tune the system prompt and re-run.

- [ ] **Step 8: Commit**

```bash
git add etl/patterns/detectFundingPatterns.js
git commit -m "feat(etl): dedup, validate, enrich, and upsert detected patterns"
```

---

## Task 6: Vercel cron handler (Express route)

**Files:**
- Create: `server/routes/cron.js`
- Modify: `server/app.js`
- Modify: `vercel.json`

- [ ] **Step 1: Create the cron router**

Create `server/routes/cron.js`:

```javascript
/**
 * server/routes/cron.js
 *
 * Endpoints hit by Vercel Cron. Each route auth-checks a shared secret header.
 * Long-running jobs are spawned asynchronously and respond 202 immediately.
 */
import express from 'express'
import { spawn } from 'node:child_process'
import path from 'node:path'

const router = express.Router()

function requireCronAuth(req, res, next) {
  const secret = process.env.CRON_AUTH_SECRET
  if (!secret) return next()                              // auth not configured — skip in dev
  const got = req.header('x-cron-secret') || req.query.secret
  if (got !== secret) return res.status(401).json({ error: 'unauthorized' })
  return next()
}

router.post('/detect-funding-patterns', requireCronAuth, (req, res) => {
  if (process.env.GALAXY_AI_ENABLED !== 'true') {
    return res.status(200).json({ ok: true, skipped: true, reason: 'galaxy_ai_disabled' })
  }
  const cycle = req.query.cycle || process.env.PATTERN_CYCLE || '2024'
  const scriptPath = path.resolve('etl/patterns/detectFundingPatterns.js')
  const child = spawn('node', [scriptPath, '--cycle', cycle], {
    stdio: 'ignore',
    detached: true,
    env: process.env
  })
  child.unref()
  return res.status(202).json({ ok: true, queued: true, cycle, pid: child.pid })
})

export default router
```

- [ ] **Step 2: Mount the router in server/app.js**

Find the section where other routers are mounted (search for `app.use('/api/`). Add:

```javascript
import cronRouter from './routes/cron.js'
// ...existing imports...

app.use('/api/cron', cronRouter)
```

- [ ] **Step 3: Register the cron in vercel.json**

Find `vercel.json` and add to the `crons` array:

```json
{
  "path": "/api/cron/detect-funding-patterns",
  "schedule": "0 7 * * 0"
}
```

(Sundays at 07:00 UTC.)

- [ ] **Step 4: Smoke-test locally**

Start the full stack:
```bash
npm run dev:all
```

In another shell:
```bash
curl -X POST http://127.0.0.1:3001/api/cron/detect-funding-patterns
```

Expected: `{"ok":true,"skipped":true,"reason":"galaxy_ai_disabled"}` (because `GALAXY_AI_ENABLED` is not set to `true` yet).

Set `GALAXY_AI_ENABLED=true` in `.env`, restart, and re-curl. Expected: `{"ok":true,"queued":true,"cycle":"2024","pid":NNNN}`. Check terminal output for the ETL script logs.

- [ ] **Step 5: Commit**

```bash
git add server/routes/cron.js server/app.js vercel.json
git commit -m "feat(server): add Vercel cron route for weekly pattern detection"
```

---

# Phase 2 — API Layer

## Task 7: galaxyService.js — shared helpers + getUniverse

**Files:**
- Create: `server/services/galaxyService.js`

- [ ] **Step 1: Create the service with node ID helpers**

Create `server/services/galaxyService.js`:

```javascript
/**
 * server/services/galaxyService.js
 *
 * Builds Funding Flow Galaxy responses from money_flow_edges + funding_flow_patterns.
 * Returns { nodes, edges, sectors, patterns, meta } envelopes per the API contract.
 */
import { ensure } from '../lib/supabase.js'

const SECTOR_COLORS = {
  'Finance':               '#4A7FFF',
  'Technology':            '#00AADD',
  'Healthcare':            '#44CC88',
  'Energy':                '#FFB84D',
  'Legal':                 '#CC88FF',
  'Real Estate':           '#FF8C42',
  'Defense':               '#FF4466',
  'Media & Entertainment': '#FF66AA',
  'Education':             '#66CCFF',
  'Labor / Unions':        '#FFDD44',
  'Consulting':            '#88BBFF',
  'Government / Politics': '#FF8844',
  'Retired / Inactive':    '#666666',
  'Other':                 '#444444'
}

export function nodeId(type, id) {
  if (type === 'employer') return `emp:${id}`
  if (type === 'politician' || type === 'candidate') return `pol:${id}`
  return `cmt:${id}`
}

/**
 * Given raw money_flow_edges rows, build the galaxy envelope.
 * is501c4 / isSuperPac are looked up from the accompanying committees map.
 */
export function buildEnvelope({ edges, committees, cycle, source = 'supabase' }) {
  const nodesMap = new Map()
  const degreeMap = new Map()
  const sectorTotals = new Map()
  let maxAmount = 0

  function upsertNode(type, id, label, sector, tier) {
    const nid = nodeId(type, id)
    if (!nodesMap.has(nid)) {
      const committee = committees.get(id)
      const kind =
        type === 'employer' ? 'employer' :
        type === 'politician' || type === 'candidate' ? 'politician' :
        committee?.is_super_pac ? 'super_pac' :
        committee?.is_501c4 ? 'dark_money' :
        'trad_pac'
      nodesMap.set(nid, {
        id: nid, kind, label: label || id,
        sector: sector || committee?.sector || null,
        amount: 0, degree: 0,
        is_501c4:   !!committee?.is_501c4,
        is_super_pac: !!committee?.is_super_pac,
        tier: Number(tier) || null
      })
    }
    return nid
  }

  const builtEdges = []
  for (const e of edges) {
    const s = upsertNode(e.source_type, e.source_id, e.source_label, e.source_sector, e.source_tier)
    const t = upsertNode(e.target_type, e.target_id, e.target_label, e.target_sector, e.target_tier)
    const amt = Number(e.amount) || 0
    const sn = nodesMap.get(s), tn = nodesMap.get(t)
    sn.amount += amt; tn.amount += amt
    degreeMap.set(s, (degreeMap.get(s) || 0) + 1)
    degreeMap.set(t, (degreeMap.get(t) || 0) + 1)
    if (amt > maxAmount) maxAmount = amt
    builtEdges.push({
      source: s, target: t, amount: amt,
      weight: 0,                                          // filled after maxAmount known
      tier_from: Number(e.source_tier) || null,
      tier_to:   Number(e.target_tier) || null
    })
    const sec = sn.sector || tn.sector
    if (sec) sectorTotals.set(sec, (sectorTotals.get(sec) || 0) + amt)
  }

  for (const edge of builtEdges) edge.weight = maxAmount > 0 ? edge.amount / maxAmount : 0
  for (const node of nodesMap.values()) node.degree = degreeMap.get(node.id) || 0

  const sectors = Array.from(sectorTotals.entries())
    .map(([name, total_amount]) => ({
      name,
      color: SECTOR_COLORS[name] || '#444444',
      node_count: Array.from(nodesMap.values()).filter(n => n.sector === name).length,
      total_amount
    }))
    .sort((a, b) => b.total_amount - a.total_amount)

  return {
    nodes: Array.from(nodesMap.values()),
    edges: builtEdges,
    sectors,
    patterns: [],                                         // callers attach patterns when applicable
    meta: {
      cycle,
      generated_at: new Date().toISOString(),
      node_count: nodesMap.size,
      edge_count: builtEdges.length,
      source
    }
  }
}

/**
 * Fetch committee metadata for a set of committee IDs in one query.
 */
async function loadCommittees(db, committeeIds) {
  if (!committeeIds.length) return new Map()
  const { data, error } = await db
    .from('pac_committees')
    .select('committee_id, committee_name, is_501c4, is_super_pac, connected_org_name, sector')
    .in('committee_id', committeeIds)
  if (error) throw error
  const map = new Map()
  for (const c of data || []) map.set(c.committee_id, c)
  return map
}

function collectCommitteeIds(edges) {
  const ids = new Set()
  for (const e of edges) {
    if (e.source_type !== 'employer' && e.source_type !== 'politician' && e.source_type !== 'candidate') ids.add(e.source_id)
    if (e.target_type !== 'employer' && e.target_type !== 'politician' && e.target_type !== 'candidate') ids.add(e.target_id)
  }
  return Array.from(ids)
}

async function loadPatterns(db, cycle) {
  const { data, error } = await db
    .from('funding_flow_patterns')
    .select('id, pattern_type, title, narrative, explanation, sector, severity_score, node_ids, generated_at')
    .eq('cycle', cycle)
    .eq('visible', true)
    .order('generated_at', { ascending: false })
    .limit(30)
  if (error) throw error
  return data ?? []
}

/**
 * Universe mode — top N nodes across the whole cycle.
 */
export async function getUniverse({ cycle = '2024', nodeCap = 500 } = {}) {
  const db = ensure()
  const { data: edges, error } = await db
    .from('money_flow_edges')
    .select('source_id, source_type, source_tier, source_label, target_id, target_type, target_tier, target_label, amount, txn_count, cycle')
    .eq('cycle', cycle)
    .gt('amount', 0)
    .order('amount', { ascending: false })
    .limit(nodeCap * 3)                                   // each edge = 2 nodes; oversample to hit node cap after dedup
  if (error) throw error

  const committees = await loadCommittees(db, collectCommitteeIds(edges || []))
  const envelope = buildEnvelope({ edges: edges || [], committees, cycle })

  if (envelope.nodes.length > nodeCap) {
    const topNodeIds = new Set(
      [...envelope.nodes].sort((a, b) => b.amount - a.amount).slice(0, nodeCap).map(n => n.id)
    )
    envelope.nodes = envelope.nodes.filter(n => topNodeIds.has(n.id))
    envelope.edges = envelope.edges.filter(e => topNodeIds.has(e.source) && topNodeIds.has(e.target))
    envelope.meta.node_count = envelope.nodes.length
    envelope.meta.edge_count = envelope.edges.length
  }

  if (process.env.GALAXY_AI_ENABLED === 'true') {
    envelope.patterns = await loadPatterns(db, cycle)
  }
  return envelope
}
```

- [ ] **Step 2: Quick smoke check via REPL**

Run:
```bash
node --experimental-vm-modules -e "import('./server/services/galaxyService.js').then(async m => { const env = await m.getUniverse({ cycle: '2024' }); console.log('nodes:', env.meta.node_count, 'edges:', env.meta.edge_count, 'sectors:', env.sectors.length, 'patterns:', env.patterns.length); })"
```

Expected: prints node count (≤500), edge count, sector count (~14), and patterns count (0 unless `GALAXY_AI_ENABLED=true`).

- [ ] **Step 3: Commit**

```bash
git add server/services/galaxyService.js
git commit -m "feat(api): galaxyService with getUniverse + buildEnvelope"
```

---

## Task 8: galaxyService.js — getSector + getEmployer + getPatternDetail

**Files:**
- Modify: `server/services/galaxyService.js`

- [ ] **Step 1: Add getSector**

Append to `server/services/galaxyService.js`:

```javascript
/**
 * Sector mode — all edges where either end's sector matches.
 */
export async function getSector({ cycle = '2024', sector, nodeCap = 80 } = {}) {
  if (!sector) throw new Error('sector is required')
  const db = ensure()

  // Sector filter: employer sector OR committee sector
  const { data: edges, error } = await db
    .from('money_flow_edges')
    .select('source_id, source_type, source_tier, source_label, source_sector, target_id, target_type, target_tier, target_label, target_sector, amount, txn_count, cycle')
    .eq('cycle', cycle)
    .or(`source_sector.eq.${sector},target_sector.eq.${sector}`)
    .gt('amount', 0)
    .order('amount', { ascending: false })
    .limit(nodeCap * 3)
  if (error) throw error

  const committees = await loadCommittees(db, collectCommitteeIds(edges || []))
  const envelope = buildEnvelope({ edges: edges || [], committees, cycle })

  if (envelope.nodes.length > nodeCap) {
    const topNodeIds = new Set(
      [...envelope.nodes].sort((a, b) => b.amount - a.amount).slice(0, nodeCap).map(n => n.id)
    )
    envelope.nodes = envelope.nodes.filter(n => topNodeIds.has(n.id))
    envelope.edges = envelope.edges.filter(e => topNodeIds.has(e.source) && topNodeIds.has(e.target))
    envelope.meta.node_count = envelope.nodes.length
    envelope.meta.edge_count = envelope.edges.length
  }
  envelope.meta.scope = { mode: 'sector', sector }
  return envelope
}
```

- [ ] **Step 2: Add getEmployer**

Append:

```javascript
/**
 * Employer mode — network around a single employer.
 * Walks 2 hops: employer → committees → politicians.
 */
export async function getEmployer({ cycle = '2024', employerId, nodeCap = 40 } = {}) {
  if (!employerId) throw new Error('employerId is required')
  const db = ensure()

  // Hop 1: employer → committee
  const { data: hop1, error: e1 } = await db
    .from('money_flow_edges')
    .select('source_id, source_type, source_tier, source_label, target_id, target_type, target_tier, target_label, amount, txn_count, cycle')
    .eq('cycle', cycle)
    .eq('source_type', 'employer')
    .eq('source_id', employerId)
    .gt('amount', 0)
    .order('amount', { ascending: false })
    .limit(50)
  if (e1) throw e1
  const committeeIds = Array.from(new Set((hop1 || []).map(e => e.target_id)))

  // Hop 2: committee → politician (only for committees the employer touches)
  let hop2 = []
  if (committeeIds.length) {
    const { data, error } = await db
      .from('money_flow_edges')
      .select('source_id, source_type, source_tier, source_label, target_id, target_type, target_tier, target_label, amount, txn_count, cycle')
      .eq('cycle', cycle)
      .in('source_id', committeeIds)
      .gt('amount', 0)
      .order('amount', { ascending: false })
      .limit(100)
    if (error) throw error
    hop2 = data || []
  }

  const edges = [...(hop1 || []), ...hop2]
  const committees = await loadCommittees(db, collectCommitteeIds(edges))
  const envelope = buildEnvelope({ edges, committees, cycle })

  if (envelope.nodes.length > nodeCap) {
    // Keep the employer + its committees + top politicians; trim the rest
    const keep = new Set()
    keep.add(nodeId('employer', employerId))
    for (const id of committeeIds) keep.add(nodeId('committee', id))
    const sortedPols = envelope.nodes
      .filter(n => n.kind === 'politician')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, nodeCap - keep.size)
    for (const p of sortedPols) keep.add(p.id)
    envelope.nodes = envelope.nodes.filter(n => keep.has(n.id))
    envelope.edges = envelope.edges.filter(e => keep.has(e.source) && keep.has(e.target))
    envelope.meta.node_count = envelope.nodes.length
    envelope.meta.edge_count = envelope.edges.length
  }
  envelope.meta.scope = { mode: 'employer', employerId }
  return envelope
}
```

- [ ] **Step 3: Add getPatternDetail**

Append:

```javascript
/**
 * Pattern detail mode — returns the pattern + its fully expanded evidence
 * nodes/edges by looking up each node_id in money_flow_edges.
 */
export async function getPatternDetail({ patternId } = {}) {
  if (!patternId) throw new Error('patternId is required')
  const db = ensure()

  const { data: pattern, error: pe } = await db
    .from('funding_flow_patterns')
    .select('*')
    .eq('id', patternId)
    .eq('visible', true)
    .maybeSingle()
  if (pe) throw pe
  if (!pattern) return null

  // Parse node_ids into {type,id} then fetch matching edges
  const parsed = (pattern.node_ids || []).map(nid => {
    const [prefix, rawId] = nid.split(':', 2)
    const type = prefix === 'emp' ? 'employer' : prefix === 'pol' ? 'candidate' : 'committee'
    return { type, id: rawId, nid }
  })
  const employerIds  = parsed.filter(p => p.type === 'employer').map(p => p.id)
  const committeeIds = parsed.filter(p => p.type === 'committee').map(p => p.id)
  const politicianIds = parsed.filter(p => p.type === 'candidate').map(p => p.id)

  // Union query: edges touching any of the involved IDs (limited for safety)
  const { data: edges, error: ee } = await db
    .from('money_flow_edges')
    .select('source_id, source_type, source_tier, source_label, source_sector, target_id, target_type, target_tier, target_label, target_sector, amount, cycle')
    .eq('cycle', pattern.cycle)
    .or([
      employerIds.length  ? `and(source_type.eq.employer,source_id.in.(${employerIds.map(x => `"${x}"`).join(',')}))` : null,
      committeeIds.length ? `source_id.in.(${committeeIds.map(x => `"${x}"`).join(',')})` : null,
      committeeIds.length ? `target_id.in.(${committeeIds.map(x => `"${x}"`).join(',')})` : null,
      politicianIds.length ? `and(target_type.in.("politician","candidate"),target_id.in.(${politicianIds.map(x => `"${x}"`).join(',')}))` : null
    ].filter(Boolean).join(','))
    .gt('amount', 0)
    .order('amount', { ascending: false })
    .limit(200)
  if (ee) throw ee

  const committees = await loadCommittees(db, collectCommitteeIds(edges || []))
  const envelope = buildEnvelope({ edges: edges || [], committees, cycle: pattern.cycle })
  return { pattern, evidence: { nodes: envelope.nodes, edges: envelope.edges } }
}
```

- [ ] **Step 4: Commit**

```bash
git add server/services/galaxyService.js
git commit -m "feat(api): add getSector, getEmployer, getPatternDetail to galaxyService"
```

---

## Task 9: galaxy.js router + feature flag + mount

**Files:**
- Create: `server/routes/galaxy.js`
- Modify: `server/app.js`

- [ ] **Step 1: Create the router**

Create `server/routes/galaxy.js`:

```javascript
/**
 * server/routes/galaxy.js
 *
 * Funding Flow Galaxy API. Gated by GALAXY_ENABLED env. Returns 404 when
 * disabled so the feature flag flip is zero-redeploy.
 */
import express from 'express'
import {
  getUniverse,
  getSector,
  getEmployer,
  getPatternDetail
} from '../services/galaxyService.js'

const router = express.Router()

router.use((req, res, next) => {
  if (process.env.GALAXY_ENABLED !== 'true') {
    return res.status(404).json({ error: 'galaxy_disabled' })
  }
  next()
})

function wrap(fn) {
  return async (req, res) => {
    try {
      const result = await fn(req)
      if (result == null) return res.status(404).json({ error: 'not_found' })
      res.json(result)
    } catch (e) {
      console.error('[galaxy]', req.method, req.originalUrl, e.message)
      res.status(500).json({ error: 'galaxy_error', message: e.message })
    }
  }
}

router.get('/universe', wrap(req => getUniverse({
  cycle:  req.query.cycle  || '2024',
  nodeCap: Number(req.query.limit) || 500
})))

router.get('/sector/:sector', wrap(req => getSector({
  cycle:   req.query.cycle || '2024',
  sector:  decodeURIComponent(req.params.sector),
  nodeCap: Number(req.query.limit) || 80
})))

router.get('/employer/:employerId', wrap(req => getEmployer({
  cycle:      req.query.cycle || '2024',
  employerId: decodeURIComponent(req.params.employerId),
  nodeCap:    Number(req.query.limit) || 40
})))

router.get('/patterns/:id', wrap(req => getPatternDetail({ patternId: req.params.id })))

export default router
```

- [ ] **Step 2: Mount the router in server/app.js**

Near the other `app.use('/api/...')` lines, add:

```javascript
import galaxyRouter from './routes/galaxy.js'
// ...
app.use('/api/galaxy', galaxyRouter)
```

- [ ] **Step 3: Smoke-test with flag OFF**

```bash
npm run dev:all
```

```bash
curl -i http://127.0.0.1:3001/api/galaxy/universe
```

Expected: `HTTP/1.1 404 Not Found` and body `{"error":"galaxy_disabled"}`.

- [ ] **Step 4: Smoke-test with flag ON**

Set `GALAXY_ENABLED=true` in `.env`, restart server.

```bash
curl -s http://127.0.0.1:3001/api/galaxy/universe?cycle=2024 | node -e "const r = JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('nodes:', r.meta.node_count, 'edges:', r.meta.edge_count, 'sectors:', r.sectors.length, 'patterns:', r.patterns.length);"
```

Expected: reasonable node/edge counts. If you already ran Task 5 end-to-end, `patterns.length` should be > 0 (provided `GALAXY_AI_ENABLED=true`).

- [ ] **Step 5: Commit**

```bash
git add server/routes/galaxy.js server/app.js
git commit -m "feat(api): mount /api/galaxy router behind GALAXY_ENABLED flag"
```

---

## Task 10: API contract verifier script

**Files:**
- Create: `scripts/verify-galaxy-api.js`

- [ ] **Step 1: Create the verifier**

Create `scripts/verify-galaxy-api.js`:

```javascript
#!/usr/bin/env node
/**
 * scripts/verify-galaxy-api.js
 *
 * Hits each /api/galaxy endpoint and asserts response shape matches the
 * spec (docs/superpowers/specs/2026-04-27-funding-flow-galaxy-design.md §7).
 *
 * Requires: server running (npm run dev:server) with GALAXY_ENABLED=true.
 * Usage: node scripts/verify-galaxy-api.js [baseUrl]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:3001'
let failures = 0
let passes = 0

function assert(cond, msg) {
  if (cond) { passes++; return }
  failures++
  console.error('  ✗', msg)
}

async function getJson(p) {
  const r = await fetch(`${BASE}${p}`)
  const body = await r.json().catch(() => ({}))
  return { status: r.status, body }
}

function assertEnvelope(env) {
  assert(Array.isArray(env.nodes), 'nodes is array')
  assert(Array.isArray(env.edges), 'edges is array')
  assert(Array.isArray(env.sectors), 'sectors is array')
  assert(Array.isArray(env.patterns), 'patterns is array')
  assert(env.meta && typeof env.meta.cycle === 'string', 'meta.cycle is string')
  assert(typeof env.meta.node_count === 'number', 'meta.node_count is number')
  assert(typeof env.meta.edge_count === 'number', 'meta.edge_count is number')
  for (const n of env.nodes.slice(0, 5)) {
    assert(typeof n.id === 'string' && /^(emp|cmt|pol):/.test(n.id), `node id prefixed: ${n.id}`)
    assert(['employer', 'trad_pac', 'dark_money', 'super_pac', 'politician'].includes(n.kind), `node kind valid: ${n.kind}`)
    assert(typeof n.label === 'string', 'node.label string')
    assert(typeof n.amount === 'number' && n.amount >= 0, 'node.amount number≥0')
    assert(typeof n.degree === 'number', 'node.degree number')
  }
  for (const e of env.edges.slice(0, 5)) {
    assert(typeof e.source === 'string', 'edge.source string')
    assert(typeof e.target === 'string', 'edge.target string')
    assert(typeof e.amount === 'number', 'edge.amount number')
    assert(typeof e.weight === 'number' && e.weight >= 0 && e.weight <= 1, 'edge.weight 0..1')
  }
}

async function main() {
  console.log(`[verify] base=${BASE}`)

  console.log('\n[GET /api/galaxy/universe?cycle=2024]')
  const u = await getJson('/api/galaxy/universe?cycle=2024')
  assert(u.status === 200, `universe status 200 (got ${u.status})`)
  if (u.status === 200) assertEnvelope(u.body)
  assert(u.body.meta?.node_count <= 500, 'universe nodes ≤ 500')

  const firstSector = u.body?.sectors?.[0]?.name
  if (firstSector) {
    console.log(`\n[GET /api/galaxy/sector/${firstSector}?cycle=2024]`)
    const s = await getJson(`/api/galaxy/sector/${encodeURIComponent(firstSector)}?cycle=2024`)
    assert(s.status === 200, `sector status 200 (got ${s.status})`)
    if (s.status === 200) assertEnvelope(s.body)
    assert(s.body.meta?.node_count <= 80, 'sector nodes ≤ 80')
  } else {
    console.warn('  (skip) no sectors returned by /universe')
  }

  const firstEmployer = u.body?.nodes?.find(n => n.kind === 'employer')
  if (firstEmployer) {
    const empId = firstEmployer.id.replace(/^emp:/, '')
    console.log(`\n[GET /api/galaxy/employer/${empId}?cycle=2024]`)
    const e = await getJson(`/api/galaxy/employer/${encodeURIComponent(empId)}?cycle=2024`)
    assert(e.status === 200, `employer status 200 (got ${e.status})`)
    if (e.status === 200) assertEnvelope(e.body)
    assert(e.body.meta?.node_count <= 40, 'employer nodes ≤ 40')
  } else {
    console.warn('  (skip) no employer node found in /universe')
  }

  const firstPattern = u.body?.patterns?.[0]
  if (firstPattern?.id) {
    console.log(`\n[GET /api/galaxy/patterns/${firstPattern.id}]`)
    const p = await getJson(`/api/galaxy/patterns/${firstPattern.id}`)
    assert(p.status === 200, `pattern status 200 (got ${p.status})`)
    assert(p.body?.pattern?.id === firstPattern.id, 'pattern id matches')
    assert(Array.isArray(p.body?.evidence?.nodes), 'evidence.nodes is array')
    assert(Array.isArray(p.body?.evidence?.edges), 'evidence.edges is array')
  } else {
    console.warn('  (skip) no patterns returned — GALAXY_AI_ENABLED=true and cron may not have run yet')
  }

  console.log(`\n[verify] ${passes} passed · ${failures} failed`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch(e => { console.error('[verify] FATAL', e); process.exit(2) })
```

- [ ] **Step 2: Run the verifier**

With server running and `GALAXY_ENABLED=true`:
```bash
node scripts/verify-galaxy-api.js
```

Expected: all assertions pass. If any fail, fix the underlying issue (usually in `galaxyService.js`), re-run. Iterate until `X passed · 0 failed`.

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-galaxy-api.js
git commit -m "chore(api): add galaxy API contract verifier script"
```

---

# Phase 3 — Frontend Foundation

## Task 11: galaxyTokens + useGalaxySurface + GalaxySurfaceToggle

**Files:**
- Create: `src/components/galaxy/lib/galaxyTokens.js`
- Create: `src/components/galaxy/hooks/useGalaxySurface.js`
- Create: `src/components/galaxy/GalaxySurfaceToggle.jsx`

- [ ] **Step 1: Create the theme tokens**

Create `src/components/galaxy/lib/galaxyTokens.js`:

```javascript
/**
 * Per-galaxy theme tokens. Read from the light/dark toggle.
 * Consumers NEVER hardcode hex; they read through these maps.
 */
export const galaxyTokens = {
  dark: {
    surface:          '#1D1D1D',
    surfaceSub:       '#161616',
    band:             '#001A7A',
    bandText:         '#FFFFFF',
    nodeFill:         '#1D1D1D',
    employerStroke:   '#FF8000',
    pacStroke:        '#FF8000',
    darkMoneyStroke:  '#FFB84D',
    superPacStroke:   '#FF8000',
    politicianFill:   '#4A7FFF',
    edgeBase:         '#FF8000',
    edgeBaseOpacity:  0.5,
    edgeBridgeColor:  '#888888',
    textPrimary:      '#FFFFFF',
    textMuted:        '#888888',
    textLow:          '#484848',
    panelBorder:      '#272727',
    patternRing:      '#FF8000',
    drawerBackdrop:   'rgba(0,0,0,0.55)'
  },
  light: {
    surface:          '#FAFAFA',
    surfaceSub:       '#F0F0F0',
    band:             '#001A7A',
    bandText:         '#FFFFFF',
    nodeFill:         '#FFFFFF',
    employerStroke:   '#FF8000',
    pacStroke:        '#FF8000',
    darkMoneyStroke:  '#B8860B',
    superPacStroke:   '#FF8000',
    politicianFill:   '#0028AA',
    edgeBase:         '#FF8000',
    edgeBaseOpacity:  0.65,
    edgeBridgeColor:  '#888888',
    textPrimary:      '#0D0D0D',
    textMuted:        '#484848',
    textLow:          '#8A8A8A',
    panelBorder:      '#D4D4D4',
    patternRing:      '#FF8000',
    drawerBackdrop:   'rgba(0,0,0,0.35)'
  }
}
```

- [ ] **Step 2: Create the hook**

Create `src/components/galaxy/hooks/useGalaxySurface.js`:

```javascript
import { useCallback, useEffect, useState } from 'react'

const KEY = 'unredacted:galaxy-surface'

function readInitial() {
  if (typeof window === 'undefined') return 'dark'
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch { /* no-op */ }
  // First-ever load: honor OS preference if present
  try {
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  } catch { /* no-op */ }
  return 'dark'
}

export default function useGalaxySurface() {
  const [surface, setSurface] = useState(readInitial)

  useEffect(() => {
    try { localStorage.setItem(KEY, surface) } catch { /* no-op */ }
  }, [surface])

  const toggle = useCallback(() => {
    setSurface(s => s === 'dark' ? 'light' : 'dark')
  }, [])

  return [surface, toggle]
}
```

- [ ] **Step 3: Create the toggle button**

Create `src/components/galaxy/GalaxySurfaceToggle.jsx`:

```jsx
import { galaxyTokens } from './lib/galaxyTokens.js'

export default function GalaxySurfaceToggle({ surface, onToggle, size = 20 }) {
  const t = galaxyTokens[surface]
  const next = surface === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      aria-label={`Switch galaxy to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={onToggle}
      style={{
        width: size + 8, height: size + 8,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent',
        border: `1px solid ${t.bandText}55`,
        color: t.bandText,
        cursor: 'pointer',
        padding: 0,
        fontSize: size - 4,
        lineHeight: 1
      }}
    >
      {surface === 'dark' ? '◐' : '☀'}
    </button>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/galaxy/lib/galaxyTokens.js src/components/galaxy/hooks/useGalaxySurface.js src/components/galaxy/GalaxySurfaceToggle.jsx
git commit -m "feat(galaxy): add theme tokens + surface toggle hook + button"
```

---

## Task 12: galaxyBuild.js — pure payload transforms

**Files:**
- Create: `src/components/galaxy/lib/galaxyBuild.js`

- [ ] **Step 1: Create the pure build functions**

Create `src/components/galaxy/lib/galaxyBuild.js`:

```javascript
/**
 * Pure functions: API envelope → D3 graph inputs.
 * No React, no DOM, no side effects. Easy to reason about in isolation.
 */

/**
 * Lays out per-sector centroids in a ring around the viewport center.
 */
export function computeCentroids(sectors, { width, height, radius } = {}) {
  const cx = (width ?? 800) / 2
  const cy = (height ?? 560) / 2
  const r  = radius ?? Math.min(cx, cy) * 0.65
  const n = Math.max(1, sectors.length)
  const map = new Map()
  sectors.forEach((s, i) => {
    const theta = (i / n) * Math.PI * 2 - Math.PI / 2
    map.set(s.name, { x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) })
  })
  map.set('__default__', { x: cx, y: cy })
  return map
}

/**
 * Assigns each node to a sector cluster by looking up node.sector or
 * falling back to __default__.
 */
export function assignClusters(nodes, centroids) {
  return nodes.map(n => ({
    ...n,
    cluster: n.sector && centroids.has(n.sector) ? n.sector : '__default__'
  }))
}

/**
 * Marks edges as "bridge" when source and target clusters differ.
 * D3's forceLink mutates source/target into node objects, so we keep
 * original string ids in `sourceId`/`targetId`.
 */
export function annotateEdges(edges, nodeById) {
  return edges.map(e => {
    const s = nodeById.get(e.source)
    const t = nodeById.get(e.target)
    const sameCluster = s?.cluster && t?.cluster && s.cluster === t.cluster
    return {
      sourceId: e.source,
      targetId: e.target,
      source: e.source,
      target: e.target,
      amount: e.amount,
      weight: e.weight,
      tier_from: e.tier_from,
      tier_to: e.tier_to,
      isBridge: !sameCluster
    }
  })
}

/**
 * Marks nodes that belong to a pattern's node_ids set so the galaxy can
 * highlight them on hover of a pattern flare.
 */
export function indexPatterns(patterns) {
  const nodeToPatterns = new Map()
  for (const p of patterns || []) {
    for (const nid of p.node_ids || []) {
      if (!nodeToPatterns.has(nid)) nodeToPatterns.set(nid, [])
      nodeToPatterns.get(nid).push(p.id)
    }
  }
  return nodeToPatterns
}

/**
 * One-call transform used by useGalaxyData.
 */
export function buildGraph(envelope, { width, height } = {}) {
  if (!envelope) return null
  const centroids = computeCentroids(envelope.sectors || [], { width, height })
  const nodes = assignClusters(envelope.nodes || [], centroids)
  const nodeById = new Map(nodes.map(n => [n.id, n]))
  const links = annotateEdges(envelope.edges || [], nodeById)
  const nodePatterns = indexPatterns(envelope.patterns || [])
  return { nodes, links, centroids, patterns: envelope.patterns || [], nodePatterns, sectors: envelope.sectors || [], meta: envelope.meta }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/galaxy/lib/galaxyBuild.js
git commit -m "feat(galaxy): pure buildGraph transforms for D3 inputs"
```

---

## Task 13: galaxyForces + useGalaxyData + api client methods

**Files:**
- Create: `src/components/galaxy/lib/galaxyForces.js`
- Create: `src/components/galaxy/hooks/useGalaxyData.js`
- Modify: `src/api/client.js`

- [ ] **Step 1: Create the forces module**

Create `src/components/galaxy/lib/galaxyForces.js`:

```javascript
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } from 'd3-force'

/**
 * Custom force: pulls each node toward its cluster centroid.
 * Strength defaults to 0.08; scaled by alpha each tick.
 */
export function clusterForce(getCentroid, strength = 0.08) {
  let nodes
  function force(alpha) {
    const k = strength * alpha
    for (const n of nodes) {
      const c = getCentroid(n)
      if (!c) continue
      n.vx += (c.x - n.x) * k
      n.vy += (c.y - n.y) * k
    }
  }
  force.initialize = _nodes => { nodes = _nodes }
  return force
}

/**
 * Compute node radius for D3 collision.
 */
export function nodeRadius(n) {
  const deg = n.degree || 0
  if (n.kind === 'employer')  return Math.max(12, Math.min(22, 9 + deg * 1.2))
  if (n.kind === 'politician') return Math.max(4,  Math.min(8,  3 + deg * 0.3))
  return Math.max(9,  Math.min(14, 7 + deg * 0.6))    // trad_pac, dark_money, super_pac
}

export function buildSimulation({ nodes, links, centroids, width, height }) {
  const getCentroid = n => centroids.get(n.cluster) || centroids.get('__default__')

  const sim = forceSimulation(nodes)
    .force('link', forceLink(links).id(n => n.id).distance(l => 60 + (1 - (l.weight || 0)) * 80).strength(l => 0.15 + (l.weight || 0) * 0.4))
    .force('charge', forceManyBody().strength(-80))
    .force('collide', forceCollide().radius(n => nodeRadius(n) + 2).strength(0.9))
    .force('cluster', clusterForce(getCentroid, 0.08))
    .force('x', forceX(width / 2).strength(0.02))
    .force('y', forceY(height / 2).strength(0.02))
    .alpha(1)
    .alphaDecay(0.028)

  // Run headless for 180 iterations to pre-stabilize
  for (let i = 0; i < 180; i++) sim.tick()
  return sim
}
```

- [ ] **Step 2: Create the data hook**

Create `src/components/galaxy/hooks/useGalaxyData.js`:

```javascript
import { useEffect, useRef, useState } from 'react'
import { galaxy } from '../../../api/client.js'

/**
 * Fetches the correct galaxy envelope for (mode, cycle, scope).
 * Cancellation-safe; returns { data, loading, error, refetch }.
 */
export default function useGalaxyData({ mode, cycle, sector, employerId }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const reqId = useRef(0)

  async function load() {
    const id = ++reqId.current
    setLoading(true); setError(null)
    try {
      let res
      if (mode === 'universe')      res = await galaxy.universe({ cycle })
      else if (mode === 'sector')   res = await galaxy.sector(sector, { cycle })
      else if (mode === 'employer') res = await galaxy.employer(employerId, { cycle })
      else throw new Error(`unknown galaxy mode: ${mode}`)
      if (id !== reqId.current) return                 // stale response
      setData(res?.data || null)
    } catch (e) {
      if (id !== reqId.current) return
      setError(e.message || String(e))
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }

  useEffect(() => {
    if (mode === 'sector'   && !sector) return
    if (mode === 'employer' && !employerId) return
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, cycle, sector, employerId])

  return { data, loading, error, refetch: load }
}
```

- [ ] **Step 3: Add galaxy methods to api client**

Find `src/api/client.js`. Locate the existing `donors` namespace. Add a new `galaxy` namespace in the same style:

```javascript
// --- Galaxy ---
export const galaxy = {
  universe: ({ cycle } = {}) => {
    const qs = new URLSearchParams({ ...(cycle && { cycle }) }).toString()
    return request(`/api/galaxy/universe${qs ? '?' + qs : ''}`)
  },
  sector: (sector, { cycle } = {}) => {
    const qs = new URLSearchParams({ ...(cycle && { cycle }) }).toString()
    return request(`/api/galaxy/sector/${encodeURIComponent(sector)}${qs ? '?' + qs : ''}`)
  },
  employer: (employerId, { cycle } = {}) => {
    const qs = new URLSearchParams({ ...(cycle && { cycle }) }).toString()
    return request(`/api/galaxy/employer/${encodeURIComponent(employerId)}${qs ? '?' + qs : ''}`)
  },
  pattern: (id) => request(`/api/galaxy/patterns/${encodeURIComponent(id)}`)
}
```

Also export it from the default export if the file has one (check the file end — mirror the `donors` export).

- [ ] **Step 4: Commit**

```bash
git add src/components/galaxy/lib/galaxyForces.js src/components/galaxy/hooks/useGalaxyData.js src/api/client.js
git commit -m "feat(galaxy): D3 force factory + data-fetching hook + galaxy API client"
```

---

# Phase 4 — Frontend Components

## Task 14: GalaxyGraph.jsx — node/edge rendering + legend

**Files:**
- Create: `src/components/galaxy/GalaxyLegend.jsx`
- Create: `src/components/galaxy/GalaxyGraph.jsx`

- [ ] **Step 1: Create the legend**

Create `src/components/galaxy/GalaxyLegend.jsx`:

```jsx
import { galaxyTokens } from './lib/galaxyTokens.js'

const LEGEND_ITEMS = [
  { kind: 'employer',    label: 'Employer',         shape: 'circle' },
  { kind: 'trad_pac',    label: 'Traditional PAC',  shape: 'circle' },
  { kind: 'dark_money',  label: '501(c)(4) dark money', shape: 'squareDashed' },
  { kind: 'super_pac',   label: 'Super PAC',        shape: 'diamond' },
  { kind: 'politician',  label: 'Politician',       shape: 'dot' }
]

function Glyph({ shape, t }) {
  if (shape === 'dot') return <circle cx="8" cy="8" r="4" fill={t.politicianFill} />
  if (shape === 'squareDashed')
    return <rect x="2" y="2" width="12" height="12" fill={t.nodeFill} stroke={t.darkMoneyStroke} strokeWidth="1.5" strokeDasharray="3,2" />
  if (shape === 'diamond')
    return <polygon points="8,2 14,8 8,14 2,8" fill={t.nodeFill} stroke={t.superPacStroke} strokeWidth="1.5" />
  return <circle cx="8" cy="8" r="5.5" fill={t.nodeFill} stroke={t.employerStroke} strokeWidth="1.5" />
}

export default function GalaxyLegend({ surface }) {
  const t = galaxyTokens[surface]
  return (
    <div style={{
      display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center',
      padding: '6px 12px', fontFamily: 'Roboto, sans-serif', fontSize: 9,
      color: t.textMuted, borderTop: `1px solid ${t.panelBorder}`, background: t.surface
    }}>
      {LEGEND_ITEMS.map(item => (
        <span key={item.kind} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="16" height="16"><Glyph shape={item.shape} t={t} /></svg>
          {item.label}
        </span>
      ))}
      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <svg width="32" height="8"><line x1="0" y1="4" x2="32" y2="4" stroke={t.edgeBase} strokeOpacity={t.edgeBaseOpacity} strokeWidth="2" /></svg>
        $ weight (thickness)
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Create the graph component — rendering only (no interactions yet)**

Create `src/components/galaxy/GalaxyGraph.jsx`:

```jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { buildGraph } from './lib/galaxyBuild.js'
import { buildSimulation, nodeRadius } from './lib/galaxyForces.js'
import { galaxyTokens } from './lib/galaxyTokens.js'

function strokeFor(kind, t) {
  if (kind === 'employer')   return t.employerStroke
  if (kind === 'trad_pac')   return t.pacStroke
  if (kind === 'dark_money') return t.darkMoneyStroke
  if (kind === 'super_pac')  return t.superPacStroke
  return null
}

function NodeShape({ n, t }) {
  const r = nodeRadius(n)
  if (n.kind === 'politician') {
    return <circle cx={n.x} cy={n.y} r={r} fill={t.politicianFill} />
  }
  if (n.kind === 'dark_money') {
    const s = r * 2
    return (
      <rect
        x={n.x - r} y={n.y - r} width={s} height={s}
        fill={t.nodeFill} stroke={t.darkMoneyStroke} strokeWidth={1.7} strokeDasharray="4,2"
      />
    )
  }
  if (n.kind === 'super_pac') {
    return (
      <polygon
        points={`${n.x},${n.y - r} ${n.x + r},${n.y} ${n.x},${n.y + r} ${n.x - r},${n.y}`}
        fill={t.nodeFill} stroke={t.superPacStroke} strokeWidth={1.7}
      />
    )
  }
  return (
    <circle
      cx={n.x} cy={n.y} r={r}
      fill={t.nodeFill} stroke={strokeFor(n.kind, t)} strokeWidth={n.kind === 'employer' ? 2 : 1.7}
    />
  )
}

export default function GalaxyGraph({
  envelope,
  surface = 'dark',
  width = 900,
  height = 560
}) {
  const t = galaxyTokens[surface]
  const svgRef = useRef(null)

  const graph = useMemo(() => buildGraph(envelope, { width, height }), [envelope, width, height])

  const [tick, setTick] = useState(0)
  const simRef = useRef(null)

  useEffect(() => {
    if (!graph) return
    const sim = buildSimulation({ nodes: graph.nodes, links: graph.links, centroids: graph.centroids, width, height })
    simRef.current = sim
    sim.on('tick', () => setTick(x => x + 1))
    return () => sim.stop()
  }, [graph, width, height])

  if (!graph) return <div style={{ padding: 40, color: t.textMuted, fontFamily: 'Roboto, sans-serif', fontSize: 11 }}>No galaxy data.</div>

  return (
    <svg ref={svgRef} width={width} height={height} style={{ display: 'block', background: t.surface }}>
      <g>
        {graph.links.map((l, i) => {
          const sw = 0.5 + (l.weight || 0) * 2.2
          const op = t.edgeBaseOpacity * (0.44 + (l.weight || 0))
          return (
            <line
              key={i}
              x1={l.source.x} y1={l.source.y}
              x2={l.target.x} y2={l.target.y}
              stroke={l.isBridge ? t.edgeBridgeColor : t.edgeBase}
              strokeOpacity={Math.min(1, op)}
              strokeWidth={sw}
              strokeDasharray={l.isBridge ? '4,3' : undefined}
            />
          )
        })}
      </g>
      <g>
        {graph.nodes.map(n => <NodeShape key={n.id} n={n} t={t} />)}
      </g>
      {/* labels — only top-degree nodes show labels by default */}
      <g>
        {graph.nodes
          .filter(n => n.kind === 'employer' || (n.degree || 0) > 8)
          .map(n => (
            <text
              key={`lbl-${n.id}`}
              x={n.x} y={n.y - nodeRadius(n) - 4}
              textAnchor="middle"
              fontFamily="Roboto, sans-serif" fontSize={9} fontWeight={600}
              fill={t.textPrimary}
            >
              {String(n.label || '').length > 28 ? String(n.label).slice(0, 26) + '…' : n.label}
            </text>
          ))}
      </g>
    </svg>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/galaxy/GalaxyLegend.jsx src/components/galaxy/GalaxyGraph.jsx
git commit -m "feat(galaxy): GalaxyGraph renders nodes/edges + GalaxyLegend"
```

---

## Task 15: GalaxyGraph.jsx — hover dim + click + zoom/pan + pattern flares

**Files:**
- Modify: `src/components/galaxy/GalaxyGraph.jsx`

- [ ] **Step 1: Add hover and click state + dim calculation**

Inside `GalaxyGraph`, above the `<svg>` return, add:

```jsx
const [hovered, setHovered] = useState(null)

const connectedIds = useMemo(() => {
  if (!hovered) return null
  const s = new Set([hovered])
  for (const l of graph.links) {
    if ((l.sourceId || l.source.id) === hovered) s.add(l.targetId || l.target.id)
    if ((l.targetId || l.target.id) === hovered) s.add(l.sourceId || l.source.id)
  }
  return s
}, [hovered, graph?.links])

function nodeOpacity(n) {
  if (!connectedIds) return 1
  return connectedIds.has(n.id) ? 1 : 0.18
}
function linkOpacity(l) {
  const op = Math.min(1, t.edgeBaseOpacity * (0.44 + (l.weight || 0)))
  if (!connectedIds) return op
  const sId = l.sourceId || l.source.id
  const tId = l.targetId || l.target.id
  return connectedIds.has(sId) && connectedIds.has(tId) ? op : 0.05
}
```

- [ ] **Step 2: Add zoom and pan state + handlers**

Add near the top of the component:

```jsx
const [view, setView] = useState({ x: 0, y: 0, k: 1 })
const dragRef = useRef(null)

function onWheel(e) {
  e.preventDefault()
  const rect = svgRef.current.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const delta = -e.deltaY * 0.0015
  setView(v => {
    const k = Math.max(0.4, Math.min(4, v.k * (1 + delta)))
    const scale = k / v.k
    return {
      k,
      x: mx - (mx - v.x) * scale,
      y: my - (my - v.y) * scale
    }
  })
}
function onMouseDown(e) { dragRef.current = { x: e.clientX, y: e.clientY, view } }
function onMouseMove(e) {
  if (!dragRef.current) return
  const dx = e.clientX - dragRef.current.x
  const dy = e.clientY - dragRef.current.y
  setView({ ...dragRef.current.view, x: dragRef.current.view.x + dx, y: dragRef.current.view.y + dy })
}
function onMouseUp() { dragRef.current = null }
```

- [ ] **Step 3: Accept `onNodeClick` and `onPatternClick` props + wire events**

Change the component signature to:

```jsx
export default function GalaxyGraph({
  envelope,
  surface = 'dark',
  width = 900,
  height = 560,
  onNodeClick,
  onPatternClick
}) {
```

Replace the existing `<svg>` return body with:

```jsx
return (
  <svg
    ref={svgRef} width={width} height={height}
    style={{ display: 'block', background: t.surface, cursor: dragRef.current ? 'grabbing' : 'grab', touchAction: 'none' }}
    onWheel={onWheel}
    onMouseDown={onMouseDown}
    onMouseMove={onMouseMove}
    onMouseUp={onMouseUp}
    onMouseLeave={onMouseUp}
  >
    <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
      {/* pattern flares (one per sector with ≥1 pattern tied to that sector) */}
      {graph.sectors.map(s => {
        const c = graph.centroids.get(s.name)
        if (!c) return null
        const pattern = (graph.patterns || []).find(p => p.sector === s.name)
        if (!pattern) return null
        return (
          <g key={`flare-${s.name}`} style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); onPatternClick?.(pattern) }}>
            <circle cx={c.x} cy={c.y} r={18} fill="none" stroke={t.patternRing} strokeWidth="1.5" strokeOpacity="0.5">
              <animate attributeName="r" values="14;22;14" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="stroke-opacity" values="0.7;0.2;0.7" dur="2.4s" repeatCount="indefinite" />
            </circle>
            <circle cx={c.x} cy={c.y} r={4} fill={t.patternRing} />
          </g>
        )
      })}

      {/* edges */}
      <g>
        {graph.links.map((l, i) => (
          <line
            key={i}
            x1={l.source.x} y1={l.source.y}
            x2={l.target.x} y2={l.target.y}
            stroke={l.isBridge ? t.edgeBridgeColor : t.edgeBase}
            strokeOpacity={linkOpacity(l)}
            strokeWidth={0.5 + (l.weight || 0) * 2.2}
            strokeDasharray={l.isBridge ? '4,3' : undefined}
          />
        ))}
      </g>

      {/* nodes */}
      <g>
        {graph.nodes.map(n => (
          <g
            key={n.id}
            opacity={nodeOpacity(n)}
            onMouseEnter={() => setHovered(n.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={e => { e.stopPropagation(); onNodeClick?.(n) }}
            style={{ cursor: 'pointer' }}
          >
            <NodeShape n={n} t={t} />
          </g>
        ))}
      </g>

      {/* labels */}
      <g>
        {graph.nodes
          .filter(n => n.kind === 'employer' || (n.degree || 0) > 8 || hovered === n.id)
          .map(n => (
            <text
              key={`lbl-${n.id}`}
              x={n.x} y={n.y - nodeRadius(n) - 4}
              textAnchor="middle"
              fontFamily="Roboto, sans-serif" fontSize={9} fontWeight={600}
              fill={t.textPrimary}
              opacity={nodeOpacity(n)}
              pointerEvents="none"
            >
              {String(n.label || '').length > 28 ? String(n.label).slice(0, 26) + '…' : n.label}
            </text>
          ))}
      </g>
    </g>
  </svg>
)
```

- [ ] **Step 4: Respect `prefers-reduced-motion`**

At the top of the component (after `const t = ...`), add:

```jsx
const reducedMotion = typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
```

In the effect that starts the simulation, if `reducedMotion`, skip registering the tick listener (pre-stabilized layout is final):

```jsx
if (!reducedMotion) sim.on('tick', () => setTick(x => x + 1))
```

- [ ] **Step 5: Commit**

```bash
git add src/components/galaxy/GalaxyGraph.jsx
git commit -m "feat(galaxy): hover/click/zoom/pan + pattern flares + reduced-motion"
```

---

## Task 16: GalaxyDrawer.jsx — pattern view + node view

**Files:**
- Create: `src/components/galaxy/GalaxyDrawer.jsx`

- [ ] **Step 1: Create the drawer**

Create `src/components/galaxy/GalaxyDrawer.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { galaxy } from '../../api/client.js'
import { galaxyTokens } from './lib/galaxyTokens.js'

function fmt$(v) {
  if (v == null) return '—'
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}b`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}m`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}k`
  return `$${Math.round(v)}`
}

function Band({ label, right, t }) {
  return (
    <div style={{
      background: t.band, color: t.bandText,
      padding: '7px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontFamily: 'Roboto, sans-serif'
    }}>
      <span style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 500 }}>{label}</span>
      {right && <span style={{ fontSize: 8, opacity: 0.55 }}>{right}</span>}
    </div>
  )
}

function PatternView({ patternSeed, t }) {
  const [detail, setDetail] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!patternSeed?.id) return
    galaxy.pattern(patternSeed.id)
      .then(r => setDetail(r?.data || null))
      .catch(e => setErr(e.message))
  }, [patternSeed?.id])

  const p = detail?.pattern || patternSeed

  return (
    <>
      <Band label={p.pattern_type?.replace(/_/g, ' ') || 'pattern'} right={p.sector || ''} t={t} />
      <div style={{ padding: 16, fontFamily: 'Roboto, sans-serif', color: t.textPrimary, overflowY: 'auto' }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 10px', color: t.textPrimary }}>{p.title}</h3>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: t.textMuted, margin: '0 0 14px' }}>{p.narrative}</p>
        <p style={{ fontSize: 12, lineHeight: 1.55, color: t.textMuted, margin: '0 0 18px' }}>{p.explanation}</p>

        {err && <div style={{ color: '#FFB84D', fontSize: 10 }}>Evidence unavailable: {err}</div>}

        {detail?.evidence?.edges?.length ? (
          <>
            <div style={{ fontSize: 9, letterSpacing: 2, color: t.textMuted, margin: '18px 0 8px', textTransform: 'uppercase' }}>Evidence — top edges</div>
            <div style={{ borderTop: `1px solid ${t.panelBorder}` }}>
              {detail.evidence.edges.slice(0, 10).map((e, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: `1px solid ${t.panelBorder}`, fontSize: 11 }}>
                  <span style={{ color: t.textPrimary }}>{e.source_label || e.source}</span>
                  <span style={{ color: t.textLow, margin: '0 6px' }}>→</span>
                  <span style={{ color: t.textPrimary }}>{e.target_label || e.target}</span>
                  <span style={{ color: '#FF8000', float: 'right', fontWeight: 600 }}>{fmt$(e.amount)}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </>
  )
}

function NodeView({ node, t }) {
  return (
    <>
      <Band label={node.kind.replace(/_/g, ' ')} right={node.sector || ''} t={t} />
      <div style={{ padding: 16, fontFamily: 'Roboto, sans-serif', color: t.textPrimary }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 14px' }}>{node.label}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
          <KPI label="Total $" value={fmt$(node.amount)} t={t} />
          <KPI label="Connections" value={String(node.degree || 0)} t={t} />
        </div>
        <div style={{ fontSize: 10, color: t.textLow }}>
          Node ID: <code style={{ color: t.textMuted }}>{node.id}</code>
        </div>
      </div>
    </>
  )
}

function KPI({ label, value, t }) {
  return (
    <div>
      <div style={{ fontSize: 9, letterSpacing: 2, color: t.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#FF8000' }}>{value}</div>
    </div>
  )
}

export default function GalaxyDrawer({ payload, onClose, surface = 'dark' }) {
  const t = galaxyTokens[surface]
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!payload) return null
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: t.drawerBackdrop, backdropFilter: 'blur(4px)',
          zIndex: 30
        }}
      />
      <aside style={{
        position: 'absolute', top: 0, right: 0, bottom: 0,
        width: 420, background: t.surface, borderLeft: `1px solid ${t.panelBorder}`,
        zIndex: 31, display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {payload.kind === 'pattern'
          ? <PatternView patternSeed={payload.pattern} t={t} />
          : <NodeView node={payload.node} t={t} />}
      </aside>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/galaxy/GalaxyDrawer.jsx
git commit -m "feat(galaxy): GalaxyDrawer with pattern and node detail views"
```

---

## Task 17: FundingFlowGalaxy.jsx orchestrator

**Files:**
- Create: `src/components/galaxy/FundingFlowGalaxy.jsx`

- [ ] **Step 1: Create the orchestrator**

Create `src/components/galaxy/FundingFlowGalaxy.jsx`:

```jsx
import { useState } from 'react'
import useGalaxyData from './hooks/useGalaxyData.js'
import useGalaxySurface from './hooks/useGalaxySurface.js'
import GalaxyGraph from './GalaxyGraph.jsx'
import GalaxyDrawer from './GalaxyDrawer.jsx'
import GalaxyLegend from './GalaxyLegend.jsx'
import GalaxySurfaceToggle from './GalaxySurfaceToggle.jsx'
import { galaxyTokens } from './lib/galaxyTokens.js'

export default function FundingFlowGalaxy({
  mode = 'universe',                            // "universe" | "sector" | "employer"
  cycle = '2024',
  sector = null,
  employerId = null,
  height = 560,
  onNodeSelect
}) {
  const [surface, toggleSurface] = useGalaxySurface()
  const t = galaxyTokens[surface]
  const { data, loading, error } = useGalaxyData({ mode, cycle, sector, employerId })
  const [drawerPayload, setDrawer] = useState(null)

  const rightMeta = mode === 'universe'
    ? `AI PATTERN DETECTION · ${data?.patterns?.length || 0} ACTIVE`
    : mode === 'sector'
      ? `SECTOR · ${sector || ''}`
      : mode === 'employer'
        ? `EMPLOYER · ${employerId || ''}`
        : ''

  function handleNodeClick(node) {
    setDrawer({ kind: 'node', node })
    onNodeSelect?.(node)
  }
  function handlePatternClick(pattern) {
    setDrawer({ kind: 'pattern', pattern })
  }

  return (
    <div style={{ position: 'relative', background: t.surface, border: `1px solid ${t.panelBorder}`, overflow: 'hidden' }}>
      <div style={{
        background: t.band, color: t.bandText,
        padding: '7px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: 9, letterSpacing: 2, fontWeight: 500, textTransform: 'uppercase' }}>
          Funding flow galaxy · {cycle}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: 8, opacity: 0.55 }}>{rightMeta}</span>
          <GalaxySurfaceToggle surface={surface} onToggle={toggleSurface} />
        </span>
      </div>

      <div style={{ position: 'relative', height, overflow: 'hidden' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: t.textMuted, fontFamily: 'Roboto, sans-serif', fontSize: 11 }}>
            Loading galaxy…
          </div>
        )}
        {error && !loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#FFB84D', fontFamily: 'Roboto, sans-serif', fontSize: 11, textAlign: 'center', padding: 20 }}>
            Galaxy temporarily unavailable.<br />
            <span style={{ fontSize: 9, color: t.textLow, marginTop: 6 }}>{error}</span>
          </div>
        )}
        {!loading && !error && data && (data.meta?.node_count ?? 0) === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: t.textMuted, fontFamily: 'Roboto, sans-serif', fontSize: 11 }}>
            No funding flow data for this selection.
          </div>
        )}
        {!loading && !error && data && (data.meta?.node_count ?? 0) > 0 && (
          <GalaxyGraph
            envelope={data}
            surface={surface}
            width={900}
            height={height}
            onNodeClick={handleNodeClick}
            onPatternClick={handlePatternClick}
          />
        )}
        {drawerPayload && <GalaxyDrawer payload={drawerPayload} onClose={() => setDrawer(null)} surface={surface} />}
      </div>

      <GalaxyLegend surface={surface} />
    </div>
  )
}
```

- [ ] **Step 2: Manual render check in isolation**

Ensure `GALAXY_ENABLED=true` + `VITE_GALAXY_ENABLED=true` in `.env`. Start the app:

```bash
npm run dev:all
```

Temporarily mount `<FundingFlowGalaxy mode="universe" cycle="2024" />` anywhere in `App.jsx` to verify rendering before doing the full integration in Task 18. Expected: graph renders with force layout, nodes colored by tier, hover dims unrelated nodes, clicking a node opens the drawer. Revert the temporary mount when done.

- [ ] **Step 3: Commit**

```bash
git add src/components/galaxy/FundingFlowGalaxy.jsx
git commit -m "feat(galaxy): FundingFlowGalaxy orchestrator (graph + drawer + toggle)"
```

---

# Phase 5 — Integration + Rollout

## Task 18: Donor Intelligence integration

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Read the current `DonorIntel` function**

Run:
```bash
grep -n "function DonorIntel" src/App.jsx
```

Note the line range (Spec Section 11.1 says 356-462). Verify before editing.

- [ ] **Step 2: Add the galaxy import near the top of App.jsx**

```jsx
import FundingFlowGalaxy from "./components/galaxy/FundingFlowGalaxy.jsx"
```

- [ ] **Step 3: Replace the chart grid + MoneyFlowSankey inside `DonorIntel`**

Locate `function DonorIntel()` (around line 356). Replace the two-column grid (`<div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1.15fr 1fr" …`) AND the `<MoneyFlowSankey />` call with:

```jsx
{import.meta.env.VITE_GALAXY_ENABLED === 'true' ? (
  <div>
    <Band label="Funding flow galaxy — 2024 cycle" right="AI PATTERN DETECTION · LIVE" />
    <Card style={{ padding: 0 }}>
      <FundingFlowGalaxy mode="universe" cycle="2024" height={640} />
    </Card>
  </div>
) : (
  <>
    {/* legacy charts — kept until flag retired */}
    <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1.15fr 1fr", gap: isMobile ? 14 : 20 }}>
      {/* ...original DONORS + POLS blocks unchanged... */}
    </div>
    <MoneyFlowSankey />
  </>
)}
<CandidatesBrowser />
```

Keep the hero banner at the top of `DonorIntel` untouched. `CandidatesBrowser` stays as documented in Spec Section 11.1.

- [ ] **Step 4: Smoke-test both flag states**

With `VITE_GALAXY_ENABLED=false` in `.env`, run:
```bash
npm run dev
```
Navigate to Follow the Money → Donor Intelligence. Expected: original bar chart + politician profiles panel + old Sankey render, nothing visibly changed.

Set `VITE_GALAXY_ENABLED=true`, restart Vite (the prefix is read at build/dev-start), re-visit. Expected: the two-column chart grid is gone, replaced by the interactive galaxy; `CandidatesBrowser` still renders below.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat(galaxy): integrate FundingFlowGalaxy into Donor Intelligence behind flag"
```

---

## Task 19: Money Flow integration

**Files:**
- Modify: `src/components/EmployerLeaderboard.jsx`

- [ ] **Step 1: Add the galaxy import**

At the top of `src/components/EmployerLeaderboard.jsx`:

```jsx
import FundingFlowGalaxy from './galaxy/FundingFlowGalaxy.jsx'
```

- [ ] **Step 2: Replace the right panel**

Find the "Right: mini Sankey" block (roughly lines 264-296). Replace the entire right-panel `<div>` with:

```jsx
{/* Right: galaxy (sector mode when no employer, employer mode when one selected) */}
<div style={{ border: `1px solid ${t.border}`, background: t.cardB, display: 'flex', flexDirection: 'column' }}>
  {import.meta.env.VITE_GALAXY_ENABLED === 'true' ? (
    <FundingFlowGalaxy
      mode={selected ? 'employer' : 'sector'}
      cycle={cycle}
      sector={selected ? null : (sector !== 'All Sectors' ? sector : null)}
      employerId={selected?.employer_id ?? null}
      height={420}
    />
  ) : (
    /* LEGACY: original Sankey right-panel (unchanged) */
    !selected ? (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ textAlign: 'center', color: t.low, fontFamily: MF, fontSize: 10, lineHeight: 1.8 }}>
          ← Select an employer<br />to explore their money flow
        </div>
      </div>
    ) : (
      <div style={{ padding: '12px 12px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontFamily: MF, fontSize: 11, fontWeight: 700, color: t.hi }}>{fmtName(selected.employer)}</span>
          <SectorBadge sector={selected.sector} />
        </div>
        <div style={{ fontFamily: MF, fontSize: 8.5, color: t.mid, marginBottom: 10 }}>
          {fmt$(selected.total)} total · {selected.txn_count?.toLocaleString()} donors · {cycle} cycle
        </div>
        {loadingFlow && <div style={{ padding: 20, textAlign: 'center', color: t.mid, fontFamily: MF, fontSize: 10 }}>Loading flow…</div>}
        {flowErr && <div style={{ padding: 12, color: t.warn, fontFamily: MF, fontSize: 9 }}>Flow unavailable: {flowErr}</div>}
        {!loadingFlow && !flowErr && <MiniSankey edges={flow} t={t} />}
        <div style={{ fontFamily: MF, fontSize: 7.5, color: t.low, marginTop: 6 }}>
          Employer → Committee → Candidate · top 50 edges by volume
        </div>
      </div>
    )
  )}
</div>
```

- [ ] **Step 3: Smoke-test**

With `VITE_GALAXY_ENABLED=true` and server running:
```bash
npm run dev:all
```

Navigate to Follow the Money → Money Flow. Expected:
- With no employer selected: right panel shows the galaxy for the active sector (e.g., Finance); `Employer Money Flow — ranked by donation volume` table still works on the left
- Click an employer row: right panel switches to the employer-scoped galaxy
- Deselect: right panel returns to sector galaxy
- Flip `VITE_GALAXY_ENABLED=false`, restart, re-check: old Sankey behavior restored

- [ ] **Step 4: Commit**

```bash
git add src/components/EmployerLeaderboard.jsx
git commit -m "feat(galaxy): swap EmployerLeaderboard right panel to galaxy behind flag"
```

---

## Task 20: TESTING.md + env example polish + final smoke test

**Files:**
- Create: `TESTING.md`
- Modify: `.env.example` (already done in Task 2 — verify)

- [ ] **Step 1: Write the manual test checklist**

Create `TESTING.md` at the repo root:

```markdown
# Galaxy Feature — Manual Test Checklist

Run through this before flipping `VITE_GALAXY_ENABLED=true` in production.

## Setup
- [ ] Server running on 3001 with `GALAXY_ENABLED=true` and `GALAXY_AI_ENABLED=true`
- [ ] Frontend running on 3000 with `VITE_GALAXY_ENABLED=true`
- [ ] `funding_flow_patterns` table has ≥5 rows for cycle 2024
- [ ] `node scripts/verify-galaxy-api.js` reports 0 failures

## Donor Intelligence subtab
- [ ] Loads without console errors
- [ ] Galaxy renders ≥100 nodes
- [ ] Pattern flares pulse on at least one sector cluster
- [ ] Hovering a node dims unrelated nodes (opacity visibly drops)
- [ ] Clicking a node opens the drawer with entity name + Total $ KPI
- [ ] Clicking a pattern flare opens drawer with narrative + evidence edges
- [ ] Pressing ESC closes the drawer
- [ ] Clicking the backdrop outside the drawer closes it
- [ ] `<CandidatesBrowser />` still renders below the galaxy

## Money Flow subtab
- [ ] No employer selected + sector = "Finance": right panel shows Finance sector galaxy
- [ ] Sector = "All Sectors": right panel shows sector galaxy for `null` sector (graceful: either empty state or default cluster)
- [ ] Clicking an employer row switches right panel to the employer galaxy
- [ ] Employer galaxy shows employer node + committee nodes + politician leaf nodes
- [ ] Clicking same row again deselects → right panel reverts to sector galaxy

## Light/Dark toggle
- [ ] ◐/☀ icon in top-right of galaxy panel
- [ ] Click → galaxy surface flips from #1D1D1D to #FAFAFA (or back)
- [ ] Node strokes + politician fills re-theme
- [ ] Reload page → preference persists (localStorage: `unredacted:galaxy-surface`)
- [ ] Open DevTools > Application > Local Storage to verify key

## Interactions
- [ ] Mouse wheel zooms toward cursor
- [ ] Drag empty space pans the view
- [ ] Touch: two-finger pinch zoom works (mobile or DevTools touch emulation)
- [ ] Reduced-motion OS setting: galaxy renders without animated force ticks (static layout)

## Feature flag OFF
- [ ] Flip `VITE_GALAXY_ENABLED=false`, restart Vite, reload
- [ ] Donor Intelligence: original bar chart + politician profiles + old MoneyFlowSankey render
- [ ] Money Flow: original Sankey behavior restored
- [ ] No console errors

## API verifier
- [ ] `node scripts/verify-galaxy-api.js` → 0 failures
- [ ] Cron endpoint auth: `curl -X POST http://127.0.0.1:3001/api/cron/detect-funding-patterns` → 401 when `CRON_AUTH_SECRET` set without header

## Pattern detection cron (manual trigger)
- [ ] `node etl/patterns/detectFundingPatterns.js --cycle 2024` completes in <60s
- [ ] Log file written to `etl/patterns/logs/YYYY-MM-DD.json`
- [ ] At least one pattern inserted (or `reason: insufficient_data` with explanation)
- [ ] Manually inspect 3 patterns — every cited node_id exists in edges
```

- [ ] **Step 2: Verify .env.example is complete**

```bash
grep -E 'GALAXY_|PATTERN_DETECTION_|CRON_AUTH_' .env.example
```

Expected: all 5 keys present (`GALAXY_ENABLED`, `GALAXY_AI_ENABLED`, `VITE_GALAXY_ENABLED`, `PATTERN_DETECTION_MONTHLY_BUDGET_USD`, `CRON_AUTH_SECRET`). If missing, add them per Task 2 Step 3.

- [ ] **Step 3: Run the full smoke checklist**

With flags on, go through every check in `TESTING.md`. Record any failures as follow-up issues before merging.

- [ ] **Step 4: Final commit**

```bash
git add TESTING.md .env.example
git commit -m "docs: add galaxy manual test checklist and env example coverage"
```

- [ ] **Step 5: Push the branch**

```bash
git push -u origin feature-research
```

- [ ] **Step 6: Open a PR describing the rollout sequence**

Use the 4-phase rollout from Spec Section 14 as the PR description's execution plan. Note that the feature flag defaults to `false` in production; the flip is manual and zero-redeploy via Vercel dashboard.

---

## Post-MVP — Cleanup (NOT part of this plan, scheduled for 2+ weeks after flag flip)

Once the galaxy has been running in production with `VITE_GALAXY_ENABLED=true` for 2 weeks without regressions, open a follow-up PR that:

1. Deletes `DONORS` and `POLS` constants from `src/App.jsx`
2. Deletes the legacy two-column chart grid in `DonorIntel`
3. Deletes the legacy Sankey fallback in `EmployerLeaderboard`'s right panel (keeps only the galaxy branch)
4. Deletes `MoneyFlowSankey` component + its route
5. Deletes `donors.employerFlow()` in `src/api/client.js` and the corresponding backend route
6. Greps for `recharts/Sankey` — if no other usages, removes the subpath import to shrink bundle

This cleanup is intentionally out of scope for the MVP plan so that rollback remains clean.

---

## Plan Self-Review

1. **Spec coverage check.** Each locked decision and section in the spec maps to at least one task:
   - Section 4 decisions → Tasks 1, 11, 14, 15, 17 (tokens, tiers, toggle, forces, orchestrator)
   - Section 5 architecture → overall plan structure
   - Section 6 data model → Task 1
   - Section 7 API contract → Tasks 7, 8, 9, 10
   - Section 8 frontend components → Tasks 11-17
   - Section 9 AI pipeline → Tasks 2, 3, 4, 5, 6
   - Section 10 light toggle → Tasks 11, 17
   - Section 11 integration → Tasks 18, 19
   - Section 12 error handling → wrapped into component + router + ETL validation (Tasks 9, 17, 4-5)
   - Section 13 testing → Tasks 10, 20
   - Section 14 rollout → Task 20 (initial) + documented post-MVP cleanup section
   - Section 15 known unknowns → flagged in Task 5 Step 7 (prompt tuning), Task 8 (PAC sector classifier assumption — if `source_sector`/`target_sector` columns don't exist on `money_flow_edges`, fall back to joining `pac_committees.sector`)

2. **Placeholder scan.** No TBDs, no "fill in later," no "similar to Task N" references. All code blocks show complete runnable code.

3. **Type consistency.** `nodeId()` has the same signature in `galaxyService.js` and `detectFundingPatterns.js` (separate copies to keep them independent — each file is self-contained). API response `kind` values match between `buildEnvelope` and `NodeShape`. `galaxyTokens.dark` and `galaxyTokens.light` have identical keys (verified). Surface prop flows consistently from `useGalaxySurface` → `FundingFlowGalaxy` → `GalaxyGraph` / `GalaxyDrawer` / `GalaxyLegend` / `GalaxySurfaceToggle`.

4. **Ambiguity check.**
   - Node cap enforcement happens in `galaxyService.js` after `buildEnvelope` — deterministic top-N by node amount.
   - Patterns only populate when `GALAXY_AI_ENABLED=true` — avoids leaking AI-generated content when cron is disabled.
   - `MoneyFlowSankey` is treated as an inline App.jsx definition (per spec Section 11.1) — Task 18 removes the *call site*; if the definition exists elsewhere, that becomes a cleanup task.

All items pass review.
