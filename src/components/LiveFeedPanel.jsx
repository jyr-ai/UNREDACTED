import { useState, useEffect, useCallback, useRef } from 'react'
import { useTheme } from '../theme/index.js'
import { ORANGE, FONT_MONO } from '../theme/tokens.js'
import { feed } from '../api/client.js'

const CATEGORIES = [
  { key: 'ALL',              label: 'All Intel',    short: 'ALL',     color: ORANGE,    icon: '◈' },
  { key: 'SPENDING',         label: 'Gov Spending', short: 'GOV',     color: '#4A7FFF', icon: '◆' },
  { key: 'CORRUPTION',       label: 'Corruption',   short: 'CORRUPT', color: '#FF8000', icon: '▲' },
  { key: 'SEC_FILING',       label: 'SEC & Filings',short: 'SEC',     color: '#00AADD', icon: '▪' },
  { key: 'FEC_CAMPAIGN',     label: 'FEC & Campaign',short:'FEC',     color: '#9966CC', icon: '◉' },
  { key: 'STOCK_ACT',        label: 'STOCK Act',    short: 'STOCK',   color: '#FFB84D', icon: '▸' },
  { key: 'POLITICIAN_SPEND', label: 'Pol. Spending',short: 'POL',     color: '#E63946', icon: '◇' },
  { key: 'DARK_MONEY',       label: 'Dark Money',   short: 'DARK',    color: '#888888', icon: '○' },
]

const REFRESH_MS  = 5 * 60 * 1000
const ITEMS_SHOWN = 14

function usePanelWidth(ref) {
  const [width, setWidth] = useState(600)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [ref])
  return width
}

function RiskBadge({ risk, s }) {
  const colors = { HIGH: '#FF8000', MED: '#FFB84D', LOW: '#444' }
  const bg     = { HIGH: '#FF800018', MED: '#FFB84D14', LOW: 'transparent' }
  if (!risk || risk === 'LOW') return null
  return (
    <span style={{
      fontFamily: FONT_MONO, fontSize: Math.round(7.5 * s), letterSpacing: 1.5,
      color: colors[risk], background: bg[risk],
      border: `1px solid ${colors[risk]}44`,
      padding: '1px 6px', flexShrink: 0,
    }}>{risk}</span>
  )
}

function FeedItem({ item, accentColor, s }) {
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
        padding: `${Math.round(9 * s)}px ${Math.round(12 * s)}px ${Math.round(8 * s)}px`,
        background: 'transparent',
        borderBottom: `1px solid ${t.border}`,
        transition: 'background .12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = accent + '0A' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: Math.round(4 * s), flexWrap: 'wrap' }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: Math.round(8.5 * s), color: accent, letterSpacing: 0.8, flexShrink: 0 }}>
          {catDef.icon} {item.source}
        </span>
        <RiskBadge risk={item.risk} s={s} />
        <span style={{ fontFamily: FONT_MONO, fontSize: Math.round(18 * s), color: t.mid, marginLeft: 'auto', flexShrink: 0 }}>
          {item.time}
        </span>
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: Math.round(15 * s), color: t.hi, lineHeight: 1.5, letterSpacing: 0.2 }}>
        {item.text}
      </div>
    </a>
  )
}

function Skeleton({ s }) {
  const t = useTheme()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ padding: `${Math.round(10 * s)}px ${Math.round(12 * s)}px`, borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 60, height: Math.round(9 * s), background: t.border, opacity: 0.6 }} />
            <div style={{ width: 30, height: Math.round(9 * s), background: t.border, opacity: 0.3 }} />
          </div>
          <div style={{ width: `${65 + (i % 3) * 10}%`, height: Math.round(11 * s), background: t.border, opacity: 0.5 }} />
        </div>
      ))}
    </div>
  )
}

