/**
 * CorporatePACFlow — Corporate PAC spending leaderboard + FundingFlowGalaxy network.
 *
 * Left panel:  Horizontal stacked bar chart showing top corporations ranked by
 *              combined PAC spending, broken out by PAC type:
 *              Connected PAC (orange) | Super PAC (blue) | 501c4 (purple)
 *
 * Right panel: FundingFlowGalaxy — PAC money-flow network for selected corporation.
 *
 * Data path:
 *   pac_committees.connected_org_name → committee_id
 *   → contributions.committee_id / candidate_id
 */
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { useTheme } from '../theme/index.js'
import { ORANGE, FONT_MONO as MF } from '../theme/tokens.js'
import { Band, Card, SourceFooter } from './ui/index.js'
import { donors } from '../api/client.js'
import FundingFlowGalaxy from './galaxy/FundingFlowGalaxy.jsx'

const CYCLES = ['2026', '2024']
const LIMITS = [10, 20, 30, 50]

const PAC_COLOR       = ORANGE
const SUPER_PAC_COLOR = '#4A7FFF'
const C4_COLOR        = '#9966CC'

function fmt$(v) {
  if (!v && v !== 0) return '—'
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}b`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}m`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}k`
  return `$${v}`
}

/** Convert "LOCKHEED MARTIN CORP" → "Lockheed Martin Corp" */
function fmtCorp(s) {
  if (!s) return '—'
  return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

function CustomTooltip({ active, payload, label, t }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, padding: '8px 12px', fontFamily: MF, fontSize: 10 }}>
      <div style={{ color: t.hi, marginBottom: 4, fontWeight: 600 }}>{fmtCorp(label)}</div>
      {payload.map(p => p.value > 0 && (
        <div key={p.dataKey} style={{ color: p.fill, marginBottom: 2 }}>
          {p.name}: {fmt$(p.value)}
        </div>
      ))}
    </div>
  )
}

export default function CorporatePACFlow() {
  const t = useTheme()
  const [cycle, setCycle]           = useState('2026')
  const [limit, setLimit]           = useState(20)
  const [corps, setCorps]           = useState([])
  const [loading, setLoading]       = useState(false)
  const [selected, setSelected]     = useState(null)

  // Load leaderboard
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setSelected(null)
    donors.corporatePACs({ cycle, limit })
      .then(r => { if (!cancelled) setCorps(r?.data?.results || []) })
      .catch(() => { if (!cancelled) setCorps([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [cycle, limit])

  const selectStyle = {
    background: t.card, color: t.hi, border: `1px solid ${t.border}`,
    padding: '5px 8px', fontFamily: MF, fontSize: 10, borderRadius: 3,
  }

  // Recharts needs short Y-axis labels
  const chartData = corps.map(c => ({
    ...c,
    label: fmtCorp(c.corp).slice(0, 22),
  }))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'stretch' }}>

      {/* LEFT column: bar chart */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Band label="Corporate PAC spending — connected PACs, Super PACs, 501(c)4s" right={`${corps.length} CORPORATIONS`} />
        <Card style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Controls */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ fontFamily: MF, fontSize: 9, color: t.mid, display: 'flex', alignItems: 'center', gap: 5 }}>
              CYCLE
              <select value={cycle} onChange={e => setCycle(e.target.value)} style={selectStyle}>
                {CYCLES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label style={{ fontFamily: MF, fontSize: 9, color: t.mid, display: 'flex', alignItems: 'center', gap: 5 }}>
              TOP
              <select value={limit} onChange={e => setLimit(Number(e.target.value))} style={selectStyle}>
                {LIMITS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            {/* Legend */}
            <div style={{ display: 'flex', gap: 12, marginLeft: 'auto', alignItems: 'center' }}>
              {[[PAC_COLOR, 'Connected PAC'], [SUPER_PAC_COLOR, 'Super PAC'], [C4_COLOR, '501(c)4']].map(([c, l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 10, height: 10, background: c }} />
                  <span style={{ fontFamily: MF, fontSize: 8.5, color: t.mid }}>{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stacked bar chart */}
          <div style={{ flex: 1, border: `1px solid ${t.border}`, background: t.cardB, borderRadius: 3, padding: '12px 0 8px', minHeight: 0 }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: t.mid, fontFamily: MF, fontSize: 10 }}>Loading corporate PAC data…</div>
            ) : corps.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: t.low, fontFamily: MF, fontSize: 10 }}>
                No corporate PAC data found for {cycle}.<br />
                <span style={{ color: t.low, fontSize: 9 }}>Requires pac_committees.connected_org_name to be populated.</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(280, corps.length * 28)}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ left: 8, right: 60, top: 4, bottom: 4 }}
                  barCategoryGap="18%"
                  onClick={d => d?.activePayload && setSelected(corps.find(c => c.corp_id === d.activePayload[0]?.payload?.corp_id) || null)}
                >
                  <CartesianGrid horizontal={false} stroke={t.grid} />
                  <XAxis type="number" tick={{ fontFamily: MF, fontSize: 9, fill: t.mid }} tickFormatter={fmt$} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" tick={{ fontFamily: MF, fontSize: 9, fill: t.mid }} width={130} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip t={t} />} cursor={{ fill: `${ORANGE}10` }} />
                  <Bar dataKey="pac_total"       name="Connected PAC" stackId="a" barSize={14} fill={PAC_COLOR}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={PAC_COLOR} fillOpacity={selected?.corp_id === entry.corp_id ? 1 : 0.75} />
                    ))}
                  </Bar>
                  <Bar dataKey="super_pac_total" name="Super PAC"     stackId="a" barSize={14} fill={SUPER_PAC_COLOR}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={SUPER_PAC_COLOR} fillOpacity={selected?.corp_id === entry.corp_id ? 1 : 0.75} />
                    ))}
                  </Bar>
                  <Bar dataKey="c4_total"        name="501(c)4"       stackId="a" barSize={14} fill={C4_COLOR} radius={[0, 3, 3, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={C4_COLOR} fillOpacity={selected?.corp_id === entry.corp_id ? 1 : 0.75} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <SourceFooter s="FEC bulk data — pac_committees (connected_org_name), contributions (Schedule A/B) · cycles 2024+2026" href="https://www.fec.gov/data/committees/" />
        </Card>
      </div>

      {/* RIGHT column: galaxy — shows PAC money-flow network for selected corp */}
      <FundingFlowGalaxy
        mode={selected ? 'corporation' : 'universe'}
        cycle={cycle}
        corpId={selected?.corp_id ?? null}
        height={560}
      />

    </div>
  )
}
