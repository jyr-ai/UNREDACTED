import { useEffect, useState } from 'react'
import { galaxy } from '../../api/client.js'
import { galaxyTokens } from './lib/galaxyTokens.js'
import { FONT_MONO } from '../../theme/tokens.js'
import MiniGalaxy from './MiniGalaxy.jsx'
import GalaxyLegend from './GalaxyLegend.jsx'
import ContributionTimeline from './ContributionTimeline.jsx'
import PatternNarrative from './PatternNarrative.jsx'
import PoliticianProfile from './PoliticianProfile.jsx'
import SourceFooter from '../ui/SourceFooter.jsx'

function Band({ label, right, t }) {
  return (
    <div style={{
      background: t.band, color: t.bandText,
      padding: '7px 36px 7px 14px', display: 'flex', alignItems: 'center',
      fontFamily: FONT_MONO, flexShrink: 0, position: 'relative',
    }}>
      <span style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 500 }}>{label}</span>
      {right && (
        <span style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          fontSize: 8, opacity: 0.55,
        }}>{right}</span>
      )}
    </div>
  )
}

function KPI({ label, value, t }) {
  return (
    <div>
      <div style={{ fontSize: 7.5, letterSpacing: 1.5, color: t.textMuted, fontFamily: FONT_MONO, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#FF8000', fontFamily: FONT_MONO }}>{value}</div>
    </div>
  )
}

function Chip({ label, color, t }) {
  return (
    <span style={{
      padding: '1px 6px', borderRadius: 2, fontSize: 7, fontWeight: 600,
      border: `1px solid ${color}44`, color, background: `${color}18`,
      fontFamily: FONT_MONO, letterSpacing: 0.5,
    }}>
      {label}
    </span>
  )
}

function fmt$(v) {
  if (v == null) return '—'
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}b`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}m`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}k`
  return `$${Math.round(v)}`
}

// ── Universal node detail view ────────────────────────────────────────────────
function DetailView({ payload, cycle, t, surface, expanded = false }) {
  const node = payload.node
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setDetail(null)
    setLoading(true)
    galaxy.node(node.id, { cycle })
      .then(r => setDetail(r?.data || null))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false))
  }, [node.id, cycle])

  const bandLabel = node.kind === 'employer'   ? 'EMPLOYER'
                  : node.kind === 'politician' ? 'POLITICIAN'
                  : node.kind === 'super_pac'  ? 'SUPER PAC'
                  : node.kind === 'dark_money' ? 'DARK MONEY'
                  : 'COMMITTEE'

  if (expanded) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Band
          label={`${bandLabel}${detail?.node?.sector ? ` · ${detail.node.sector}` : ''}`}
          right={cycle}
          t={t}
        />
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Left column — mini galaxy + legend */}
          <div style={{
            width: '50%', borderRight: `1px solid ${t.panelBorder}`,
            display: 'flex', flexDirection: 'column',
            overflowY: 'hidden',
          }}>
            <MiniGalaxy
              nodes={detail?.nodes || [node]}
              edges={detail?.edges || []}
              height={window.innerHeight - 74}
              surface={surface}
              focusNodeId={node.id}
            />
            <GalaxyLegend surface={surface} />
          </div>

          {/* Right column — metadata + timeline, independently scrollable */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.panelBorder}` }}>
              {node.kind !== 'politician' && (
                <div style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, marginBottom: 6, fontFamily: 'Roboto, sans-serif', lineHeight: 1.3 }}>
                  {detail?.node?.label || node.label}
                </div>
              )}
              {node.kind === 'politician' && detail?.node && (
                <PoliticianProfile node={detail.node} />
              )}
              {node.kind !== 'politician' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
                  <KPI label="Total $" value={fmt$(detail?.node?.amount ?? node.amount)} t={t} />
                  <KPI label="Connections" value={String(detail?.node?.degree ?? node.degree ?? 0)} t={t} />
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                {detail?.node?.is_super_pac && <Chip label="SUPER PAC" color="#4A7FFF" t={t} />}
                {detail?.node?.is_501c4    && <Chip label="501(c)(4)" color="#CC88FF" t={t} />}
                {detail?.node?.sector      && <Chip label={detail.node.sector} color="#FF8000" t={t} />}
              </div>
              {node.kind === 'employer' && (
                <SourceFooter
                  s="Self-reported employer field on FEC Schedule A · Individual Contributions"
                  href="https://www.fec.gov/data/receipts/individual-contributions/"
                />
              )}
              {(node.kind === 'trad_pac' || node.kind === 'super_pac' || node.kind === 'dark_money') && (
                <SourceFooter
                  s="FEC Committee Database"
                  href={`https://www.fec.gov/data/committee/${node.id.replace('cmt:', '')}/`}
                />
              )}
            </div>
            {detail?.patterns?.length > 0 && (
              <PatternNarrative patterns={detail.patterns} />
            )}
            {loading
              ? <div style={{ padding: '16px 14px', fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO }}>Loading transactions…</div>
              : <ContributionTimeline events={detail?.timeline || []} />
            }
          </div>
        </div>
      </div>
    )
  }

  // Collapsed (default side-panel) layout — unchanged from current code
  return (
    <>
      <Band
        label={`${bandLabel}${detail?.node?.sector ? ` · ${detail.node.sector}` : ''}`}
        right={cycle}
        t={t}
      />
      <MiniGalaxy
        nodes={detail?.nodes || [node]}
        edges={detail?.edges || []}
        height={220}
        surface={surface}
        focusNodeId={node.id}
      />
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.panelBorder}` }}>
        {node.kind !== 'politician' && (
          <div style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, marginBottom: 6, fontFamily: 'Roboto, sans-serif', lineHeight: 1.3 }}>
            {detail?.node?.label || node.label}
          </div>
        )}
        {node.kind === 'politician' && detail?.node && (
          <PoliticianProfile node={detail.node} />
        )}
        {node.kind !== 'politician' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
            <KPI label="Total $" value={fmt$(detail?.node?.amount ?? node.amount)} t={t} />
            <KPI label="Connections" value={String(detail?.node?.degree ?? node.degree ?? 0)} t={t} />
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {detail?.node?.is_super_pac && <Chip label="SUPER PAC" color="#4A7FFF" t={t} />}
          {detail?.node?.is_501c4    && <Chip label="501(c)(4)" color="#CC88FF" t={t} />}
          {detail?.node?.sector      && <Chip label={detail.node.sector} color="#FF8000" t={t} />}
        </div>
        {node.kind === 'employer' && (
          <SourceFooter
            s="Self-reported employer field on FEC Schedule A · Individual Contributions"
            href="https://www.fec.gov/data/receipts/individual-contributions/"
          />
        )}
        {(node.kind === 'trad_pac' || node.kind === 'super_pac' || node.kind === 'dark_money') && (
          <SourceFooter
            s="FEC Committee Database"
            href={`https://www.fec.gov/data/committee/${node.id.replace('cmt:', '')}/`}
          />
        )}
      </div>
      {detail?.patterns?.length > 0 && (
        <PatternNarrative patterns={detail.patterns} />
      )}
      {loading
        ? <div style={{ padding: '16px 14px', fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO }}>Loading transactions…</div>
        : <ContributionTimeline events={detail?.timeline || []} />
      }
    </>
  )
}

