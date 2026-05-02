# Corporate PAC Galaxy Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken politician-recipients right panel in the Corporate PACs subtab with a live FundingFlowGalaxy that shows the PAC money-flow network for the selected corporation.

**Architecture:** Add a new `corporation` galaxy mode end-to-end: `getCorporation` service (fetches the corp's PAC committee IDs from `pac_committees`, then their edges from `money_flow_edges`) → new galaxy route → api client method → `useGalaxyData` support → `FundingFlowGalaxy` prop → restructured `CorporatePACFlow` layout (left: bar chart, right: galaxy peer panel, matching the `EmployerLeaderboard` pattern).

**Tech Stack:** Existing `buildEnvelope` / `loadCommittees` / `loadPoliticians` helpers in `galaxyService.js`. Existing `FundingFlowGalaxy` component. No new tables or schema changes.

---

## Context for the implementer

### Data model
- `pac_committees.connected_org_name` — the parent corporation name (e.g. `"LOCKHEED MARTIN CORP"`)
- `pac_committees.committee_id` — the PAC's FEC ID
- `money_flow_edges` MV — pre-aggregated flows; `source_id`/`target_id` are raw IDs
- `corp_id` in the leaderboard is the exact `connected_org_name` string from `pac_committees`

### Existing galaxy modes for reference
`getEmployer` is the closest analog — it fetches hop-1 from `contributions` and hop-2 from `money_flow_edges`. `getCorporation` is simpler: both hops come entirely from `money_flow_edges` (the PAC committees are already in the MV).

### `EmployerLeaderboard` layout pattern
The target layout matches this file exactly:
- Outer `display: grid, gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'stretch'`  
- Left: `<div style={{ display: 'flex', flexDirection: 'column' }}>` containing `<Band>` then `<Card style={{ flex: 1 }}>` with the chart
- Right: `<FundingFlowGalaxy mode="corporation" corpId={...} cycle={cycle} height={560} />`

### `FundingFlowGalaxy` current interface
```jsx
<FundingFlowGalaxy
  mode="universe" | "sector" | "employer" | "corporation"  // ← add "corporation"
  cycle="2024"
  sector={null}
  employerId={null}
  rawIds={null}
  corpId={null}                                             // ← add
  height={560}
  onNodeSelect={fn}
/>
```

---

## File Map

| Action | File | Change |
|---|---|---|
| Modify | `server/services/galaxyService.js` | Add `getCorporation` function |
| Modify | `server/routes/galaxy.js` | Add `GET /corporation/:corpId` route |
| Modify | `src/api/client.js` | Add `galaxy.corporation()` method |
| Modify | `src/components/galaxy/hooks/useGalaxyData.js` | Add `corp` mode + `corpId` param |
| Modify | `src/components/galaxy/FundingFlowGalaxy.jsx` | Add `corpId` prop, pass to hook |
| Modify | `src/components/CorporatePACFlow.jsx` | Restructure layout, add galaxy panel |

---

## Task 1: `getCorporation` service + route

**Files:**
- Modify: `server/services/galaxyService.js`
- Modify: `server/routes/galaxy.js`

**Context:** `getCorporation` mirrors `getSector`'s two-hop pattern but uses `pac_committees.connected_org_name` for the first hop instead of sector classification. The function:
1. Fetches all committee IDs for the corp from `pac_committees`
2. Queries `money_flow_edges` for outbound edges (committee → politician, the dominant flow)
3. Also fetches inbound edges (employer → committee) to show who funds the PAC
4. Builds the envelope with `buildEnvelope`

Both `loadCommittees` and `loadPoliticians` helpers already exist in `galaxyService.js` — use them.

- [ ] **Step 1: Add `getCorporation` to `server/services/galaxyService.js`**

Read the file first. Add this function after `getEmployer` (before `getPatternDetail`):

```javascript
/**
 * Corporation mode — network around a corporation's PAC ecosystem.
 * Fetches the corp's committee IDs from pac_committees, then walks
 * their edges in money_flow_edges (outbound to politicians + inbound from employers).
 */
export async function getCorporation({ cycle = '2024', corpId, nodeCap = 60 } = {}) {
  if (!corpId) throw new Error('corpId is required')
  const db = ensure()

  // Fetch all PAC committees connected to this corporation
  const { data: cmts, error: ce } = await db
    .from('pac_committees')
    .select('committee_id, name, is_super_pac, is_501c4, connected_org_name')
    .ilike('connected_org_name', corpId)
    .limit(50)
  if (ce) throw ce

  const committeeIds = (cmts || []).map(c => c.committee_id)
  if (!committeeIds.length) {
    return buildEnvelope({ edges: [], committees: new Map(), politicians: new Map(), cycle })
  }

  // Pre-load committee metadata so buildEnvelope can classify node kinds
  const cmtMap = new Map((cmts || []).map(c => [c.committee_id, c]))

  // Outbound: committee → politician (PAC spending on candidates)
  const { data: outEdges, error: oe } = await db
    .from('money_flow_edges')
    .select('source_id, source_type, source_tier, source_label, target_id, target_type, target_tier, target_label, amount, txn_count, cycle')
    .eq('cycle', parseInt(cycle))
    .in('source_id', committeeIds)
    .gt('amount', 0)
    .order('amount', { ascending: false })
    .limit(150)
  if (oe) throw oe

  // Inbound: employer → committee (who funds the PAC)
  const { data: inEdges, error: ie } = await db
    .from('money_flow_edges')
    .select('source_id, source_type, source_tier, source_label, target_id, target_type, target_tier, target_label, amount, txn_count, cycle')
    .eq('cycle', parseInt(cycle))
    .in('target_id', committeeIds)
    .gt('amount', 0)
    .order('amount', { ascending: false })
    .limit(50)
  if (ie) throw ie

  const allEdges = [...(outEdges || []), ...(inEdges || [])]
  const enriched = enrichEdgesWithSector(allEdges)

  const [committees, politicians] = await Promise.all([
    loadCommittees(db, collectCommitteeIds(enriched)),
    loadPoliticians(db, collectCandidateIds(enriched))
  ])

  // Merge pre-fetched committee metadata so kinds (super_pac, dark_money) resolve correctly
  for (const [id, cmt] of cmtMap) {
    if (!committees.has(id)) committees.set(id, cmt)
  }

  const envelope = buildEnvelope({ edges: enriched, committees, politicians, cycle })

  if (envelope.nodes.length > nodeCap) {
    const topIds = new Set(
      [...envelope.nodes].sort((a, b) => b.amount - a.amount).slice(0, nodeCap).map(n => n.id)
    )
    envelope.nodes = envelope.nodes.filter(n => topIds.has(n.id))
    envelope.edges = envelope.edges.filter(e => topIds.has(e.source) && topIds.has(e.target))
    envelope.meta.node_count = envelope.nodes.length
    envelope.meta.edge_count = envelope.edges.length
  }

  envelope.meta.scope = { mode: 'corporation', corpId }
  return envelope
}
```

- [ ] **Step 2: Add the route to `server/routes/galaxy.js`**

Read the file. Find the employer route:
```javascript
router.get('/employer/:employerId', wrap(req => getEmployer({
  cycle:      req.query.cycle || '2024',
  employerId: decodeURIComponent(req.params.employerId),
  rawIds:     req.query.rawIds ? req.query.rawIds.split('|').filter(Boolean) : undefined,
  nodeCap:    Number(req.query.limit) || 40
})))
```

Add immediately after it (before the patterns route):
```javascript
router.get('/corporation/:corpId', wrap(req => getCorporation({
  cycle:   req.query.cycle || '2024',
  corpId:  decodeURIComponent(req.params.corpId),
  nodeCap: Number(req.query.limit) || 60
})))
```

Also add `getCorporation` to the import from `galaxyService.js` at the top of the routes file. The current import looks like:
```javascript
import { getUniverse, getSector, getEmployer, getPatternDetail, getNodeDetail } from '../services/galaxyService.js'
```
Add `getCorporation`:
```javascript
import { getUniverse, getSector, getEmployer, getCorporation, getPatternDetail, getNodeDetail } from '../services/galaxyService.js'
```

- [ ] **Step 3: Verify the endpoint returns data**

Start the server (`npm run dev:server`), then test with a known corp name from the leaderboard (e.g. "LOCKHEED MARTIN CORP" if it appears in your data):

```bash
curl -s "http://127.0.0.1:3001/api/galaxy/corporation/LOCKHEED%20MARTIN%20CORP?cycle=2024" | node -e "
const d=[]; process.stdin.on('data',c=>d.push(c)); process.stdin.on('end',()=>{
  const r=JSON.parse(d.join('')); console.log('nodes:', r.nodes?.length, 'edges:', r.edges?.length)
})"
```

Expected: `nodes: N edges: M` where N > 0. If nodes = 0, the corp name may not exist in `pac_committees.connected_org_name` for that cycle.

- [ ] **Step 4: Commit**

```bash
git add server/services/galaxyService.js server/routes/galaxy.js
git commit -m "feat(galaxy): add corporation mode — PAC ecosystem network for a corporate parent"
```

---

## Task 2: Thread `corpId` through the client layer

**Files:**
- Modify: `src/api/client.js`
- Modify: `src/components/galaxy/hooks/useGalaxyData.js`
- Modify: `src/components/galaxy/FundingFlowGalaxy.jsx`

**Context:** The `galaxy` client object already has `universe`, `sector`, `employer`, `pattern`, `node` methods. Add `corporation`. Then thread `corpId` through `useGalaxyData` and `FundingFlowGalaxy` following the exact same pattern as `employerId`.

- [ ] **Step 1: Add `galaxy.corporation` to `src/api/client.js`**

Read the file. Find the `galaxy` export object. Find:
```javascript
  employer: (employerId, { cycle, rawIds } = {}) => {
```

Add after the `employer` method (before `pattern`):
```javascript
  corporation: (corpId, { cycle } = {}) => {
    const qs = new URLSearchParams({ ...(cycle && { cycle }) }).toString()
    return request(`/api/galaxy/corporation/${encodeURIComponent(corpId)}${qs ? '?' + qs : ''}`)
  },
```

- [ ] **Step 2: Update `useGalaxyData` to support `corp` mode**

Read `src/components/galaxy/hooks/useGalaxyData.js`. Make three changes:

**2a. Update signature** from:
```javascript
export default function useGalaxyData({ mode, cycle, sector, employerId, rawIds }) {
```
to:
```javascript
export default function useGalaxyData({ mode, cycle, sector, employerId, rawIds, corpId }) {
```

**2b. Add corp branch** inside `load()`. Find:
```javascript
      else if (mode === 'employer') res = await galaxy.employer(employerId, { cycle, rawIds })
      else throw new Error(`unknown galaxy mode: ${mode}`)
```
Replace with:
```javascript
      else if (mode === 'employer')     res = await galaxy.employer(employerId, { cycle, rawIds })
      else if (mode === 'corporation')  res = await galaxy.corporation(corpId, { cycle })
      else throw new Error(`unknown galaxy mode: ${mode}`)
```

**2c. Update guard** — the existing guard skips fetch if required ID is missing. Find:
```javascript
    if (mode === 'sector'   && !sector) return
    if (mode === 'employer' && !employerId) return
```
Add:
```javascript
    if (mode === 'sector'      && !sector)    return
    if (mode === 'employer'    && !employerId) return
    if (mode === 'corporation' && !corpId)     return
```

**2d. Update useEffect dep array**:
```javascript
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, cycle, sector, employerId, rawIds?.join('|')])
```
→
```javascript
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, cycle, sector, employerId, rawIds?.join('|'), corpId])
```

- [ ] **Step 3: Update `FundingFlowGalaxy` to accept and forward `corpId`**

Read `src/components/galaxy/FundingFlowGalaxy.jsx`. Make two changes:

**3a. Add `corpId` to props** — find:
```javascript
export default function FundingFlowGalaxy({
  mode = 'universe',
  cycle: cycleProp = '2024',
  sector = null,
  employerId = null,
  rawIds = null,
  height = 560,
  onNodeSelect
}) {
```
Add `corpId = null`:
```javascript
export default function FundingFlowGalaxy({
  mode = 'universe',
  cycle: cycleProp = '2024',
  sector = null,
  employerId = null,
  rawIds = null,
  corpId = null,
  height = 560,
  onNodeSelect
}) {
```

**3b. Forward `corpId` to `useGalaxyData`** — find:
```javascript
  const { data, loading, error } = useGalaxyData({ mode, cycle, sector, employerId, rawIds })
```
Replace with:
```javascript
  const { data, loading, error } = useGalaxyData({ mode, cycle, sector, employerId, rawIds, corpId })
```

- [ ] **Step 4: Commit**

```bash
git add src/api/client.js src/components/galaxy/hooks/useGalaxyData.js src/components/galaxy/FundingFlowGalaxy.jsx
git commit -m "feat(galaxy): thread corpId through client layer for corporation galaxy mode"
```

---

## Task 3: Restructure `CorporatePACFlow` — replace right panel with galaxy

**Files:**
- Modify: `src/components/CorporatePACFlow.jsx`

**Context:** The current component wraps everything in a single `<Band> + <Card>`. The new layout mirrors `EmployerLeaderboard`:
- Outer `display: grid, gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'stretch'`
- Left column: flex column with `<Band>` + `<Card style={{ flex: 1 }}>` containing controls + chart
- Right column: `<FundingFlowGalaxy mode="corporation" corpId={selected?.corp_id} cycle={cycle} height={560} />`

Remove the entire right politician-recipients panel — it's replaced by the galaxy. Keep the `recipients` / `loadingRec` / `recErr` state removal as part of the cleanup (they're no longer needed).

