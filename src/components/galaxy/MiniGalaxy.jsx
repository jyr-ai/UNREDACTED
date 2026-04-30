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
  const t = galaxyTokens[surface] || galaxyTokens.dark
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
  }, [simNodes, simLinks])

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
    dragRef.current = { nodeObj, ox: e.clientX - (nodeObj.x || 0), oy: e.clientY - (nodeObj.y || 0) }
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
    <div
      style={{ position: 'relative', width: '100%', height, background: t.surfaceSub, overflow: 'hidden' }}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        onWheel={onWheel}
        style={{ display: 'block', cursor: 'grab' }}
      >
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
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
          {/* Nodes */}
          {simNodes.map(n => {
            const r = nodeRadius(n)
            const color = KIND_COLOR[n.kind] || '#888'
            const isFocus = n.id === focusNodeId
            return (
              <g key={n.id}
                 transform={`translate(${n.x ?? 0},${n.y ?? 0})`}
                 style={{ cursor: 'pointer' }}
                 onMouseDown={e => onMouseDown(e, n)}>
                {isFocus && (
                  <circle r={r + 4} fill="none" stroke="#FF8000" strokeWidth={1.5} opacity={0.7} />
                )}
                {n.kind === 'dark_money'
                  ? <rect x={-r} y={-r} width={r * 2} height={r * 2}
                          fill={`${color}28`} stroke={color} strokeWidth={1.5} strokeDasharray="4,2" />
                  : n.kind === 'super_pac'
                  ? <polygon points={`0,${-r} ${r},0 0,${r} ${-r},0`}
                             fill={`${color}28`} stroke={color} strokeWidth={1.5} />
                  : <circle r={r}
                            fill={`${color}${n.kind === 'employer' ? '' : '28'}`}
                            stroke={color}
                            strokeWidth={n.kind === 'employer' ? 0 : 1.5} />
                }
                <text
                  y={r + 10}
                  textAnchor="middle"
                  fontSize={7}
                  fill={t.textMuted}
                  fontFamily="Roboto, sans-serif"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {(n.label || '').slice(0, 18)}{(n.label || '').length > 18 ? '…' : ''}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
      {/* Zoom buttons */}
      <div style={{ position: 'absolute', top: 6, right: 8, display: 'flex', gap: 3 }}>
        {['+', '−'].map((lbl, i) => (
          <button key={lbl} onClick={() => setView(v => {
            const factor = i === 0 ? 1.25 : 0.8
            const k = Math.max(0.3, Math.min(5, v.k * factor))
            const cx = (svgRef.current?.clientWidth || 380) / 2
            const cy = height / 2
            const scale = k / v.k
            return { k, x: cx - (cx - v.x) * scale, y: cy - (cy - v.y) * scale }
          })} style={{
            width: 20, height: 20, background: 'rgba(255,255,255,0.08)',
            border: `1px solid rgba(255,255,255,0.15)`, borderRadius: 2,
            color: t.textMuted, fontSize: 13, lineHeight: 1, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'monospace', padding: 0,
          }}>{lbl}</button>
        ))}
      </div>
      <div style={{
        position: 'absolute', bottom: 5, right: 8,
        fontSize: 7, color: t.textMuted, opacity: 0.4, pointerEvents: 'none',
      }}>
        Drag to pan · scroll to zoom
      </div>
    </div>
  )
}
