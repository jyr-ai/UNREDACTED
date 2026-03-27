/**
 * Map Explorer — dedicated full-viewport intelligence map tab
 *
 * The map is the hero: full-width, tall canvas, with a collapsible
 * state-detail sidebar that shows delegation + accountability stats
 * when a state is clicked, and a corruption leaderboard otherwise.
 *
 * Data pipeline: same bootstrap hydration as CampaignWatch —
 * primeHydrationCache() → loadMapData() → individual API fallbacks.
 */

import React, { useState, useEffect, useMemo, lazy, Suspense, useCallback } from 'react';
import { useTheme } from '../theme/index.js';
import { Band } from '../components/ui/index.js';
import ErrorBoundary from '../components/ErrorBoundary';
import { useMobile } from '../hooks/useMediaQuery.js';
import { DATA_CENTERS } from '../data/geo';
import { campaignWatch as cwApi } from '../api/client';
import { primeHydrationCache } from '../services/bootstrap.js';
import { loadMapData } from '../services/map-data.js';

const DeckGLMap = lazy(() => import('../components/DeckGLMap'));

// ── Constants ──────────────────────────────────────────────────────────────

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

const SCORE_COLOR = score =>
  score < 30 ? '#ef4444' :
  score < 50 ? '#f97316' :
  score < 70 ? '#eab308' : '#22c55e';

const SCORE_LABEL = score =>
  score < 30 ? 'CRITICAL RISK' :
  score < 50 ? 'HIGH RISK' :
  score < 70 ? 'MODERATE' : 'CLEAN';

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiCell({ value, label, source, last }) {
  const t = useTheme();
  return (
    <div style={{
      padding: '14px 16px',
      borderRight: last ? 'none' : `1px solid ${t.border}`,
      minWidth: 0,
    }}>
      <div style={{
        fontFamily: "'Playfair Display',Georgia,serif",
        fontSize: 24, color: t.kpiNum, lineHeight: 1, marginBottom: 3,
      }}>{value}</div>
      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: t.hi, marginBottom: 1 }}>{label}</div>
      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: t.low }}>{source}</div>
    </div>
  );
}

function ScoreBar({ score }) {
  return (
    <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', margin: '6px 0 2px' }}>
      <div style={{
        height: '100%', width: `${score}%`,
        background: `linear-gradient(90deg, ${SCORE_COLOR(score)}, ${SCORE_COLOR(score)}cc)`,
        borderRadius: 2, transition: 'width 0.5s ease',
      }} />
    </div>
  );
}

function RepCard({ rep, t }) {
  const party = rep.party || rep.partyName || '';
  const partyLower = party.toLowerCase();
  const partyColor = partyLower.includes('republican') ? '#ef4444'
                   : partyLower.includes('democrat')   ? '#3b82f6'
                   : t.mid;
  const chamber = rep.chamber === 'Senate' ? 'SEN'
                : rep.chamber === 'House'  ? 'REP'
                : '';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 0',
      borderBottom: `1px solid ${t.border}`,
    }}>
      {rep.photoUrl && (
        <img src={rep.photoUrl} alt={rep.name}
          style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover',
            border: `1.5px solid ${partyColor}`, flexShrink: 0 }}
          onError={e => { e.target.style.display = 'none'; }}
        />
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: t.hi,
          fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {chamber && <span style={{ color: partyColor, marginRight: 5, fontSize: 8 }}>{chamber}</span>}
          {rep.name || `${rep.lastName}, ${rep.firstName}`}
        </div>
        {party && (
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: partyColor, marginTop: 1 }}>
            {party.replace('Republican', 'R').replace('Democrat', 'D').replace('Independent', 'I')}
          </div>
        )}
      </div>
      {(rep.urls?.[0] || rep.officialUrl) && (
        <a href={rep.urls?.[0] || rep.officialUrl} target="_blank" rel="noopener noreferrer"
          style={{ color: t.blue, fontSize: 14, flexShrink: 0, textDecoration: 'none' }}>
          ↗
        </a>
      )}
    </div>
  );
}

