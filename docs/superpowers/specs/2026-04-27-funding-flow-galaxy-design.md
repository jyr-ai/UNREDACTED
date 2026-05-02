# Funding Flow Galaxy — Design Spec

**Date:** 2026-04-27
**Status:** Approved for implementation planning
**Author:** collaborative brainstorming session with jroachell

---

## 1. Overview

An interactive force-directed graph visualization that exposes the flow of campaign-finance money from Employers → PACs / 501(c)(4)s / Super PACs → Politicians. Modeled on FOIA Fluent's Pattern Galaxy, adapted for UNREDACTED's data and brand. Surfaces "signals" — AI-detected money-flow patterns — layered on top of a stable structural view organized by sector clusters.

Replaces the static "Top Corporate Donors" bar chart, "Politician Donor Profiles" panel, the general `MoneyFlowSankey` on the Donor Intelligence subtab, and the employer-specific Sankey on the Money Flow subtab. **Galaxy is the single money-flow visualization across the app.**

## 2. Goals

- **G1:** Give users a single interactive surface to explore the entire universe of campaign-finance flow, scoped down to sector or company on demand.
- **G2:** Surface non-obvious patterns (dark money pathways, sector concentration, committee alignment, sudden surges) using AI so users who don't know what to look for still find the story.
- **G3:** Make dark-money conduits visually distinct — the galaxy tells the 501(c)(4) story at a glance.
- **G4:** Stay within UNREDACTED's "War Room Terminal" design register — dark-first, precision-driven, no institutional camouflage.
- **G5:** Ship behind a feature flag with zero-redeploy rollback.

## 3. Non-Goals

- Real-time (sub-daily) pattern detection.
- Showing every FEC-registered entity (~hundreds of thousands) — the galaxy curates to ~300-500 nodes for signal over completeness.
- Replacing the existing `CandidatesBrowser` on Donor Intelligence (stays as tabular drill-down companion).
- A global app-wide light mode — the light toggle is scoped to the galaxy panel only.
- Automated test suite — project has no test framework configured; manual testing checklist ships in PR.

## 4. Locked Design Decisions

| Decision | Value | Rationale |
|---|---|---|
| Panel background (dark) | `#1D1D1D` (card-surface-raised) | In-system lighter-dark; avoids new tokens |
| Panel background (light mode) | `#FAFAFA` | Clear contrast; poster/presentation mode |
| Cluster model | 13 sector clusters + AI pattern overlay | Stable structure + narrative signal |
| Node categories (5 visual) | Employer (tier 1) · Trad PAC (tier 2, `!is_501c4 && !is_super_pac`) · Dark Money 501(c)(4) (tier 2, `is_501c4=true`) · Super PAC (tier 3-4, `is_super_pac=true`) · Politician (tier 5) | Uses `money_flow_edges` MV tier numbering; committees disambiguate via `is_501c4` / `is_super_pac` flags on `pac_committees` |
| Dark money visual grammar | **Amber dashed square** `#FFB84D` (dark) / `#B8860B` (light) | Signature visual language FOIA Fluent doesn't have |
| MVP AI pattern types (4) | Sector Concentration · Dark Money Pathway · Committee Alignment · Sudden Surge | Highest-impact stories using existing Supabase data |
| v2 pattern type | Cross-Party Hedging | User-flagged as high-priority for next iteration |
| Universe scale | 300-500 curated nodes | SVG + D3-force renders at 60fps; "signal over completeness" |
| Rendering tech | D3-force v3 + SVG (React component) | Match FOIA Fluent; Canvas/WebGL not needed at this scale |
| Click behavior | Drawer-only (FOIA Fluent style) | Graph stays visible; ESC to close |
| AI cadence | Weekly cron, Sundays 07:00 UTC | ~$2/mo Claude cost; matches FEC update cadence |
| AI provider for detection | Claude Sonnet 4.6 (direct Anthropic SDK) | Forced tool use, structured output; not `aiService.js` |
| Backend architecture | Hybrid — reuse `money_flow_edges` MV, add `funding_flow_patterns` table + 4 new routes | Minimal new infra; clear API contract |
| Feature flags | `GALAXY_ENABLED` (UI) + `GALAXY_AI_ENABLED` (cron/overlay) | Zero-redeploy rollback; independent AI kill-switch |
| Light-mode toggle | Ships in MVP, per-galaxy scope | Screenshot/presentation mode; localStorage persisted |

