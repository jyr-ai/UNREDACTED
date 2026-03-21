/**
 * Campaign Watch - 2026 Election Map
 * Phase 2F: Legislation panel (in dialog), state reps on click, gradient legend,
 *           error boundaries, D3 lazy loading, bundle splitting.
 */

import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useTheme } from '../theme/index.js';
import { Card, Band, CardTitle } from '../components/ui/index.js';
import ErrorBoundary from '../components/ErrorBoundary';
import { DATA_CENTERS } from '../data/geo';
import { campaignWatch as cwApi } from '../api/client';

// Lazy-load heavy components so D3/recharts don't block initial paint
const USPoliticalMap  = lazy(() => import('../components/USPoliticalMap'));
const CorruptionDialog = lazy(() => import('../components/CorruptionDialog'));

// Shared loading fallback used by Suspense wrappers
const MapFallback = ({ t }) => (
  <div style={{ height: 520, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: t?.mid || '#888' }}>
    Loading map…
  </div>
);

const STATE_NAMES = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',
  CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',
  HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',
  KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',
  MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',
  MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',
  NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',
  OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',
  SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',
  VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',
  WI:'Wisconsin',WY:'Wyoming',DC:'Washington DC',
};

const fmtM = n => {
  if (!n) return '$0';
  if (n >= 1e9) return `$${(n/1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n/1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n/1e3).toFixed(0)}K`;
  return `$${n}`;
};

const daysUntil = dateStr => {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.max(0, Math.ceil((d - now) / (1000 * 60 * 60 * 24)));
};

