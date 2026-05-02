import { useTheme } from '../../theme/index.js'
import { FONT_MONO } from '../../theme/tokens.js'
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
  if (!node) return null

  const party = node.party
  const partyColor = PARTY_COLOR[party] || '#666'
  const fecUrl = `https://www.fec.gov/data/candidate/${node.id?.replace('pol:', '')}/`

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: t.hi, marginBottom: 5, fontFamily: 'Roboto, sans-serif', lineHeight: 1.3 }}>
        {node.label}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
        {party && (
          <span style={{
            padding: '1px 5px', borderRadius: 2, fontSize: 7, fontWeight: 700, letterSpacing: 0.5,
            border: `1px solid ${partyColor}44`, color: partyColor, background: `${partyColor}18`,
            fontFamily: FONT_MONO,
          }}>
            {party === 'R' ? 'REPUBLICAN' : party === 'D' ? 'DEMOCRAT' : party}
          </span>
        )}
        {node.chamber && (
          <span style={{ padding: '1px 5px', borderRadius: 2, fontSize: 7, border: `1px solid ${t.border}`, color: t.mid, fontFamily: FONT_MONO }}>
            {node.chamber.toUpperCase()}
          </span>
        )}
        {node.state && (
          <span style={{ padding: '1px 5px', borderRadius: 2, fontSize: 7, border: `1px solid ${t.border}`, color: t.mid, fontFamily: FONT_MONO }}>
            {node.state}
          </span>
        )}
      </div>

      {node.amount > 0 && (
        <div style={{ fontSize: 8, color: t.low, fontFamily: FONT_MONO, marginBottom: 6 }}>
          Received <span style={{ color: '#FF8000', fontWeight: 600 }}>{fmt$(node.amount)}</span> this cycle
        </div>
      )}

      <SourceFooter
        s="FEC Candidate Profile"
        href={fecUrl}
      />
    </div>
  )
}
