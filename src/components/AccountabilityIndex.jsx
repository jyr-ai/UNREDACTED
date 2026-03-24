import { useState, useEffect, Fragment } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getAccountabilityLeaderboard } from '../api/client.js';
import { useTheme } from '../theme/index.js';
import { Band, Card, CardTitle, SourceFooter } from './ui/index.js';
import { Score } from './charts/index.js';

const COMPONENT_LABELS = {
  donorTransparency: 'Donor Transparency',
  stockActCompliance: 'STOCK Act Compliance',
  voteDonorAlignment: 'Vote-Donor Alignment',
  disclosureTimeliness: 'Disclosure Timeliness',
};

function partyColor(party = '') {
  const p = party.toUpperCase();
  if (p.includes('DEM')) return '#4A7FFF';
  if (p.includes('REP')) return '#E63946';
  return '#888';
}

function ComponentBar({ label, value, t }) {
  if (value === null || value === undefined) {
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: t.mid }}>{label}</span>
          <span style={{ fontSize: 10, color: t.low, fontStyle: 'italic' }}>N/A — requires ETL data</span>
        </div>
        <div style={{ height: 5, background: t.border, borderRadius: 3 }} />
      </div>
    );
  }
  const pct = (value / 25) * 100;
  const color = pct >= 70 ? '#2DC653' : pct >= 50 ? '#FF8000' : '#E63946';
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: t.mid }}>{label}</span>
        <span style={{ fontSize: 11, color, fontWeight: 600 }}>{value}/25</span>
      </div>
      <div style={{ height: 5, background: t.border, borderRadius: 3 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

export default function AccountabilityIndex() {
  const t = useTheme();
  const [politicians, setPoliticians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterChamber, setFilterChamber] = useState('ALL');
  const [filterParty, setFilterParty] = useState('ALL');
  const [sortBy, setSortBy] = useState('score');
  const [expandedId, setExpandedId] = useState(null);
  const [activeHall, setActiveHall] = useState('shame');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getAccountabilityLeaderboard(null, null, 50);
        setPoliticians(res?.data || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const sorted = [...politicians]
    .filter(p => filterChamber === 'ALL' || p.office === filterChamber)
    .filter(p => filterParty === 'ALL' || (p.party || '').toUpperCase().includes(filterParty))
    .sort((a, b) => sortBy === 'score' ? b.overallScore - a.overallScore : a.overallScore - b.overallScore);

  const hallOfFame = [...politicians].sort((a, b) => b.overallScore - a.overallScore).slice(0, 3);
  const hallOfShame = [...politicians].sort((a, b) => a.overallScore - b.overallScore).slice(0, 3);

  const distData = [
    { range: '0–20', count: politicians.filter(p => p.overallScore <= 20).length },
    { range: '21–40', count: politicians.filter(p => p.overallScore > 20 && p.overallScore <= 40).length },
    { range: '41–60', count: politicians.filter(p => p.overallScore > 40 && p.overallScore <= 60).length },
    { range: '61–80', count: politicians.filter(p => p.overallScore > 60 && p.overallScore <= 80).length },
    { range: '81–100', count: politicians.filter(p => p.overallScore > 80).length },
  ];

  const fmtM = v => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v || 0}`;

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <Band label="Accountability Index" right="FEC · PHASE 3" />
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 20px', color: t.mid }}>
            Loading accountability scores from FEC...
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <Band label="Accountability Index" right="FEC · PHASE 3" />

      <Card>
        <CardTitle h="Politician Accountability Scores" sub="RECEIPTS Accountability Score (0–100) computed from FEC donor transparency and vote-donor alignment data" />

        {error && (
          <div style={{ marginBottom: 16, padding: '8px 12px', background: '#E6394610', border: `1px solid #E6394633`, borderRadius: 4, fontSize: 11, color: '#E63946' }}>
            Error loading data: {error}
          </div>
        )}

        {politicians.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: t.mid }}>
            <div style={{ fontSize: 16, marginBottom: 12 }}>No politician data available</div>
            <div style={{ fontSize: 12, color: t.low, maxWidth: 440, margin: '0 auto', lineHeight: 1.6 }}>
              The accountability leaderboard requires FEC candidate data.
              This may be due to API rate limits (DEMO_KEY: 1000 calls/day) or connectivity issues.
              Set FEC_API_KEY in the backend .env for higher limits.
            </div>
          </div>
        ) : (
          <>
            {/* Score Distribution + Hall */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
              <div>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 15, fontWeight: 700, color: t.hi, marginBottom: 16 }}>Score Distribution</div>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={distData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.grid} />
                    <XAxis dataKey="range" tick={{ fill: t.mid, fontSize: 10 }} />
                    <YAxis tick={{ fill: t.mid, fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: t.cardB, border: `1px solid ${t.border}`, fontFamily: "'Roboto', sans-serif", fontSize: 11 }} />
                    <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                      {distData.map((d, i) => (
                        <Cell key={i} fill={
                          d.range === '81–100' ? '#2DC653' : d.range === '61–80' ? '#4A7FFF' :
                          d.range === '41–60' ? '#FF8000' : d.range === '21–40' ? '#FFB84D' : '#E63946'
                        } />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div>
                <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: `1px solid ${t.border}` }}>
                  {[['shame', 'Hall of Shame'], ['fame', 'Hall of Fame']].map(([k, l]) => (
                    <button key={k} onClick={() => setActiveHall(k)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: '6px 16px',
                      fontFamily: "'Roboto', sans-serif", fontSize: 11, fontWeight: activeHall === k ? 700 : 400,
                      color: activeHall === k ? (k === 'shame' ? '#E63946' : '#2DC653') : t.mid,
                      borderBottom: activeHall === k ? `2px solid ${k === 'shame' ? '#E63946' : '#2DC653'}` : '2px solid transparent',
                      marginBottom: -1,
                    }}>{l}</button>
                  ))}
                </div>
                {(activeHall === 'shame' ? hallOfShame : hallOfFame).map((p, i) => (
                  <div key={p.candidateId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${t.border}` }}>
                    <div>
                      <span style={{ color: t.low, marginRight: 10, fontSize: 11 }}>#{i + 1}</span>
                      <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: partyColor(p.party), marginRight: 7 }} />
                      <span style={{ color: t.hi, fontSize: 13 }}>{p.name}</span>
                      <span style={{ color: t.mid, fontSize: 11, marginLeft: 6 }}>{p.state}</span>
                    </div>
                    <Score v={p.overallScore} />
                  </div>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, padding: '0 0 14px' }}>
              {[['ALL', 'All'], ['S', 'Senate'], ['H', 'House']].map(([v, l]) => (
                <button key={v} onClick={() => setFilterChamber(v)} style={{
                  background: filterChamber === v ? t.accent : t.inputBg,
                  border: `1px solid ${filterChamber === v ? t.accent : t.border}`,
                  borderRadius: 4, color: filterChamber === v ? '#000' : t.mid,
                  fontFamily: "'Roboto', sans-serif", fontSize: 11, padding: '6px 14px', cursor: 'pointer',
                }}>{l}</button>
              ))}
              <div style={{ width: 1, background: t.border, margin: '0 4px' }} />
              {[['ALL', 'All'], ['DEM', 'Dem'], ['REP', 'Rep']].map(([v, l]) => (
                <button key={v} onClick={() => setFilterParty(v)} style={{
                  background: filterParty === v ? t.accent : t.inputBg,
                  border: `1px solid ${filterParty === v ? t.accent : t.border}`,
                  borderRadius: 4, color: filterParty === v ? '#000' : t.mid,
                  fontFamily: "'Roboto', sans-serif", fontSize: 11, padding: '6px 14px', cursor: 'pointer',
                }}>{l}</button>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                {[['score', 'Best First'], ['worst', 'Worst First']].map(([v, l]) => (
                  <button key={v} onClick={() => setSortBy(v)} style={{
                    background: sortBy === v ? '#1A1A1A' : 'none',
                    border: `1px solid ${sortBy === v ? t.border : 'transparent'}`,
                    borderRadius: 4, color: sortBy === v ? t.hi : t.mid,
                    fontFamily: "'Roboto', sans-serif", fontSize: 11, padding: '6px 14px', cursor: 'pointer',
                  }}>{l}</button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div style={{ background: t.cardB, border: `1px solid ${t.border}`, borderRadius: 6, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: t.card }}>
                    {['Rank', 'Politician', 'Party/State', 'Total Raised', 'Score'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: t.mid, fontFamily: "'Roboto', sans-serif", fontWeight: 600, fontSize: 11, borderBottom: `1px solid ${t.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p, i) => (
                    <Fragment key={p.candidateId}>
                      <tr
                        onClick={() => setExpandedId(expandedId === p.candidateId ? null : p.candidateId)}
                        style={{
                          background: expandedId === p.candidateId ? t.card : i % 2 === 0 ? t.cardB : t.tableAlt,
                          borderBottom: `1px solid ${t.border}`,
                          cursor: 'pointer',
                        }}
                      >
                        <td style={{ padding: '10px 14px', color: t.low, fontWeight: 700 }}>#{i + 1}</td>
                        <td style={{ padding: '10px 14px', color: t.hi, fontWeight: 600 }}>{p.name}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: partyColor(p.party), marginRight: 6 }} />
                          <span style={{ color: t.mid, fontSize: 11 }}>
                            {p.party} · {p.state} · {p.office === 'S' ? 'Senate' : p.office === 'H' ? 'House' : p.office || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', color: t.hi }}>{fmtM(p.totalRaised || 0)}</td>
                        <td style={{ padding: '10px 14px' }}><Score v={p.overallScore} /></td>
                      </tr>
                      {expandedId === p.candidateId && (
                        <tr key={`${p.candidateId}-expand`} style={{ background: t.card }}>
                          <td colSpan={5} style={{ padding: '16px 24px', borderBottom: `1px solid ${t.border}` }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: t.hi, marginBottom: 12 }}>Score Breakdown</div>
                                {Object.entries(COMPONENT_LABELS).map(([k, label]) => (
                                  <ComponentBar key={k} label={label} value={p.components?.[k] ?? null} t={t} />
                                ))}
                              </div>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: t.hi, marginBottom: 12 }}>Risk Factors</div>
                                {(p.riskFactors || []).length === 0 ? (
                                  <div style={{ fontSize: 12, color: '#2DC653' }}>No risk factors detected</div>
                                ) : (
                                  <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                                    {p.riskFactors.map((f, fi) => (
                                      <li key={fi} style={{ fontSize: 12, color: t.mid, marginBottom: 6 }}>{f}</li>
                                    ))}
                                  </ul>
                                )}
                                {p.candidateId && (
                                  <a
                                    href={`https://www.fec.gov/data/candidate/${p.candidateId}/`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: t.accent, textDecoration: 'none', fontSize: 11, marginTop: 12, display: 'inline-block' }}
                                  >
                                    View FEC Profile ↗
                                  </a>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              <SourceFooter s="FEC API; UN*REDACTED accountability score methodology" />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
