import { useEffect, useMemo, useRef, useState } from 'react'
import { buildGraph } from './lib/galaxyBuild.js'
import { buildSimulation, nodeRadius } from './lib/galaxyForces.js'
import { galaxyTokens } from './lib/galaxyTokens.js'

// Hex points: pointy-top hexagon centered at (cx,cy) with radius r
function hexPoints(cx, cy, r) {
  return Array.from({ length: 6 }, (_, i) => {
    const θ = (i * Math.PI) / 3 + Math.PI / 6
    return `${cx + r * Math.cos(θ)},${cy + r * Math.sin(θ)}`
  }).join(' ')
}

// Party-based politician color
function polColor(party) {
  if (party === 'REP' || party === 'R') return '#FF4466'
  if (party === 'DEM' || party === 'D') return '#4A7FFF'
  return '#888888'
}

function NodeShape({ n, t }) {
  const r = nodeRadius(n)
  const cx = n.x, cy = n.y

  // Politician: solid party-colored circle with subtle outer ring
  if (n.kind === 'politician') {
    const c = polColor(n.party)
    return (
      <g>
        <circle cx={cx} cy={cy} r={r + 2} fill="none" stroke={c} strokeWidth={0.8} opacity={0.35} />
        <circle cx={cx} cy={cy} r={r} fill={c} />
      </g>
    )
  }

  // Dark money 501c4: dashed purple rect — ominous, hollow
  if (n.kind === 'dark_money') {
    const c = t.darkMoneyStroke
    return (
      <rect
        x={cx - r} y={cy - r} width={r * 2} height={r * 2}
        fill={`${c}20`} stroke={c}
        strokeWidth={1.5} strokeDasharray="3,2"
      />
    )
  }

  // Super PAC: orange-red diamond with faint fill
  if (n.kind === 'super_pac') {
    const c = t.superPacStroke
    return (
      <polygon
        points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
        fill={`${c}25`} stroke={c} strokeWidth={1.7}
      />
    )
  }

  // Traditional PAC: teal hexagon — geometric conduit
  if (n.kind === 'trad_pac') {
    const c = t.pacStroke
    return (
      <polygon
        points={hexPoints(cx, cy, r)}
        fill={`${c}22`} stroke={c} strokeWidth={1.5}
      />
    )
  }

  // Employer: solid warm amber circle — the source/sun
  const c = t.employerStroke
  return (
    <g>
      <circle cx={cx} cy={cy} r={r + 3} fill={`${c}12`} />
      <circle cx={cx} cy={cy} r={r} fill={c} />
    </g>
  )
}

