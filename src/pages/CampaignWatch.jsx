/**
 * Campaign Watch - 2026 Election Map
 * Interactive US map with infrastructure layers and corruption dialog
 * Following World Monitor's Map.ts pattern with in-map controls
 */

import React, { useState } from 'react';
import { useTheme } from '../theme/index.js';
import { Card, Band, CardTitle } from '../components/ui/index.js';
import USPoliticalMap from '../components/USPoliticalMap';
import CorruptionDialog from '../components/CorruptionDialog';
import { DATA_CENTERS } from '../data/geo';

// ── Mock data (bypasses API for immediate display) ──────────────────────────

const MOCK_STATS = {
  totalRaised: 47800000,
  totalCandidates: 142,
  avgCorruption: 34,
};

const MOCK_CORRUPTION_DATA = [
  { stateCode: 'TX', name: 'Texas',          corruptionIndex: 34, darkMoneyExposure: 18200000 },
  { stateCode: 'FL', name: 'Florida',         corruptionIndex: 38, darkMoneyExposure: 15200000 },
  { stateCode: 'CA', name: 'California',      corruptionIndex: 42, darkMoneyExposure: 19800000 },
  { stateCode: 'NY', name: 'New York',        corruptionIndex: 45, darkMoneyExposure: 17200000 },
  { stateCode: 'IL', name: 'Illinois',        corruptionIndex: 48, darkMoneyExposure: 14200000 },
  { stateCode: 'PA', name: 'Pennsylvania',    corruptionIndex: 52, darkMoneyExposure: 13200000 },
  { stateCode: 'OH', name: 'Ohio',            corruptionIndex: 55, darkMoneyExposure: 12200000 },
  { stateCode: 'GA', name: 'Georgia',         corruptionIndex: 58, darkMoneyExposure: 11200000 },
  { stateCode: 'NC', name: 'North Carolina',  corruptionIndex: 62, darkMoneyExposure: 10200000 },
  { stateCode: 'VA', name: 'Virginia',        corruptionIndex: 65, darkMoneyExposure:  9200000 },
];

const STATE_NAMES = {
  TX: 'Texas', CA: 'California', FL: 'Florida', NY: 'New York',
  IL: 'Illinois', PA: 'Pennsylvania', OH: 'Ohio', GA: 'Georgia',
  NC: 'North Carolina', VA: 'Virginia', AZ: 'Arizona', WA: 'Washington',
  CO: 'Colorado', MA: 'Massachusetts', TN: 'Tennessee', MI: 'Michigan',
  MN: 'Minnesota', NJ: 'New Jersey', WI: 'Wisconsin', MO: 'Missouri',
};

// ── Component ────────────────────────────────────────────────────────────────

const CampaignWatch = () => {
  const t = useTheme();
  const [selectedState, setSelectedState] = useState(null);
  const [dialogPosition, setDialogPosition] = useState({ x: 120, y: 120 });
  const [dialogVisible, setDialogVisible] = useState(false);

  const handleStateClick = (stateCode) => {
    setSelectedState(stateCode);
    setDialogVisible(true);
    setDialogPosition({
      x: Math.min(window.innerWidth  - 420, 120 + Math.random() * 180),
      y: Math.min(window.innerHeight - 620, 120 + Math.random() * 180),
    });
  };

  const handleCloseDialog = () => setDialogVisible(false);

  const stateName = selectedState
    ? (STATE_NAMES[selectedState] || selectedState)
    : '';

  const fmtM = n => `$${(n / 1e6).toFixed(1)}M`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* ── KPI row ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        borderTop: `1px solid ${t.border}`,
        borderBottom: `1px solid ${t.border}`,
      }}>
        {[
          { v: fmtM(MOCK_STATS.totalRaised), d: '2026 total raised',        s: 'FEC · current cycle' },
          { v: MOCK_STATS.totalCandidates,   d: 'Candidates tracked',        s: 'All federal races' },
          { v: MOCK_STATS.avgCorruption,     d: 'Avg corruption index',      s: 'Lower = more corrupt' },
          { v: DATA_CENTERS.length,          d: 'Data centers mapped',       s: 'Infrastructure layer' },
        ].map((k, i) => (
          <div key={i} style={{ padding: '18px 20px', borderRight: `1px solid ${t.border}` }}>
            <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 32, color: t.kpiNum, lineHeight: 1, marginBottom: 5 }}>{k.v}</div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: t.hi, marginBottom: 3 }}>{k.d}</div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: t.low }}>{k.s}</div>
          </div>
        ))}
      </div>

      {/* ── Map ── */}
      <div>
        <Band label="US Political Accountability Map — 2026 Election" right="CLICK ANY STATE FOR PROFILE" />
        <Card>
          <CardTitle
            h="Infrastructure, economics, and political accountability — all in one view."
            sub="Layer toggles inside the map. Click any state to open its corruption profile."
          />
          <USPoliticalMap onStateClick={handleStateClick} theme={t} />
        </Card>
      </div>

      {/* ── Corruption rankings ── */}
      <div>
        <Band label="Corruption index rankings" right="LOWER SCORE = HIGHER RISK" />
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {MOCK_CORRUPTION_DATA.map(state => {
              const color =
                state.corruptionIndex < 40 ? t.warn  :
                state.corruptionIndex < 55 ? t.accent :
                state.corruptionIndex < 70 ? t.ok    : t.blue;
              return (
                <div
                  key={state.stateCode}
                  onClick={() => handleStateClick(state.stateCode)}
                  style={{
                    padding: 12,
                    background: t.cardB || t.ink,
                    border: `1px solid ${t.border}`,
                    borderLeft: `4px solid ${color}`,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: t.hi, fontWeight: 700 }}>{state.stateCode}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 14, fontWeight: 700, color }}>{state.corruptionIndex}</span>
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: t.mid, marginTop: 4 }}>{state.name}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: t.low, marginTop: 4 }}>
                    {fmtM(state.darkMoneyExposure)} dark $
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ── Floating corruption dialog ── */}
      {dialogVisible && selectedState && (
        <CorruptionDialog
          stateCode={selectedState}
          stateName={stateName}
          position={dialogPosition}
          onClose={handleCloseDialog}
          theme={t}
        />
      )}
    </div>
  );
};

export default CampaignWatch;
