import { useEffect, useState } from 'react'
import { galaxy } from '../../api/client.js'
import { galaxyTokens } from './lib/galaxyTokens.js'

function fmt$(v) {
  if (v == null) return '—'
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}b`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}m`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}k`
  return `$${Math.round(v)}`
}

function Band({ label, right, t }) {
  return (
    <div style={{
      background: t.band, color: t.bandText,
      padding: '7px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontFamily: 'Roboto, sans-serif'
    }}>
      <span style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 500 }}>{label}</span>
      {right && <span style={{ fontSize: 8, opacity: 0.55 }}>{right}</span>}
    </div>
  )
}

function PatternView({ patternSeed, t }) {
  const [detail, setDetail] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!patternSeed?.id) return
    galaxy.pattern(patternSeed.id)
      .then(r => setDetail(r || null))
      .catch(e => setErr(e.message))
  }, [patternSeed?.id])

  const p = detail?.pattern || patternSeed

  return (
    <>
      <Band label={p.pattern_type?.replace(/_/g, ' ') || 'pattern'} right={p.sector || ''} t={t} />
      <div style={{ padding: 16, fontFamily: 'Roboto, sans-serif', color: t.textPrimary, overflowY: 'auto' }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 10px', color: t.textPrimary }}>{p.title}</h3>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: t.textMuted, margin: '0 0 14px' }}>{p.narrative}</p>
        <p style={{ fontSize: 12, lineHeight: 1.55, color: t.textMuted, margin: '0 0 18px' }}>{p.explanation}</p>

        {err && <div style={{ color: '#FFB84D', fontSize: 10 }}>Evidence unavailable: {err}</div>}

        {detail?.evidence?.edges?.length ? (
          <>
            <div style={{ fontSize: 9, letterSpacing: 2, color: t.textMuted, margin: '18px 0 8px', textTransform: 'uppercase' }}>Evidence — top edges</div>
            <div style={{ borderTop: `1px solid ${t.panelBorder}` }}>
              {detail.evidence.edges.slice(0, 10).map((e, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: `1px solid ${t.panelBorder}`, fontSize: 11 }}>
                  <span style={{ color: t.textPrimary }}>{e.source_label || e.source}</span>
                  <span style={{ color: t.textLow, margin: '0 6px' }}>→</span>
                  <span style={{ color: t.textPrimary }}>{e.target_label || e.target}</span>
                  <span style={{ color: '#FF8000', float: 'right', fontWeight: 600 }}>{fmt$(e.amount)}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </>
  )
}

function NodeView({ node, t }) {
  return (
    <>
      <Band label={node.kind.replace(/_/g, ' ')} right={node.sector || ''} t={t} />
      <div style={{ padding: 16, fontFamily: 'Roboto, sans-serif', color: t.textPrimary }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 14px' }}>{node.label}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
          <KPI label="Total $" value={fmt$(node.amount)} t={t} />
          <KPI label="Connections" value={String(node.degree || 0)} t={t} />
        </div>
        <div style={{ fontSize: 10, color: t.textLow }}>
          Node ID: <code style={{ color: t.textMuted }}>{node.id}</code>
        </div>
      </div>
    </>
  )
}

function KPI({ label, value, t }) {
  return (
    <div>
      <div style={{ fontSize: 9, letterSpacing: 2, color: t.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#FF8000' }}>{value}</div>
    </div>
  )
}

export default function GalaxyDrawer({ payload, onClose, surface = 'dark' }) {
  const t = galaxyTokens[surface]
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!payload) return null
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: t.drawerBackdrop, backdropFilter: 'blur(4px)',
          zIndex: 30
        }}
      />
      <aside style={{
        position: 'absolute', top: 0, right: 0, bottom: 0,
        width: 420, background: t.surface, borderLeft: `1px solid ${t.panelBorder}`,
        zIndex: 31, display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {payload.kind === 'pattern'
          ? <PatternView patternSeed={payload.pattern} t={t} />
          : <NodeView node={payload.node} t={t} />}
      </aside>
    </>
  )
}