- [ ] **Step 1: Add the FundingFlowGalaxy import**

Add to the imports at the top:
```javascript
import FundingFlowGalaxy from './galaxy/FundingFlowGalaxy.jsx'
```

- [ ] **Step 2: Remove unused state**

Remove these three state declarations (no longer needed):
```javascript
  const [recipients, setRecipients] = useState({ recipients: [], pacs: [] })
  const [loadingRec, setLoadingRec] = useState(false)
  const [recErr, setRecErr]         = useState(null)
```

Remove the `useEffect` that loaded recipients (the second `useEffect`, around lines 123–132):
```javascript
  // Load recipients for selected corp
  useEffect(() => {
    if (!selected) return
    let cancelled = false
    setLoadingRec(true); setRecErr(null)
    donors.corporatePACRecipients(selected.corp_id, { cycle, limit: 15 })
      .then(r => { if (!cancelled) setRecipients(r?.data || { recipients: [], pacs: [] }) })
      .catch(e => { if (!cancelled) setRecErr(e.message) })
      .finally(() => { if (!cancelled) setLoadingRec(false) })
    return () => { cancelled = true }
  }, [selected, cycle])
```

- [ ] **Step 3: Replace the full `return (...)` with the new layout**

Replace the entire `return (...)` block with:

```jsx
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'stretch' }}>

      {/* LEFT column: bar chart */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Band label="Corporate PAC spending — connected PACs, Super PACs, 501(c)4s" right={`${corps.length} CORPORATIONS`} />
        <Card style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Controls */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ fontFamily: MF, fontSize: 9, color: t.mid, display: 'flex', alignItems: 'center', gap: 5 }}>
              CYCLE
              <select value={cycle} onChange={e => setCycle(e.target.value)} style={selectStyle}>
                {CYCLES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label style={{ fontFamily: MF, fontSize: 9, color: t.mid, display: 'flex', alignItems: 'center', gap: 5 }}>
              TOP
              <select value={limit} onChange={e => setLimit(Number(e.target.value))} style={selectStyle}>
                {LIMITS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            {/* Legend */}
            <div style={{ display: 'flex', gap: 12, marginLeft: 'auto', alignItems: 'center' }}>
              {[[PAC_COLOR, 'Connected PAC'], [SUPER_PAC_COLOR, 'Super PAC'], [C4_COLOR, '501(c)4']].map(([c, l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 10, height: 10, background: c }} />
                  <span style={{ fontFamily: MF, fontSize: 8.5, color: t.mid }}>{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stacked bar chart */}
          <div style={{ flex: 1, border: `1px solid ${t.border}`, background: t.cardB, borderRadius: 3, padding: '12px 0 8px', minHeight: 0 }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: t.mid, fontFamily: MF, fontSize: 10 }}>Loading corporate PAC data…</div>
            ) : corps.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: t.low, fontFamily: MF, fontSize: 10 }}>
                No corporate PAC data found for {cycle}.<br />
                <span style={{ color: t.low, fontSize: 9 }}>Requires pac_committees.connected_org_name to be populated.</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(280, corps.length * 28)}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ left: 8, right: 60, top: 4, bottom: 4 }}
                  barCategoryGap="18%"
                  onClick={d => d?.activePayload && setSelected(corps.find(c => c.corp_id === d.activePayload[0]?.payload?.corp_id) || null)}
                >
                  <CartesianGrid horizontal={false} stroke={t.grid} />
                  <XAxis type="number" tick={{ fontFamily: MF, fontSize: 9, fill: t.mid }} tickFormatter={fmt$} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" tick={{ fontFamily: MF, fontSize: 9, fill: t.mid }} width={130} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip t={t} />} cursor={{ fill: `${ORANGE}10` }} />
                  <Bar dataKey="pac_total"       name="Connected PAC" stackId="a" barSize={14} fill={PAC_COLOR}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={PAC_COLOR} fillOpacity={selected?.corp_id === entry.corp_id ? 1 : 0.75} />
                    ))}
                  </Bar>
                  <Bar dataKey="super_pac_total" name="Super PAC"     stackId="a" barSize={14} fill={SUPER_PAC_COLOR}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={SUPER_PAC_COLOR} fillOpacity={selected?.corp_id === entry.corp_id ? 1 : 0.75} />
                    ))}
                  </Bar>
                  <Bar dataKey="c4_total"        name="501(c)4"       stackId="a" barSize={14} fill={C4_COLOR} radius={[0, 3, 3, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={C4_COLOR} fillOpacity={selected?.corp_id === entry.corp_id ? 1 : 0.75} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <SourceFooter s="FEC bulk data — pac_committees (connected_org_name), contributions (Schedule A/B) · cycles 2024+2026" href="https://www.fec.gov/data/committees/" />
        </Card>
      </div>

      {/* RIGHT column: galaxy — shows PAC money-flow network for selected corp */}
      <FundingFlowGalaxy
        mode={selected ? 'corporation' : 'universe'}
        cycle={cycle}
        corpId={selected?.corp_id ?? null}
        height={560}
      />

    </div>
  )
```

