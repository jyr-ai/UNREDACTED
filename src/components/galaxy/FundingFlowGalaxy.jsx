import { useEffect, useRef, useState } from 'react'
import useGalaxyData from './hooks/useGalaxyData.js'
import useGalaxySurface from './hooks/useGalaxySurface.js'
import GalaxyGraph from './GalaxyGraph.jsx'
import GalaxyDrawer from './GalaxyDrawer.jsx'
import GalaxyLegend from './GalaxyLegend.jsx'
import GalaxySurfaceToggle from './GalaxySurfaceToggle.jsx'
import { galaxyTokens } from './lib/galaxyTokens.js'

const CYCLES = ['2024', '2026']

export default function FundingFlowGalaxy({
  mode = 'universe',
  cycle: cycleProp = '2024',
  sector = null,
  employerId = null,
  height = 560,
  onNodeSelect
}) {
  const [surface, toggleSurface] = useGalaxySurface()
  const t = galaxyTokens[surface]

  // Local cycle state so the filter is self-contained
  const [cycle, setCycle] = useState(cycleProp)

  // Measure container width to fill the full panel — no white space
  const containerRef = useRef(null)
  const [containerWidth, setContainerWidth] = useState(900)
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect?.width
      if (w && w > 0) setContainerWidth(Math.floor(w))
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const { data, loading, error } = useGalaxyData({ mode, cycle, sector, employerId })
  const [drawerPayload, setDrawer] = useState(null)

  const rightMeta = mode === 'universe'
    ? `AI PATTERN DETECTION · ${data?.patterns?.length || 0} ACTIVE`
    : mode === 'sector'
      ? `SECTOR · ${sector || ''}`
      : mode === 'employer'
        ? `EMPLOYER · ${employerId || ''}`
        : ''

  function handleNodeClick(node) {
    setDrawer({ kind: 'node', node })
    onNodeSelect?.(node)
  }
  function handlePatternClick(pattern) {
    setDrawer({ kind: 'pattern', pattern })
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', background: t.surface, border: `1px solid ${t.panelBorder}`, overflow: 'hidden' }}>
      <div style={{
        background: t.band, color: t.bandText,
        padding: '7px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: 9, letterSpacing: 2, fontWeight: 500, textTransform: 'uppercase' }}>
          Funding flow galaxy
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          {/* Cycle filter — only shown in universe mode */}
          {mode === 'universe' && (
            <span style={{ display: 'inline-flex', gap: 2 }}>
              {CYCLES.map(c => (
                <button
                  key={c}
                  onClick={() => setCycle(c)}
                  style={{
                    fontFamily: 'Roboto, sans-serif', fontSize: 8, letterSpacing: 1,
                    padding: '2px 7px', cursor: 'pointer',
                    background: cycle === c ? '#FF8000' : 'transparent',
                    color: cycle === c ? '#000' : `${t.bandText}99`,
                    border: `1px solid ${cycle === c ? '#FF8000' : `${t.bandText}44`}`,
                    fontWeight: cycle === c ? 700 : 400
                  }}
                >
                  {c}
                </button>
              ))}
            </span>
          )}
          <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: 8, opacity: 0.55 }}>{rightMeta}</span>
          <GalaxySurfaceToggle surface={surface} onToggle={toggleSurface} />
        </span>
      </div>

      <div style={{ position: 'relative', height, overflow: 'hidden' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: t.textMuted, fontFamily: 'Roboto, sans-serif', fontSize: 11 }}>
            Loading galaxy…
          </div>
        )}
        {error && !loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#FFB84D', fontFamily: 'Roboto, sans-serif', fontSize: 11, textAlign: 'center', padding: 20 }}>
            Galaxy temporarily unavailable.<br />
            <span style={{ fontSize: 9, color: t.textLow, marginTop: 6 }}>{error}</span>
          </div>
        )}
        {!loading && !error && data && (data.meta?.node_count ?? 0) === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: t.textMuted, fontFamily: 'Roboto, sans-serif', fontSize: 11 }}>
            No funding flow data for this selection.
          </div>
        )}
        {!loading && !error && data && (data.meta?.node_count ?? 0) > 0 && (
          <GalaxyGraph
            envelope={data}
            surface={surface}
            width={containerWidth}
            height={height}
            onNodeClick={handleNodeClick}
            onPatternClick={handlePatternClick}
          />
        )}
        {drawerPayload && <GalaxyDrawer payload={drawerPayload} onClose={() => setDrawer(null)} surface={surface} />}
      </div>

      <GalaxyLegend surface={surface} />
      <div style={{
        padding: '5px 12px',
        fontFamily: 'Roboto, sans-serif', fontSize: 8.5,
        color: t.textLow, borderTop: `1px solid ${t.panelBorder}`,
        background: t.surface, lineHeight: 1.5
      }}>
        * "Employer" nodes represent clusters of <em>individual donors</em> who self-reported their employer on FEC Schedule A filings — not direct corporate contributions. Corporate treasury money enters through Super PACs and 501(c)(4) dark money conduits shown above.
      </div>
    </div>
  )
}
