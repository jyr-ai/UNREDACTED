import { useTheme } from '../../theme/index.js'
import { FONT_MONO, ORANGE } from '../../theme/tokens.js'
import SourceFooter from '../ui/SourceFooter.jsx'

const RECEIPT_COLOR  = '#FFB84D'
const TRANSFER_COLOR = '#4A7FFF'

function fmt$(v) {
  if (v == null) return '—'
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}b`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}m`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}k`
  return `$${Math.round(v)}`
}

function fmtDate(d) {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

export default function ContributionTimeline({ events = [], surface = 'dark' }) {
  const t = useTheme()

  if (!events.length) {
    return (
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 8, letterSpacing: 1.5, color: t.low, fontFamily: FONT_MONO, marginBottom: 8, textTransform: 'uppercase' }}>
          Money Trail
        </div>
        <div style={{ fontSize: 10, color: t.low, fontFamily: FONT_MONO }}>
          No dated transactions found for this node.
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 14px' }}>
      <div style={{ fontSize: 8, letterSpacing: 1.5, color: t.low, fontFamily: FONT_MONO, marginBottom: 10, textTransform: 'uppercase' }}>
        Money Trail — Contributions &amp; Transfers by Date
      </div>

      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
        {events.map((ev, i) => {
          const isLast = i === events.length - 1
          const dotColor = ev.kind === 'receipt' ? RECEIPT_COLOR : TRANSFER_COLOR
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '58px 10px 1fr', gap: '3px 8px', alignItems: 'start', marginBottom: 2 }}>
              {/* Date */}
              <div style={{ fontSize: 8, color: t.low, fontFamily: FONT_MONO, textAlign: 'right', paddingTop: 1 }}>
                {fmtDate(ev.date)}
              </div>
              {/* Dot + line */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, border: `1px solid ${dotColor}88`, flexShrink: 0 }} />
                {!isLast && <div style={{ width: 1, flex: 1, background: t.border, minHeight: 12 }} />}
              </div>
              {/* Text */}
              <div style={{ paddingBottom: 6 }}>
                <div style={{ fontSize: 9, color: t.hi, fontFamily: FONT_MONO, lineHeight: 1.4 }}>
                  {ev.from_label} → {ev.to_label}
                </div>
                <div style={{ fontSize: 8, color: t.low, fontFamily: FONT_MONO }}>
                  {ev.kind === 'receipt' ? 'Individual receipt' : 'Committee transfer'} ·{' '}
                  <span style={{ color: ORANGE, fontWeight: 600 }}>{fmt$(ev.amount)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginTop: 8, paddingTop: 6, borderTop: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: RECEIPT_COLOR }} />
          <span style={{ fontSize: 7.5, color: t.low, fontFamily: FONT_MONO }}>Individual receipt</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: TRANSFER_COLOR }} />
          <span style={{ fontSize: 7.5, color: t.low, fontFamily: FONT_MONO }}>Committee transfer</span>
        </div>
      </div>

      <SourceFooter
        s="FEC Individual Contributions (Schedule A) · FEC Committee-to-Committee Transfers"
        href="https://www.fec.gov/campaign-finance-data/"
      />
    </div>
  )
}