## 5. Architecture

### 5.1 Data flow (request → render)

```
Browser (React SPA)
  └─ <FundingFlowGalaxy mode="universe|sector|employer" />
        │
        │ GET /api/galaxy/{universe|sector/:name|employer/:id}?cycle=2024
        │ GET /api/galaxy/patterns?cycle=2024 (parallel, universe mode only)
        ▼
Express (server/routes/galaxy.js)
  └─ server/services/galaxyService.js
        │
        │ SELECT from money_flow_edges MV (existing, indexed)
        │ LEFT JOIN funding_flow_patterns (new table)
        ▼
Supabase PostgreSQL
```

### 5.2 AI pipeline (asynchronous, weekly)

```
Vercel Cron (schedule: "0 7 * * 0", Sun 07:00 UTC)
  └─ api/cron/detect-funding-patterns.js
        │
        └─ etl/patterns/detectFundingPatterns.js
              │
              │ 1. Fetch top 400 edges (money_flow_edges) for recent cycle
              │ 2. Fetch recent patterns (14d) for dedup context
              │ 3. Build structured prompt with prompt-caching breakpoint
              │ 4. Claude Sonnet 4.6 via forced tool use (extract_funding_patterns)
              │ 5. Validate node_ids against source data
              │ 6. Dedupe against recent patterns
              │ 7. UPSERT into funding_flow_patterns
              │ 8. Log summary to etl/patterns/logs/YYYY-MM-DD.json
```

### 5.3 Monorepo placement

| New files | Location |
|---|---|
| Frontend components | `src/components/galaxy/` |
| Frontend hooks | `src/components/galaxy/hooks/` |
| Frontend lib | `src/components/galaxy/lib/` |
| Backend route | `server/routes/galaxy.js` |
| Backend service | `server/services/galaxyService.js` |
| AI cron script | `etl/patterns/detectFundingPatterns.js` |
| Cron HTTP handler | `api/cron/detect-funding-patterns.js` |
| DB migration | `supabase/migrations/YYYYMMDD_funding_flow_patterns.sql` |
| Verification script | `scripts/verify-galaxy-api.js` |

## 6. Data Model

### 6.1 New table — `funding_flow_patterns`

```sql
CREATE TABLE funding_flow_patterns (
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
  evidence        JSONB NOT NULL DEFAULT '{}',
  cycle           TEXT NOT NULL,
  severity_score  INT  NOT NULL DEFAULT 5
                  CHECK (severity_score BETWEEN 0 AND 10),
  generated_at    TIMESTAMPTZ DEFAULT NOW(),
  generated_by    TEXT DEFAULT 'claude-sonnet-4-6',
  visible         BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_patterns_node_ids ON funding_flow_patterns USING GIN (node_ids);
CREATE INDEX idx_patterns_cycle_visible ON funding_flow_patterns (cycle, visible, generated_at DESC);
CREATE INDEX idx_patterns_sector ON funding_flow_patterns (sector) WHERE visible = TRUE;
```

### 6.2 Existing tables (read-only)

- `money_flow_edges` (materialized view) — primary source of galaxy nodes/edges
- `pac_committees` — `is_501c4`, `is_super_pac`, `connected_org_name` used to classify tier + sector
- `politicians` — candidate names, parties, offices
- `candidate_totals` — cycle-aggregated financial summaries for politician nodes
- `contributions` — detail drawer drill-down

### 6.3 Node ID format

Prefixed to disambiguate across tiers:

- `emp:<employer_id>` — employer (tier 1)
- `cmt:<committee_id>` — committee: PAC, 501(c)(4), or Super PAC (tiers 2-4, discriminated by flags)
- `pol:<fec_candidate_id>` — politician (tier 5)

## 7. API Contract

### 7.1 Endpoints

