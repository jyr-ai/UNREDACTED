# Node Detail Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the basic GalaxyDrawer with a rich detail panel that opens on any galaxy node click — showing a live mini D3 galaxy, a dated money-trail timeline, AI pattern narrative (for flare nodes), and Congress.gov photo (for politician nodes).

**Architecture:** One universal server endpoint (`GET /api/galaxy/node/:id`) returns a 1-hop subgraph + dated transactions for any node. Four new focused React components (MiniGalaxy, ContributionTimeline, PatternNarrative, PoliticianProfile) are wired into a refactored GalaxyDrawer. Sector halo clicks open a sector-scoped variant.

**Tech Stack:** React (inline styles + `useTheme`), D3 v7 force simulation, Express/Supabase, existing `galaxyForces.js` + `galaxyBuild.js` helpers, Congress.gov API via existing `getMemberDetails`.

**Visual reference:** `node_detail_panel.html` in the project root — open in a browser for the full UI spec.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `src/components/ui/SourceFooter.jsx` | Add `href` prop for clickable source links |
| Modify | `server/services/galaxyService.js` | Add `bioguide_id` to `loadPoliticians` select |
| Create | `server/services/galaxyNodeService.js` | Node detail: subgraph + timeline + patterns query |
| Modify | `server/routes/galaxy.js` | Add `GET /api/galaxy/node/:id` route |
| Modify | `server/routes/congress.js` | Add `GET /api/congress/member/:bioguideId` route |
| Modify | `src/api/client.js` | Add `galaxy.node()` + `congress.member()` |
| Create | `src/components/galaxy/MiniGalaxy.jsx` | Self-contained D3 force sim at panel scale |
| Create | `src/components/galaxy/ContributionTimeline.jsx` | Sorted dated event list (receipts + transfers) |
| Create | `src/components/galaxy/PatternNarrative.jsx` | AI pattern text block with severity badge |
| Create | `src/components/galaxy/PoliticianProfile.jsx` | Congress.gov photo + metadata block |
| Modify | `src/components/galaxy/GalaxyGraph.jsx` | Add `onSectorClick` prop + sector halo click handler |
| Modify | `src/components/galaxy/FundingFlowGalaxy.jsx` | Wire `onSectorClick` → drawer payload |
| Modify | `src/components/galaxy/GalaxyDrawer.jsx` | Full refactor: DetailView wiring all four components |

---

## Task 1: Extend SourceFooter with `href` prop

**Files:**
- Modify: `src/components/ui/SourceFooter.jsx`

Context: `SourceFooter` currently renders a plain text string. The CLAUDE.md rule requires every data point to link to a verifiable source. Adding an optional `href` makes the source text a clickable external link. No other component changes needed.

- [ ] **Step 1: Read the current file**

```bash
cat src/components/ui/SourceFooter.jsx
```

- [ ] **Step 2: Replace the component**

Replace the entire contents of `src/components/ui/SourceFooter.jsx` with:

```jsx
import { useTheme } from '../../theme/index.js'
import { FONT_MONO } from '../../theme/tokens.js'

function SourceFooter({ s, href }) {
  const t = useTheme()
  const style = {
    marginTop: 10, paddingTop: 8,
    borderTop: `1px solid ${t.border}`,
    fontFamily: FONT_MONO, fontSize: 8.5, color: t.low,
  }
  const text = `Sources: ${s}`
  return (
    <div style={style}>
      {href
        ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: t.low, textDecoration: 'none' }}>{text} ↗</a>
        : text}
    </div>
  )
}

export default SourceFooter
```

- [ ] **Step 3: Verify no existing callers break**

Run the dev server and check any page that renders a `SourceFooter` (e.g. FollowTheMoney, EmployerLeaderboard). They pass only `s` — the `href` prop is optional so they should render identically.

```bash
npm run dev:all
```

Expected: no console errors, existing source footers still render as plain text.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/SourceFooter.jsx
git commit -m "feat(ui): SourceFooter accepts href prop for clickable source links"
```

---

## Task 2: Add `bioguide_id` to `loadPoliticians`

**Files:**
- Modify: `server/services/galaxyService.js` (line 163)

Context: `loadPoliticians` currently selects `fec_candidate_id, name, party, state, chamber, office`. The `bioguide_id` column exists on the `politicians` table and is the key needed to fetch Congress.gov photos. Without it in the returned map, `PoliticianProfile` cannot make the photo request.

- [ ] **Step 1: Open the file and find `loadPoliticians`**

It starts at line 159. The select string on line 163 is:
```
'fec_candidate_id, name, party, state, chamber, office'
```

- [ ] **Step 2: Add `bioguide_id` to the select**

Change line 163 from:
```javascript
    .select('fec_candidate_id, name, party, state, chamber, office')
```
to:
```javascript
    .select('fec_candidate_id, name, party, state, chamber, office, bioguide_id')
```

- [ ] **Step 3: Add `bioguide_id` to the node object in `buildEnvelope`**

In `buildEnvelope`, the `upsertNode` function creates the node object at lines 63–73. Add `bioguide_id` to the object:

```javascript
      nodesMap.set(nid, {
        id: nid, kind, label: resolvedLabel,
        sector: sector || null,
        party: politician?.party || null,
        state: politician?.state || null,
        chamber: politician?.chamber || null,
        bioguide_id: politician?.bioguide_id || null,   // ADD THIS LINE
        amount: 0, degree: 0,
        is_501c4:   !!committee?.is_501c4,
        is_super_pac: !!committee?.is_super_pac,
        tier: Number(tier) || null
      })
```

- [ ] **Step 4: Verify**

```bash
curl "http://localhost:3001/api/galaxy/universe?cycle=2024" | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))
  const pol = d.nodes.find(n => n.kind === 'politician')
  console.log('politician node:', JSON.stringify(pol, null, 2))
"
```

Expected: politician node has `bioguide_id` field (may be null for presidential candidates, non-null for senators/representatives).

- [ ] **Step 5: Commit**

```bash
git add server/services/galaxyService.js
git commit -m "feat(galaxy): include bioguide_id on politician nodes for Congress.gov photo fetch"
```

---

## Task 3: `galaxyNodeService.js` — node detail query

**Files:**
- Create: `server/services/galaxyNodeService.js`

Context: This is the core of the feature. Given any prefixed node ID (`emp:...`, `cmt:...`, `pol:...`), it returns: 1-hop subgraph (nodes + edges), dated transactions (timeline), and any matching AI patterns. The `ensure()` function is from `server/lib/supabase.js` — it throws a clear error if Supabase isn't configured.

- [ ] **Step 1: Create the file**

Create `server/services/galaxyNodeService.js` with this content:

```javascript
import { ensure } from '../lib/supabase.js'
import { classifySector } from '../lib/sectorClassifier.js'