// ── Sector halo click view ────────────────────────────────────────────────────
function SectorView({ payload, cycle, t, surface, expanded = false }) {
  const sector = payload.sector
  const [data, setData] = useState(null)

  useEffect(() => {
    galaxy.sector(sector.name, { cycle })
      .then(r => setData(r || null))
      .catch(() => setData(null))
  }, [sector.name, cycle])

  return (
    <>
      <Band label={`SECTOR · ${sector.name}`} right={cycle} t={t} />
      <MiniGalaxy
        nodes={data?.nodes || []}
        edges={data?.edges || []}
        height={220}
        surface={surface}
      />
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.panelBorder}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, marginBottom: 8, fontFamily: 'Roboto, sans-serif' }}>
          {sector.name}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
          <KPI label="Total Flow" value={fmt$(sector.total_amount)} t={t} />
          <KPI label="Nodes" value={String(sector.node_count || 0)} t={t} />
        </div>
        <SourceFooter
          s="FEC Bulk Data — money_flow_edges"
          href="https://www.fec.gov/campaign-finance-data/"
        />
      </div>
    </>
  )
}

// ── Pattern flare click view ──────────────────────────────────────────────────
function PatternView({ payload, cycle, t, surface, expanded = false }) {
  const p = payload.pattern
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    if (!p?.id) return
    galaxy.pattern(p.id)
      .then(r => setDetail(r || null))
      .catch(() => setDetail(null))
  }, [p?.id])

  const patterns = detail ? [detail.pattern || p] : [p]
  const topNodeId = p.node_ids?.[0]

  return (
    <>
      <Band label={p.pattern_type?.replace(/_/g, ' ') || 'pattern'} right={p.sector || ''} t={t} />
      <MiniGalaxy
        nodes={detail?.evidence?.nodes || []}
        edges={detail?.evidence?.edges || []}
        height={220}
        surface={surface}
        focusNodeId={topNodeId}
      />
      <PatternNarrative patterns={patterns} />
      {topNodeId && <ConnectedTimeline nodeId={topNodeId} cycle={cycle} t={t} />}
    </>
  )
}