| Method | Path | Returns |
|---|---|---|
| GET | `/api/galaxy/universe?cycle=2024` | Full galaxy · nodes capped at 500 (target 300-500) · all visible patterns |
| GET | `/api/galaxy/sector/:sector?cycle=2024` | Scoped to one sector · nodes capped at 80 |
| GET | `/api/galaxy/employer/:employerId?cycle=2024` | Employer's network · nodes capped at 40 |
| GET | `/api/galaxy/patterns/:id` | Single pattern with expanded evidence nodes/edges |

### 7.2 Response envelope (shared by `/universe`, `/sector`, `/employer`)

```ts
{
  nodes: [{
    id: string,                   // "emp:LOCKHEED MARTIN" | "cmt:C00000042" | "pol:H0AL02087"
    kind: "employer" | "trad_pac" | "dark_money" | "super_pac" | "politician",
    label: string,                // human-readable, title-cased
    sector?: string,              // employer + PAC nodes only
    amount: number,               // total $ flowing through this node
    degree: number,               // edge count — fallback sizing
    is_501c4?: boolean,
    is_super_pac?: boolean
  }],
  edges: [{
    source: string,               // node id
    target: string,               // node id
    amount: number,
    weight: number,               // 0..1 normalized within response, drives stroke width
    tier_from: 1|2|3|4|5,
    tier_to: 1|2|3|4|5
  }],
  sectors: [{ name: string, color: string, node_count: number, total_amount: number }],
  patterns: Pattern[],            // only on /universe; [] on scoped modes
  meta: {
    cycle: string,
    generated_at: string,         // ISO 8601
    node_count: number,
    edge_count: number,
    source: "supabase"
  }
}
```

### 7.3 Pattern response (`/patterns/:id`)

```ts
{
  pattern: {
    id: string,
    pattern_type: string,
    title: string,
    narrative: string,
    explanation: string,
    sector: string | null,
    severity_score: number,
    generated_at: string,
    node_ids: string[]
  },
  evidence: {
    nodes: Node[],                // fully expanded per Section 7.2
    edges: Edge[]
  }
}
```

## 8. Frontend Components

### 8.1 Component tree

```
src/components/galaxy/
  FundingFlowGalaxy.jsx           Orchestrator. Accepts mode + cycle + scope prop.
                                  Handles data fetch, drawer state, surface toggle.
  GalaxyGraph.jsx                 D3-force SVG renderer.
                                  Nodes, edges, labels, cluster force, zoom/pan.
  GalaxyDrawer.jsx                Right-side slide-in panel.
                                  Renders either pattern detail or node profile.
  GalaxyLegend.jsx                Tier shapes + sector colors key.
  GalaxySurfaceToggle.jsx         ◐/☀ icon button; flips localStorage + local state.
  hooks/
    useGalaxyData.js              Fetch + memoize galaxy payload per mode/cycle.
    useGalaxySurface.js           Read/write localStorage; default 'dark'.
  lib/
    galaxyForces.js               D3 force factories + custom clusterForce().
    galaxyBuild.js                Pure: apiPayload → {nodes, links, centroids}.
    galaxyTokens.js               Dark + light theme token maps.
```

### 8.2 Main component props

```jsx
<FundingFlowGalaxy
  mode="universe"                 // "universe" | "sector" | "employer"
  cycle="2024"
  sector={null}                   // required when mode="sector"
  employerId={null}               // required when mode="employer"
  height={560}
  onNodeSelect={(node) => {}}     // optional callback
/>
```

### 8.3 Visual grammar

| Tier | Shape | Size rule | Stroke | Fill (dark) | Fill (light) |
|---|---|---|---|---|---|
| Employer | Circle | `max(12, min(22, 9 + deg×1.2))` | 2px `#FF8000` | `#1D1D1D` | `#FFFFFF` |
| Trad PAC | Circle | `max(9, min(14, 7 + deg×0.6))` | 1.7px `#FF8000` | `#1D1D1D` | `#FFFFFF` |
| Dark Money (501c4) | **Square, dashed** `stroke-dasharray="4,2"` | same as PAC | 1.7px `#FFB84D` dark / `#B8860B` light | `#1D1D1D` | `#FFFFFF` |
| Super PAC | Diamond (45°-rotated square) | same as PAC | 1.7px `#FF8000` | `#1D1D1D` | `#FFFFFF` |
| Politician | Small solid circle | `max(4, min(8, 3 + deg×0.3))` | none | `#4A7FFF` | `#0028AA` |