- [ ] **Step 4: Remove unused imports**

Remove `fmtPolitician`, `PartyBadge`, `PACTypeBadge` functions from the file since they were only used in the recipient list (now removed). Also remove `PARTY_COLOR` constant and `SF` (FONT_SERIF) import since they're no longer used.

Specifically, remove from the import line:
```javascript
import { ORANGE, FONT_MONO as MF, FONT_SERIF as SF } from '../theme/tokens.js'
```
→
```javascript
import { ORANGE, FONT_MONO as MF } from '../theme/tokens.js'
```

And delete the `PARTY_COLOR`, `fmtPolitician`, `PartyBadge`, `PACTypeBadge` declarations.

- [ ] **Step 5: Verify in browser**

```bash
npm run dev:all
```

Open the app → Follow the Money → Corporate PACs tab. Confirm:
- Left panel shows the stacked bar chart
- Right panel shows the universe galaxy by default
- Clicking a corporation row switches the right panel to that corp's PAC galaxy
- The galaxy shows the PAC committees and their politician connections
- Clicking nodes in the galaxy opens the drawer panel

- [ ] **Step 6: Commit**

```bash
git add src/components/CorporatePACFlow.jsx
git commit -m "feat(corporate-pacs): replace politician list with FundingFlowGalaxy corp network panel"
```

