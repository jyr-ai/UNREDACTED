import { useState, useEffect, useCallback, useRef } from 'react'
import { useTheme } from '../theme/index.js'
import { ORANGE, FONT_MONO as MF } from '../theme/tokens.js'
import { feed } from '../api/client.js'

// ── Category metadata (mirrors server FEED_CATEGORIES) ──────────────────────
const CATEGORIES = [
  { key: 'ALL',              label: 'All Intel',          color: ORANGE,    icon: '◈' },
  { key: 'SPENDING',         label: 'Gov Spending',        color: '#4A7FFF', icon: '💰' },
  { key: 'CORRUPTION',       label: 'Corruption',          color: '#FF8000', icon: '⚠' },
  { key: 'SEC_FILING',       label: 'SEC & Filings',       color: '#00AADD', icon: '📋' },
  { key: 'FEC_CAMPAIGN',     label: 'FEC & Campaign',      color: '#9966CC', icon: '🗳' },
  { key: 'STOCK_ACT',        label: 'STOCK Act',           color: '#FFB84D', icon: '📈' },
  { key: 'POLITICIAN_SPEND', label: 'Pol. Spending',       color: '#E63946', icon: '🏛' },
  { key: 'DARK_MONEY',       label: 'Dark Money',          color: '#888888', icon: '🔎' },
]

const REFRESH_MS   = 5 * 60 * 1000  // 5 minutes
const ITEMS_SHOWN  = 14             // items per page

// ── Risk badge ───────────────────────────────────────────────────────────────
function RiskBadge({ risk }) {
  const colors = { HIGH: '#FF8000', MED: '#FFB84D', LOW: '#444' }
  const bg     = { HIGH: '#FF800018', MED: '#FFB84D14', LOW: 'transparent' }
  if (!risk || risk === 'LOW') return null
  return (
    <span style={{
      fontFamily: MF, fontSize: 7.5, letterSpacing: 1.5,
      color: colors[risk], background: bg[risk],
      border: `1px solid ${colors[risk]}44`,
      padding: '1px 6px', flexShrink: 0,
    }}>{risk}</span>
  )
}

// ── Single feed item card ─────────────────────────────────────────────────────
function FeedItem({ item, accentColor }) {
  const t = useTheme()
  const catDef = CATEGORIES.find(c => c.key === item.category) || CATEGORIES[0]
  const accent = accentColor || catDef.color || ORANGE

  return (
    <a
      href={item.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block', textDecoration: 'none',
        borderLeft: `2px solid ${accent}55`,
        padding: '9px 12px 8px',
        background: t.card,
        borderBottom: `1px solid ${t.border}`,
        transition: 'border-left-color .12s, background .12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderLeftColor = accent; e.currentTarget.style.background = accent + '0A' }}
      onMouseLeave={e => { e.currentTarget.style.borderLeftColor = accent + '55'; e.currentTarget.style.background = t.card }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MF, fontSize: 8.5, color: accent, letterSpacing: 0.8, flexShrink: 0 }}>
          {catDef.icon} {item.source}
        </span>
        <RiskBadge risk={item.risk} />
        <span style={{ fontFamily: MF, fontSize: 16, color: t.low, marginLeft: 'auto', flexShrink: 0 }}>
          {item.time}
        </span>
      </div>
      <div style={{
        fontFamily: MF, fontSize: 15, color: t.hi,
        lineHeight: 1.45, letterSpacing: 0.2,
      }}>
        {item.text}
      </div>
    </a>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function Skeleton() {
  const t = useTheme()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ padding: '10px 12px', borderBottom: `1px solid ${t.border}`, background: t.card }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 60, height: 9, background: t.border, borderRadius: 2, opacity: 0.6 }} />
            <div style={{ width: 30, height: 9, background: t.border, borderRadius: 2, opacity: 0.3 }} />
          </div>
          <div style={{ width: `${65 + (i % 3) * 10}%`, height: 11, background: t.border, borderRadius: 2, opacity: 0.5 }} />
        </div>
      ))}
    </div>
  )
}

