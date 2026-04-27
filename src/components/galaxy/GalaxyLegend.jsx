import { galaxyTokens } from './lib/galaxyTokens.js'

const LEGEND_ITEMS = [
  { kind: 'employer',    label: 'Employer',             shape: 'circle' },
  { kind: 'trad_pac',   label: 'Traditional PAC',       shape: 'circle' },
  { kind: 'dark_money', label: '501(c)(4) dark money',  shape: 'squareDashed' },
  { kind: 'super_pac',  label: 'Super PAC',             shape: 'diamond' },
  { kind: 'politician', label: 'Politician',            shape: 'dot' }
]

function Glyph({ shape, t }) {
  if (shape === 'dot')
    return <circle cx="8" cy="8" r="4" fill={t.politicianFill} />
  if (shape === 'squareDashed')
    return (
      <rect
        x="2" y="2" width="12" height="12"
        fill={t.nodeFill} stroke={t.darkMoneyStroke}
        strokeWidth="1.5" strokeDasharray="3,2"
      />
    )
  if (shape === 'diamond')
    return (
      <polygon
        points="8,2 14,8 8,14 2,8"
        fill={t.nodeFill} stroke={t.superPacStroke} strokeWidth="1.5"
      />
    )
  // default: circle (employer / trad_pac)
  return (
    <circle
      cx="8" cy="8" r="5.5"
      fill={t.nodeFill} stroke={t.employerStroke} strokeWidth="1.5"
    />
  )
}

export default function GalaxyLegend({ surface }) {
  const t = galaxyTokens[surface]
  return (
    <div style={{
      display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center',
      padding: '6px 12px', fontFamily: 'Roboto, sans-serif', fontSize: 9,
      color: t.textMuted, borderTop: `1px solid ${t.panelBorder}`, background: t.surface
    }}>
      {LEGEND_ITEMS.map(item => (
        <span key={item.kind} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="16" height="16"><Glyph shape={item.shape} t={t} /></svg>
          {item.label}
        </span>
      ))}
      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <svg width="32" height="8">
          <line
            x1="0" y1="4" x2="32" y2="4"
            stroke={t.edgeBase} strokeOpacity={t.edgeBaseOpacity} strokeWidth="2"
          />
        </svg>
        $ weight (thickness)
      </span>
    </div>
  )
}