function parseNodeId(nodeId) {
  const i = nodeId.indexOf(':')
  return { kind: nodeId.slice(0, i), rawId: nodeId.slice(i + 1) }
}

function cycleRange(cycle) {
  const y = parseInt(cycle)
  return { start: `${y - 1}-01-01`, end: `${y}-12-31`, year: y }
}

export async function getNodeDetail({ nodeId, cycle = '2024' }) {
  const db = ensure()
  const { kind, rawId } = parseNodeId(nodeId)

  // ── 1. 1-hop subgraph ────────────────────────────────────────────────────
  const { data: edgeRows, error: edgeErr } = await db
    .from('money_flow_edges')
    .select('source_type,source_id,source_label,target_type,target_id,target_label,amount,txn_count,source_tier,target_tier')
    .or(`source_id.eq.${rawId},target_id.eq.${rawId}`)
    .eq('cycle', parseInt(cycle))
    .order('amount', { ascending: false })
    .limit(50)
  if (edgeErr) throw edgeErr
  const edges = edgeRows || []

  // ── 2. Collect IDs for label joins ───────────────────────────────────────
  const committeeIds = new Set()
  const candidateIds = new Set()
  for (const e of edges) {
    if (e.source_type !== 'employer') committeeIds.add(e.source_id)
    if (e.target_type !== 'employer') committeeIds.add(e.target_id)
    if (e.source_type === 'candidate') candidateIds.add(e.source_id)
    if (e.target_type === 'candidate') candidateIds.add(e.target_id)
  }

  // ── 3. Parallel label lookups ────────────────────────────────────────────
  const [cmtRes, polRes] = await Promise.all([
    committeeIds.size
      ? db.from('pac_committees').select('committee_id,name,is_super_pac,is_501c4').in('committee_id', [...committeeIds])
      : { data: [] },
    candidateIds.size
      ? db.from('politicians').select('fec_candidate_id,name,party,state,chamber,bioguide_id').in('fec_candidate_id', [...candidateIds])
      : { data: [] },
  ])
  const cmtMap = new Map((cmtRes.data || []).map(c => [c.committee_id, c]))
  const polMap = new Map((polRes.data || []).map(p => [p.fec_candidate_id, p]))

  // ── 4. Build nodes + edges ───────────────────────────────────────────────
  const nodesMap = new Map()

  function upsertNode(type, id, rawLabel) {
    const prefix = type === 'employer' ? 'emp' : type === 'candidate' ? 'pol' : 'cmt'
    const nid = `${prefix}:${id}`
    if (!nodesMap.has(nid)) {
      const pol = polMap.get(id)
      const cmt = cmtMap.get(id)
      const label = type === 'candidate' ? (pol?.name || rawLabel || id)
                  : type !== 'employer'  ? (cmt?.name || rawLabel || id)
                  : (rawLabel || id)
      nodesMap.set(nid, {
        id: nid,
        kind: type === 'employer' ? 'employer'
            : type === 'candidate' ? 'politician'
            : cmt?.is_super_pac ? 'super_pac'
            : cmt?.is_501c4   ? 'dark_money'
            : 'trad_pac',
        label,
        sector: type === 'employer' ? classifySector(label) : null,
        party:       pol?.party      || null,
        state:       pol?.state      || null,
        chamber:     pol?.chamber    || null,
        bioguide_id: pol?.bioguide_id || null,
        is_super_pac: !!cmt?.is_super_pac,
        is_501c4:     !!cmt?.is_501c4,
        amount: 0, degree: 0,
      })
    }
    return nid
  }

  const builtEdges = []
  for (const e of edges) {
    const sId = upsertNode(e.source_type, e.source_id, e.source_label)
    const tId = upsertNode(e.target_type, e.target_id, e.target_label)
    const amt = Number(e.amount) || 0
    const sn = nodesMap.get(sId), tn = nodesMap.get(tId)
    sn.amount += amt; sn.degree++; tn.degree++
    builtEdges.push({ source: sId, target: tId, amount: amt, weight: 0 })
  }
  const maxAmt = Math.max(...builtEdges.map(e => e.amount), 1)
  for (const e of builtEdges) e.weight = e.amount / maxAmt

  // Ensure focal node exists even if it has no edges in MV
  if (!nodesMap.has(nodeId)) {
    const typeMap = { emp: 'employer', cmt: 'committee', pol: 'candidate' }
    upsertNode(typeMap[kind] || 'committee', rawId, rawId)
  }
  const focalNode = nodesMap.get(nodeId)

  // ── 5. Timeline ──────────────────────────────────────────────────────────
  const { start, end, year } = cycleRange(cycle)
  const timeline = []

  if (kind === 'emp') {
    const { data: receipts } = await db
      .from('contributions')
      .select('contributor_employer,committee_id,amount,date')
      .ilike('contributor_employer', rawId)
      .gte('date', start).lte('date', end)
      .order('date', { ascending: true }).limit(50)
    for (const r of receipts || []) {
      timeline.push({
        date: r.date, kind: 'receipt',
        from_label: r.contributor_employer || rawId,
        from_id: nodeId,
        to_label: cmtMap.get(r.committee_id)?.name || r.committee_id,
        to_id: `cmt:${r.committee_id}`,
        amount: Number(r.amount),
      })
    }
  } else if (kind === 'cmt') {
    const [{ data: receipts }, { data: transfers }] = await Promise.all([
      db.from('contributions').select('contributor_employer,committee_id,amount,date')
        .eq('committee_id', rawId).gte('date', start).lte('date', end)
        .order('date', { ascending: true }).limit(25),
      db.from('committee_transfers').select('from_committee_id,to_committee_id,transfer_amount,transfer_date')
        .or(`from_committee_id.eq.${rawId},to_committee_id.eq.${rawId}`)
        .eq('cycle', year).order('transfer_date', { ascending: true }).limit(25),
    ])
    for (const r of receipts || []) {
      timeline.push({
        date: r.date, kind: 'receipt',
        from_label: r.contributor_employer || 'Unknown',
        from_id: `emp:${(r.contributor_employer || 'unknown').toLowerCase()}`,
        to_label: cmtMap.get(rawId)?.name || rawId,
        to_id: nodeId,
        amount: Number(r.amount),
      })
    }
    for (const t of transfers || []) {
      if (!t.transfer_date) continue
      timeline.push({
        date: t.transfer_date, kind: 'transfer',
        from_label: cmtMap.get(t.from_committee_id)?.name || t.from_committee_id,
        from_id: `cmt:${t.from_committee_id}`,
        to_label: cmtMap.get(t.to_committee_id)?.name || t.to_committee_id,
        to_id: `cmt:${t.to_committee_id}`,
        amount: Number(t.transfer_amount),
      })
    }
  } else if (kind === 'pol') {
    const cmtIds = [...nodesMap.values()]
      .filter(n => n.kind !== 'politician' && n.kind !== 'employer')
      .map(n => n.id.slice(4))   // strip 'cmt:'
    if (cmtIds.length) {
      const { data: transfers } = await db
        .from('committee_transfers').select('from_committee_id,to_committee_id,transfer_amount,transfer_date')
        .in('to_committee_id', cmtIds)
        .eq('cycle', year).order('transfer_date', { ascending: true }).limit(50)
      for (const t of transfers || []) {
        if (!t.transfer_date) continue
        timeline.push({
          date: t.transfer_date, kind: 'transfer',
          from_label: cmtMap.get(t.from_committee_id)?.name || t.from_committee_id,
          from_id: `cmt:${t.from_committee_id}`,
          to_label: cmtMap.get(t.to_committee_id)?.name || t.to_committee_id,
          to_id: `cmt:${t.to_committee_id}`,
          amount: Number(t.transfer_amount),
        })
      }
    }
  }

  timeline.sort((a, b) => new Date(a.date) - new Date(b.date))

  // ── 6. Patterns ──────────────────────────────────────────────────────────
  const { data: patternRows } = await db
    .from('funding_flow_patterns')
    .select('id,pattern_type,title,narrative,explanation,sector,severity_score,generated_at')
    .contains('node_ids', [nodeId])
    .eq('visible', true)
    .order('severity_score', { ascending: false })

  return {
    node:     focalNode,
    nodes:    [...nodesMap.values()],
    edges:    builtEdges,
    timeline,
    patterns: patternRows || [],
  }
}
```

- [ ] **Step 2: Verify the file saved**

```bash
node -e "import('./server/services/galaxyNodeService.js').then(() => console.log('OK')).catch(e => console.error(e.message))"
```

Expected: `OK` (or a Supabase error if env isn't loaded — that's fine, the import itself should succeed).

- [ ] **Step 3: Commit**

```bash
git add server/services/galaxyNodeService.js
git commit -m "feat(galaxy): galaxyNodeService — node detail subgraph + timeline + patterns"
```

---

## Task 4: `GET /api/galaxy/node/:id` route

**Files:**
- Modify: `server/routes/galaxy.js`

Context: Wire `getNodeDetail` into the existing galaxy router. The router already has a `wrap()` helper that handles errors and 404s. The GALAXY_ENABLED middleware gate is already applied to all routes.

- [ ] **Step 1: Add the import**

At the top of `server/routes/galaxy.js`, after the existing import:

```javascript
import {
  getUniverse,
  getSector,
  getEmployer,
  getPatternDetail
} from '../services/galaxyService.js'
```

Add:

```javascript
import { getNodeDetail } from '../services/galaxyNodeService.js'
```

- [ ] **Step 2: Add the route**

After the `router.get('/patterns/:id', ...)` line, add:

```javascript
router.get('/node/:nodeId', wrap(req => getNodeDetail({
  nodeId: decodeURIComponent(req.params.nodeId),
  cycle:  req.query.cycle || '2024',
})))
```

- [ ] **Step 3: Verify with curl**

With `npm run dev:server` running:

```bash
curl "http://localhost:3001/api/galaxy/node/emp:space%20exploration%20technologies%20corp.?cycle=2024" | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))
  console.log('node:', d.node?.label)
  console.log('neighbors:', d.nodes?.length)
  console.log('timeline events:', d.timeline?.length)
  console.log('patterns:', d.patterns?.length)