function StatePanel({ stateCode, corruptionIndex, gasPriceByState, t, onClose }) {
  const [reps, setReps] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!stateCode) return;
    setReps(null);
    setLoading(true);
    cwApi.representatives(stateCode)
      .then(res => setReps(res?.data || null))
      .catch(() => setReps(null))
      .finally(() => setLoading(false));
  }, [stateCode]);

  const stateEntry = corruptionIndex.find(s => s.stateCode === stateCode);
  const score     = stateEntry?.corruptionIndex ?? null;
  const raised    = stateEntry?.totalRaised ?? null;
  const gasPrice  = gasPriceByState[stateCode];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', minHeight: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 10px',
        borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 18, color: t.hi, lineHeight: 1.1 }}>
            {STATE_NAMES[stateCode] || stateCode}
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: t.low, marginTop: 3 }}>
            STATE PROFILE · {stateCode}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: `1px solid ${t.border}`, borderRadius: 3,
          color: t.mid, fontSize: 12, width: 24, height: 24, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>×</button>
      </div>

      {/* Score + stats */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}` }}>
        {score != null ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: t.low, letterSpacing: '1px' }}>
                ACCOUNTABILITY SCORE
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8,
                color: SCORE_COLOR(score), fontWeight: 700, letterSpacing: '1px' }}>
                {SCORE_LABEL(score)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 32,
                color: SCORE_COLOR(score), lineHeight: 1 }}>{score}</span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: t.mid }}>/100</span>
            </div>
            <ScoreBar score={score} />
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: t.low }}>
              Higher = less corrupt · RECEIPTS methodology
            </div>
          </>
        ) : (
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: t.low }}>
            Score unavailable
          </div>
        )}

        {/* Quick stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
          {raised != null && (
            <div style={{ background: t.cardB, border: `1px solid ${t.border}`, borderRadius: 3, padding: '8px 10px' }}>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: t.low, marginBottom: 2 }}>2026 RAISED</div>
              <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 15, color: t.kpiNum }}>{fmtM(raised)}</div>
            </div>
          )}
          {gasPrice != null && (
            <div style={{ background: t.cardB, border: `1px solid ${t.border}`, borderRadius: 3, padding: '8px 10px' }}>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: t.low, marginBottom: 2 }}>GAS / GAL</div>
              <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 15, color: t.kpiNum }}>
                ${typeof gasPrice === 'number' ? gasPrice.toFixed(2) : gasPrice}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delegation */}
      <div style={{ padding: '10px 16px 4px' }}>
        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: t.low,
          letterSpacing: '1px', marginBottom: 8 }}>CONGRESSIONAL DELEGATION</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        {loading ? (
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: t.mid, paddingTop: 8 }}>
            Loading delegation…
          </div>
        ) : !reps || (reps.officials || []).length === 0 ? (
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: t.low, paddingTop: 8 }}>
            No delegation data available.
          </div>
        ) : (
          (reps.officials || []).map((rep, i) => (
            <RepCard key={i} rep={rep} t={t} />
          ))
        )}
      </div>
    </div>
  );
}

function LeaderboardPanel({ corruptionIndex, gasPriceByState, onStateClick, t }) {
  const sorted = useMemo(() =>
    [...corruptionIndex].sort((a, b) => a.corruptionIndex - b.corruptionIndex),
    [corruptionIndex]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${t.border}` }}>
        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: t.low,
          letterSpacing: '1.5px', marginBottom: 2 }}>ACCOUNTABILITY INDEX</div>
        <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 15, color: t.hi }}>
          State Rankings
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: t.low, marginTop: 3 }}>
          Click a state to view profile · Lower score = more corrupt
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sorted.length === 0 ? (
          <div style={{ padding: '16px', fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: t.mid }}>
            Loading state rankings…
          </div>
        ) : sorted.map((s, i) => {
          const score = s.corruptionIndex ?? 55;
          const gas   = gasPriceByState[s.stateCode];
          return (
            <div key={s.stateCode}
              onClick={() => onStateClick(s.stateCode)}
              style={{
                display: 'grid', gridTemplateColumns: '22px 1fr auto',
                gap: 8, alignItems: 'center',
                padding: '7px 16px', cursor: 'pointer',
                borderBottom: `1px solid ${t.border}`,
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8,
                color: t.low, textAlign: 'right' }}>{i+1}</span>
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: t.hi, fontWeight: 600 }}>
                  {s.stateCode}
                  <span style={{ color: t.low, fontWeight: 400, marginLeft: 6, fontSize: 9 }}>
                    {STATE_NAMES[s.stateCode] || ''}
                  </span>
                </div>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2,
                  overflow: 'hidden', marginTop: 3, width: '80%' }}>
                  <div style={{ height: '100%', width: `${score}%`,
                    background: SCORE_COLOR(score), borderRadius: 2 }} />
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11,
                  color: SCORE_COLOR(score), fontWeight: 700 }}>{score}</div>
                {gas != null && (
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: t.low }}>
                    ${typeof gas === 'number' ? gas.toFixed(2) : gas}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function MapPage() {
  const t       = useTheme();
  const isMobile = useMobile();

  // ── Map data ───────────────────────────────────────────────────────────
  const [corruptionIndex,   setCorruptionIndex]   = useState([]);
  const [corruptionLoading, setCorruptionLoading] = useState(true);
  const [gasPriceByState,   setGasPriceByState]   = useState({});
  const [newsLocations,     setNewsLocations]      = useState([]);
  const [contributions,     setContributions]      = useState([]);
  const [electionRaces,     setElectionRaces]      = useState([]);
  const [darkMoneyFlows,    setDarkMoneyFlows]     = useState([]);
  const [spendingFlows,     setSpendingFlows]      = useState([]);
  const [stockActTrades,    setStockActTrades]     = useState([]);

  // ── State panel ────────────────────────────────────────────────────────
  const [selectedState, setSelectedState] = useState(null);

  // ── Bootstrap hydration → loadMapData (same pipeline as CampaignWatch) ─
  useEffect(() => {
    primeHydrationCache()
      .then(() => loadMapData({
        setCorruptionScores: (scores) => {
          if (scores && typeof scores === 'object') {
            setCorruptionIndex(prev => {
              const count = Object.keys(scores).length;
              if (count > prev.length) {
                return Object.entries(scores).map(([stateCode, corruptionIndex]) => ({
                  stateCode, corruptionIndex, totalRaised: 0,
                }));
              }
              return prev;
            });
          }
        },
        setGasPriceByState,
        setContributions,
        setElectionRaces,
        setDarkMoneyFlows,
        setSpendingFlows,
        setStockActTrades,
        setNewsLocations,
      }))
      .catch(() => loadMapData({
        setGasPriceByState,
        setContributions,
        setElectionRaces,
        setDarkMoneyFlows,
        setSpendingFlows,
        setStockActTrades,
        setNewsLocations,
      }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Direct API fetch for corruption index (as authoritative source)
  useEffect(() => {
    setCorruptionLoading(true);
    cwApi.corruptionIndex()
      .then(res => setCorruptionIndex(Array.isArray(res?.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setCorruptionLoading(false));
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
    const totalRaised   = corruptionIndex.reduce((s, x) => s + (x.totalRaised || 0), 0);
    const avgCorruption = Math.round(
      corruptionIndex.reduce((s, x) => s + (x.corruptionIndex || 55), 0) / corruptionIndex.length
    );
    return { total: totalRaised, count: corruptionIndex.length, avg: avgCorruption, centers: DATA_CENTERS.length };
  }, [corruptionIndex]);

  const handleStateClick = useCallback((stateCode) => {
    setSelectedState(stateCode);
  }, []);

  const handlePanelClose = useCallback(() => {
    setSelectedState(null);
  }, []);

  // ── Sidebar width (0 on mobile — panel is below map) ──────────────────
  const SIDEBAR_W = 290;

  // ── Map height — taller than in CampaignWatch ─────────────────────────
  const mapH = isMobile ? 420 : 680;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── KPI bar ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        borderTop: `1px solid ${t.border}`,
        borderBottom: `1px solid ${t.border}`,
      }}>
        <KpiCell
          value={corruptionLoading ? '…' : fmtM(kpiStats.total)}
          label="2026 total raised"
          source="FEC · current cycle"
        />
        <KpiCell
          value={corruptionLoading ? '…' : kpiStats.count}
          label="States tracked"
          source="All 51 incl. DC"
        />
        <KpiCell
          value={corruptionLoading ? '…' : kpiStats.avg}
          label="Avg accountability score"
          source="Lower = more corrupt"
        />
        <KpiCell
          value={kpiStats.centers}
          label="Data centers mapped"
          source="Infrastructure layer"
          last
        />
      </div>

      {/* ── Band ─────────────────────────────────────────────────────── */}
      <Band
        label="US Intelligence Map — Infrastructure · Accountability · Economics"
        right="CLICK ANY STATE FOR PROFILE"
      />

      {/* ── Map + Sidebar ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: 0,
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderTop: 'none',
      }}>

        {/* Map column */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <ErrorBoundary label="Map" theme={t}>
            <Suspense fallback={
              <div style={{ height: mapH, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 11, color: t.mid }}>
                Loading map…
              </div>
            }>
              <DeckGLMap
                corruptionScores={corruptionScores}
                gasPriceByState={gasPriceByState}
                onStateClick={handleStateClick}
                theme={t}
                mapTheme="dark"
                newsLocations={newsLocations}
                contributions={contributions}
                electionRaces={electionRaces}
                darkMoneyFlows={darkMoneyFlows}
                spendingFlows={spendingFlows}
                stockActTrades={stockActTrades}
                height={mapH}
              />
            </Suspense>
          </ErrorBoundary>
        </div>

        {/* Sidebar — leaderboard default, state profile on click */}
        {!isMobile && (
          <div style={{
            width: SIDEBAR_W, flexShrink: 0,
            borderLeft: `1px solid ${t.border}`,
            height: mapH, overflowY: 'hidden',
            display: 'flex', flexDirection: 'column',
            background: t.bg,
          }}>
            {selectedState ? (
              <StatePanel
                stateCode={selectedState}
                corruptionIndex={corruptionIndex}
                gasPriceByState={gasPriceByState}
                t={t}
                onClose={handlePanelClose}
              />
            ) : (
              <LeaderboardPanel
                corruptionIndex={corruptionIndex}
                gasPriceByState={gasPriceByState}
                onStateClick={handleStateClick}
                t={t}
              />
            )}
          </div>
        )}
      </div>

      {/* Mobile: state panel below map */}
      {isMobile && selectedState && (
        <div style={{
          border: `1px solid ${t.border}`, borderTop: 'none',
          background: t.bg, maxHeight: 360, overflowY: 'auto',
        }}>
          <StatePanel
            stateCode={selectedState}
            corruptionIndex={corruptionIndex}
            gasPriceByState={gasPriceByState}
            t={t}
            onClose={handlePanelClose}
          />
        </div>
      )}

      {/* Mobile: leaderboard below map (when no state selected) */}
      {isMobile && !selectedState && corruptionIndex.length > 0 && (
        <div style={{
          border: `1px solid ${t.border}`, borderTop: 'none',
          background: t.bg, maxHeight: 340, overflowY: 'auto',
        }}>
          <LeaderboardPanel
            corruptionIndex={corruptionIndex}
            gasPriceByState={gasPriceByState}
            onStateClick={handleStateClick}
            t={t}
          />
        </div>
      )}

    </div>
  );
}