---

## Self-Review

**Spec coverage:**
- ✅ New `corporation` galaxy mode end-to-end (Tasks 1–2)
- ✅ Galaxy shows PAC committees + their outbound flows to politicians (Task 1: `getCorporation`)
- ✅ Galaxy also shows inbound employer → PAC flows (Task 1: `inEdges` query)
- ✅ Right panel replaced with `FundingFlowGalaxy` (Task 3)
- ✅ Default right panel shows `universe` when nothing selected (Task 3: `mode={selected ? 'corporation' : 'universe'}`)
- ✅ Unused state + imports cleaned up (Task 3)

**Placeholder scan:** No TBDs. All code blocks are complete.

**Type consistency:**
- `corpId` in `getCorporation` → route param `req.params.corpId` → `galaxy.corporation(corpId)` → `useGalaxyData({ corpId })` → `FundingFlowGalaxy corpId` — consistent snake_case across backend, camelCase in frontend props
- `corp_id` in the leaderboard rows (snake_case from API) accessed as `selected?.corp_id` — matches the existing `corp_id` field in `corporatePACs` response

**Edge case:** If `pac_committees.connected_org_name` has no matching entries for a given corp/cycle, `getCorporation` returns an empty envelope → galaxy shows "No funding flow data for this selection." This is correct behavior.