"
```

Expected output:
```
node: SPACE EXPLORATION TECHNOLOGIES CORP.
neighbors: 4-8
timeline events: 1-22
patterns: 1-2
```

- [ ] **Step 4: Test a committee node**

```bash
curl "http://localhost:3001/api/galaxy/node/cmt:C00879510?cycle=2024" | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))
  console.log('node:', d.node?.label, '| kind:', d.node?.kind)
  console.log('timeline:', d.timeline?.slice(0,2).map(e => e.date + ' ' + e.kind + ' $' + e.amount))
"
```

Expected: node label is the committee name (not raw ID), timeline has receipts and/or transfers.

- [ ] **Step 5: Commit**

```bash
git add server/routes/galaxy.js
git commit -m "feat(galaxy): GET /api/galaxy/node/:id — universal node detail endpoint"
```

---

## Task 5: `GET /api/congress/member/:bioguideId` route

**Files:**
- Modify: `server/routes/congress.js`

Context: `getMemberDetails` already exists in `server/services/congressGov.js` and returns `{ bioguideId, name, party, state, chamber, depiction, url }`. This is a one-route wrapper. The existing congress router has no bioguide-specific endpoint.

- [ ] **Step 1: Add the import**

At the top of `server/routes/congress.js`, change:

```javascript
import { getMembersByState, getBillsByState, getRecentVotes } from '../services/congressGov.js'
```

to:

```javascript
import { getMembersByState, getBillsByState, getRecentVotes, getMemberDetails } from '../services/congressGov.js'
```

- [ ] **Step 2: Add the route**

After the existing `router.get('/members', ...)` block and before `export default router`, add:

```javascript
router.get('/member/:bioguideId', async (req, res) => {
  try {
    const data = await getMemberDetails(req.params.bioguideId)
    if (!data) return res.status(404).json({ success: false, error: 'member_not_found' })
    res.json({ success: true, data })
  } catch (e) {
    console.error('congress/member error:', e.message)
    res.status(500).json({ success: false, error: e.message })
  }
})
```

- [ ] **Step 3: Verify with a known bioguide ID**

Senator Mitch McConnell's bioguide ID is `M000355`:

```bash
curl "http://localhost:3001/api/congress/member/M000355" | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))
  console.log('name:', d.data?.name)
  console.log('party:', d.data?.party)
  console.log('photo:', d.data?.depiction ? 'present' : 'missing')
  console.log('url:', d.data?.url)