export default function GalaxyGraph({
  envelope,
  surface = 'dark',
  width = 900,
  height = 560,
  onNodeClick,
  onPatternClick,
  onSectorClick
}) {
  const t = galaxyTokens[surface]
  const svgRef = useRef(null)

  const reducedMotion = typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const dragRef = useRef(null)        // viewport pan
  const nodeDragRef = useRef(null)    // individual node drag (physics)

  function zoomBy(factor) {
    setView(v => {
      const k = Math.max(0.4, Math.min(4, v.k * factor))
      const cx = width / 2, cy = height / 2
      const scale = k / v.k
      return { k, x: cx - (cx - v.x) * scale, y: cy - (cy - v.y) * scale }
    })
  }

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
  function onNodeMouseDown(e, node) {
    e.stopPropagation()  // prevent viewport pan
    const rect = svgRef.current.getBoundingClientRect()
    nodeDragRef.current = { node }
    node.fx = node.x
    node.fy = node.y
    simRef.current?.alphaTarget(0.3).restart()
  }
  function onMouseMove(e) {
    if (nodeDragRef.current) {
      const rect = svgRef.current.getBoundingClientRect()
      nodeDragRef.current.node.fx = (e.clientX - rect.left - view.x) / view.k
      nodeDragRef.current.node.fy = (e.clientY - rect.top  - view.y) / view.k
      return
    }
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.x
    const dy = e.clientY - dragRef.current.y
    setView({ ...dragRef.current.view, x: dragRef.current.view.x + dx, y: dragRef.current.view.y + dy })
  }
  function onMouseUp() {
    if (nodeDragRef.current) {
      nodeDragRef.current.node.fx = null
      nodeDragRef.current.node.fy = null
      simRef.current?.alphaTarget(0)
      nodeDragRef.current = null
    }
    dragRef.current = null
  }

  const [hovered, setHovered] = useState(null)

  const graph = useMemo(
    () => buildGraph(envelope, { width, height }),
    [envelope, width, height]
  )

  const connectedIds = useMemo(() => {
    if (!hovered) return null
    const s = new Set([hovered])
    for (const l of (graph?.links || [])) {
      if ((l.sourceId || l.source?.id) === hovered) s.add(l.targetId || l.target?.id)
      if ((l.targetId || l.target?.id) === hovered) s.add(l.sourceId || l.source?.id)
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
    const sId = l.sourceId || l.source?.id
    const tId = l.targetId || l.target?.id
    return connectedIds.has(sId) && connectedIds.has(tId) ? op : 0.05
  }

  // tick increments on each simulation tick, triggering re-render so SVG
  // reads the D3-mutated x/y positions on node objects.
  const [tick, setTick] = useState(0)

  // Recompute sector bounding circles from live node positions each tick
  const sectorBounds = useMemo(() => {
    if (!graph) return new Map()
    const byName = new Map()
    for (const n of graph.nodes) {
      if (!n.sector || n.x == null || n.y == null) continue
      if (!byName.has(n.sector)) byName.set(n.sector, [])
      byName.get(n.sector).push(n)
    }
    const bounds = new Map()
    for (const [name, nodes] of byName) {
      const cx = nodes.reduce((a, n) => a + n.x, 0) / nodes.length
      const cy = nodes.reduce((a, n) => a + n.y, 0) / nodes.length
      const r = Math.max(32, Math.max(...nodes.map(n => Math.hypot(n.x - cx, n.y - cy))) + 30)
      bounds.set(name, { cx, cy, r })
    }
    return bounds
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, graph])
  const simRef = useRef(null)

  useEffect(() => {
    if (!graph) return
    const sim = buildSimulation({
      nodes: graph.nodes,
      links: graph.links,
      centroids: graph.centroids,
      width,
      height
    })
    simRef.current = sim
    if (!reducedMotion) sim.on('tick', () => setTick(x => x + 1))
    return () => sim.stop()
  }, [graph, width, height, reducedMotion])

  if (!graph) {
    return (
      <div style={{
        padding: 40, color: t.textMuted,
        fontFamily: 'Roboto, sans-serif', fontSize: 11
      }}>
        No galaxy data.
      </div>
    )
  }

  const btnStyle = {
    width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: t.surface, border: `1px solid ${t.panelBorder}`, color: t.textMuted,
    fontFamily: 'Roboto, sans-serif', fontSize: 16, fontWeight: 300,
    cursor: 'pointer', lineHeight: 1, userSelect: 'none'
  }

  return (
    <div style={{ position: 'relative', width, height }}>
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
        {/* sector halos — live bounding circles around actual node positions */}
        {graph.sectors.map(s => {
          const b = sectorBounds.get(s.name)
          if (!b) return null
          return (
            <g key={`halo-${s.name}`}>
              <circle
                cx={b.cx} cy={b.cy} r={b.r}
                fill={s.color}
                fillOpacity={surface === 'dark' ? 0.06 : 0.09}
                stroke={s.color}
                strokeOpacity={surface === 'dark' ? 0.20 : 0.26}
                strokeWidth={1.2}
                strokeDasharray="4,3"
                style={{ cursor: onSectorClick ? 'pointer' : 'default' }}
                onClick={() => onSectorClick?.(s)}
              />
              <text
                x={b.cx} y={b.cy - b.r + 14}
                textAnchor="middle"
                fontFamily="Roboto, sans-serif" fontSize={8} fontWeight={600}
                fill={s.color} fillOpacity={0.6}
                style={{ letterSpacing: '1.5px' }}
                pointerEvents="none"
              >
                {s.name.toUpperCase()}
              </text>
            </g>
          )
        })}

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

        {/* nodes */}
        <g>
          {graph.nodes.map(n => (
            <g
              key={n.id}
              opacity={nodeOpacity(n)}
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
              onMouseDown={e => onNodeMouseDown(e, n)}
              onClick={e => { e.stopPropagation(); onNodeClick?.(n) }}
              style={{ cursor: 'grab' }}
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
    <div style={{ position: 'absolute', bottom: 10, right: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <button type="button" aria-label="Zoom in" style={btnStyle} onClick={() => zoomBy(1.3)}>+</button>
      <button type="button" aria-label="Zoom out" style={btnStyle} onClick={() => zoomBy(1 / 1.3)}>−</button>
    </div>
    </div>
  )
}
