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
  height = 560
}) {
  const t = galaxyTokens[surface]
  const svgRef = useRef(null)

  const graph = useMemo(
    () => buildGraph(envelope, { width, height }),
    [envelope, width, height]
  )

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
    sim.on('tick', () => setTick(x => x + 1))
    return () => sim.stop()
  }, [graph, width, height])

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

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{ display: 'block', background: t.surface }}
    >
      {/* Edges */}
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

      {/* Nodes */}
      <g>
        {graph.nodes.map(n => (
          <NodeShape key={n.id} n={n} t={t} />
        ))}
      </g>

      {/* Labels — only employer nodes and high-degree nodes */}
      <g>
        {graph.nodes
          .filter(n => n.kind === 'employer' || (n.degree || 0) > 8)
          .map(n => (
            <text
              key={`lbl-${n.id}`}
              x={n.x}
              y={n.y - nodeRadius(n) - 4}
              textAnchor="middle"
              fontFamily="Roboto, sans-serif"
              fontSize={9}
              fontWeight={600}
              fill={t.textPrimary}
            >
              {String(n.label || '').length > 28
                ? String(n.label).slice(0, 26) + '…'
                : n.label}
            </text>
          ))}
      </g>
    </svg>
  )
}