"
```

Expected:
```
name: McConnell, Mitch
party: R
photo: present
url: https://www.congress.gov/member/mitch-mcconnell/M000355
```

- [ ] **Step 4: Commit**

```bash
git add server/routes/congress.js
git commit -m "feat(congress): GET /api/congress/member/:bioguideId wraps getMemberDetails"
```

---

## Task 6: API client additions

**Files:**
- Modify: `src/api/client.js`

Context: The API client in `src/api/client.js` groups methods by domain. The `galaxy` object currently has `universe`, `sector`, `employer`, `pattern`. The `congress` object doesn't exist — congress data is only used server-side so far. Add both methods.

- [ ] **Step 1: Add `galaxy.node` to the galaxy object**

Find the `galaxy` object in `src/api/client.js` (around line 229). It ends with:

```javascript
  pattern: (id) => request(`/api/galaxy/patterns/${encodeURIComponent(id)}`),
}
```

Change to:

```javascript
  pattern: (id) => request(`/api/galaxy/patterns/${encodeURIComponent(id)}`),
  node: (nodeId, { cycle } = {}) => {
    const qs = new URLSearchParams({ ...(cycle && { cycle }) }).toString()
    return request(`/api/galaxy/node/${encodeURIComponent(nodeId)}${qs ? '?' + qs : ''}`)
  },
}
```

- [ ] **Step 2: Add the `congress` object**

After the `galaxy` object closing `}` and before the `version` object, add:

```javascript
// ── Congress ─────────────────────────────────────────────────────────────
export const congress = {
  member: (bioguideId) => request(`/api/congress/member/${encodeURIComponent(bioguideId)}`),
}
```

- [ ] **Step 3: Add `congress` to the default export**

Find the `export default {` at the bottom of the file and add `congress`:

```javascript
export default {
  spending, donors, policy, congress, feed, agent, aiAgent, settings,
  corruption, companies, stockAct, darkMoney, campaignWatch, galaxy, health,
}
```

- [ ] **Step 4: Verify the dev build compiles**

```bash
npm run dev
```

Expected: Vite compiles with no errors. Open browser console → `window.__VITE_DEV__` or just check no red errors in terminal.

- [ ] **Step 5: Commit**

```bash
git add src/api/client.js
git commit -m "feat(api): add galaxy.node() and congress.member() to API client"
```

---

## Task 7: `MiniGalaxy.jsx` component

**Files:**
- Create: `src/components/galaxy/MiniGalaxy.jsx`

Context: A self-contained D3 force simulation rendered as an SVG inside the drawer. Receives `nodes[]` and `edges[]` already shaped from the API (same shape as the main galaxy). Uses `buildSimulation` from `galaxyForces.js` with simplified sector clustering (no sector ring — the mini galaxy is too small for that). The `nodeRadius` helper is reused for consistent sizing. Supports drag and scroll-zoom.

**Key constraint:** D3's `forceSimulation` mutates node objects directly (adds `x`, `y`, `vx`, `vy`). Always clone nodes and links before passing to D3, so the original props are not mutated.

- [ ] **Step 1: Create the file**

Create `src/components/galaxy/MiniGalaxy.jsx`:

```jsx
import { useEffect, useRef, useState, useMemo } from 'react'
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } from 'd3'
import { nodeRadius } from './lib/galaxyForces.js'
import { galaxyTokens } from './lib/galaxyTokens.js'

const KIND_COLOR = {
  employer:   '#FFB84D',
  super_pac:  '#4A7FFF',
  dark_money: '#CC88FF',
  trad_pac:   '#4A7FFF',
  politician: '#FF4466',
}

function buildMiniSim({ nodes, links, width, height }) {
  return forceSimulation(nodes)
    .force('link',    forceLink(links).id(n => n.id).distance(55).strength(0.35))
    .force('charge',  forceManyBody().strength(-100))
    .force('collide', forceCollide().radius(n => nodeRadius(n) + 4).strength(0.8))
    .force('x',       forceX(width / 2).strength(0.04))
    .force('y',       forceY(height / 2).strength(0.04))
    .alpha(1).alphaDecay(0.03)
}