// ── Main LiveFeedPanel component ──────────────────────────────────────────────
export default function LiveFeedPanel() {
  const t = useTheme()
  const [activeTab,   setActiveTab]   = useState('ALL')
  const [items,       setItems]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [fetchedAt,   setFetchedAt]   = useState(null)
  const [countdown,   setCountdown]   = useState(REFRESH_MS / 1000)
  const [highCount,   setHighCount]   = useState(0)
  const timerRef = useRef(null)
  const cdRef    = useRef(null)

  const fetchData = useCallback(async (tab) => {
    setLoading(true)
    setError(null)
    try {
      let res
      if (tab === 'ALL') {
        res = await feed.allFeeds(ITEMS_SHOWN)
      } else {
        res = await feed.allFeeds(ITEMS_SHOWN, tab)
      }
      if (res.success) {
        setItems(res.items || [])
        setFetchedAt(res.fetchedAt)
        setHighCount((res.items || []).filter(i => i.risk === 'HIGH').length)
      } else {
        setError('Feed unavailable')
      }
    } catch (e) {
      setError('Could not reach server')
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-refresh every 5 min
  const scheduleRefresh = useCallback((tab) => {
    clearInterval(timerRef.current)
    clearInterval(cdRef.current)
    setCountdown(REFRESH_MS / 1000)

    timerRef.current = setInterval(() => {
      fetchData(tab)
      setCountdown(REFRESH_MS / 1000)
    }, REFRESH_MS)

    cdRef.current = setInterval(() => {
      setCountdown(n => Math.max(0, n - 1))
    }, 1000)
  }, [fetchData])

  // Initial load + tab switches
  useEffect(() => {
    fetchData(activeTab)
    scheduleRefresh(activeTab)
    return () => { clearInterval(timerRef.current); clearInterval(cdRef.current) }
  }, [activeTab]) // eslint-disable-line

  const activeCat = CATEGORIES.find(c => c.key === activeTab) || CATEGORIES[0]
  const fmtCountdown = () => {
    const m = Math.floor(countdown / 60)
    const s = countdown % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header band ── */}
      <div style={{
        background: '#0A0A0A',
        borderBottom: `1px solid ${t.border}`,
        padding: '7px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00FF88', boxShadow: '0 0 6px #00FF88', flexShrink: 0 }} />
          <span style={{ fontFamily: MF, fontSize: 9, color: '#FFF', letterSpacing: 2 }}>LIVE INTELLIGENCE FEEDS</span>
          {highCount > 0 && (
            <span style={{
              fontFamily: MF, fontSize: 8, color: ORANGE,
              border: `1px solid ${ORANGE}55`, background: ORANGE + '14',
              padding: '1px 7px', letterSpacing: 1,
            }}>
              {highCount} HIGH RISK
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {fetchedAt && (
            <span style={{ fontFamily: MF, fontSize: 8, color: t.low }}>
              Updated {new Date(fetchedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <span style={{ fontFamily: MF, fontSize: 8, color: t.low }}>
            Refresh in {fmtCountdown()}
          </span>
          <button
            onClick={() => { fetchData(activeTab); setCountdown(REFRESH_MS / 1000); scheduleRefresh(activeTab) }}
            title="Refresh now"
            style={{
              background: 'none', border: `1px solid ${t.border}`,
              color: t.mid, padding: '2px 8px',
              fontFamily: MF, fontSize: 8, letterSpacing: 1, cursor: 'pointer',
            }}
          >
            ↻ REFRESH
          </button>
        </div>
      </div>

      {/* ── Category tabs ── */}
      <div style={{
        display: 'flex', overflowX: 'auto',
        borderBottom: `1px solid ${t.border}`,
        background: t.card,
        scrollbarWidth: 'none',
      }}>
        {CATEGORIES.map(cat => {
          const active = activeTab === cat.key
          return (
            <button
              key={cat.key}
              onClick={() => setActiveTab(cat.key)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: `3px solid ${active ? cat.color : 'transparent'}`,
                borderRight: `1px solid ${t.border}`,
                padding: '9px 14px',
                fontFamily: MF, fontSize: 9, letterSpacing: 0.5,
                color: active ? cat.color : t.mid,
                whiteSpace: 'nowrap', flexShrink: 0,
                cursor: 'pointer', transition: 'color .12s, border-color .12s',
              }}
            >
              <span style={{ marginRight: 5 }}>{cat.icon}</span>
              {cat.label}
            </button>
          )
        })}
      </div>

      {/* ── Feed items ── */}
      <div style={{ maxHeight: 420, overflowY: 'auto', scrollbarWidth: 'thin' }}>
        {loading && <Skeleton />}
        {!loading && error && (
          <div style={{
            padding: '24px 18px', fontFamily: MF, fontSize: 10,
            color: t.low, textAlign: 'center', background: t.card,
          }}>
            ⚠ {error} — backend server may be offline.
            <br />
            <button
              onClick={() => fetchData(activeTab)}
              style={{ marginTop: 10, background: ORANGE + '18', border: `1px solid ${ORANGE}44`, color: ORANGE, padding: '4px 12px', fontFamily: MF, fontSize: 9, cursor: 'pointer' }}
            >
              Retry
            </button>
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div style={{ padding: '24px 18px', fontFamily: MF, fontSize: 10, color: t.low, textAlign: 'center', background: t.card }}>
            No items found for this category.
          </div>
        )}
        {!loading && !error && items.map((item, i) => (
          <FeedItem key={`${item.sourceId}-${i}`} item={item} accentColor={activeCat.color} />
        ))}
      </div>

      {/* ── Footer ── */}
      <div style={{
        borderTop: `1px solid ${t.border}`,
        padding: '6px 14px',
        background: t.card,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontFamily: MF, fontSize: 8, color: t.low }}>
          {items.length} items · GAO · SEC · DOJ · FBI · ProPublica · CREW · FEC · OpenSecrets · Google News
        </span>
        <span style={{ fontFamily: MF, fontSize: 8, color: t.low }}>
          5-min live refresh · UNREDACTED intelligence
        </span>
      </div>
    </div>
  )
}