**Edge stroke:** `width = 0.5 + weight × 2.2` · `opacity = 0.22 + weight × 0.5` (dark) or `0.35 + weight × 0.4` (light). Edges crossing sector clusters render dashed.

**Pattern-highlighted clusters:** sector centroid gets an 18px orange ring with `animation: pulse 2.4s ease-in-out infinite`. A small orange flare glyph at centroid is clickable and opens the pattern in the drawer.

### 8.4 Interactions

- **Hover node** — unrelated nodes fade to `opacity: 0.18`, unrelated edges to `0.05`.
- **Click node** — drawer opens with node profile.
- **Click pattern flare** — drawer opens with pattern narrative + explanation + evidence.
- **Mouse wheel** — zoom toward cursor.
- **Drag empty space** — pan.
- **Touch** — single-finger pan, two-finger pinch zoom.
- **ESC** — closes drawer.
- **Auto-fit on mount** — fit viewport with padding after initial force simulation runs headless for 180 iterations, then fade-in.

### 8.5 D3 force configuration (`galaxyForces.js`)

- `forceLink` weighted by `1 / edge.weight` (strong edges pull harder)
- `forceManyBody` at `-80`
- `forceCollide` radius = node radius + 2px padding
- Custom `clusterForce` pulls nodes toward per-sector centroids laid out in a ring; strength = `0.08 × alpha`
- On mount: 180 iterations headlessly → fade in → live tick at 60fps
- `prefers-reduced-motion: reduce` → skip animation, render final positions directly

### 8.6 Drawer (`GalaxyDrawer.jsx`)

- 420px wide, slides from right
- Overlay: `backdrop-filter: blur(4px)`
- Band header (navy `#001A7A`) with pattern type label or node kind label
- **Pattern view:** title → narrative → explanation → evidence list (top 10 contributing edges with $ amounts) → "Open in Money Flow" CTA
- **Node view:** entity name → sector chip → KPIs ($ total, donor count) → top 8 incoming/outgoing edges → "View in Money Flow" CTA

## 9. AI Pattern Detection Pipeline

### 9.1 Script entry point

`etl/patterns/detectFundingPatterns.js` — standalone Node script invokable via:

```bash
node etl/patterns/detectFundingPatterns.js --cycle 2024
```

### 9.2 Pipeline steps

1. Fetch top ~400 edges from `money_flow_edges` for the cycle
2. Join entity context: labels, sectors, `is_501c4`, `is_super_pac`
3. Fetch recent patterns (last 14 days) for deduplication context
4. Build structured prompt — system block stable across runs (prompt-cache friendly), user block includes edge summary as compact table
5. Call Claude Sonnet 4.6 via forced tool use (`extract_funding_patterns`)
6. Validate: every `node_id` resolves to a real row; ≥3 distinct nodes per pattern; severity 0-10
7. Dedupe: reject titles with Levenshtein ≤3 or cosine >0.85 against step-3 recents
8. Enrich: attach `evidence` JSONB with specific supporting edges
9. UPSERT into `funding_flow_patterns` with `generated_by='claude-sonnet-4-6'`, `visible=TRUE`
10. Log run summary to `etl/patterns/logs/YYYY-MM-DD.json` (patterns created, rejected, cost)

### 9.3 Tool schema (forced)

```json
{
  "name": "extract_funding_patterns",
  "input_schema": {
    "type": "object",
    "properties": {
      "patterns": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["title", "narrative", "explanation", "pattern_type",
                       "node_ids", "severity_score", "sector"],
          "properties": {
            "title":          { "type": "string", "maxLength": 90 },
            "narrative":      { "type": "string", "maxLength": 280 },
            "explanation":    { "type": "string", "maxLength": 800 },
            "pattern_type":   { "enum": ["sector_concentration",
                                          "dark_money_pathway",
                                          "committee_alignment",
                                          "sudden_surge"] },
            "sector":         { "type": "string" },
            "node_ids":       { "type": "array", "minItems": 3, "items": {"type": "string"} },
            "severity_score": { "type": "integer", "minimum": 0, "maximum": 10 }
          }
        }
      }
    },
    "required": ["patterns"]
  }
}
```