export default function MiniGalaxy({ nodes = [], edges = [], height = 220, surface = 'dark', focusNodeId }) {
  const t = galaxyTokens[surface]
  const svgRef = useRef(null)
  const [tick, setTick] = useState(0)
  const simRef = useRef(null)
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const dragRef = useRef(null)

  // Clone nodes + links so D3 mutation doesn't affect props
  const simNodes = useMemo(() => nodes.map(n => ({ ...n })), [nodes])
  const simLinks = useMemo(
    () => edges.map(e => ({ ...e, source: e.source, target: e.target })),
    [edges]
  )

  const width = svgRef.current?.clientWidth || 380

  useEffect(() => {
    if (!simNodes.length) return
    const sim = buildMiniSim({ nodes: simNodes, links: simLinks, width, height })
    simRef.current = sim
    // Pre-stabilize 150 ticks headless
    for (let i = 0; i < 150; i++) sim.tick()
    setTick(t => t + 1)
    // Animate remaining
    sim.on('tick', () => setTick(t => t + 1))
    return () => sim.stop()
  }, [nodes, edges])  // eslint-disable-line react-hooks/exhaustive-deps

  function onWheel(e) {
    e.preventDefault()
    const rect = svgRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.15 : 0.87
    setView(v => {
      const k = Math.max(0.3, Math.min(5, v.k * factor))
      const scale = k / v.k
      return { k, x: mx - (mx - v.x) * scale, y: my - (my - v.y) * scale }
    })
  }

  function onMouseDown(e, nodeObj) {
    e.stopPropagation()
    dragRef.current = { nodeObj, ox: e.clientX - nodeObj.x, oy: e.clientY - nodeObj.y }
    simRef.current?.alphaTarget(0.15).restart()
  }

  function onMouseMove(e) {
    if (!dragRef.current) return
    const { nodeObj, ox, oy } = dragRef.current
    nodeObj.fx = (e.clientX - ox)
    nodeObj.fy = (e.clientY - oy)
  }

  function onMouseUp() {
    if (!dragRef.current) return
    const { nodeObj } = dragRef.current
    nodeObj.fx = null; nodeObj.fy = null
    simRef.current?.alphaTarget(0)
    dragRef.current = null
  }

  const nodeById = useMemo(() => new Map(simNodes.map(n => [n.id, n])), [simNodes, tick])

  return (
    <div style={{ position: 'relative', width: '100%', height, background: t.surfaceSub, overflow: 'hidden' }}
         onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
      <svg ref={svgRef} width="100%" height={height}
           onWheel={onWheel} style={{ display: 'block', cursor: 'grab' }}>
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {/* Edges */}
          {simLinks.map((e, i) => {
            const s = nodeById.get(typeof e.source === 'object' ? e.source.id : e.source)
            const tgt = nodeById.get(typeof e.target === 'object' ? e.target.id : e.target)
            if (!s || !tgt) return null
            return (
              <line key={i}
                x1={s.x} y1={s.y} x2={tgt.x} y2={tgt.y}
                stroke="#FF8000"
                strokeWidth={Math.max(0.5, Math.min(3, (e.weight || 0.2) * 3))}
                opacity={0.35 + (e.weight || 0) * 0.3}
              />
            )
          })}
          {/* Nodes */}
          {simNodes.map(n => {
            const r = nodeRadius(n)
            const color = KIND_COLOR[n.kind] || '#888'
            const isFocus = n.id === focusNodeId
            return (
              <g key={n.id} transform={`translate(${n.x ?? 0},${n.y ?? 0})`}
                 style={{ cursor: 'pointer' }}
                 onMouseDown={e => onMouseDown(e, n)}>
                {isFocus && <circle r={r + 4} fill="none" stroke="#FF8000" strokeWidth={1.5} opacity={0.7} />}
                {n.kind === 'dark_money'
                  ? <rect x={-r} y={-r} width={r*2} height={r*2} fill={t.nodeFill} stroke={color} strokeWidth={1.5} strokeDasharray="4,2" />
                  : n.kind === 'super_pac'
                  ? <polygon points={`0,${-r} ${r},0 0,${r} ${-r},0`} fill={t.nodeFill} stroke={color} strokeWidth={1.5} />
                  : <circle r={r} fill={n.kind === 'employer' ? color : t.nodeFill}
                             stroke={n.kind !== 'employer' ? color : 'none'} strokeWidth={1.5} />
                }
                <text y={r + 10} textAnchor="middle"
                      fontSize={7} fill={t.textMuted} fontFamily="Roboto, sans-serif"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {(n.label || '').slice(0, 18)}{(n.label || '').length > 18 ? '…' : ''}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
      <div style={{ position: 'absolute', bottom: 5, right: 8, fontSize: 7, color: t.textMuted, opacity: 0.4, pointerEvents: 'none' }}>
        Drag to pan · scroll to zoom
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Check that `galaxyTokens` has `canvasBg`, `nodeFill`, `labelColor`**

Open `src/components/galaxy/lib/galaxyTokens.js` and confirm those keys exist. If `canvasBg` is missing, use `background` or `surfaceBg` — match what the file uses.

- [ ] **Step 3: Smoke-test by importing in GalaxyDrawer temporarily**

Add a temporary import at the top of `GalaxyDrawer.jsx`:
```javascript
import MiniGalaxy from './MiniGalaxy.jsx'
```
If Vite compiles without error, remove the temporary import.

- [ ] **Step 4: Commit**

```bash
git add src/components/galaxy/MiniGalaxy.jsx
git commit -m "feat(galaxy): MiniGalaxy — self-contained D3 force sim for drawer panel"
```

---

## Task 8: `ContributionTimeline.jsx` component

**Files:**
- Create: `src/components/galaxy/ContributionTimeline.jsx`

Context: Renders a vertical dot-and-line timeline of dated financial transactions. Amber dots = individual FEC receipts (`contributions.date`), blue dots = PAC-to-PAC transfers (`committee_transfers.transfer_date`). The `events` array comes from the node detail endpoint, sorted ascending by date.

- [ ] **Step 1: Create the file**

Create `src/components/galaxy/ContributionTimeline.jsx`:

```jsx
import { useTheme } from '../../theme/index.js'
import { FONT_MONO, ORANGE } from '../../theme/tokens.js'
import SourceFooter from '../ui/SourceFooter.jsx'

const RECEIPT_COLOR  = '#FFB84D'
const TRANSFER_COLOR = '#4A7FFF'

function fmt$(v) {
  if (v == null) return '—'
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}b`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}m`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}k`
  return `$${Math.round(v)}`
}

function fmtDate(d) {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

export default function ContributionTimeline({ events = [], surface = 'dark' }) {
  const t = useTheme()

  if (!events.length) {
    return (
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 8, letterSpacing: 1.5, color: t.low, fontFamily: FONT_MONO, marginBottom: 8, textTransform: 'uppercase' }}>
          Money Trail
        </div>
        <div style={{ fontSize: 10, color: t.low, fontFamily: FONT_MONO }}>
          No dated transactions found for this node.
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 14px' }}>
      <div style={{ fontSize: 8, letterSpacing: 1.5, color: t.low, fontFamily: FONT_MONO, marginBottom: 10, textTransform: 'uppercase' }}>
        Money Trail — Contributions &amp; Transfers by Date
      </div>

      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
        {events.map((ev, i) => {
          const isLast = i === events.length - 1
          const dotColor = ev.kind === 'receipt' ? RECEIPT_COLOR : TRANSFER_COLOR
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '58px 10px 1fr', gap: '3px 8px', alignItems: 'start', marginBottom: 2 }}>
              {/* Date */}
              <div style={{ fontSize: 8, color: t.low, fontFamily: FONT_MONO, textAlign: 'right', paddingTop: 1 }}>
                {fmtDate(ev.date)}
              </div>
              {/* Dot + line */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, border: `1px solid ${dotColor}88`, flexShrink: 0 }} />
                {!isLast && <div style={{ width: 1, flex: 1, background: t.border, minHeight: 12 }} />}
              </div>
              {/* Text */}
              <div style={{ paddingBottom: 6 }}>
                <div style={{ fontSize: 9, color: t.hi, fontFamily: FONT_MONO, lineHeight: 1.4 }}>
                  {ev.from_label} → {ev.to_label}
                </div>
                <div style={{ fontSize: 8, color: t.low, fontFamily: FONT_MONO }}>
                  {ev.kind === 'receipt' ? 'Individual receipt' : 'Committee transfer'} ·{' '}
                  <span style={{ color: ORANGE, fontWeight: 600 }}>{fmt$(ev.amount)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginTop: 8, paddingTop: 6, borderTop: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: RECEIPT_COLOR }} />
          <span style={{ fontSize: 7.5, color: t.low, fontFamily: FONT_MONO }}>Individual receipt</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: TRANSFER_COLOR }} />
          <span style={{ fontSize: 7.5, color: t.low, fontFamily: FONT_MONO }}>Committee transfer</span>
        </div>
      </div>

      <SourceFooter
        s="FEC Individual Contributions (Schedule A) · FEC Committee-to-Committee Transfers"
        href="https://www.fec.gov/campaign-finance-data/"
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/galaxy/ContributionTimeline.jsx
git commit -m "feat(galaxy): ContributionTimeline — dated receipt/transfer event list"
```

---

## Task 9: `PatternNarrative.jsx` component

**Files:**
- Create: `src/components/galaxy/PatternNarrative.jsx`

Context: Renders the AI-detected pattern analysis block. Only mounted when `patterns.length > 0`. Shows the highest-severity pattern first, with a severity badge, pattern type label, narrative text, and chips for any additional patterns the node appears in.

- [ ] **Step 1: Create the file**

Create `src/components/galaxy/PatternNarrative.jsx`:

```jsx
import { useTheme } from '../../theme/index.js'
import { FONT_MONO, ORANGE } from '../../theme/tokens.js'
import SourceFooter from '../ui/SourceFooter.jsx'

const TYPE_LABEL = {
  sector_concentration: 'SECTOR CONCENTRATION',
  dark_money_pathway:   'DARK MONEY PATHWAY',
  committee_alignment:  'COMMITTEE ALIGNMENT',
  sudden_surge:         'SUDDEN SURGE',
}

function SeverityBadge({ score }) {
  const color = score >= 8 ? '#FF4466' : score >= 5 ? '#FFB84D' : '#666'
  return (
    <span style={{
      display: 'inline-block', padding: '1px 6px', borderRadius: 2,
      fontSize: 7, fontWeight: 700, letterSpacing: 0.5,
      border: `1px solid ${color}44`, color, background: `${color}18`,
    }}>
      SEVERITY {score}/10
    </span>
  )
}

export default function PatternNarrative({ patterns = [] }) {
  const t = useTheme()
  if (!patterns.length) return null

  const primary = patterns[0]
  const others  = patterns.slice(1)

  return (
    <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.border}` }}>
      <div style={{
        background: t.cardB,
        borderLeft: `2px solid ${ORANGE}55`,
        borderRadius: '0 3px 3px 0',
        padding: '8px 10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 7, letterSpacing: 1.5, color: ORANGE, opacity: 0.8, fontFamily: FONT_MONO }}>
            AI PATTERN ANALYSIS
          </span>
          <SeverityBadge score={primary.severity_score} />
          {primary.pattern_type && (
            <span style={{
              padding: '1px 5px', borderRadius: 2, fontSize: 7, letterSpacing: 0.5,
              border: `1px solid ${ORANGE}33`, color: ORANGE, background: `${ORANGE}12`,
              fontFamily: FONT_MONO,
            }}>
              {TYPE_LABEL[primary.pattern_type] || primary.pattern_type.toUpperCase().replace(/_/g, ' ')}
            </span>
          )}
        </div>

        <p style={{ fontSize: 11, lineHeight: 1.55, color: t.mid, margin: '0 0 4px', fontFamily: 'Roboto, sans-serif' }}>
          {primary.narrative}
        </p>

        {others.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 7, letterSpacing: 1, color: t.low, fontFamily: FONT_MONO, marginBottom: 3 }}>
              ALSO APPEARS IN {others.length} OTHER PATTERN{others.length > 1 ? 'S' : ''}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {others.map(p => (
                <span key={p.id} style={{
                  padding: '1px 6px', background: t.cardB,
                  border: `1px solid ${ORANGE}33`, borderRadius: 2,
                  fontSize: 7.5, color: ORANGE, fontFamily: FONT_MONO,
                  opacity: 0.8,
                }}>
                  ⚡ {p.title.slice(0, 40)}{p.title.length > 40 ? '…' : ''}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <SourceFooter
        s="AI analysis of FEC bulk data · generated by claude-sonnet-4-6"
        href="https://www.fec.gov/data/receipts/"
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/galaxy/PatternNarrative.jsx
git commit -m "feat(galaxy): PatternNarrative — AI pattern block with severity badge"
```

---

## Task 10: `PoliticianProfile.jsx` component

**Files:**
- Create: `src/components/galaxy/PoliticianProfile.jsx`

Context: Fetches the Congress.gov photo and member metadata for candidate nodes. Only mounted when `node.kind === 'politician'`. The `bioguide_id` comes from `node.bioguide_id` (added in Task 2). If `bioguide_id` is null (presidential candidates, retired members), renders name + party badge only — no fetch attempted.

- [ ] **Step 1: Create the file**

Create `src/components/galaxy/PoliticianProfile.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { useTheme } from '../../theme/index.js'
import { FONT_MONO } from '../../theme/tokens.js'
import { congress } from '../../api/client.js'
import SourceFooter from '../ui/SourceFooter.jsx'

const PARTY_COLOR = { R: '#FF4466', D: '#4A7FFF' }

function fmt$(v) {
  if (v == null) return '—'
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}b`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}m`
  return `$${Math.round(v).toLocaleString()}`
}

export default function PoliticianProfile({ node }) {
  const t = useTheme()
  const [member, setMember] = useState(null)

  useEffect(() => {
    if (!node?.bioguide_id) return
    congress.member(node.bioguide_id)
      .then(r => setMember(r?.data || null))
      .catch(() => setMember(null))
  }, [node?.bioguide_id])

  if (!node) return null

  const party      = node.party || member?.party
  const partyColor = PARTY_COLOR[party] || '#666'
  const photoUrl   = member?.depiction
  const cgUrl      = member?.url

  return (
    <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.border}` }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 6 }}>

        {/* Photo or avatar */}
        <div style={{
          width: 48, height: 60, borderRadius: 3, overflow: 'hidden', flexShrink: 0,
          background: t.cardB, border: `1px solid ${t.border}`,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          {photoUrl
            ? <img src={photoUrl} alt={node.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: 28, height: 28, borderRadius: '50%', background: t.border, marginBottom: 2 }} />
          }
        </div>

        {/* Name + badges */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.hi, marginBottom: 3, fontFamily: 'Roboto, sans-serif', lineHeight: 1.3 }}>
            {node.label}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 4 }}>
            {party && (
              <span style={{
                padding: '1px 5px', borderRadius: 2, fontSize: 7, fontWeight: 700, letterSpacing: 0.5,
                border: `1px solid ${partyColor}44`, color: partyColor, background: `${partyColor}18`,
                fontFamily: FONT_MONO,
              }}>
                {party === 'R' ? 'REPUBLICAN' : party === 'D' ? 'DEMOCRAT' : party}
              </span>
            )}
            {(node.chamber || member?.chamber) && (
              <span style={{ padding: '1px 5px', borderRadius: 2, fontSize: 7, border: `1px solid ${t.border}`, color: t.mid, fontFamily: FONT_MONO }}>
                {(node.chamber || member?.chamber || '').toUpperCase()}
              </span>
            )}
            {(node.state || member?.state) && (
              <span style={{ padding: '1px 5px', borderRadius: 2, fontSize: 7, border: `1px solid ${t.border}`, color: t.mid, fontFamily: FONT_MONO }}>
                {node.state || member?.state}
              </span>
            )}
          </div>
          {node.amount > 0 && (
            <div style={{ fontSize: 8, color: t.low, fontFamily: FONT_MONO }}>
              Received <span style={{ color: '#FF8000', fontWeight: 600 }}>{fmt$(node.amount)}</span> this cycle
            </div>
          )}
        </div>
      </div>

      {cgUrl && (
        <a href={cgUrl} target="_blank" rel="noopener noreferrer"
           style={{ fontSize: 8, color: '#4A7FFF', fontFamily: FONT_MONO, textDecoration: 'none' }}>
          View on congress.gov ↗
        </a>
      )}

      <SourceFooter
        s={`FEC Candidate Profile · Congress.gov${member?.bioguideId ? ` (Bioguide ${member.bioguideId})` : ''}`}
        href={cgUrl || `https://www.fec.gov/data/candidate/${node.id?.replace('pol:', '')}/`}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/galaxy/PoliticianProfile.jsx
