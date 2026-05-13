/**
 * Campaign Watch - 2026 Election Map
 * Phase 2F: Legislation panel (in dialog), state reps on click, gradient legend,
 *           error boundaries, D3 lazy loading, bundle splitting.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { useTheme } from '../theme/index.js';
import { Card, Band, CardTitle } from '../components/ui/index.js';
import ErrorBoundary from '../components/ErrorBoundary';
import LiveNewsPanel from '../components/LiveNewsPanel.jsx';
import LiveFeedPanel from '../components/LiveFeedPanel.jsx';
// WarStats inlined — conflict data fetched directly so the KPI cell shares
// the exact same DOM structure, padding, border, and font tokens as every other column.
import { FONT_MONO, FONT_SERIF } from '../theme/tokens.js';
import { useMobile } from '../hooks/useMediaQuery.js';
import { DATA_CENTERS } from '../data/geo';
import { campaignWatch as cwApi, fetchContracts } from '../api/client';
import { primeHydrationCache } from '../services/bootstrap.js';
import { loadMapData } from '../services/map-data.js';

// Lazy-load heavy components so D3/recharts/WebGL don't block initial paint
// DeckGLMap (MapLibre + deck.gl) is the primary map; USPoliticalMap kept as SVG fallback
const DeckGLMap       = lazy(() => import('../components/DeckGLMap'));
const USPoliticalMap  = lazy(() => import('../components/USPoliticalMap'));
const CorruptionDialog = lazy(() => import('../components/CorruptionDialog'));

// Shared loading fallback used by Suspense wrappers
const MapFallback = ({ t }) => (
  <div style={{ height: 520, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: FONT_MONO, fontSize: 11, color: t?.mid || '#888' }}>
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

const fmtK = n => {
  if (n == null) return null;
  if (n >= 1e12) return `$${(n/1e12).toFixed(1)}T`;
  if (n >= 1e9)  return `$${(n/1e9).toFixed(1)}bn`;
  if (n >= 1e6)  return `$${(n/1e6).toFixed(0)}m`;
  return `$${n.toFixed(0)}`;
};

const CampaignWatch = () => {
  const t = useTheme();
  const isMobile = useMobile();

  // ── Economic KPIs ─────────────────────────────────────────────────────────
  const [unemploymentData, setUnemploymentData] = useState(null);
  const [inflationData,    setInflationData]    = useState(null);
  const [fearGreedData,    setFearGreedData]    = useState(null);
  const [conflictData,     setConflictData]     = useState(null);

  useEffect(() => {
    // BLS Unemployment + CPI — proxied through backend (cached, avoids BLS rate limits)
    fetch('/api/economic')
      .then(r => r.json())
      .then(d => {
        if (d?.unemployment) setUnemploymentData(d.unemployment);
        if (d?.inflation) setInflationData(d.inflation);
      })
      .catch(() => {});

    // CNN Fear & Greed — proxied through backend to avoid CORS
    fetch('/api/fear-greed')
      .then(r => r.json())
      .then(d => { if (d?.score != null) setFearGreedData(d); })
      .catch(() => {});

    // Conflict / US-Iran War spending
    fetch('/api/conflict')
      .then(r => r.json())
      .then(d => { if (d?.damage) setConflictData(d.damage); })
      .catch(() => {});
  }, []);

  const fmtChange = (val) => {
    if (val == null) return '—';
    const isWorse = val > 0;
    const color = val === 0 ? '#888' : isWorse ? '#ef4444' : '#22c55e';
    const arrow = val > 0 ? '▲' : '▼';
    return <span style={{ color }}>{arrow}{Math.abs(val)}% YoY</span>;
  };

  const fmtSpend = v => {
    if (v == null) return '—';
    if (v >= 1000) return `$${(v / 1000).toFixed(1)}bn`;
    return `$${v}m`;
  };

  const fmtNum = n => (n == null ? '—' : n.toLocaleString());

  const fearGreedColor = rating => {
    if (!rating) return '#888';
    const r = rating.toLowerCase();
    if (r.includes('extreme fear')) return '#ef4444';
    if (r.includes('fear'))         return '#f97316';
    if (r.includes('neutral'))      return '#eab308';
    if (r.includes('extreme greed')) return '#16a34a';
    if (r.includes('greed'))        return '#22c55e';
    return '#888';
  };

  const fearGreedLabel = rating => {
    if (!rating) return '—';
    return rating.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  };

  // ── Live contract data (from Overview KPIs) ───────────────────────────────
  const [liveContracts, setLiveContracts] = useState(null);

  useEffect(() => {
    fetchContracts({ limit: 50 })
      .then(res => { if (res.success) setLiveContracts(res); })
      .catch(() => {});
  }, []);

  const contractsArr = Array.isArray(liveContracts?.data)
    ? liveContracts.data
    : (liveContracts?.data?.results || []);
  const totalSpend = liveContracts
    ? contractsArr.reduce((s, c) => s + parseFloat(c['Award Amount'] || 0), 0)
    : null;
  const flaggedCount = liveContracts
    ? contractsArr.filter(c => parseFloat(c['Award Amount'] || 0) >= 5e8).length
    : null;

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

  // ── Phase 2: Dynamic map data (fed via Redis bootstrap pipeline) ──────────
  const [gasPriceByState,  setGasPriceByState]  = useState({});
  const [newsLocations,    setNewsLocations]     = useState([]);
  const [contributions,    setContributions]     = useState([]);
  const [electionRaces,    setElectionRaces]     = useState([]);
  const [darkMoneyFlows,   setDarkMoneyFlows]    = useState([]);
  const [spendingFlows,    setSpendingFlows]     = useState([]);
  const [stockActTrades,   setStockActTrades]    = useState([]);

  // Prime the hydration cache on page mount, then load all map data.
  // The bootstrap fetch (fast + slow tiers) runs in parallel with a 800ms timeout;
  // if it misses the cache, loadMapData falls through to individual API calls.
  useEffect(() => {
    // Note: setCorruptionScores is intentionally NOT passed here.
    // The bootstrap/seed payload for `corruption:index:v1` is a score-only
    // {stateCode: 0-100} map and has no totalRaised values, so feeding it into
    // corruptionIndex state would race with the cwApi.corruptionIndex() effect
    // below and zero out the "2026 total raised" KPI. That effect already
    // populates the full rich array including totalRaised for both the KPI
    // and the choropleth, so the bootstrap path for corruption is redundant.
    const mapSetters = {
      setGasPriceByState,
      setContributions,
      setElectionRaces,
      setDarkMoneyFlows,
      setSpendingFlows,
      setStockActTrades,
      setNewsLocations,
    };
    primeHydrationCache()
      .then(() => loadMapData(mapSetters))
      .catch(() => loadMapData(mapSetters));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const corruptionColor = score =>
    score < 30 ? t.warn :
    score < 50 ? t.accent :
    score < 70 ? t.ok : t.blue;

  const [splitPct, setSplitPct] = useState(50);
  const feedsContainerRef = useRef(null);
  const isDragging = useRef(false);

  const handleDividerMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e) => {
      if (!isDragging.current || !feedsContainerRef.current) return;
      const rect = feedsContainerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPct(Math.max(20, Math.min(80, pct)));
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Intelligence Briefing: Signal Status + grouped KPI grid ── */}
      <div>
        <Band
          label="INTELLIGENCE BRIEFING · 2026 CYCLE"
          right={[
            flaggedCount != null ? `${flaggedCount} contracts ≥$500M flagged` : null,
            '$18bn PAC donations · 2023–24',
            fearGreedData?.rating ? `Market: ${fearGreedLabel(fearGreedData.rating)}` : null,
          ].filter(Boolean).join('  ·  ')}
        />

        {/* Group header labels */}
        {!isMobile && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '4fr 3fr 3fr',
            background: t.navBg,
            borderLeft: `1px solid ${t.border}`,
            borderRight: `1px solid ${t.border}`,
            borderBottom: `1px solid ${t.border}`,
          }}>
            {['ECONOMIC INDICATORS', 'CAMPAIGN FINANCE', 'FEDERAL SPENDING'].map((label, i) => (
              <div key={i} style={{
                padding: '5px 14px',
                fontFamily: FONT_MONO,
                fontSize: 10,
                color: t.mid,
                letterSpacing: 2,
                borderLeft: i > 0 ? `1px solid ${t.border}` : 'none',
              }}>{label}</div>
            ))}
          </div>
        )}

        {/* KPI cells — grouped: 4 economic · 3 campaign · 3 spending */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(10, 1fr)',
          borderLeft: `1px solid ${t.border}`,
          borderRight: `1px solid ${t.border}`,
          borderBottom: `1px solid ${t.border}`,
        }}>
          {/* ── ECONOMIC (4) ── */}
          <div style={{ padding: isMobile ? '10px 10px' : '14px 14px', borderRight: `1px solid ${t.border}`, borderBottom: isMobile ? `1px solid ${t.border}` : 'none' }}>
            <div style={{ fontFamily: FONT_SERIF, fontSize: isMobile ? 22 : 28, color: t.hi, lineHeight: 1, marginBottom: 4 }}>$39.0T</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: t.hi, marginBottom: 3 }}>US national debt</div>
            <a href="https://www.pgpf.org/national-debt-clock/" target="_blank" rel="noopener noreferrer" style={{ fontFamily: FONT_MONO, fontSize: 8, color: t.blue, textDecoration: 'none' }}>pgpf.org · live clock</a>
          </div>
          <div style={{ padding: isMobile ? '10px 10px' : '14px 14px', borderRight: `1px solid ${t.border}`, borderBottom: isMobile ? `1px solid ${t.border}` : 'none' }}>
            <div style={{ fontFamily: FONT_SERIF, fontSize: isMobile ? 22 : 28, color: t.hi, lineHeight: 1, marginBottom: 4 }}>{unemploymentData ? `${unemploymentData.rate}%` : '…'}</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: t.hi, marginBottom: 3 }}>Unemployment · {unemploymentData?.period || '—'}</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: t.low }}>{unemploymentData ? fmtChange(unemploymentData.change) : '—'} · <a href="https://www.bls.gov/cps/" target="_blank" rel="noopener noreferrer" style={{ color: t.blue, textDecoration: 'none' }}>BLS</a></div>
          </div>
          <div style={{ padding: isMobile ? '10px 10px' : '14px 14px', borderRight: `1px solid ${t.border}`, borderBottom: isMobile ? `1px solid ${t.border}` : 'none' }}>
            <div style={{ fontFamily: FONT_SERIF, fontSize: isMobile ? 22 : 28, color: t.hi, lineHeight: 1, marginBottom: 4 }}>{inflationData ? `${inflationData.rate}%` : '…'}</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: t.hi, marginBottom: 3 }}>CPI inflation YoY · {inflationData?.period || '—'}</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: t.low }}>{inflationData ? fmtChange(inflationData.change) : '—'} · <a href="https://www.bls.gov/cpi/" target="_blank" rel="noopener noreferrer" style={{ color: t.blue, textDecoration: 'none' }}>BLS</a></div>
          </div>
          <div style={{ padding: isMobile ? '10px 10px' : '14px 14px', borderRight: `1px solid ${t.border}`, borderBottom: isMobile ? `1px solid ${t.border}` : 'none' }}>
            <div style={{ fontFamily: FONT_SERIF, fontSize: isMobile ? 22 : 28, color: fearGreedData ? fearGreedColor(fearGreedData.rating) : t.hi, lineHeight: 1, marginBottom: 4 }}>{fearGreedData ? `${fearGreedData.score}%` : '…'}</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: fearGreedData ? fearGreedColor(fearGreedData.rating) : t.hi, marginBottom: 3 }}>{fearGreedData ? `Market is in ${fearGreedLabel(fearGreedData.rating)}` : 'Market sentiment'}</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: t.low }}><a href="https://www.cnn.com/markets/fear-and-greed" target="_blank" rel="noopener noreferrer" style={{ color: t.blue, textDecoration: 'none' }}>CNN · Fear & Greed</a></div>
          </div>

          {/* ── CAMPAIGN FINANCE (3) ── */}
          <div style={{ padding: isMobile ? '10px 10px' : '14px 14px', borderRight: `1px solid ${t.border}`, borderBottom: isMobile ? `1px solid ${t.border}` : 'none' }}>
            <div style={{ fontFamily: FONT_SERIF, fontSize: isMobile ? 22 : 28, color: t.hi, lineHeight: 1, marginBottom: 4 }}>$1.94B</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: t.hi, marginBottom: 3 }}>Candidates raised</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: t.low }}>Jan 2025–present · <a href="https://www.fec.gov/data/browse-data/?tab=raising" target="_blank" rel="noopener noreferrer" style={{ color: t.blue, textDecoration: 'none' }}>FEC</a></div>
          </div>
          <div style={{ padding: isMobile ? '10px 10px' : '14px 14px', borderRight: `1px solid ${t.border}`, borderBottom: isMobile ? `1px solid ${t.border}` : 'none' }}>
            <div style={{ fontFamily: FONT_SERIF, fontSize: isMobile ? 22 : 28, color: t.accent, lineHeight: 1, marginBottom: 4 }}>$6.48B</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: t.hi, marginBottom: 3 }}>PACs raised</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: t.low }}>Jan 2025–present · <a href="https://www.fec.gov/data/browse-data/?tab=raising" target="_blank" rel="noopener noreferrer" style={{ color: t.blue, textDecoration: 'none' }}>FEC</a></div>
          </div>
          <div style={{ padding: isMobile ? '10px 10px' : '14px 14px', borderRight: `1px solid ${t.border}`, borderBottom: isMobile ? `1px solid ${t.border}` : 'none' }}>
            <div style={{ fontFamily: FONT_SERIF, fontSize: isMobile ? 22 : 28, color: t.blue, lineHeight: 1, marginBottom: 4 }}>$1.28B</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: t.hi, marginBottom: 3 }}>Party committees raised</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: t.low }}>Jan 2025–present · <a href="https://www.fec.gov/data/browse-data/?tab=raising" target="_blank" rel="noopener noreferrer" style={{ color: t.blue, textDecoration: 'none' }}>FEC</a></div>
          </div>

          {/* ── FEDERAL SPENDING (3) ── */}
          <div style={{ padding: isMobile ? '10px 10px' : '14px 14px', borderRight: `1px solid ${t.border}`, borderBottom: isMobile ? `1px solid ${t.border}` : 'none' }}>
            <div style={{ fontFamily: FONT_SERIF, fontSize: isMobile ? 22 : 28, color: t.hi, lineHeight: 1, marginBottom: 4 }}>{conflictData ? fmtSpend(conflictData.spending?.value) : '…'}</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: t.hi, marginBottom: 3 }}>US-Iran War spending</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: t.low }}>Strikes: {conflictData ? fmtNum(conflictData.strikes?.value) : '—'} · Deaths: {conflictData ? fmtNum(conflictData.deaths?.value) : '—'} · <a href="https://meta-trials.vercel.app/us-iran-conflict" target="_blank" rel="noopener noreferrer" style={{ color: t.blue, textDecoration: 'none' }}>tracker</a></div>
          </div>
          <div style={{ padding: isMobile ? '10px 10px' : '14px 14px', borderRight: `1px solid ${t.border}`, borderBottom: isMobile ? `1px solid ${t.border}` : 'none' }}>
            <div style={{ fontFamily: FONT_SERIF, fontSize: isMobile ? 22 : 28, color: t.hi, lineHeight: 1, marginBottom: 4 }}>$3.65T</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: t.hi, marginBottom: 3 }}>Federal spending FY2026</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: t.low }}><span style={{ color: t.blue }}>+2% YoY</span> · <a href="https://fiscaldata.treasury.gov/americas-finance-guide/federal-spending/" target="_blank" rel="noopener noreferrer" style={{ color: t.blue, textDecoration: 'none' }}>US Treasury · fiscal data</a></div>
          </div>
          <div style={{ padding: isMobile ? '10px 10px' : '14px 14px', borderBottom: isMobile ? `1px solid ${t.border}` : 'none' }}>
            <div style={{ fontFamily: FONT_SERIF, fontSize: isMobile ? 22 : 28, color: t.ok, lineHeight: 1, marginBottom: 4 }}>$2.48T</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: t.hi, marginBottom: 3 }}>US Gov. Revenue FY2026</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: t.ok }}>+10% YoY · <a href="https://fiscaldata.treasury.gov/americas-finance-guide/government-revenue/" target="_blank" rel="noopener noreferrer" style={{ color: t.blue, textDecoration: 'none' }}>US Treasury · fiscal data</a></div>
          </div>
        </div>
      </div>

      {/* ── Live Intelligence Feeds ── */}
      <div data-tour="monitor-feeds">
        <Band label="LIVE INTELLIGENCE FEEDS" right="UPDATING CONTINUOUSLY" />
      <div
        ref={feedsContainerRef}
        style={{
          display: 'flex',
          alignItems: 'stretch',
          height: isMobile ? 'auto' : 620,
          border: `1px solid ${t.border}`,
          borderTop: 'none',
          overflow: 'hidden',
        }}
      >
        <div style={{ width: isMobile ? '100%' : `${splitPct}%`, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', flexShrink: 0 }}>
          <LiveNewsPanel />
        </div>

        {/* ── Draggable divider ── */}
        {!isMobile && (
          <div
            role="separator"
            aria-label="Resize panels — arrow keys or drag"
            aria-valuenow={Math.round(splitPct)}
            aria-valuemin={20}
            aria-valuemax={80}
            tabIndex={0}
            onMouseDown={handleDividerMouseDown}
            onDoubleClick={() => setSplitPct(50)}
            onKeyDown={e => {
              if (e.key === 'ArrowLeft')  { e.preventDefault(); setSplitPct(p => Math.max(20, p - 5)); }
              if (e.key === 'ArrowRight') { e.preventDefault(); setSplitPct(p => Math.min(80, p + 5)); }
              if (e.key === 'Home')       { e.preventDefault(); setSplitPct(20); }
              if (e.key === 'End')        { e.preventDefault(); setSplitPct(80); }
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSplitPct(50); }
            }}
            title="Drag to resize · ← → to adjust · Enter to reset"
            style={{
              width: 4,
              flexShrink: 0,
              cursor: 'col-resize',
              background: t.border,
              transition: 'background 0.15s',
              position: 'relative',
              zIndex: 1,
              outline: 'none',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = t.accent; }}
            onMouseLeave={e => { e.currentTarget.style.background = t.border; }}
            onFocus={e => { e.currentTarget.style.background = t.accent; }}
            onBlur={e => { e.currentTarget.style.background = t.border; }}
          />
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', borderLeft: isMobile ? 'none' : `1px solid ${t.border}` }}>
          <LiveFeedPanel />
        </div>
      </div>
      </div>

      {/* ── Map (full width, below both panels) ─────────────────────── */}
      <div data-tour="monitor-map">
        <Band label="US Geoeconomic Map" right="CLICK ANY STATE FOR PROFILE" />
        <ErrorBoundary label="Map" theme={t}>
          <Card>
            <CardTitle
              h="Infrastructure, economics, and legislation — all in one view."
              sub="Select any state to open its intelligence profile, congressional delegation, and recent legislation."
            />
            <Suspense fallback={<MapFallback t={t} />}>
              {/*
               * DeckGLMap — MapLibre GL + deck.gl WebGL map (Phase 1)
               * Falls through to USPoliticalMap (SVG) only if the ErrorBoundary catches
               * a WebGL init failure at the component level.
               *
               * Props:
               *   corruptionScores  — { stateCode: 0-100 } from FEC/corruption API
               *   gasPriceByState   — { stateCode: USD/gal } from EIA API
               *   onStateClick      — opens CorruptionDialog + fetches delegation
               *   theme             — UNREDACTED theme tokens (passed for future use)
               */}
              <DeckGLMap
                /* Phase 1 — static + choropleth */
                corruptionScores={corruptionScores}
                gasPriceByState={gasPriceByState}
                onStateClick={handleStateClick}
                theme={t}
                mapTheme="dark"
                /* Phase 2 — dynamic pipeline data (populated after bootstrap) */
                newsLocations={newsLocations}
                contributions={contributions}
                electionRaces={electionRaces}
                darkMoneyFlows={darkMoneyFlows}
                spendingFlows={spendingFlows}
                stockActTrades={stockActTrades}
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
                <div style={{ padding: '16px 0', fontFamily: FONT_MONO, fontSize: 11, color: t.mid }}>
                  Loading delegation…
                </div>
              ) : !stateReps || (stateReps.officials || []).length === 0 ? (
                <div style={{ padding: '16px 0', fontFamily: FONT_MONO, fontSize: 11, color: t.low }}>
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
                        borderTop: `3px solid ${partyColor}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          {rep.photoUrl && (
                            <img src={rep.photoUrl} alt={rep.name}
                              style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${partyColor}` }}
                              onError={e => { e.target.style.display = 'none'; }}
                            />
                          )}
                          <div>
                            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: t.hi, fontWeight: 700 }}>
                              {rep.name || `${rep.lastName}, ${rep.firstName}`}
                            </div>
                            {office && (
                              <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: t.mid, marginTop: 2 }}>{office}</div>
                            )}
                          </div>
                        </div>
                        {party && (
                          <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: partyColor, marginBottom: 5 }}>{party}</div>
                        )}
                        {(rep.urls?.length > 0 || rep.officialUrl) && (
                          <a
                            href={rep.urls?.[0] || rep.officialUrl}
                            target="_blank" rel="noopener noreferrer"
                            style={{ fontFamily: FONT_MONO, fontSize: 8, color: t.blue, textDecoration: 'none' }}
                          >
                            ↗ Official website
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