### 9.4 System prompt rules (conservative)

- Only cite patterns with ≥3 real `node_ids` from the provided data.
- Never invent entities; node_ids must come verbatim from input.
- Empty array is a valid response — refuse to fabricate patterns when data is insufficient.
- Severity reflects financial + institutional weight, not political opinion.
- Narrative must be factual, specific, grounded; no speculation.

### 9.5 Vercel cron registration

Added to `vercel.json`:

```json
{ "path": "/api/cron/detect-funding-patterns", "schedule": "0 7 * * 0" }
```

Handler `api/cron/detect-funding-patterns.js` imports and runs the ETL script. Auth-protected by Vercel cron-auth header.

### 9.6 Cost envelope

- ~$0.35 per cached run (system block cached), ~$0.50 uncached
- Weekly × 4 = ~$2/mo steady state
- Budget guardrail: env `PATTERN_DETECTION_MONTHLY_BUDGET_USD=10` — cron skips if monthly ledger exceeds

### 9.7 Claude SDK integration

Direct Anthropic SDK call in the ETL script — **bypasses `server/services/aiService.js`**. Rationale: pattern detection needs structured output + forced tool use + quality guarantees that DeepSeek (the app default) does not provide reliably. The **claude-api skill** will be invoked during implementation to ensure correct prompt caching placement and model ID.

## 10. Light-Mode Toggle

### 10.1 Scope

Per-galaxy only. The toggle flips the galaxy panel's surface, node fills, stroke colors, label colors, and text colors. The rest of the app stays dark — DESIGN.md doctrine untouched. Think "poster mode" for screenshots, presentations, and printing.

### 10.2 UI

A 24px icon-button in the top-right of the galaxy Band header, inline with the right-side meta text. Icon: moon (`◐`) when dark active, sun (`☀`) when light active. Hover tooltip: "Toggle galaxy surface".

### 10.3 Theme tokens (`src/components/galaxy/lib/galaxyTokens.js`)

| Token | Dark (default) | Light |
|---|---|---|
| `surface` | `#1D1D1D` | `#FAFAFA` |
| `band` | `#001A7A` | `#001A7A` |
| `employerStroke` | `#FF8000` | `#FF8000` |
| `pacStroke` | `#FF8000` | `#FF8000` |
| `darkMoneyStroke` | `#FFB84D` | `#B8860B` |
| `superPacStroke` | `#FF8000` | `#FF8000` |
| `politicianFill` | `#4A7FFF` | `#0028AA` |
| `edgeColor` | `#FF8000` @ 0.5 | `#FF8000` @ 0.65 |
| `textPrimary` | `#FFFFFF` | `#0D0D0D` |
| `textMuted` | `#888888` | `#484848` |
| `nodeFill` | `#1D1D1D` | `#FFFFFF` |

### 10.4 Persistence

`localStorage.getItem('unredacted:galaxy-surface')` — `'dark'` or `'light'`. Read once on mount (default `'dark'`). Write on toggle. Persists per-user across sessions. `prefers-color-scheme: light` honored only on first-ever load before user sets preference.

### 10.5 Hook contract

`useGalaxySurface()` returns `[surface, toggle]`. Consumed by `FundingFlowGalaxy`; passed as `surface` prop to `GalaxyGraph` and `GalaxyDrawer`. **Every visual rule reads from `galaxyTokens[surface]` — zero hardcoded hex in rendering code.**

### 10.6 Accessibility

- Toggle button: `aria-label="Switch galaxy to {light|dark} mode"`.
- Focus ring: `outline: 2px solid rgba(255,128,0,0.6); outline-offset: 2px`.
- Surface transition: 200ms opacity fade. Skipped when `prefers-reduced-motion: reduce`.

