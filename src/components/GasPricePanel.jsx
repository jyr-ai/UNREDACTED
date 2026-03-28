/**
 * GasPricePanel.jsx
 * Slide-in sidebar showing gas station prices near a selected city or searched location.
 * Consumed by USPoliticalMap when a city is clicked with the ⛽ Gas Prices layer active,
 * or from the standalone search bar.
 */

import { useState, useCallback } from 'react'
import { gasPrices } from '../api/client.js'
import { useTheme } from '../theme/index.js'

const FONT_MONO = "'IBM Plex Mono', monospace"

const PRICE_COLOR = {
  regular:  '#fb923c',
  midgrade: '#fbbf24',
  premium:  '#a78bfa',
  diesel:   '#34d399',
}

function timeSince(iso) {
  if (!iso) return 'unknown'
  const s = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (s < 60)    return `${s}s ago`
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function StationCard({ s, fuelType }) {
  const t   = useTheme()
  const [hovered, setHovered] = useState(false)
  const price = s.prices?.[fuelType]

  return (
    <div
      style={{
        background:    hovered ? t.cardB : t.card,
        border:        `1px solid ${hovered ? t.accent : t.border}`,
        borderRadius:  8,
        padding:       '12px 14px',
        marginBottom:  8,
        transition:    'all 0.18s',
        cursor:        'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: t.hi, fontWeight: 600 }}>{s.name}</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: t.mid, marginTop: 2 }}>
            {s.address}{s.city ? `, ${s.city}` : ''}{s.state ? ` ${s.state}` : ''}
          </div>
          {s.distance != null && (
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: t.low, marginTop: 2 }}>
              {s.distance.toFixed(1)} mi · updated {timeSince(s.updatedAt)}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', minWidth: 64 }}>
          {price != null ? (
            <>
              <div style={{ fontFamily: FONT_MONO, fontSize: 20, color: PRICE_COLOR[fuelType] || t.accent, fontWeight: 700, lineHeight: 1 }}>
                ${price.toFixed(2)}
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: t.low }}>/gal</div>
            </>
          ) : (
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: t.low }}>N/A</div>
          )}
        </div>
      </div>

      {/* Fuel prices grid */}
      <div style={{ display: 'flex', gap: 6 }}>
        {['regular', 'midgrade', 'premium', 'diesel'].map(ft => (
          <div
            key={ft}
            style={{
              flex: 1,
              background:   ft === fuelType ? `${PRICE_COLOR[ft]}18` : `${t.cardB || '#111'}80`,
              border:       `1px solid ${ft === fuelType ? PRICE_COLOR[ft] + '55' : t.border}`,
              borderRadius: 5,
              padding:      '5px 3px',
              textAlign:    'center',
            }}
          >
            <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: ft === fuelType ? PRICE_COLOR[ft] : t.low, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {ft === 'midgrade' ? 'mid' : ft}
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: s.prices?.[ft] != null ? (ft === fuelType ? PRICE_COLOR[ft] : t.mid) : t.low, fontWeight: ft === fuelType ? 700 : 400 }}>
              {s.prices?.[ft] != null ? `$${s.prices[ft].toFixed(2)}` : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function GasPricePanel({
  cityName,
  stateCode,
  statePriceData,  // { prices, updatedAt, source }
  onClose,
}) {
  const t = useTheme()

  const [searchInput,     setSearchInput]     = useState(cityName ? `${cityName}${stateCode ? ' ' + stateCode : ''}` : '')
  const [fuelType,        setFuelType]        = useState('regular')
  const [sortBy,          setSortBy]          = useState('distance')
  const [stations,        setStations]        = useState([])
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState(null)
  const [geocodedAddress, setGeocodedAddress] = useState(null)
  const [nationalAvg,     setNationalAvg]     = useState(null)
  const [hasSearched,     setHasSearched]     = useState(false)

  // Fetch national avg once on mount
  useState(() => {
    gasPrices.national().then(d => setNationalAvg(d.average)).catch(() => {})
  })

  const statePrice = stateCode && statePriceData?.prices?.[stateCode]

  const handleSearch = useCallback(async (e) => {
    e?.preventDefault()
    const q = searchInput.trim()
    if (!q) return
    setLoading(true)
    setError(null)
    setHasSearched(true)
    try {
      const data = await gasPrices.search(q, fuelType, sortBy, 15)
      setStations(data.stations || [])
      setGeocodedAddress(data.geocode?.formattedAddress || q)
    } catch (err) {
      setError(err.message)
      setStations([])
    } finally {
      setLoading(false)
    }
  }, [searchInput, fuelType, sortBy])

  // Auto-search if cityName was provided
  useState(() => {
    if (cityName) {
      setTimeout(handleSearch, 100)
    }
  })

  const selectStyle = {
    background:    t.cardB || '#0f172a',
    border:        `1px solid ${t.border}`,
    borderRadius:  5,
    padding:       '5px 8px',
    color:         t.hi,
    fontFamily:    FONT_MONO,
    fontSize:      11,
    cursor:        'pointer',
    outline:       'none',
  }

  return (
    <div style={{
      width:      320,
      height:     '100%',
      background: t.card,
      borderLeft: `1px solid ${t.border}`,
      display:    'flex',
      flexDirection: 'column',
      overflow:   'hidden',
    }}>
      {/* Panel header */}
      <div style={{
        padding:        '14px 16px 12px',
        borderBottom:   `1px solid ${t.border}`,
        background:     t.ink || t.card,
        flexShrink:     0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: t.accent, letterSpacing: 2, marginBottom: 4 }}>⛽ GAS PRICES</div>
            {nationalAvg && (
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: t.mid }}>
                National avg: <span style={{ color: '#fb923c', fontWeight: 700 }}>${nationalAvg.toFixed(2)}/gal</span>
              </div>
            )}
            {statePrice && (
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: t.mid, marginTop: 2 }}>
                {stateCode} avg: <span style={{ color: '#fbbf24', fontWeight: 700 }}>${statePrice.toFixed(2)}/gal</span>
                {statePriceData?.updatedAt && (
                  <span style={{ color: t.low, marginLeft: 4 }}>· {statePriceData.updatedAt}</span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: t.low, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 6px' }}
            title="Close panel"
          >×</button>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="City, ZIP, or address…"
              style={{
                flex:        1,
                background:  t.cardB || '#0f172a',
                border:      `1px solid ${t.border}`,
                borderRadius: 5,
                padding:     '6px 10px',
                color:       t.hi,
                fontFamily:  FONT_MONO,
                fontSize:    11,
                outline:     'none',
              }}
            />
            <button
              type="submit"
              style={{
                background:   t.accent,
                border:       'none',
                borderRadius: 5,
                padding:      '6px 12px',
                color:        '#fff',
                fontFamily:   FONT_MONO,
                fontSize:     11,
                cursor:       'pointer',
                fontWeight:   700,
              }}
            >Go</button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <select value={fuelType} onChange={e => setFuelType(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
              <option value="regular">Regular</option>
              <option value="midgrade">Mid-Grade</option>
              <option value="premium">Premium</option>
              <option value="diesel">Diesel</option>
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
              <option value="distance">By Distance</option>
              <option value="price">By Price</option>
            </select>
          </div>
        </form>
      </div>

      {/* Results area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 16px' }}>
        {geocodedAddress && (
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: t.mid, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${t.border}` }}>
            📍 {geocodedAddress}
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: `3px solid ${t.border}`, borderTopColor: t.accent,
              animation: 'spin 0.8s linear infinite',
            }} />
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: t.low, letterSpacing: 2 }}>SEARCHING…</div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {error && (
          <div style={{
            padding: '10px 12px', borderRadius: 6, marginBottom: 10,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            fontFamily: FONT_MONO, fontSize: 10, color: '#fca5a5',
          }}>⚠ {error}</div>
        )}

        {!loading && hasSearched && stations.length === 0 && !error && (
          <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: t.low, textAlign: 'center', padding: '24px 0' }}>
            No stations found in this area.
          </div>
        )}

        {!loading && !hasSearched && (
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: t.low, textAlign: 'center', padding: '32px 12px', lineHeight: 1.8 }}>
            Search a city, ZIP code, or address<br />to find nearby gas stations<br />and compare prices.
          </div>
        )}

        {!loading && stations.map(s => (
          <StationCard key={s.id} s={s} fuelType={fuelType} />
        ))}

        {!loading && stations.length > 0 && (
          <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: t.low, textAlign: 'center', marginTop: 8 }}>
            {stations.length} stations · source: MyGasFeed
          </div>
        )}
      </div>
    </div>
  )
}