git commit -m "feat(galaxy): PoliticianProfile — Congress.gov photo + metadata for candidate nodes"
```

---

## Task 11: Refactor `GalaxyDrawer.jsx` + wire `GalaxyGraph` sector click

**Files:**
- Modify: `src/components/galaxy/GalaxyDrawer.jsx`
- Modify: `src/components/galaxy/GalaxyGraph.jsx` (add `onSectorClick`)
- Modify: `src/components/galaxy/FundingFlowGalaxy.jsx` (wire `onSectorClick` → drawer)

Context: This is the integration task. `GalaxyDrawer` currently has `PatternView` and `NodeView` — replace both with a unified `DetailView` that calls the universal node endpoint. Add a `SectorView` for sector halo clicks. Wire the sector halo `<circle>` elements in `GalaxyGraph` to fire `onSectorClick`. Drawer width stays 420px; `<aside>` gets `overflowY: auto`.

**Sub-step A: Add `onSectorClick` to `GalaxyGraph.jsx`**

- [ ] **Step 1: Open `GalaxyGraph.jsx` and find where sector halo circles are rendered**

Search for `sectorBounds` in the file — the sector halos are rendered as `<circle>` elements from the `sectorBounds` useMemo. They currently have `pointerEvents="none"`.

- [ ] **Step 2: Add `onSectorClick` prop to the component signature**

```javascript
export default function GalaxyGraph({
  envelope,
  surface = 'dark',
  width = 900,
  height = 560,
  onNodeClick,
  onPatternClick,
  onSectorClick,       // ADD THIS
}) {
```

- [ ] **Step 3: Make sector halo circles clickable**

Find the sector halo `<circle>` render. It currently has `pointerEvents="none"`. Change it to fire `onSectorClick`:

```jsx
<circle
  key={`halo-${s.name}`}
  cx={bounds.cx} cy={bounds.cy} r={bounds.r}
  fill={s.color}
  fillOpacity={surface === 'dark' ? 0.07 : 0.10}
  stroke={s.color}
  strokeOpacity={surface === 'dark' ? 0.18 : 0.22}
  strokeWidth={1}
  style={{ cursor: onSectorClick ? 'pointer' : 'default' }}
  onClick={() => onSectorClick?.(s)}
/>
```

Note: `s` here is the sector object from `graph.sectors` with `{ name, color, total_amount, node_count }`.

**Sub-step B: Wire `onSectorClick` in `FundingFlowGalaxy.jsx`**

- [ ] **Step 4: Find where `GalaxyGraph` is rendered in `FundingFlowGalaxy.jsx`**

It receives `onNodeClick` and `onPatternClick` props already. Add `onSectorClick`:

```jsx
<GalaxyGraph
  envelope={data}
  surface={surface}
  width={containerWidth}
  height={height}
  onNodeClick={n  => setDrawerPayload({ kind: 'node',    node: n })}
  onPatternClick={p => setDrawerPayload({ kind: 'pattern', pattern: p })}
  onSectorClick={s  => setDrawerPayload({ kind: 'sector',  sector: s })}
/>
```

**Sub-step C: Rewrite `GalaxyDrawer.jsx`**

- [ ] **Step 5: Replace the entire contents of `GalaxyDrawer.jsx`**

```jsx
import { useEffect, useState } from 'react'
import { galaxy } from '../../api/client.js'
import { galaxyTokens } from './lib/galaxyTokens.js'
import MiniGalaxy from './MiniGalaxy.jsx'
import ContributionTimeline from './ContributionTimeline.jsx'
import PatternNarrative from './PatternNarrative.jsx'
import PoliticianProfile from './PoliticianProfile.jsx'
import SourceFooter from '../ui/SourceFooter.jsx'
import { FONT_MONO } from '../../theme/tokens.js'

function Band({ label, right, t }) {
  return (
    <div style={{
      background: t.band, color: t.bandText,
      padding: '7px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontFamily: FONT_MONO, flexShrink: 0,
    }}>
      <span style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 500 }}>{label}</span>
      {right && <span style={{ fontSize: 8, opacity: 0.55 }}>{right}</span>}
    </div>
  )
}