## 11. Integration — Replacing Charts + Sankeys

### 11.1 Donor Intelligence subtab (`src/App.jsx:356-462`)

**Remove:**
- `DONORS` constant and the "Top corporate donors" bar chart (lines 378-400)
- `POLS` constant and the "Politician donor profiles" panel (lines 404-454)
- The two-column grid container (lines 376-456)
- `<MoneyFlowSankey />` call at line 459 (and inline component definition if in App.jsx — confirm via grep during implementation)

**Keep:**
- Hero banner (lines 370-374)
- `<CandidatesBrowser />` at line 458

**Replace with:**
```jsx
<div>
  <Band label="Funding flow galaxy — 2024 cycle" right="AI PATTERN DETECTION · LIVE" />
  <Card style={{ padding: 0 }}>
    <FundingFlowGalaxy mode="universe" cycle={cycle} height={640} />
  </Card>
</div>
<CandidatesBrowser />
```

### 11.2 Money Flow subtab (`src/components/EmployerLeaderboard.jsx`)

**Remove:**
- Inline `MiniSankey` component (lines 89-134)
- Inline `SankeyNode` component (lines 72-87)
- Recharts imports for `Sankey`, `Layer`, `Rectangle` (line 13) — keep `ResponsiveContainer`, `Tooltip` only if still used elsewhere
- `TIER_COLOR` constant if no longer used
- The "Right: mini Sankey" block (lines 264-296)

**Replace with:**
```jsx
{/* Right: galaxy — sector mode if no employer, employer mode if one selected */}
<div style={{ border: `1px solid ${t.border}`, background: t.cardB, display: 'flex', flexDirection: 'column' }}>
  <FundingFlowGalaxy
    mode={selected ? 'employer' : 'sector'}
    cycle={cycle}
    sector={selected ? null : sector}
    employerId={selected?.employer_id ?? null}
    height={420}
  />
</div>
```

### 11.3 API cleanup

- `donors.employerFlow()` in `src/api/client.js` is no longer called after UI migration → deprecate in same PR, delete after 2 weeks stable
- Corresponding backend route and `getEmployerFlow` service function in `supabaseDonors.js` → deprecate + delete on same timeline

### 11.4 Dependency check

If no other component imports `recharts/Sankey`, we can remove that subpath import. Bundle size win. `grep -r "from 'recharts'" src/` during implementation to confirm.

### 11.5 Feature flags

Env vars (dual):

```bash
GALAXY_ENABLED=true            # hides galaxy UI when false
GALAXY_AI_ENABLED=true         # disables pattern cron/overlay when false
```

Exposed to client as `VITE_GALAXY_ENABLED`. When `VITE_GALAXY_ENABLED=false`:
- Donor Intelligence: renders existing charts (keep `DONORS`/`POLS` in code until flag retired)
- Money Flow right panel: renders existing Sankey

### 11.6 Breaking change inventory

| What changes | Who's affected | Mitigation |
|---|---|---|
| `DONORS` / `POLS` mocked constants removed | Nothing — hardcoded placeholders | Delete after flag retired |
| Right panel on Money Flow replaced | Existing users | Feature flag rollback available; galaxy is strict superset of Sankey info |
| `/api/donors/employers/:id/flow` deprecated | Only the Sankey UI | Remove after 2-week stability window |
| New `funding_flow_patterns` table | DBA / migrations | Ship via `supabase/migrations/` SQL |

## 12. Error Handling

| Failure | Behavior |
|---|---|
| `/api/galaxy/universe` 5xx | Galaxy panel shows empty state + retry button + "Galaxy temporarily unavailable" |
| Pattern endpoint fails, graph loads | Graph renders without overlays; "AI patterns unavailable" micro-label in Band meta |
| Supabase returns 0 nodes | Empty-state card: "No funding flow data for this selection." |
| D3 simulation throws | `ErrorBoundary` catches; renders fallback node list as text; Sentry breadcrumb |
| Weekly cron fails | Logged; Vercel retries next week. Frontend shows last successful patterns (still `visible=TRUE`) |
| Claude returns malformed tool response | Validator rejects; script exits 0; logged. No partial writes |
| Claude rate-limited | Retry once after 30s backoff; then abort run; logged |
| Monthly budget exceeded | Cron skips; logs skip reason |

