# Galaxy Flow Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visualize the direction and magnitude of money flowing through galaxy edges using animated particles traveling source → target, plus arrowhead markers on all edges.

**Architecture:** Replace SVG `<line>` elements with `<path>` elements (visually identical, but required for SVG `<animateMotion>` + `<mpath>`). Add `<defs>` arrowhead markers for direction cues. Add a particle layer where small animated circles travel along significant edges — faster and larger particles mean more money. Apply to both `GalaxyGraph.jsx` (full galaxy) and `MiniGalaxy.jsx` (drawer panel).

**Tech Stack:** SVG `<animateMotion>`, `<marker>`, `<path>`, `<mpath>` — all native SVG, no extra libraries. Existing D3 simulation and `tick` re-renders keep particle paths in sync with node positions.

---

## Design Decisions

**Particle behavior:**
- Direction: source node → target node (employer → PAC → politician = left to right in the money chain)
- Speed: `dur = 2 + (1 - weight) * 3` seconds — heavy flows (weight=1.0) take 2s, light flows (weight=0.1) take 4.7s. Heavier = faster = more money.
- Size: `r = 1.5 + weight * 1.5` px — heavier flows have larger particles
- Color: matches edge color (orange for regular, blue-grey for bridge)
- Stagger: `begin={i * 0.4 % 3}s` so particles don't all start together

**Performance caps:**
- `GalaxyGraph` universe mode (up to 500 edges): only edges with `weight >= 0.25`
- `MiniGalaxy` (5–20 edges): all edges get particles
- `reducedMotion` in `GalaxyGraph`: skip all animation (check already exists in component)

**Arrow markers:**
- Small arrowhead (5×4px) at the edge endpoint pointing toward the target node
- Orange for regular edges (`#FF8000`), grey for bridge edges (`#555566`)
- `markerEnd` added to every edge path

---

## File Map

| Action | File | Change |
|---|---|---|
| Modify | `src/components/galaxy/GalaxyGraph.jsx` | Replace edge `<line>` with `<path>`, add `<defs>` markers, add particle layer |
| Modify | `src/components/galaxy/MiniGalaxy.jsx` | Replace edge `<line>` with `<path>`, add `<defs>` markers, add particle layer |

---

## Task 1: Arrow markers + convert edges to paths in `GalaxyGraph`

**Files:**
- Modify: `src/components/galaxy/GalaxyGraph.jsx`

**Context:** The SVG currently renders edges as `<line>` elements. Arrowhead `<marker>` elements require `<defs>`. `<animateMotion>` with `<mpath>` requires `<path>` (not `<line>`) as the referenced element. Converting lines to paths is visually identical — `<path d="M x1 y1 L x2 y2">` draws the same line.

The `<defs>` block must be inside `<svg>` but outside the `<g transform>` group so markers are in the global SVG namespace. Place them as the **first child** of `<svg>`.

- [ ] **Step 1: Read the current GalaxyGraph SVG section**

Open `src/components/galaxy/GalaxyGraph.jsx`. Find the `<svg>` element (around line 220). Note: the `<g transform={...}>` is the first child of `<svg>`. The edges `<g>` block is around line 301–314.

- [ ] **Step 2: Add `<defs>` markers as first child of `<svg>`**

Inside the `return (...)`, find this existing structure:
```jsx
<svg
  ref={svgRef} width={width} height={height}
  style={{ ... }}
  onWheel={onWheel}
  ...
>
  <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
```

Insert the `<defs>` block immediately after the opening `<svg>` tag, BEFORE the `<g transform>`:

```jsx
<svg
  ref={svgRef} width={width} height={height}
  style={{ display: 'block', background: t.surface, cursor: dragRef.current ? 'grabbing' : 'grab', touchAction: 'none' }}
  onWheel={onWheel}
  onMouseDown={onMouseDown}
  onMouseMove={onMouseMove}
  onMouseUp={onMouseUp}
  onMouseLeave={onMouseUp}
>
  <defs>
    <marker id="fa-orange" markerWidth="5" markerHeight="4" refX="4.5" refY="2" orient="auto">
      <path d="M 0 0 L 5 2 L 0 4 z" fill="#FF8000" opacity="0.7" />
    </marker>
    <marker id="fa-grey" markerWidth="5" markerHeight="4" refX="4.5" refY="2" orient="auto">
      <path d="M 0 0 L 5 2 L 0 4 z" fill="#555566" opacity="0.5" />
    </marker>
  </defs>
  <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
```

- [ ] **Step 3: Replace edge `<line>` elements with `<path>` + add `markerEnd`**

Find the edges `<g>` block (around line 302–314):
```jsx
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
```

