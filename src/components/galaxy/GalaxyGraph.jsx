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
        fill={t.nodeFill} stroke={t.darkMoneyStroke}
        strokeWidth={1.7} strokeDasharray="4,2"
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

  // employer + trad_pac
  return (
    <circle
      cx={n.x} cy={n.y} r={r}
      fill={t.nodeFill} stroke={strokeFor(n.kind, t)}
      strokeWidth={n.kind === 'employer' ? 2 : 1.7}
    />
  )
}

export default function GalaxyGraph({
  envelope,
  surface = 'dark',
  width = 900,
  height = 560,
  onNodeClick,
  onPatternClick
}) {
  const t = galaxyTokens[surface]
  const svgRef = useRef(null)

  const reducedMotion = typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const dragRef = useRef(null)

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
  function onMouseMove(e) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.x
    const dy = e.clientY - dragRef.current.y
    setView({ ...dragRef.current.view, x: dragRef.current.view.x + dx, y: dragRef.current.view.y + dy })
  }
  function onMouseUp() { dragRef.current = null }

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
  const [, setTick] = useState(0)
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
    <div style={{ position: 'absolute', bottom: 10, right: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <button type="button" aria-label="Zoom in" style={btnStyle} onClick={() => zoomBy(1.3)}>+</button>
      <button type="button" aria-label="Zoom out" style={btnStyle} onClick={() => zoomBy(1 / 1.3)}>−</button>
    </div>
    </div>
  )
}