## 13. Testing Strategy

No test framework is configured (per CLAUDE.md). Ships with manual-testing discipline:

1. **Manual test checklist in PR** (`TESTING.md`):
   - Cycle switch loads new data
   - Sector filter scopes correctly
   - Hover dim/highlight behavior
   - Drawer open/close, ESC key, outside-click
   - Mobile touch (pan + pinch zoom)
   - Light/dark toggle + localStorage persistence
   - Reload preserves toggle state
   - Feature flag off restores old UI
2. **Data integrity checks in ETL script** — validator aborts before DB writes; bad patterns never land
3. **API contract verifier** (`scripts/verify-galaxy-api.js`) — hits each endpoint, asserts response shape matches Section 7. Re-runnable pre-merge
4. **Playwright smoke** (stretch goal) — one E2E test: load Donor Intelligence → galaxy renders ≥1 node + edge → click node → drawer appears. Scaffolds future test infra

## 14. Rollout Plan

### Phase 1 — Schema + AI data (week 1)
1. Merge migration: `funding_flow_patterns` table
2. Ship ETL script; run manually once vs. 2024 cycle; review 10+ patterns for factual accuracy; tune prompt
3. Register Vercel cron in `vercel.json`

### Phase 2 — API (week 1-2)
4. Merge `/api/galaxy/*` routes behind `GALAXY_ENABLED=false` (404 when off)
5. Validate all endpoints with `verify-galaxy-api.js`

### Phase 3 — UI (week 2-3)
6. Merge galaxy components + integration behind `VITE_GALAXY_ENABLED=false`
7. Preview deploy → internal QA using testing checklist
8. Flip `VITE_GALAXY_ENABLED=true` in Vercel production

### Phase 4 — Cleanup (week 4+)
9. After 2 weeks stable: delete `DONORS`/`POLS` constants + old chart code
10. Delete deprecated `donors.employerFlow()` API + service function
11. Consider removing `recharts/Sankey` from bundle if unused

### Rollback
- Flip `VITE_GALAXY_ENABLED=false` in Vercel dashboard — no redeploy; old charts reappear instantly
- If AI patterns are unreliable, flip `GALAXY_AI_ENABLED=false` to hide overlay while keeping graph
- Full rollback: revert the two integration commits; schema/tables may remain

## 15. Known Unknowns

- **Committee-assignments data:** is there a `committee_assignments` table in Supabase? Needed for "Committee Alignment" pattern type. If absent, that pattern type scopes to v2.5 pending data ingestion.
- **Sector classifier for PAC nodes:** existing classifier targets `contributor_employer`; PAC sector inference likely needs a separate mapping via `connected_org_name` → sector.
- **Prompt caching breakpoint placement:** validate with the claude-api skill during implementation — system block is stable, place the cache breakpoint after system prompt, before per-run edge data.
- **Sankey component removal:** confirm via grep no other consumers before dropping `recharts/Sankey` subpath.

---

## Appendix A — Reference: FOIA Fluent Pattern Galaxy

This design intentionally mirrors the architecture of FOIA Fluent's Pattern Galaxy feature (`github.com/dssg-nyc/FOIA-Fluent`, `PatternGraph.tsx`). Key parallels:

| FOIA Fluent | UNREDACTED |
|---|---|
| `signal_patterns` table | `funding_flow_patterns` table |
| `foia_signals_feed` (ingested records) | `money_flow_edges` MV (aggregated edges) |
| `entity_bios` (cached) | Node metadata joined from existing tables |
| 7 pattern types | 4 MVP pattern types |
| Daily cron | Weekly cron |
| `PatternGraph.tsx` | `GalaxyGraph.jsx` |
| D3-force v3 + SVG | Same |
| PatternDetailDrawer | `GalaxyDrawer.jsx` |

Where they differ — **dark money visual grammar (amber dashed squares), 4-tier node discrimination, sector centroid clustering, light/dark toggle** — those are the UNREDACTED-specific differentiators.
