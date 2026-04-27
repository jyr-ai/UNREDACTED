import { useState } from 'react'
import useGalaxyData from './hooks/useGalaxyData.js'
import useGalaxySurface from './hooks/useGalaxySurface.js'
import GalaxyGraph from './GalaxyGraph.jsx'
import GalaxyDrawer from './GalaxyDrawer.jsx'
import GalaxyLegend from './GalaxyLegend.jsx'
import GalaxySurfaceToggle from './GalaxySurfaceToggle.jsx'
import { galaxyTokens } from './lib/galaxyTokens.js'

export default function FundingFlowGalaxy({
  mode = 'universe',                            // "universe" | "sector" | "employer"
  cycle = '2024',
  sector = null,
  employerId = null,
  height = 560,
  onNodeSelect
}) {
  const [surface, toggleSurface] = useGalaxySurface()
  const t = galaxyTokens[surface]
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
    <div style={{ position: 'relative', background: t.surface, border: `1px solid ${t.panelBorder}`, overflow: 'hidden' }}>
      <div style={{
        background: t.band, color: t.bandText,
        padding: '7px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: 9, letterSpacing: 2, fontWeight: 500, textTransform: 'uppercase' }}>
          Funding flow galaxy · {cycle}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
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
            width={900}
            height={height}
            onNodeClick={handleNodeClick}
            onPatternClick={handlePatternClick}
          />
        )}
        {drawerPayload && <GalaxyDrawer payload={drawerPayload} onClose={() => setDrawer(null)} surface={surface} />}
      </div>

      <GalaxyLegend surface={surface} />
    </div>
  )
}