function ConnectedTimeline({ nodeId, cycle, t }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    galaxy.node(nodeId, { cycle })
      .then(r => setEvents(r?.data?.timeline || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [nodeId, cycle])
  if (loading) return <div style={{ padding: '16px 14px', fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO }}>Loading transactions…</div>
  return <ContributionTimeline events={events} />
}

// ── Main drawer shell ─────────────────────────────────────────────────────────
export default function GalaxyDrawer({ payload, onClose, surface = 'dark', cycle = '2024' }) {
  const t = galaxyTokens[surface] || galaxyTokens.dark
  const [expanded, setExpanded] = useState(false)
  useEffect(() => { setExpanded(false) }, [payload])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!payload) return null

  return (
    <>
      {/* Backdrop — hidden when expanded (panel IS the full screen) */}
      {!expanded && (
        <div onClick={onClose} style={{
          position: 'fixed', inset: 0,
          background: t.drawerBackdrop, backdropFilter: 'blur(4px)',
          zIndex: 1000,
        }} />
      )}

      {/* Panel */}
      <aside style={{
        position: 'fixed',
        top: 0, bottom: 0,
        right: 0,
        left: expanded ? 0 : 'auto',
        width: expanded ? '100vw' : 420,
        background: t.surface,
        borderLeft: expanded ? 'none' : `1px solid ${t.panelBorder}`,
        zIndex: 1001,
        display: 'flex',
        flexDirection: 'column',
        overflowY: expanded ? 'hidden' : 'auto',
      }}>
        {/* Close button */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 6, right: 12, background: 'none', border: 'none',
          color: t.textMuted, cursor: 'pointer', fontSize: 16, zIndex: 2, lineHeight: 1,
        }}>✕</button>

        {/* Expand / collapse button — sits left of the X */}
        <button
          onClick={() => setExpanded(e => !e)}
          title={expanded ? 'Collapse panel' : 'Expand to full page'}
          style={{
            position: 'absolute', top: 7, right: 36, background: 'none', border: 'none',
            color: t.textMuted, cursor: 'pointer', fontSize: 9, zIndex: 2, lineHeight: 1,
            fontFamily: FONT_MONO, letterSpacing: 0.5,
          }}
        >
          {expanded ? 'Collapse' : 'Full View'}
        </button>

        {payload.kind === 'sector'
          ? <SectorView  payload={payload} cycle={cycle} t={t} surface={surface} expanded={expanded} />
          : payload.kind === 'pattern'
          ? <PatternView payload={payload} cycle={cycle} t={t} surface={surface} expanded={expanded} />
          : <DetailView  payload={payload} cycle={cycle} t={t} surface={surface} expanded={expanded} />
        }
      </aside>
    </>
  )
}
