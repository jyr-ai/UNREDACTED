import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../../theme/index.js'
import { ORANGE, FONT_MONO as MF } from '../../theme/tokens.js'
import { feed } from '../../api/client.js'
import { useMobile } from '../../hooks/useMediaQuery.js'

const STATIC_FALLBACK = [
  { text: 'STOCK Act violations up 40% this quarter',           risk: 'HIGH', source: 'UNREDACTED', cat: 'STOCK_ACT' },
  { text: 'New $5.1B defense contract awarded to Raytheon',     risk: 'HIGH', source: 'UNREDACTED', cat: 'SPENDING' },
  { text: 'Sen. Hughes receives $2.8M from defense PACs',        risk: 'HIGH', source: 'UNREDACTED', cat: 'FEC_CAMPAIGN' },
  { text: 'Dark-money spending hits record $1.2B in 2024',       risk: 'HIGH', source: 'UNREDACTED', cat: 'DARK_MONEY' },
  { text: 'Federal Register: 17 new regulations this week',      risk: 'MED',  source: 'FedReg',     cat: 'SPENDING' },
  { text: 'DoD budget exceeds $1T for first time',               risk: 'HIGH', source: 'UNREDACTED', cat: 'SPENDING' },
  { text: 'SEC charges hedge fund manager with insider trading', risk: 'HIGH', source: 'UNREDACTED', cat: 'SEC_FILING' },
]

// Category accent colours — mirrors LiveFeedPanel
const CAT_COLOR = {
  SPENDING:         '#4A7FFF',
  CORRUPTION:       '#FF8000',
  SEC_FILING:       '#00AADD',
  FEC_CAMPAIGN:     '#9966CC',
  STOCK_ACT:        '#FFB84D',
  POLITICIAN_SPEND: '#E63946',
  DARK_MONEY:       '#888888',
}

const REFRESH_MS = 5 * 60 * 1000   // 5 minutes

function Ticker() {
  const t = useTheme()
  const isMobile = useMobile()
  const [items, setItems] = useState(STATIC_FALLBACK)
  const [live, setLive]   = useState(false)
  const timerRef = useRef(null)

  const loadFeed = async () => {
    try {
      // Fetch top 20 items, favour HIGH risk from all categories
      const res = await feed.allFeeds(20)
      if (res?.success && res.items?.length) {
        // Prefer HIGH/MED risk items; deduplicate by text prefix
        const seen = new Set()
        const mapped = res.items
          .filter(i => i.text)
          .map(i => ({
            text:   i.text.length > 90 ? i.text.slice(0, 87) + '…' : i.text,
            risk:   i.risk,
            source: i.source,
            cat:    i.category,
            url:    i.url,
          }))
          .filter(i => {
            const key = i.text.slice(0, 30)
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
          .slice(0, 16)

        if (mapped.length > 0) {
          setItems(mapped)
          setLive(true)
        }
      }
    } catch {
      // silently keep static fallback
    }
  }

  useEffect(() => {
    loadFeed()
    timerRef.current = setInterval(loadFeed, REFRESH_MS)
    return () => clearInterval(timerRef.current)
  }, [])

  // Need doubled list for seamless infinite scroll
  const display = [...items, ...items]
  const durationSec = Math.max(30, display.length * 3.5)

  const styleId = 'ticker-kf'
  const animId  = 'ticker-scroll'

  return (
    <div style={{
      background: t.tickerBg,
      borderBottom: `1px solid ${t.border}`,
      padding: '0 0',
      overflow: 'hidden',
      height: isMobile ? 34 : 28,
      display: 'flex',
      alignItems: 'center',
      position: 'relative',
    }}>
      {/* LIVE indicator */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 5,
        padding: isMobile ? '0 10px' : '0 12px',
        borderRight: `1px solid ${t.border}`,
        height: '100%',
        background: t.tickerBg,
        zIndex: 2,
      }}>
        <div style={{
          width: isMobile ? 6 : 5, height: isMobile ? 6 : 5, borderRadius: '50%',
          background: live ? '#00FF88' : t.border,
          boxShadow: live ? '0 0 5px #00FF88' : 'none',
          flexShrink: 0,
        }} />
        <span style={{ fontFamily: MF, fontSize: isMobile ? 9 : 8, color: live ? '#00FF88' : t.low, letterSpacing: 1.5 }}>
          {live ? 'LIVE' : 'INTEL'}
        </span>
      </div>

      {/* Scrolling track */}
      <div style={{ overflow: 'hidden', flex: 1, height: '100%', display: 'flex', alignItems: 'center' }}>
        <div
          key={items.length}
          style={{
            display: 'flex',
            whiteSpace: 'nowrap',
            animation: `${animId} ${durationSec}s linear infinite`,
          }}
        >
          {display.map((item, i) => {
            const accent = CAT_COLOR[item.cat] || ORANGE
            return (
              <span
                key={i}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  marginRight: 0,
                  paddingLeft: 10,
                  cursor: item.url ? 'pointer' : 'default',
                }}
                onClick={() => item.url && window.open(item.url, '_blank', 'noopener')}
              >
                {/* risk flash for HIGH */}
                {item.risk === 'HIGH' && (
                  <span style={{
                    fontFamily: MF, fontSize: 7, color: ORANGE,
                    border: `1px solid ${ORANGE}44`, background: ORANGE + '14',
                    padding: '0 4px', marginRight: 6, letterSpacing: 1, flexShrink: 0,
                  }}>
                    !
                  </span>
                )}
                {/* source tag */}
                <span style={{
                  fontFamily: MF, fontSize: 8, color: accent, marginRight: 5,
                  flexShrink: 0, letterSpacing: 0.3,
                }}>
                  [{item.source}]
                </span>
                {/* headline */}
                <span style={{
                  fontFamily: MF,
                  fontSize: isMobile ? 10.5 : 9.5,
                  color: item.risk === 'HIGH' ? t.tickerTx : t.low,
                  letterSpacing: 0.3,
                }}>
                  {item.text}
                </span>
                {/* separator */}
                <svg width={8} height={8} style={{ marginLeft: 18, marginRight: 2, flexShrink: 0 }}>
                  <circle cx={4} cy={4} r={1.5} fill={accent + '66'} />
                </svg>
              </span>
            )
          })}
        </div>
      </div>

      <style>{`
        @keyframes ${animId} {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}

export default Ticker