function KPI({ label, value, t }) {
  return (
    <div>
      <div style={{ fontSize: 7.5, letterSpacing: 1.5, color: t.textMuted, fontFamily: FONT_MONO, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#FF8000', fontFamily: FONT_MONO }}>{value}</div>
    </div>
  )
}

function fmt$(v) {
  if (v == null) return '—'
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}b`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}m`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}k`
  return `$${Math.round(v)}`
}

// ── Detail view: universal node click ────────────────────────────────────────
function DetailView({ payload, cycle, t, surface }) {
  const node = payload.node
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setDetail(null)
    setLoading(true)
    galaxy.node(node.id, { cycle })
      .then(r => setDetail(r?.data || null))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false))
  }, [node.id, cycle])

  const bandLabel = node.kind === 'employer'   ? 'EMPLOYER'
                  : node.kind === 'politician' ? 'POLITICIAN'
                  : node.kind === 'super_pac'  ? 'SUPER PAC'
                  : node.kind === 'dark_money' ? 'DARK MONEY'
                  : 'COMMITTEE'

  return (
    <>
      <Band label={`${bandLabel}${detail?.node?.sector ? ` · ${detail.node.sector}` : ''}`}
            right={cycle} t={t} />

      {/* Section 1: Mini galaxy */}
      <MiniGalaxy
        nodes={detail?.nodes || [node]}
        edges={detail?.edges || []}
        height={220}
        surface={surface}
        focusNodeId={node.id}
      />

      {/* Section 2: Metadata */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.panelBorder}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, marginBottom: 6, fontFamily: 'Roboto, sans-serif', lineHeight: 1.3 }}>
          {detail?.node?.label || node.label}
        </div>

        {/* Politician photo block */}
        {(node.kind === 'politician') && detail?.node && (
          <PoliticianProfile node={detail.node} />
        )}

        {/* KPIs for non-politician nodes */}
        {node.kind !== 'politician' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
            <KPI label="Total $" value={fmt$(detail?.node?.amount ?? node.amount)} t={t} />
            <KPI label="Connections" value={String(detail?.node?.degree ?? node.degree ?? 0)} t={t} />
          </div>
        )}

        {/* Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {detail?.node?.is_super_pac && <Chip label="SUPER PAC" color="#4A7FFF" t={t} />}
          {detail?.node?.is_501c4    && <Chip label="501(c)(4)" color="#CC88FF" t={t} />}
          {detail?.node?.sector      && <Chip label={detail.node.sector} color="#FF8000" t={t} />}
        </div>

        {/* Source footer for employer self-reporting note */}
        {node.kind === 'employer' && (
          <SourceFooter
            s="Self-reported employer field on FEC Schedule A · Individual Contributions"
            href="https://www.fec.gov/data/receipts/individual-contributions/"
          />
        )}
        {node.kind !== 'employer' && node.kind !== 'politician' && (
          <SourceFooter
            s="FEC Committee Database"
            href={`https://www.fec.gov/data/committee/${node.id.replace('cmt:', '')}/`}
          />
        )}
      </div>

      {/* Section 3: Pattern narrative (only if this node has patterns) */}
      {detail?.patterns?.length > 0 && (
        <PatternNarrative patterns={detail.patterns} />
      )}

      {/* Section 4: Timeline */}
      {loading
        ? <div style={{ padding: '16px 14px', fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO }}>Loading transactions…</div>
        : <ContributionTimeline events={detail?.timeline || []} />
      }
    </>
  )
}

