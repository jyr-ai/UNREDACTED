# Node Detail Panel — Design Spec

> **For agentic workers:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this spec task-by-task.

**Goal:** Replace the basic `GalaxyDrawer` with a rich detail panel that opens on any galaxy node click, showing a live mini D3 galaxy of the node's connections, a full money-trail timeline, and — for pattern flare nodes — an AI narrative section. Politician nodes additionally show their Congress.gov photo and metadata.

**Visual reference:** `node_detail_panel.html` in the project root — shows all 6 drawer variants and the Architecture C component map.

**Architecture:** Approach C — one universal server endpoint returns subgraph + timeline for any node; four focused frontend components wire into a refactored `GalaxyDrawer`.

**Tech stack:** React (inline styles + `useTheme`), D3 v7 force simulation (reusing `galaxyBuild` / `galaxyForces`), Express route, Supabase (`contributions`, `committee_transfers`, `politicians`, `pac_committees`), Congress.gov API (existing `getMemberDetails` in `congressGov.js`).

---

## Layout Contract (agreed in brainstorming)

All drawer variants share one layout, always in this order:

```
┌─────────────────────────────────────┐
│  BAND: node type · sector/cycle     │  [close ✕]
├─────────────────────────────────────┤
│                                     │
│   MINI-GALAXY  (full width, ~220px) │  ← D3 force sim, drag+zoom
│                                     │
├─────────────────────────────────────┤
│  METADATA SECTION                   │  ← varies by node type (see below)
├─────────────────────────────────────┤
│  TIMELINE (full width, scrollable)  │  ← amber = receipt, blue = transfer
└─────────────────────────────────────┘
```

The **metadata section** is the only part that varies:

| Node type | Metadata content |
|---|---|
| Employer | Name, sector badge, total donated KPI, txn count KPI, PACs funded KPI |
| Committee / PAC | Name, committee type badges (SUPER PAC / 501c4), total raised + disbursed KPIs, top donor chips |
| Politician / Candidate | Congress.gov photo, name, party + state + chamber badges, raised KPI, bioguide link; if no bioguide_id: name + party only |
| Pattern flare node | All of the above for its base type, **plus** AI narrative block (left-orange-bordered), severity badge, pattern type badge, "also appears in" chips |
| Sector halo click | Sector name + color, total flow KPI, node count KPI, pattern count KPI, top-pattern narrative block |
| Dark money / 501c4 | Committee ID, dark money warning block, disbursements-only note |

---

## Data Model

### Timeline event shape (unified)
```typescript
interface TimelineEvent {
  date: string          // ISO date "2024-07-03"
  kind: 'receipt' | 'transfer'
  from_label: string    // employer name or committee name
  to_label: string      // committee name or candidate name
  from_id: string       // prefixed node ID "emp:..." or "cmt:..."
  to_id: string
  amount: number
}
```

### Node subgraph shape (from new endpoint)
```typescript
interface NodeSubgraph {
  node: GalaxyNode          // the clicked node with full metadata
  nodes: GalaxyNode[]       // 1-hop neighbors
  edges: GalaxyEdge[]       // edges connecting them
  timeline: TimelineEvent[] // sorted ascending by date
  patterns: PatternRef[]    // patterns this node appears in (may be empty)
}

interface PatternRef {
  id: string
  pattern_type: string
  title: string
  narrative: string
  explanation: string
  sector: string | null
  severity_score: number
}
```

---

## Server Changes

### 1. New route — `GET /api/galaxy/node/:id`

**File:** `server/routes/galaxy.js`

**Query params:** `cycle` (default `'2024'`)

**Logic:**
1. Parse node type from ID prefix: `emp:` → employer, `cmt:` → committee, `pol:` → candidate
2. Fetch 1-hop subgraph edges from `money_flow_edges` where `source_id = rawId OR target_id = rawId` AND `cycle = cycle`
3. Join `pac_committees` for committee labels; join `politicians` for candidate labels (same pattern as existing `getUniverse`)
4. Classify employer sector via `classifySector(label)` (server-side, no DB column needed)
5. Fetch timeline:
   - **Receipts:** `SELECT contributor_employer, committee_id, amount, date FROM contributions WHERE (committee_id = rawId OR contributor_employer ILIKE '%rawLabel%') AND date BETWEEN cycle_start AND cycle_end` — cycle 2024 → `2023-01-01` to `2024-12-31`; cycle 2026 → `2025-01-01` to `2026-12-31`. For employer nodes match on `contributor_employer ILIKE '%rawLabel%'`; for committee nodes match on `committee_id = rawId`.
   - **Transfers:** `SELECT from_committee_id, to_committee_id, transfer_amount, transfer_date FROM committee_transfers WHERE from_committee_id = rawId OR to_committee_id = rawId AND cycle = cycle`
   - Merge and sort ascending by date; limit 50 events