const CampaignWatch = () => {
  const t = useTheme();

  const [selectedState,   setSelectedState]   = useState(null);
  const [dialogPosition,  setDialogPosition]  = useState({ x: 120, y: 120 });
  const [dialogVisible,   setDialogVisible]   = useState(false);

  const [corruptionIndex,   setCorruptionIndex]   = useState([]);
  const [corruptionLoading, setCorruptionLoading] = useState(true);
  const [elections,         setElections]         = useState([]);
  const [electionsLoading,  setElectionsLoading]  = useState(true);

  // ── State delegation (fetched on map click) ────────────────────────────────
  const [stateReps,        setStateReps]        = useState(null);
  const [stateRepsLoading, setStateRepsLoading] = useState(false);

  // ── Address-based reps lookup ─────────────────────────────────────────────
  const [addressInput, setAddressInput] = useState('');
  const [repsLoading,  setRepsLoading]  = useState(false);
  const [repsData,     setRepsData]     = useState(null);
  const [repsNote,     setRepsNote]     = useState(null);
  const [repsError,    setRepsError]    = useState(null);

  useEffect(() => {
    setCorruptionLoading(true);
    cwApi.corruptionIndex()
      .then(res => setCorruptionIndex(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setCorruptionIndex([]))
      .finally(() => setCorruptionLoading(false));
  }, []);

  useEffect(() => {
    setElectionsLoading(true);
    cwApi.elections()
      .then(res => setElections(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setElections([]))
      .finally(() => setElectionsLoading(false));
  }, []);

  const corruptionScores = useMemo(() => {
    const map = {};
    corruptionIndex.forEach(s => {
      if (s.stateCode) map[s.stateCode] = s.corruptionIndex ?? 55;
    });
    return map;
  }, [corruptionIndex]);

  const kpiStats = useMemo(() => {
    if (!corruptionIndex.length) return { total: 0, count: 0, avg: '—', centers: DATA_CENTERS.length };
    const totalRaised = corruptionIndex.reduce((s, x) => s + (x.totalRaised || 0), 0);
    const avgCorruption = Math.round(
      corruptionIndex.reduce((s, x) => s + (x.corruptionIndex || 55), 0) / corruptionIndex.length
    );
    return { total: totalRaised, count: corruptionIndex.length, avg: avgCorruption, centers: DATA_CENTERS.length };
  }, [corruptionIndex]);

  const sortedStates = useMemo(() => (
    [...corruptionIndex].sort((a, b) => a.corruptionIndex - b.corruptionIndex)
  ), [corruptionIndex]);

  const handleStateClick = (stateCode) => {
    setSelectedState(stateCode);
    setDialogVisible(true);
    setDialogPosition({
      x: Math.min(window.innerWidth  - 420, 120 + Math.random() * 180),
      y: Math.min(window.innerHeight - 620, 120 + Math.random() * 180),
    });
    // Fetch state delegation for the side panel
    setStateReps(null);
    setStateRepsLoading(true);
    cwApi.representatives(stateCode)
      .then(res => setStateReps(res?.data || null))
      .catch(() => setStateReps(null))
      .finally(() => setStateRepsLoading(false));
  };
  const handleCloseDialog = () => setDialogVisible(false);
  const stateName = selectedState ? (STATE_NAMES[selectedState] || selectedState) : '';

  // ── Representatives lookup — accepts address, zip, or state abbr ──────────
  const searchRepresentatives = async () => {
    const addr = addressInput.trim();
    if (addr.length < 2) return;
    setRepsLoading(true);
    setRepsError(null);
    setRepsData(null);
    setRepsNote(null);
    try {
      const res = await cwApi.repsByAddress(addr);
      if (res?.data) {
        setRepsData(res.data);
        if (res.note) setRepsNote(res.note);
      } else if (res?.note) {
        setRepsError(res.note);
      } else {
        setRepsError('No representatives found. Try including a state abbreviation (e.g. "Union City NJ") or zip code.');
      }
    } catch (e) {
      setRepsError(e.message || 'Failed to look up representatives.');
    } finally {
      setRepsLoading(false);
    }
  };

  const corruptionColor = score =>
    score < 30 ? t.warn :
    score < 50 ? t.accent :
    score < 70 ? t.ok : t.blue;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* ── KPI row ───────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        borderTop: `1px solid ${t.border}`,
        borderBottom: `1px solid ${t.border}`,
      }}>
        {[
          { v: corruptionLoading ? '…' : fmtM(kpiStats.total),  d: '2026 total raised',    s: 'FEC · current cycle' },
          { v: corruptionLoading ? '…' : kpiStats.count,         d: 'States tracked',       s: 'All 51 incl. DC' },
          { v: corruptionLoading ? '…' : kpiStats.avg,           d: 'Avg corruption index', s: 'Lower = more corrupt' },
          { v: kpiStats.centers,                                  d: 'Data centers mapped',  s: 'Infrastructure layer' },
        ].map((k, i) => (
          <div key={i} style={{ padding: '18px 20px', borderRight: `1px solid ${t.border}` }}>
            <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 32, color: t.kpiNum, lineHeight: 1, marginBottom: 5 }}>{k.v}</div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: t.hi, marginBottom: 3 }}>{k.d}</div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: t.low }}>{k.s}</div>
          </div>
        ))}
      </div>

      {/* ── Map ───────────────────────────────────────────────────────── */}
      <div>
        <Band label="US Political Accountability Map — 2026 Election" right="CLICK ANY STATE FOR PROFILE" />
        <ErrorBoundary label="Map" theme={t}>
          <Card>
            <CardTitle
              h="Infrastructure, economics, and political accountability — all in one view."
              sub="Red = high corruption risk. Click any state to open its detailed profile."
            />
            <Suspense fallback={<MapFallback t={t} />}>
              <USPoliticalMap
                onStateClick={handleStateClick}
                theme={t}
                corruptionScores={corruptionScores}
              />
            </Suspense>
          </Card>
        </ErrorBoundary>
      </div>

      {/* ── State Delegation Panel (appears after a state is clicked) ─── */}
      {(selectedState || stateRepsLoading) && (
        <div>
          <Band
            label={selectedState ? `${STATE_NAMES[selectedState] || selectedState} Congressional Delegation` : 'State Delegation'}
            right="CONGRESS.GOV"
          />
          <ErrorBoundary label="Delegation" theme={t}>
            <Card>
              {stateRepsLoading ? (
                <div style={{ padding: '16px 0', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: t.mid }}>
                  Loading delegation…
                </div>
              ) : !stateReps || (stateReps.officials || []).length === 0 ? (
                <div style={{ padding: '16px 0', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: t.low }}>
                  No delegation data available for {STATE_NAMES[selectedState] || selectedState}.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                  {(stateReps.officials || []).map((rep, i) => {
                    const party = rep.party || rep.partyName || '';
                    const partyLower = party.toLowerCase();
                    const partyColor = partyLower.includes('republican') ? '#ef4444'
                                     : partyLower.includes('democrat')   ? '#3b82f6'
                                     : t.mid;
                    const office = rep.office || rep.chamber
                      ? (rep.chamber === 'Senate'
                          ? `U.S. Senator · ${selectedState}`
                          : rep.chamber === 'House'
                          ? `U.S. Representative · ${selectedState}`
                          : rep.office || '')
                      : '';
                    return (
                      <div key={i} style={{
                        padding: 14,
                        background: t.cardB, border: `1px solid ${t.border}`,
                        borderTop: `3px solid ${partyColor}`, borderRadius: 4,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          {rep.photoUrl && (
                            <img src={rep.photoUrl} alt={rep.name}
                              style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${partyColor}` }}
                              onError={e => { e.target.style.display = 'none'; }}
                            />
                          )}
                          <div>
                            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: t.hi, fontWeight: 700 }}>
                              {rep.name || `${rep.lastName}, ${rep.firstName}`}
                            </div>
                            {office && (
                              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: t.mid, marginTop: 2 }}>{office}</div>
                            )}
                          </div>
                        </div>
                        {party && (
                          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: partyColor, marginBottom: 5 }}>{party}</div>
                        )}
                        {(rep.urls?.length > 0 || rep.officialUrl) && (
                          <a
                            href={rep.urls?.[0] || rep.officialUrl}
                            target="_blank" rel="noopener noreferrer"
                            style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: t.blue, textDecoration: 'none' }}
                          >
                            🌐 Official website
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </ErrorBoundary>
        </div>
      )}

      {/* ── Rankings + Elections ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 22 }}>
        <div>
          <Band label="Corruption index rankings" right="LOWER SCORE = HIGHER RISK" />
          <ErrorBoundary label="Rankings" theme={t}>
            <Card>
              {corruptionLoading ? (
                <div style={{ padding: 20, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: t.mid }}>Loading corruption data…</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                  {sortedStates.map(state => {
                    const color = corruptionColor(state.corruptionIndex);
                    return (
                      <div key={state.stateCode} onClick={() => handleStateClick(state.stateCode)}
                        style={{ padding: 10, background: t.cardB || t.ink, border: `1px solid ${t.border}`, borderLeft: `4px solid ${color}`, cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: t.hi, fontWeight: 700 }}>{state.stateCode}</span>
                          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 14, fontWeight: 700, color }}>{state.corruptionIndex ?? '—'}</span>
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: t.mid, marginTop: 3 }}>{STATE_NAMES[state.stateCode] || state.stateCode}</div>
                        {state.totalRaised > 0 && (
                          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: t.low, marginTop: 2 }}>{fmtM(state.totalRaised)} raised</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </ErrorBoundary>
        </div>

        <div>
          <Band label="Upcoming elections" right="2026 CYCLE" />
          <Card>
            {electionsLoading ? (
              <div style={{ padding: 20, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: t.mid }}>Loading elections…</div>
            ) : elections.length === 0 ? (
              <div style={{ padding: 20, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: t.mid }}>No upcoming elections data available.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {elections.slice(0, 8).map((el, i) => {
                  const days = el.electionDay ? daysUntil(el.electionDay) : null;
                  return (
                    <div key={i} style={{ padding: '10px 12px', background: t.cardB, border: `1px solid ${t.border}`, borderLeft: `3px solid ${days !== null && days < 30 ? t.warn : t.accent}` }}>
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: t.hi, marginBottom: 3 }}>{el.name || 'Election'}</div>
                      {el.electionDay && (
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: t.mid }}>
                          {new Date(el.electionDay).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                          {days !== null && (
                            <span style={{ marginLeft: 8, color: days < 30 ? t.warn : t.accent }}>{days === 0 ? 'TODAY' : `${days}d`}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Representatives panel ─────────────────────────────────────── */}
      <div>
        <Band label="Find Your Representatives" right="CONGRESS.GOV + GOOGLE CIVIC" />
        <Card>
          <CardTitle
            h="Look up your elected officials by address, zip code, or state."
            sub="Enter a full address (e.g. 115 37th Ave Union City NJ), a zip code (07087), or just a state abbreviation (NJ)."
          />

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <input
              type="text"
              value={addressInput}
              onChange={e => setAddressInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchRepresentatives()}
              placeholder="115 37th Ave Union City NJ  —  07087  —  NJ"
              style={{
                flex: 1, padding: '10px 14px',
                background: t.cardB, border: `1px solid ${t.border}`, borderRadius: 4,
                color: t.hi, fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, outline: 'none',
              }}
            />
            <button
              onClick={searchRepresentatives}
              disabled={repsLoading || addressInput.trim().length < 2}
              style={{
                padding: '10px 20px',
                background: (repsLoading || addressInput.trim().length < 2) ? t.cardB : t.accent,
                border: `1px solid ${t.border}`, borderRadius: 4,
                color: (repsLoading || addressInput.trim().length < 2) ? t.mid : '#fff',
                fontFamily: "'IBM Plex Mono',monospace", fontSize: 11,
                cursor: repsLoading ? 'wait' : 'pointer', letterSpacing: '1px',
              }}
            >
              {repsLoading ? 'SEARCHING…' : 'FIND REPS'}
            </button>
          </div>

          {/* Fallback note (not an error — just informational) */}
          {repsNote && (
            <div style={{ padding: '8px 14px', background: t.cardB, border: `1px solid ${t.border}`, borderRadius: 4, fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: t.low, marginBottom: 14 }}>
              ℹ {repsNote}
            </div>
          )}

          {/* Error */}
          {repsError && (
            <div style={{ padding: '10px 14px', background: t.cardB, border: `1px solid ${t.warn}`, borderRadius: 4, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: t.warn, marginBottom: 16 }}>
              ⚠ {repsError}
            </div>
          )}

          {/* Results */}
          {repsData && (
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: t.low, marginBottom: 14, letterSpacing: '1px' }}>
                {repsData.source === 'congress.gov'
                  ? `FEDERAL REPRESENTATIVES — ${repsData.normalizedInput?.line1 || addressInput}`
                  : `RESULTS FOR: ${repsData.normalizedInput?.line1 || ''}${repsData.normalizedInput?.city ? `, ${repsData.normalizedInput.city}` : ''}${repsData.normalizedInput?.state ? ` ${repsData.normalizedInput.state}` : ''}`
                }
              </div>

              {(repsData.officials || []).length === 0 ? (
                <div style={{ padding: '12px 14px', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: t.mid }}>
                  No officials found for this location.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                  {(repsData.officials || []).map((rep, i) => {
                    const party = rep.party || '';
                    const partyLower = party.toLowerCase();
                    const partyColor = partyLower.includes('republican') ? '#ef4444'
                                     : partyLower.includes('democrat')   ? '#3b82f6'
                                     : t.mid;
                    return (
                      <div key={i} style={{
                        padding: 14,
                        background: t.cardB, border: `1px solid ${t.border}`,
                        borderTop: `3px solid ${partyColor}`, borderRadius: 4,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          {rep.photoUrl && (
                            <img src={rep.photoUrl} alt={rep.name}
                              style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${partyColor}` }}
                              onError={e => { e.target.style.display='none'; }}
                            />
                          )}
                          <div>
                            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: t.hi, fontWeight: 700 }}>{rep.name}</div>
                            {/* Use rep.office from normalized format */}
                            {rep.office && <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: t.mid, marginTop: 2 }}>{rep.office}</div>}
                          </div>
                        </div>
                        {party && (
                          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: partyColor, marginBottom: 6 }}>{party}</div>
                        )}
                        {rep.channels?.length > 0 && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                            {rep.channels.slice(0, 3).map((ch, j) => (
                              <a key={j}
                                href={`https://${ch.type.toLowerCase()}.com/${ch.id}`}
                                target="_blank" rel="noopener noreferrer"
                                style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: t.blue, textDecoration: 'none', border: `1px solid ${t.border}`, padding: '2px 6px', borderRadius: 3 }}>
                                {ch.type}
                              </a>
                            ))}
                          </div>
                        )}
                        {rep.phones?.length > 0 && (
                          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: t.mid, marginTop: 4 }}>
                            📞 {rep.phones[0]}
                          </div>
                        )}
                        {rep.urls?.length > 0 && (
                          <a href={rep.urls[0]} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'block', marginTop: 4, fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: t.blue, textDecoration: 'none' }}>
                            🌐 Official website
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Placeholder */}
          {!repsData && !repsError && !repsLoading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {['Federal Senator', 'Federal Representative', 'Governor'].map(role => (
                <div key={role} style={{
                  padding: 16, background: t.cardB, border: `1px solid ${t.border}`, borderRadius: 4,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minHeight: 80,
                }}>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: t.accent, letterSpacing: '1px' }}>{role.toUpperCase()}</div>
                  <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 11, fontStyle: 'italic', color: t.low }}>Enter address, zip, or state</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Floating corruption dialog ─────────────────────────────── */}
      {dialogVisible && selectedState && (
        <ErrorBoundary label="Corruption Dialog" theme={t}>
          <Suspense fallback={null}>
            <CorruptionDialog
              stateCode={selectedState}
              stateName={stateName}
              position={dialogPosition}
              onClose={handleCloseDialog}
              theme={t}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  );
};

export default CampaignWatch;
