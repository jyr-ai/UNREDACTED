import { useEffect, useState } from 'react'
import { useTheme } from '../../theme/index.js'
import { FONT_MONO } from '../../theme/tokens.js'
import { congress } from '../../api/client.js'
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
  const [member, setMember] = useState(null)

  useEffect(() => {
    if (!node?.bioguide_id) return
    congress.member(node.bioguide_id)
      .then(r => setMember(r?.data || null))
      .catch(() => setMember(null))
  }, [node?.bioguide_id])

  if (!node) return null

  const rawParty = node.party || member?.party
  const party = rawParty === 'Republican' ? 'R'
              : rawParty === 'Democratic' ? 'D'
              : rawParty
  const partyColor = PARTY_COLOR[party] || '#666'
  const photoUrl   = member?.depiction
  const cgUrl = node.bioguide_id
    ? `https://www.congress.gov/member/${node.bioguide_id}`
    : member?.url || null

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 6 }}>

        {/* Photo or avatar */}
        <div style={{
          width: 48, height: 60, borderRadius: 3, overflow: 'hidden', flexShrink: 0,
          background: t.cardB || t.card, border: `1px solid ${t.border}`,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          {photoUrl
            ? <img src={photoUrl} alt={node.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: 28, height: 28, borderRadius: '50%', background: t.border, marginBottom: 2 }} />
          }
        </div>

        {/* Name + badges */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.hi, marginBottom: 3, fontFamily: 'Roboto, sans-serif', lineHeight: 1.3 }}>
            {node.label}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 4 }}>
            {party && (
              <span style={{
                padding: '1px 5px', borderRadius: 2, fontSize: 7, fontWeight: 700, letterSpacing: 0.5,
                border: `1px solid ${partyColor}44`, color: partyColor, background: `${partyColor}18`,
                fontFamily: FONT_MONO,
              }}>
                {party === 'R' ? 'REPUBLICAN' : party === 'D' ? 'DEMOCRAT' : party}
              </span>
            )}
            {(node.chamber || member?.chamber) && (
              <span style={{ padding: '1px 5px', borderRadius: 2, fontSize: 7, border: `1px solid ${t.border}`, color: t.mid, fontFamily: FONT_MONO }}>
                {(node.chamber || member?.chamber || '').toUpperCase()}
              </span>
            )}
            {(node.state || member?.state) && (
              <span style={{ padding: '1px 5px', borderRadius: 2, fontSize: 7, border: `1px solid ${t.border}`, color: t.mid, fontFamily: FONT_MONO }}>
                {node.state || member?.state}
              </span>
            )}
          </div>
          {node.amount > 0 && (
            <div style={{ fontSize: 8, color: t.low, fontFamily: FONT_MONO }}>
              Received <span style={{ color: '#FF8000', fontWeight: 600 }}>{fmt$(node.amount)}</span> this cycle
            </div>
          )}
        </div>
      </div>

      {cgUrl && (
        <a href={cgUrl} target="_blank" rel="noopener noreferrer"
           style={{ fontSize: 8, color: '#4A7FFF', fontFamily: FONT_MONO, textDecoration: 'none' }}>
          View on congress.gov ↗
        </a>
      )}

      <SourceFooter
        s={`FEC Candidate Profile · Congress.gov${member?.bioguideId ? ` (Bioguide ${member.bioguideId})` : ''}`}
        href={cgUrl || `https://www.fec.gov/data/candidate/${node.id?.replace('pol:', '')}/`}
      />
    </div>
  )
}
