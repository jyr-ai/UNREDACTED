import { useState, useEffect } from 'react'
import { useTheme } from '../theme/index.js'
import { getRecentStockTrades, getStockActWatchlist } from '../api/client'

const ORANGE = '#FF8000'
const RED    = '#E63946'
const MF     = "'IBM Plex Mono','Courier New',monospace"
const SF     = "'Playfair Display',Georgia,serif"

export default function StockActMonitor() {
  const t = useTheme()

  const [trades, setTrades] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterChamber, setFilterChamber] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('filings')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [tradesRes, watchlistRes] = await Promise.allSettled([
          getRecentStockTrades(null, 100),
          getStockActWatchlist(),
        ])
        if (tradesRes.status === 'fulfilled') setTrades(tradesRes.value?.data || [])
        if (watchlistRes.status === 'fulfilled') setWatchlist(watchlistRes.value?.data || [])
        if (tradesRes.status === 'rejected') setError(tradesRes.reason?.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const senate = trades.filter(tr => tr.chamber === 'senate')
  const house  = trades.filter(tr => tr.chamber === 'house')

  const filtered = trades.filter(tr => {
    if (filterChamber === 'SENATE' && tr.chamber !== 'senate') return false
    if (filterChamber === 'HOUSE'  && tr.chamber !== 'house')  return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (tr.senator || tr.representative || '').toLowerCase().includes(q)
    }
    return true
  })

  const kpis = [
    { label: 'Total PTR Filings',  value: trades.length,    color: ORANGE      },
    { label: 'Senate Filings',     value: senate.length,    color: '#7B61FF'   },
    { label: 'House Filings',      value: house.length,     color: '#4A7FFF'   },
    { label: 'Watchlist Entries',  value: watchlist.length, color: RED         },
  ]

  if (loading) {
    return (
      <div style={{ fontFamily: MF, padding: '24px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: t.mid, fontSize: 14 }}>Loading congressional trade disclosures…</div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: MF }}>
      {/* Data note */}
      <div style={{ marginBottom: 20, padding: '8px 12px', background: `${ORANGE}10`, border: `1px solid ${ORANGE}33`, borderRadius: 4, fontSize: 11, color: ORANGE }}>
        Data note: Individual trade details (ticker, amount) are embedded in PDF filings and require offline ETL parsing.
        This view shows PTR filing metadata from public congressional disclosure APIs.
      </div>

      {error && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: `${RED}10`, border: `1px solid ${RED}33`, borderRadius: 4, fontSize: 11, color: RED }}>
          API error: {error}
        </div>
      )}

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 6, padding: '16px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: k.color, fontFamily: MF }}>{k.value}</div>
            <div style={{ fontSize: 12, color: t.mid, marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Inner Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}`, marginBottom: 0 }}>
        {[
          { key: 'filings',   label: `PTR Filings (${trades.length})`    },
          { key: 'watchlist', label: `Watchlist (${watchlist.length})`   },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '10px 20px',
              fontFamily: MF, fontSize: 12, fontWeight: activeTab === tab.key ? 700 : 400,
              color: activeTab === tab.key ? t.accent : t.mid,
              borderBottom: activeTab === tab.key ? `2px solid ${t.accent}` : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, padding: '14px 0' }}>
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by name…"
          style={{
            background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 4,
            color: t.hi, fontFamily: MF, fontSize: 12, padding: '7px 12px', width: 240,
          }}
        />
        {[['ALL', 'All'], ['SENATE', 'Senate'], ['HOUSE', 'House']].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilterChamber(v)}
            style={{
              background: filterChamber === v ? t.accent : t.inputBg,
              border: `1px solid ${filterChamber === v ? t.accent : t.border}`,
              borderRadius: 4, color: filterChamber === v ? '#000' : t.mid,
              fontFamily: MF, fontSize: 11, padding: '7px 14px', cursor: 'pointer',
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {/* PTR Filings Tab */}
      {activeTab === 'filings' && (
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 6, overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: t.mid }}>
              {trades.length === 0
                ? 'No PTR filings available. Senate/House disclosure APIs may be unavailable or rate-limited.'
                : 'No filings match current filters.'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: t.cardB }}>
                  {['Chamber', 'Legislator', 'Filing Type', 'Filing Date', 'Document'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: t.mid, fontFamily: MF, fontWeight: 600, fontSize: 11, borderBottom: `1px solid ${t.border}` }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((tr, i) => (
                  <tr key={tr.id || i} style={{ background: i % 2 === 0 ? t.card : t.tableAlt, borderBottom: `1px solid ${t.border}` }}>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                        background: tr.chamber === 'senate' ? '#7B61FF' : '#4A7FFF', marginRight: 6,
                      }} />
                      <span style={{ color: t.mid, fontSize: 11 }}>{(tr.chamber || '').toUpperCase()}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: t.hi, fontWeight: 600 }}>
                      {tr.senator || tr.representative || 'Unknown'}
                    </td>
                    <td style={{ padding: '10px 14px', color: ORANGE }}>{tr.filingType || 'PTR'}</td>
                    <td style={{ padding: '10px 14px', color: t.mid }}>{tr.filingDate || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {tr.url ? (
                        <a href={tr.url} target="_blank" rel="noopener noreferrer" style={{ color: t.accent, textDecoration: 'none', fontSize: 11 }}>
                          View PDF ↗
                        </a>
                      ) : (
                        <span style={{ color: t.low, fontSize: 11 }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Watchlist Tab */}
      {activeTab === 'watchlist' && (
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 6, padding: '24px' }}>
          {watchlist.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: t.mid }}>
              <div style={{ marginBottom: 12, fontSize: 14 }}>No watchlist data available</div>
              <div style={{ fontSize: 12, color: t.low, maxWidth: 440, margin: '0 auto', lineHeight: 1.6 }}>
                The high-risk watchlist is built by cross-referencing parsed individual trades with committee hearing schedules.
                This requires the PDF parsing ETL pipeline to process disclosure filings first.
              </div>
            </div>
          ) : (
            watchlist.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${t.border}` }}>
                <div>
                  <div style={{ color: t.hi, fontWeight: 700, fontSize: 14 }}>{p.politician}</div>
                  <div style={{ color: t.mid, fontSize: 11, marginTop: 2 }}>
                    {(p.chamber || '').toUpperCase()} · {p.state} · {p.violationCount} violation(s)
                  </div>
                </div>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: p.riskScore > 80 ? 'rgba(230,57,70,0.15)' : 'rgba(255,128,0,0.15)',
                  border: `2px solid ${p.riskScore > 80 ? RED : ORANGE}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ color: p.riskScore > 80 ? RED : ORANGE, fontSize: 14, fontWeight: 700 }}>{p.riskScore}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