6. Look up `funding_flow_patterns` where `node_ids @> ARRAY[id]` to find any matching patterns
7. Return `NodeSubgraph` shape

**Response shape:**
```json
{
  "success": true,
  "source": "supabase",
  "data": {
    "node": { "id": "emp:...", "label": "SPACEX", "kind": "employer", "amount": 238523077, "sector": "Defense" },
    "nodes": [...],
    "edges": [...],
    "timeline": [
      { "date": "2024-07-03", "kind": "receipt", "from_label": "SpaceX", "to_label": "AMERICA PAC", "amount": 5000000 }
    ],
    "patterns": [
      { "id": "3ba06bef-...", "pattern_type": "sector_concentration", "title": "SpaceX-Linked Funds...", "narrative": "...", "severity_score": 9 }
    ]
  }
}
```

### 2. New route — `GET /api/congress/member/:bioguideId`

**File:** `server/routes/congress.js` — add one route

**Logic:** Call existing `getMemberDetails(bioguideId)` from `congressGov.js`. Return the result directly. Cached by the existing in-memory cache in `congressGov.js` (2-hour TTL).

**Response shape:**
```json
{
  "success": true,
  "data": {
    "bioguideId": "T000483",
    "name": "Trump, Donald J.",
    "party": "R",
    "state": "FL",
    "chamber": "Presidential",
    "depiction": "https://bioguide.congress.gov/bioguide/photo/T/T000483.jpg",
    "url": "https://www.congress.gov/member/donald-trump/T000483"
  }
}
```

---

## Frontend Components

### 3. `MiniGalaxy.jsx` — `src/components/galaxy/MiniGalaxy.jsx`

Self-contained D3 force simulation at panel scale.

**Props:**
```typescript
{
  nodes: GalaxyNode[]
  edges: GalaxyEdge[]
  height?: number          // default 220
  surface?: 'dark' | 'light'
  focusNodeId?: string     // highlights the clicked node
}
```

**Behavior:**
- Imports layout helpers from `src/components/galaxy/lib/galaxyBuild.js` (client-side) and force configs from `src/components/galaxy/lib/galaxyForces.js` — reuses existing force engine, no new physics code. Note: this is the **client-side** `galaxyBuild.js`, not the server-side `server/services/galaxyService.js`.
- Runs simulation for 150 ticks on mount, then animates remaining ticks via `requestAnimationFrame`
- Node circles colored by `node.kind`: employer = amber, committee = blue, candidate = red/blue by party
- Edge thickness proportional to `log(amount)`
- `focusNodeId` node rendered at 1.4× radius with orange stroke ring
- Zoom via D3 zoom (scroll wheel); drag nodes via D3 drag
- Label: name truncated to 18 chars, rendered below node, hidden when zoom < 0.6
- Bottom caption: "Drag to pan · scroll to zoom · hover to focus" in `t.low` color

### 4. `ContributionTimeline.jsx` — `src/components/galaxy/ContributionTimeline.jsx`

Sorted dated event list.

**Props:**
```typescript
{
  events: TimelineEvent[]
  surface?: 'dark' | 'light'
}
```

**Behavior:**
- Renders a 3-column CSS grid: `[date 55px] [dot+line 10px] [text 1fr]`
- Amber dot (`#FFB84D`) for `kind === 'receipt'`, blue dot (`#4A7FFF`) for `kind === 'transfer'`
- Vertical connector line between consecutive events (same color as dot above)
- Amount right-aligned in orange (`#FF8000`)
- Empty state: "No dated transactions found for this node"
- Legend at bottom: amber = individual receipt, blue = committee transfer
- Max height 280px with `overflowY: auto`

### 5. `PatternNarrative.jsx` — `src/components/galaxy/PatternNarrative.jsx`

AI pattern text block. Only rendered when `patterns.length > 0`.

**Props:**
```typescript
{
  patterns: PatternRef[]
  surface?: 'dark' | 'light'
}
```