Replace with:
```jsx
{/* edges — <path> instead of <line> so animateMotion mpath can reference by id */}
<g>
  {graph.links.map((l, i) => {
    const x1 = l.source.x, y1 = l.source.y
    const x2 = l.target.x, y2 = l.target.y
    const markerId = l.isBridge ? 'fa-grey' : 'fa-orange'
    return (
      <path
        key={i}
        id={`ge-${i}`}
        d={`M ${x1} ${y1} L ${x2} ${y2}`}
        fill="none"
        stroke={l.isBridge ? t.edgeBridgeColor : t.edgeBase}
        strokeOpacity={linkOpacity(l)}
        strokeWidth={0.5 + (l.weight || 0) * 2.2}
        strokeDasharray={l.isBridge ? '4,3' : undefined}
        markerEnd={`url(#${markerId})`}
      />
    )
  })}
</g>
```

- [ ] **Step 4: Verify in browser**

```bash
npm run dev:all
```

Open the app → Follow the Money → Money Flow tab. Edges should look the same as before, now with small orange arrowheads pointing toward the target node on each edge. No particles yet.

Expected: edges render with arrowheads, no console errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/galaxy/GalaxyGraph.jsx
git commit -m "feat(galaxy): arrowhead markers on edges — convert <line> to <path> for animateMotion"
```

---

## Task 2: Animated flow particles in `GalaxyGraph`

**Files:**
- Modify: `src/components/galaxy/GalaxyGraph.jsx`

**Context:** After Task 1, each edge `<path>` has `id="ge-{i}"`. A particle is a `<circle>` that uses `<animateMotion>` + `<mpath href="#ge-{i}">` to travel along the edge path. Only render particles for significant edges (`weight >= 0.25`) to avoid performance issues in universe mode (up to 500 edges). Respect existing `reducedMotion` boolean already in the component. Place the particle `<g>` AFTER the edges `<g>` but BEFORE the nodes `<g>` so particles render on top of edges but below nodes.

- [ ] **Step 1: Add particle layer after edges, before nodes**

Find the comment `{/* nodes */}` and add the particles `<g>` block immediately before it:

```jsx
        {/* flow particles — travel source→target on significant edges */}
        {!reducedMotion && (
          <g pointerEvents="none">
            {graph.links.map((l, i) => {
              if ((l.weight || 0) < 0.25) return null
              const color = l.isBridge ? '#8888aa' : '#FF8000'
              const dur   = (2 + (1 - (l.weight || 0)) * 3).toFixed(1)
              const r     = 1.5 + (l.weight || 0) * 1.5
              const begin = `${((i * 0.4) % 3).toFixed(1)}s`
              return (
                <circle key={`fp-${i}`} r={r} fill={color} opacity={0.75}>
                  <animateMotion
                    dur={`${dur}s`}
                    begin={begin}
                    repeatCount="indefinite"
                    rotate="auto"
                  >
                    <mpath href={`#ge-${i}`} />
                  </animateMotion>
                </circle>
              )
            })}
          </g>
        )}

        {/* nodes */}
```

- [ ] **Step 2: Verify in browser**

```bash
npm run dev:all
```

Open the galaxy. You should see small orange dots traveling along the thicker (higher-weight) edges, from employer nodes toward PAC nodes. Thicker edges = faster dots. Bridge edges (grey dashes) show blue-grey dots.

Expected: particles visible on significant edges, animating continuously, not on thin/low-weight edges, no performance drop on scrolling/zooming.

- [ ] **Step 3: Check reduced motion**

In browser DevTools → Rendering → Emulate prefers-reduced-motion: reduce. Reload. Particles should disappear but edges and arrowheads remain.

- [ ] **Step 4: Commit**

```bash
git add src/components/galaxy/GalaxyGraph.jsx
git commit -m "feat(galaxy): animated money flow particles on significant edges (weight >= 0.25)"
```

---

## Task 3: Arrow markers + flow particles in `MiniGalaxy`

**Files:**
- Modify: `src/components/galaxy/MiniGalaxy.jsx`

**Context:** The drawer MiniGalaxy has the same `<line>` → `<path>` conversion needed, but applies to all edges (5–20 edges max). No `reducedMotion` check needed here — the drawer is interactive and brief. The `tick` state variable triggers re-renders on each simulation step, so `id="me-{i}"` paths update their coordinates and particles restart seamlessly.

One difference from GalaxyGraph: `simLinks` use D3-mutated `source` and `target` (objects after link force runs), so resolve with `nodeById` map as the current code already does.

- [ ] **Step 1: Add `<defs>` markers to the MiniGalaxy SVG**

Find the `<svg>` element in MiniGalaxy (around line 110). Insert `<defs>` as its first child:

```jsx
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        onWheel={onWheel}
        style={{ display: 'block', cursor: 'grab' }}
      >
        <defs>
          <marker id="mfa-orange" markerWidth="5" markerHeight="4" refX="4.5" refY="2" orient="auto">
            <path d="M 0 0 L 5 2 L 0 4 z" fill="#FF8000" opacity="0.7" />
          </marker>
        </defs>
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
```

- [ ] **Step 2: Replace edge `<line>` with `<path>` + arrowhead**

Find the edges render block (around line 119–130 of MiniGalaxy):

```jsx
          {/* Edges */}
          {simLinks.map((e, i) => {
            const s = nodeById.get(typeof e.source === 'object' ? e.source.id : e.source)
            const tgt = nodeById.get(typeof e.target === 'object' ? e.target.id : e.target)
            if (!s || !tgt) return null
            return (
              <line key={i}
                x1={s.x ?? 0} y1={s.y ?? 0} x2={tgt.x ?? 0} y2={tgt.y ?? 0}
                stroke="#FF8000"
                strokeWidth={Math.max(0.5, Math.min(3, (e.weight || 0.2) * 3))}
                opacity={0.35 + (e.weight || 0) * 0.3}
              />
            )
          })}
