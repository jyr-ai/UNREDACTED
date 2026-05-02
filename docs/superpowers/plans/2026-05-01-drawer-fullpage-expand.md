# Drawer Full-Page Expand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an expand/collapse toggle button to the node detail drawer panel that switches between the existing 420px side panel and a full-viewport overlay with a two-column layout.

**Architecture:** Single-file change to `GalaxyDrawer.jsx`. Add `expanded` boolean state. Derive all layout values (panel width, backdrop, inner layout) from that flag. No new components, no new files, no changes to data layer.

**Tech Stack:** React `useState`, inline styles (project convention — no CSS-in-JS library), existing `galaxyTokens` design tokens.

---

## Context for the implementer

`GalaxyDrawer.jsx` is at `src/components/galaxy/GalaxyDrawer.jsx`. It exports a default `GalaxyDrawer` component that renders:
- A fixed full-viewport **backdrop** (`position: fixed, inset: 0, zIndex: 1000`)
- A fixed right-edge **panel** (`position: fixed, top: 0, right: 0, bottom: 0, width: 420, zIndex: 1001, overflowY: auto`)
- An **X close button** (`position: absolute, top: 6, right: 12`)
- Content routed to `SectorView`, `PatternView`, or `DetailView` based on `payload.kind`

`DetailView` renders (in order, stacked vertically):
1. `<Band>` — section header strip
2. `<MiniGalaxy>` — D3 force graph, `height={220}`
3. A metadata `<div>` with name, KPIs, badges, SourceFooter
4. `<PatternNarrative>` (conditional)
5. `<ContributionTimeline>` — the money trail

Design tokens live in `galaxyTokens[surface]`. The `t` object available in components includes `t.surface`, `t.panelBorder`, `t.textMuted`, etc.

---

## File Map

| Action | File | Change |
|---|---|---|
| Modify | `src/components/galaxy/GalaxyDrawer.jsx` | Add `expanded` state, expand button, conditional layout |

---

## Task 1: Add expanded state + expand/collapse button

**Files:**
- Modify: `src/components/galaxy/GalaxyDrawer.jsx`

**Context:** The close button currently sits at `position: absolute, top: 6, right: 12` inside the `<aside>`. We add the expand button immediately to its left. Use `⤢` (U+2922) for expand and `⤡` (U+2921) for collapse — both are clean directional arrows readable at small sizes.

- [ ] **Step 1: Add `expanded` state to the `GalaxyDrawer` shell component**

Find the `GalaxyDrawer` default export (around line 232). It currently starts:

```jsx
export default function GalaxyDrawer({ payload, onClose, surface = 'dark', cycle = '2024' }) {
  const t = galaxyTokens[surface] || galaxyTokens.dark

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
```

Add `useState` to the import at the top of the file (it already imports `useEffect` and `useState`). Then add the state inside `GalaxyDrawer`:

```jsx
export default function GalaxyDrawer({ payload, onClose, surface = 'dark', cycle = '2024' }) {
  const t = galaxyTokens[surface] || galaxyTokens.dark
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
```

- [ ] **Step 2: Replace the static panel `<aside>` and backdrop with expanded-aware versions**

Find the `return (...)` block of `GalaxyDrawer` (around line 243). It currently renders:

```jsx
  return (
    <>
      {/* Backdrop — fixed to full viewport */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: t.drawerBackdrop, backdropFilter: 'blur(4px)',
        zIndex: 1000,
      }} />

      {/* Panel — fixed full viewport height, right edge */}
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 420, background: t.surface, borderLeft: `1px solid ${t.panelBorder}`,
        zIndex: 1001, display: 'flex', flexDirection: 'column',
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
```

Replace with:

```jsx
  return (
    <>
      {/* Backdrop — hidden when expanded (panel IS the full screen) */}
      {!expanded && (
        <div onClick={onClose} style={{
          position: 'fixed', inset: 0,
          background: t.drawerBackdrop, backdropFilter: 'blur(4px)',
          zIndex: 1000,
        }} />
      )}

      {/* Panel */}
      <aside style={{
        position: 'fixed',
        top: 0, bottom: 0,
        right: 0,
        left: expanded ? 0 : 'auto',
        width: expanded ? '100vw' : 420,
        background: t.surface,
        borderLeft: expanded ? 'none' : `1px solid ${t.panelBorder}`,
        zIndex: 1001,
        display: 'flex',
        flexDirection: 'column',
        overflowY: expanded ? 'hidden' : 'auto',
      }}>
        {/* Close button */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 6, right: 12, background: 'none', border: 'none',
          color: t.textMuted, cursor: 'pointer', fontSize: 16, zIndex: 2, lineHeight: 1,
        }}>✕</button>

        {/* Expand / collapse button — sits left of the X */}
        <button
          onClick={() => setExpanded(e => !e)}
          title={expanded ? 'Collapse panel' : 'Expand to full page'}
          style={{
            position: 'absolute', top: 6, right: 36, background: 'none', border: 'none',
            color: t.textMuted, cursor: 'pointer', fontSize: 14, zIndex: 2, lineHeight: 1,
          }}
        >
          {expanded ? '⤡' : '⤢'}
        </button>

        {payload.kind === 'sector'
          ? <SectorView  payload={payload} cycle={cycle} t={t} surface={surface} expanded={expanded} />
          : payload.kind === 'pattern'
          ? <PatternView payload={payload} cycle={cycle} t={t} surface={surface} expanded={expanded} />
          : <DetailView  payload={payload} cycle={cycle} t={t} surface={surface} expanded={expanded} />
        }
      </aside>
    </>
  )
```

- [ ] **Step 3: Verify button renders and toggles**

```bash
npm run dev:all
```

Open the app → Follow the Money → Money Flow tab → click any node. Confirm:
- `⤢` button appears to the left of `✕`
- Clicking `⤢` expands the panel to full width; button changes to `⤡`
- Clicking `⤡` collapses back to 420px
- `✕` still closes in both modes
- Pressing Escape still closes in both modes

- [ ] **Step 4: Commit**

```bash
git add src/components/galaxy/GalaxyDrawer.jsx
git commit -m "feat(drawer): add expand/collapse toggle button for full-page mode"
```

---

## Task 2: Two-column layout for `DetailView` in expanded mode

**Files:**
- Modify: `src/components/galaxy/GalaxyDrawer.jsx`

**Context:** `DetailView` is a local component inside `GalaxyDrawer.jsx` (around line 54). It currently renders everything in a single scrolling column. In expanded mode (`expanded={true}`) we split into two columns:
- **Left (40%):** `<Band>` strip + `<MiniGalaxy>` at 100% height of remaining space
- **Right (60%):** metadata block + `<PatternNarrative>` + `<ContributionTimeline>`, independently scrollable

`DetailView` already receives `t`, `surface`, `payload`, `cycle`. We add `expanded` as a new prop (passed from the shell in Task 1 Step 2).

- [ ] **Step 1: Update `DetailView` signature and layout**

Find the `DetailView` function (around line 54):

```jsx
function DetailView({ payload, cycle, t, surface }) {
```

Replace the entire `DetailView` function with the expanded-aware version below. The content inside each section is unchanged — only the outer wrapper changes based on `expanded`:

```jsx
function DetailView({ payload, cycle, t, surface, expanded = false }) {
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

  if (expanded) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Band
          label={`${bandLabel}${detail?.node?.sector ? ` · ${detail.node.sector}` : ''}`}
          right={cycle}
          t={t}
        />
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Left column — mini galaxy */}
          <div style={{
            width: '40%', borderRight: `1px solid ${t.panelBorder}`,
            display: 'flex', flexDirection: 'column',
          }}>
            <MiniGalaxy
              nodes={detail?.nodes || [node]}
              edges={detail?.edges || []}
              height={600}
              surface={surface}
              focusNodeId={node.id}
            />
          </div>

          {/* Right column — metadata + timeline */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {/* Metadata */}
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.panelBorder}` }}>
              {node.kind !== 'politician' && (
                <div style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, marginBottom: 6, fontFamily: 'Roboto, sans-serif', lineHeight: 1.3 }}>
                  {detail?.node?.label || node.label}
                </div>
              )}
              {node.kind === 'politician' && detail?.node && (
                <PoliticianProfile node={detail.node} />
              )}
              {node.kind !== 'politician' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
                  <KPI label="Total $" value={fmt$(detail?.node?.amount ?? node.amount)} t={t} />
                  <KPI label="Connections" value={String(detail?.node?.degree ?? node.degree ?? 0)} t={t} />
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                {detail?.node?.is_super_pac && <Chip label="SUPER PAC" color="#4A7FFF" t={t} />}
                {detail?.node?.is_501c4    && <Chip label="501(c)(4)" color="#CC88FF" t={t} />}
                {detail?.node?.sector      && <Chip label={detail.node.sector} color="#FF8000" t={t} />}
              </div>
              {node.kind === 'employer' && (
                <SourceFooter
                  s="Self-reported employer field on FEC Schedule A · Individual Contributions"
                  href="https://www.fec.gov/data/receipts/individual-contributions/"
                />
              )}
              {(node.kind === 'trad_pac' || node.kind === 'super_pac' || node.kind === 'dark_money') && (
                <SourceFooter
                  s="FEC Committee Database"
                  href={`https://www.fec.gov/data/committee/${node.id.replace('cmt:', '')}/`}
                />
              )}
            </div>

            {/* Pattern narrative */}
            {detail?.patterns?.length > 0 && (
              <PatternNarrative patterns={detail.patterns} />
            )}

            {/* Timeline */}
            {loading
              ? <div style={{ padding: '16px 14px', fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO }}>Loading transactions…</div>
              : <ContributionTimeline events={detail?.timeline || []} />
            }
          </div>
        </div>
      </div>
    )
  }

  // ── Collapsed (default side-panel) layout ────────────────────────────────
  return (
    <>
      <Band
        label={`${bandLabel}${detail?.node?.sector ? ` · ${detail.node.sector}` : ''}`}
        right={cycle}
        t={t}
      />

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
        {node.kind !== 'politician' && (
          <div style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, marginBottom: 6, fontFamily: 'Roboto, sans-serif', lineHeight: 1.3 }}>
            {detail?.node?.label || node.label}
          </div>
        )}

        {/* Politician photo block */}
        {node.kind === 'politician' && detail?.node && (
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {detail?.node?.is_super_pac && <Chip label="SUPER PAC" color="#4A7FFF" t={t} />}
          {detail?.node?.is_501c4    && <Chip label="501(c)(4)" color="#CC88FF" t={t} />}
          {detail?.node?.sector      && <Chip label={detail.node.sector} color="#FF8000" t={t} />}
        </div>

        {/* Source attribution */}
        {node.kind === 'employer' && (
          <SourceFooter
            s="Self-reported employer field on FEC Schedule A · Individual Contributions"
            href="https://www.fec.gov/data/receipts/individual-contributions/"
          />
        )}
        {(node.kind === 'trad_pac' || node.kind === 'super_pac' || node.kind === 'dark_money') && (
          <SourceFooter
            s="FEC Committee Database"
            href={`https://www.fec.gov/data/committee/${node.id.replace('cmt:', '')}/`}
          />
        )}
        {/* Politician SourceFooter is rendered inside PoliticianProfile — skip it here */}
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
```

- [ ] **Step 2: Pass `expanded` to `SectorView` and `PatternView` as well (future-proofing, no layout change yet)**

Find `SectorView` (around line 150) and `PatternView` (around line 187). Update both signatures to accept and silently ignore `expanded` — this prevents React unknown-prop warnings if the prop is ever used later:

```jsx
function SectorView({ payload, cycle, t, surface, expanded = false }) {
```

```jsx
function PatternView({ payload, cycle, t, surface, expanded = false }) {
```

No other changes inside those functions.

- [ ] **Step 3: Verify two-column expanded layout**

```bash
npm run dev:all
```

Open any employer node drawer. Click `⤢`. Confirm:
- Panel fills full viewport
- Left 40%: MiniGalaxy at 600px height
- Right 60%: metadata KPIs + badges + money trail timeline, scrollable independently
- `⤡` collapses back to normal 420px single-column view
- Sector and Pattern drawers still open and close correctly (no layout change, no errors)

- [ ] **Step 4: Commit**

```bash
git add src/components/galaxy/GalaxyDrawer.jsx
git commit -m "feat(drawer): two-column layout in full-page expanded mode"
```

---

## Self-Review

**Spec coverage:**
- ✅ Expand button renders next to X
- ✅ Clicking expands to full viewport (`inset: 0` equivalent via `left: 0, right: 0`)
- ✅ Collapse button returns to 420px side panel
- ✅ Backdrop hidden in expanded mode (panel IS the full screen)
- ✅ Two-column layout in expanded mode: mini-galaxy left, content right
- ✅ Escape key and X still close in both modes
- ✅ SectorView and PatternView accept `expanded` prop without errors

**Placeholder scan:** No TBDs, no incomplete sections. All code is complete and self-contained.

**Type consistency:** `expanded` prop defaults to `false` in all sub-components. `setExpanded` uses functional update `e => !e` to avoid stale closure. `FONT_MONO` is already imported at the top of `GalaxyDrawer.jsx`.