**Behavior:**
- Shows first (highest severity) pattern by default
- Left orange border (`2px solid #FF800055`), dark background block
- Label row: "AI PATTERN ANALYSIS" + severity badge (red at ≥8, amber at 5–7, grey below)
- Pattern type badge (sector_concentration, dark_money_pathway, committee_alignment, sudden_surge)
- Narrative paragraph (13px, `t.mid` color)
- If `patterns.length > 1`: "Also appears in N other patterns" chip list — each chip is the pattern title truncated to 40 chars
- Clicking a chip does nothing in MVP (future: navigate to that pattern)

### 6. `PoliticianProfile.jsx` — `src/components/galaxy/PoliticianProfile.jsx`

Congress.gov photo + metadata. Only rendered when `node.kind === 'candidate'`.

**Props:**
```typescript
{
  node: GalaxyNode         // must have fec_candidate_id
  bioguideId?: string      // from node metadata; if null, renders name-only fallback
  surface?: 'dark' | 'light'
}
```

**Behavior:**
- On mount: if `bioguideId` is non-null, calls `GET /api/congress/member/:bioguideId`
- Photo: 48×60px rounded rect; `object-fit: cover`; fallback = grey avatar silhouette if fetch fails or no photo
- Party badge color: R = red (`#FF4466`), D = blue (`#4A7FFF`), I/other = grey
- State + chamber displayed inline
- "View on congress.gov ↗" link (`href` from member `url` field), opens in new tab
- If `bioguideId` is null (presidential candidates without Congress tenure): renders name + party badge only, no photo

### 7. `GalaxyDrawer.jsx` — refactor (existing file)

**Changes:**
- `PatternView` and `NodeView` replaced by a unified `DetailView` component
- `DetailView` calls `GET /api/galaxy/node/:id` on mount (replaces per-type logic)
- For politician nodes, fires parallel `GET /api/congress/member/:bioguideId` fetch
- Layout: `MiniGalaxy` (top) → `[PatternNarrative if patterns.length > 0]` → `[PoliticianProfile if candidate]` → `ContributionTimeline` (bottom)
- Sector halo click: `payload.kind === 'sector'` renders a `SectorView` using existing `galaxy.sector()` API call + sector-scoped timeline (top 30 events from sector's node_ids)
- Drawer width remains 420px; mini-galaxy height 220px; timeline max-height 280px with scroll
- Drawer `<aside>` has `overflowY: auto` so the full panel scrolls when content exceeds viewport height
- `bioguide_id` must be included in galaxy node objects returned by `buildEnvelope` — add `politicians.bioguide_id` to the politician join in `galaxyService.js` `loadPoliticians()` so it flows through to `GalaxyNode.bioguide_id`
- `Escape` key and backdrop click still close the drawer

---

## API Client additions

**File:** `src/api/client.js`

```javascript
// in galaxy object:
node: (nodeId, { cycle } = {}) => {
  const qs = new URLSearchParams({ ...(cycle && { cycle }) }).toString()
  return request(`/api/galaxy/node/${encodeURIComponent(nodeId)}${qs ? '?' + qs : ''}`)
},

// in congress object (new):
member: (bioguideId) => request(`/api/congress/member/${encodeURIComponent(bioguideId)}`),
```

---

## Drawer Variant Summary

| Click target | `payload.kind` | Metadata section | Extra sections |
|---|---|---|---|
| Employer node | `'employer'` | Name, sector, KPIs | — |
| Committee/PAC node | `'committee'` | Name, type badges, KPIs, donor chips | — |
| Candidate node | `'candidate'` | PoliticianProfile (photo + congress.gov) | — |
| Pattern flare node (any type) | base kind + `patterns.length > 0` | Base metadata | PatternNarrative |
| Sector halo ring | `'sector'` | Sector name, total flow, top pattern narrative | — |
| Dark money / 501c4 | `'committee'` + `is_501c4 = true` | Dark money warning block | — |

---

## Graceful Degradation

- **No bioguide_id** (presidential candidates, retired members): `PoliticianProfile` renders name + party badge only. No photo fetch attempted.
- **Congress.gov API down**: photo fails silently; grey avatar shown. Name + party still render from `politicians` table.
- **No timeline events**: `ContributionTimeline` shows "No dated transactions found for this node."
- **No patterns**: `PatternNarrative` not rendered at all.
- **Node not in MV** (edge case): drawer shows loading state, then "No data available for this node."

---

## Out of Scope (Post-MVP)

- Clicking a pattern chip in `PatternNarrative` to navigate to that pattern
- Animated timeline (events appearing one-by-one on open)
- Horizontal scatter timeline variant (considered and rejected — vertical is cleaner)
- Pagination of timeline events beyond 50
- Export / share panel state as URL