function Chip({ label, color, t }) {
  return (
    <span style={{
      padding: '1px 6px', borderRadius: 2, fontSize: 7, fontWeight: 600,
      border: `1px solid ${color}44`, color, background: `${color}18`,
      fontFamily: FONT_MONO, letterSpacing: 0.5,
    }}>
      {label}
    </span>
  )
}

// ── Sector halo click view ────────────────────────────────────────────────────
function SectorView({ payload, cycle, t, surface }) {
  const sector = payload.sector   // { name, color, total_amount, node_count }
  const [data, setData] = useState(null)

  useEffect(() => {
    import('../../api/client.js').then(({ galaxy: g }) => {
      g.sector(sector.name, { cycle })
        .then(r => setData(r || null))
        .catch(() => setData(null))
    })
  }, [sector.name, cycle])

  return (
    <>
      <Band label={`SECTOR · ${sector.name}`} right={cycle} t={t} />
      <MiniGalaxy
        nodes={data?.nodes || []}
        edges={data?.edges || []}
        height={220}
        surface={surface}
      />
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.panelBorder}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
          <KPI label="Total Flow" value={fmt$(sector.total_amount)} t={t} />
          <KPI label="Nodes" value={String(sector.node_count || 0)} t={t} />
        </div>
        <SourceFooter
          s="FEC Bulk Data — money_flow_edges"
          href="https://www.fec.gov/campaign-finance-data/"
        />
      </div>
    </>
  )
}

// ── Pattern flare click (legacy + enhanced) ───────────────────────────────────
function PatternView({ payload, cycle, t, surface }) {
  const p = payload.pattern
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    if (!p?.id) return
    import('../../api/client.js').then(({ galaxy: g }) => {
      g.pattern(p.id).then(r => setDetail(r || null)).catch(() => setDetail(null))
    })
  }, [p?.id])

  const patterns = detail ? [detail.pattern || p] : [p]
  const topNodeId = p.node_ids?.[0]

  return (
    <>
      <Band label={p.pattern_type?.replace(/_/g, ' ') || 'pattern'} right={p.sector || ''} t={t} />

      {/* Mini galaxy scoped to pattern nodes */}
      <MiniGalaxy
        nodes={detail?.nodes || []}
        edges={detail?.edges || []}
        height={220}
        surface={surface}
        focusNodeId={topNodeId}
      />

      {/* AI narrative */}
      <PatternNarrative patterns={patterns} />

      {/* Timeline for first node in pattern */}
      {topNodeId && <ConnectedTimeline nodeId={topNodeId} cycle={cycle} t={t} />}
    </>
  )
}

function ConnectedTimeline({ nodeId, cycle, t }) {
  const [events, setEvents] = useState([])
  useEffect(() => {
    galaxy.node(nodeId, { cycle })
      .then(r => setEvents(r?.data?.timeline || []))
      .catch(() => setEvents([]))
  }, [nodeId, cycle])
  return <ContributionTimeline events={events} />
}

// ── Main drawer shell ─────────────────────────────────────────────────────────
export default function GalaxyDrawer({ payload, onClose, surface = 'dark', cycle = '2024' }) {
  const t = galaxyTokens[surface]

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!payload) return null

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: t.drawerBackdrop, backdropFilter: 'blur(4px)',
        zIndex: 30,
      }} />

      {/* Panel */}
      <aside style={{
        position: 'absolute', top: 0, right: 0, bottom: 0,
        width: 420, background: t.surface, borderLeft: `1px solid ${t.panelBorder}`,
        zIndex: 31, display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Close button */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 6, right: 12, background: 'none', border: 'none',
          color: t.textMuted, cursor: 'pointer', fontSize: 16, zIndex: 1, lineHeight: 1,
        }}>✕</button>

        {payload.kind === 'sector'
          ? <SectorView  payload={payload} cycle={cycle} t={t} surface={surface} />
          : payload.kind === 'pattern'
          ? <PatternView payload={payload} cycle={cycle} t={t} surface={surface} />
          : <DetailView  payload={payload} cycle={cycle} t={t} surface={surface} />
        }
      </aside>
    </>
  )
}
```

- [ ] **Step 6: Pass `cycle` prop to `GalaxyDrawer` in `FundingFlowGalaxy.jsx`**

Find the `<GalaxyDrawer>` render and add the `cycle` prop:

```jsx
<GalaxyDrawer
  payload={drawerPayload}
  onClose={() => setDrawerPayload(null)}
  surface={surface}
  cycle={cycle}
/>
```

- [ ] **Step 7: Smoke test in browser**

```bash
npm run dev:all
```

1. Open the app → Donor Intelligence or Follow the Money → Money Flow tab
2. Click any employer node → drawer opens, mini-galaxy animates in, timeline shows contribution receipts
3. Click a politician node → Congress.gov photo loads (or fallback avatar), party/state badges visible
4. Click a pattern flare node (orange glow) → AI narrative block visible above timeline
5. Click a sector halo ring → sector view opens with mini-galaxy of sector nodes
6. Press Escape → drawer closes
7. Check browser console for errors

- [ ] **Step 8: Commit**

```bash
git add src/components/galaxy/GalaxyDrawer.jsx src/components/galaxy/GalaxyGraph.jsx src/components/galaxy/FundingFlowGalaxy.jsx
git commit -m "feat(galaxy): refactor GalaxyDrawer — MiniGalaxy + Timeline + PatternNarrative + PoliticianProfile + sector click"
```

---

## Self-Review Checklist

After all tasks complete, verify spec coverage:

- [ ] Layout order: mini-galaxy top → metadata → timeline bottom ✓ (Task 11)
- [ ] All 6 drawer variants covered: employer, committee, politician, pattern flare, sector halo, dark money ✓ (Task 11)
- [ ] Timeline sources: `contributions.date` (amber) + `committee_transfers.transfer_date` (blue) ✓ (Task 3, Task 8)
- [ ] Mini-galaxy: live D3 force simulation with 150 pre-ticks ✓ (Task 7)
- [ ] Congress.gov photo: parallel fetch, graceful fallback ✓ (Task 10)
- [ ] `bioguide_id` flows through galaxy node objects ✓ (Task 2)
- [ ] Source attribution links on every section ✓ (Tasks 1, 8, 9, 10, 11)
- [ ] All 3 galaxy instances upgraded (Donor Intelligence, Money Flow, EmployerLeaderboard) ✓ — single `GalaxyDrawer` component
- [ ] `SourceFooter` href prop works ✓ (Task 1)
- [ ] Escape key + backdrop click close drawer ✓ (Task 11)
- [ ] `overflowY: auto` on drawer `<aside>` ✓ (Task 11)
