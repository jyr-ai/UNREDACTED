import { galaxyTokens } from './lib/galaxyTokens.js'

function hexPoints(cx, cy, r) {
  return Array.from({ length: 6 }, (_, i) => {
    const θ = (i * Math.PI) / 3 + Math.PI / 6
    return `${cx + r * Math.cos(θ)},${cy + r * Math.sin(θ)}`
  }).join(' ')
}

const LEGEND_ITEMS = [
  { kind: 'employer',    label: 'Employer',            shape: 'employer' },
  { kind: 'trad_pac',   label: 'Traditional PAC',      shape: 'hexagon' },
  { kind: 'super_pac',  label: 'Super PAC',            shape: 'diamond' },
  { kind: 'dark_money', label: '501(c)(4) dark money', shape: 'squareDashed' },
  { kind: 'politician', label: 'Politician',           shape: 'dot' },
]

function Glyph({ shape, t }) {
  if (shape === 'employer') {
    const c = t.employerStroke
    return (
      <>
        <circle cx="8" cy="8" r="8" fill={`${c}12`} />
        <circle cx="8" cy="8" r="5" fill={c} />
      </>
    )
  }
  if (shape === 'hexagon') {
    const c = t.pacStroke
    return (
      <polygon points={hexPoints(8, 8, 6)} fill={`${c}22`} stroke={c} strokeWidth="1.5" />
    )
  }
  if (shape === 'diamond') {
    const c = t.superPacStroke
    return (
      <polygon points="8,2 14,8 8,14 2,8" fill={`${c}25`} stroke={c} strokeWidth="1.5" />
    )
  }
  if (shape === 'squareDashed') {
    const c = t.darkMoneyStroke
    return (
      <rect x="2" y="2" width="12" height="12"
        fill={`${c}20`} stroke={c} strokeWidth="1.5" strokeDasharray="3,2" />
    )
  }
  // politician dot
  return <circle cx="8" cy="8" r="5" fill={t.politicianFill} />
}

export default function GalaxyLegend({ surface }) {
  const t = galaxyTokens[surface] || galaxyTokens.dark
  return (
    <div style={{
      display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center',
      padding: '6px 12px', fontFamily: 'Roboto, sans-serif', fontSize: 9,
      color: t.textMuted, borderTop: `1px solid ${t.panelBorder}`, background: t.surface,
    }}>
      {LEGEND_ITEMS.map(item => (
        <span key={item.kind} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <svg width="16" height="16"><Glyph shape={item.shape} t={t} /></svg>
          {item.label}
        </span>
      ))}
      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <svg width="32" height="8">
          <line x1="0" y1="4" x2="32" y2="4"
            stroke={t.edgeBase} strokeOpacity={t.edgeBaseOpacity} strokeWidth="2" />
        </svg>
        $ weight (thickness)
      </span>
    </div>
  )
}