export default function LiveFeedPanel() {
  const t = useTheme()
  const [activeTab, setActiveTab] = useState('ALL')
  const [items,     setItems]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [fetchedAt, setFetchedAt] = useState(null)
  const [countdown, setCountdown] = useState(REFRESH_MS / 1000)
  const [highCount, setHighCount] = useState(0)
  const timerRef  = useRef(null)
  const cdRef     = useRef(null)
  const panelRef  = useRef(null)
  const w = usePanelWidth(panelRef)
  const s = Math.max(0.72, Math.min(1, w / 580))

  const fetchData = useCallback(async (tab) => {
    setLoading(true)
    setError(null)
    try {
      const res = await feed.allFeeds(ITEMS_SHOWN, tab === 'ALL' ? undefined : tab)
      if (res.success) {
        setItems(res.items || [])
        setFetchedAt(res.fetchedAt)
        setHighCount((res.items || []).filter(i => i.risk === 'HIGH').length)
      } else {
        setError('Feed unavailable')
      }
    } catch {
      setError('Could not reach server')
    } finally {
      setLoading(false)
    }
  }, [])

  const scheduleRefresh = useCallback((tab) => {
    clearInterval(timerRef.current)
    clearInterval(cdRef.current)
    setCountdown(REFRESH_MS / 1000)
    timerRef.current = setInterval(() => { fetchData(tab); setCountdown(REFRESH_MS / 1000) }, REFRESH_MS)
    cdRef.current    = setInterval(() => setCountdown(n => Math.max(0, n - 1)), 1000)
  }, [fetchData])

  useEffect(() => {
    fetchData(activeTab)
    scheduleRefresh(activeTab)
    return () => { clearInterval(timerRef.current); clearInterval(cdRef.current) }
  }, [activeTab]) // eslint-disable-line

  const activeCat = CATEGORIES.find(c => c.key === activeTab) || CATEGORIES[0]
  const fmtCountdown = () => {
    const m = Math.floor(countdown / 60)
    const sec = countdown % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  return (
    <div ref={panelRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: t.card, overflow: 'hidden', minHeight: 0 }}>

      {/* ── Header ── */}
      <div style={{ background: t.navBg, borderBottom: `1px solid ${t.border}`, padding: '7px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00FF88', boxShadow: '0 0 6px #00FF88', flexShrink: 0 }} />
          <span style={{ fontFamily: FONT_MONO, fontSize: 11 * s, color: t.hi, letterSpacing: 2, flexShrink: 0 }}>INTELLIGENCE FEEDS</span>
          {highCount > 0 && (
            <span style={{ fontFamily: FONT_MONO, fontSize: Math.round(9 * s), color: ORANGE, border: `1px solid ${ORANGE}55`, background: ORANGE + '14', padding: '1px 7px', letterSpacing: 1, flexShrink: 0 }}>
              {highCount} HIGH RISK
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {fetchedAt && (
            <span style={{ fontFamily: FONT_MONO, fontSize: Math.round(9 * s), color: t.low }}>
              {new Date(fetchedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => { fetchData(activeTab); setCountdown(REFRESH_MS / 1000); scheduleRefresh(activeTab) }}
            title="Refresh now"
            style={{ background: 'none', border: `1px solid ${t.border}`, color: t.mid, padding: `3px ${Math.round(8 * s)}px`, fontFamily: FONT_MONO, fontSize: Math.round(9 * s), letterSpacing: 1, cursor: 'pointer' }}
          >
            ↻ {fmtCountdown()}
          </button>
        </div>
      </div>

      {/* ── Category tabs — responsive: full → short → icon-only ── */}
      <div style={{ display: 'flex', background: t.cardB, borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
        {CATEGORIES.map(cat => {
          const active   = activeTab === cat.key
          const tabLabel = w >= 500 ? cat.label : w >= 330 ? cat.short : null
          return (
            <button
              key={cat.key}
              onClick={() => setActiveTab(cat.key)}
              title={cat.label}
              style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', borderBottom: `3px solid ${active ? cat.color : 'transparent'}`, borderRight: `1px solid ${t.border}`, padding: `${Math.round(8 * s)}px 2px`, fontFamily: FONT_MONO, fontSize: Math.round(10 * s), letterSpacing: tabLabel ? 0.5 : 0, color: active ? cat.color : t.mid, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', transition: 'color .12s, border-color .12s', textAlign: 'center' }}
            >
              {tabLabel
                ? <><span style={{ marginRight: 3 }}>{cat.icon}</span>{tabLabel}</>
                : cat.icon
              }
            </button>
          )
        })}
      </div>

      {/* ── Feed items ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'thin' }}>
        {loading && <Skeleton s={s} />}
        {!loading && error && (
          <div style={{ padding: `24px ${Math.round(18 * s)}px`, fontFamily: FONT_MONO, fontSize: Math.round(10 * s), color: t.low, textAlign: 'center' }}>
            ⚠ {error} — backend may be offline.
            <br />
            <button
              onClick={() => fetchData(activeTab)}
              style={{ marginTop: 10, background: ORANGE + '18', border: `1px solid ${ORANGE}44`, color: ORANGE, padding: `4px ${Math.round(12 * s)}px`, fontFamily: FONT_MONO, fontSize: Math.round(10 * s), cursor: 'pointer' }}
            >
              Retry
            </button>
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div style={{ padding: `24px ${Math.round(18 * s)}px`, fontFamily: FONT_MONO, fontSize: Math.round(10 * s), color: t.low, textAlign: 'center' }}>
            No items for this category.
          </div>
        )}
        {!loading && !error && items.map((item, i) => (
          <FeedItem key={`${item.sourceId}-${i}`} item={item} accentColor={activeCat.color} s={s} />
        ))}
      </div>

      {/* ── Footer ── */}
      <div style={{ background: t.cardB, borderTop: `1px solid ${t.border}`, padding: '7px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: Math.round(9 * s), color: t.low }}>
          {items.length} items · 5-min refresh
        </span>
        <span style={{ fontFamily: FONT_MONO, fontSize: Math.round(9 * s), color: t.low }}>
          FEC · SEC · DOJ · ProPublica · CREW
        </span>
      </div>

    </div>
  )
}