```

Replace with:

```jsx
          {/* Edges — <path> for animateMotion + arrowhead markers */}
          {simLinks.map((e, i) => {
            const s = nodeById.get(typeof e.source === 'object' ? e.source.id : e.source)
            const tgt = nodeById.get(typeof e.target === 'object' ? e.target.id : e.target)
            if (!s || !tgt) return null
            return (
              <path
                key={i}
                id={`me-${i}`}
                d={`M ${s.x ?? 0} ${s.y ?? 0} L ${tgt.x ?? 0} ${tgt.y ?? 0}`}
                fill="none"
                stroke="#FF8000"
                strokeWidth={Math.max(0.5, Math.min(3, (e.weight || 0.2) * 3))}
                opacity={0.35 + (e.weight || 0) * 0.3}
                markerEnd="url(#mfa-orange)"
              />
            )
          })}
```

- [ ] **Step 3: Add particle layer after edges, before nodes**

Find the comment `{/* Nodes */}` in the MiniGalaxy SVG and add particles immediately before it:

```jsx
          {/* Flow particles */}
          <g pointerEvents="none">
            {simLinks.map((e, i) => {
              const s = nodeById.get(typeof e.source === 'object' ? e.source.id : e.source)
              const tgt = nodeById.get(typeof e.target === 'object' ? e.target.id : e.target)
              if (!s || !tgt) return null
              const dur   = (1.8 + (1 - (e.weight || 0.2)) * 2.5).toFixed(1)
              const r     = 1.2 + (e.weight || 0.2) * 1.8
              const begin = `${((i * 0.35) % 2.5).toFixed(1)}s`
              return (
                <circle key={`mp-${i}`} r={r} fill="#FF8000" opacity={0.7}>
                  <animateMotion
                    dur={`${dur}s`}
                    begin={begin}
                    repeatCount="indefinite"
                    rotate="auto"
                  >
                    <mpath href={`#me-${i}`} />
                  </animateMotion>
                </circle>
              )
            })}
          </g>

          {/* Nodes */}
```

- [ ] **Step 4: Verify in browser**

Click any node in the galaxy to open the drawer. The MiniGalaxy edges should show arrowheads and animated orange dots traveling from source to target nodes.

Expected: particles visible on all edges in the drawer panel, arrowheads pointing toward target nodes.

- [ ] **Step 5: Commit**

```bash
git add src/components/galaxy/MiniGalaxy.jsx
git commit -m "feat(galaxy): flow particles + arrowheads on MiniGalaxy drawer edges"
```

---

## Self-Review

**Spec coverage:**
- ✅ Direction shown: arrowhead markers on all edges (Tasks 1, 3)
- ✅ Magnitude shown: particle speed + size proportional to `weight` (Tasks 2, 3)
- ✅ Both galaxy instances: GalaxyGraph (Tasks 1–2) + MiniGalaxy (Task 3)
- ✅ Performance: capped at `weight >= 0.25` in GalaxyGraph universe mode
- ✅ Accessibility: `reducedMotion` check in GalaxyGraph skips particles

**Type consistency:**
- `ge-{i}` path IDs in GalaxyGraph, `me-{i}` in MiniGalaxy — no collision
- `fa-orange`/`fa-grey` markers in GalaxyGraph, `mfa-orange` in MiniGalaxy — no collision
- `l.weight` and `e.weight` are both `0–1` normalized values from `buildEnvelope` — consistent

**No placeholders:** All code blocks are complete and self-contained.
