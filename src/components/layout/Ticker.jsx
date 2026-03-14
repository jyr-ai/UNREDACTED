import { useTheme } from '../../theme/index.js';

function Ticker() {
  const t = useTheme();
  const items = [
    "STOCK Act violations up 40% this quarter",
    "New $5.1B defense contract awarded to Raytheon",
    "Sen. Hughes receives $2.8M from defense PACs",
    "Dark‑money spending hits record $1.2B in 2024",
    "Federal Register: 17 new regulations this week",
    "DoD budget exceeds $1T for first time",
  ];
  return (
    <div style={{ background: t.tickerBg, borderBottom: `1px solid ${t.border}`, padding: "6px 18px", overflow: "hidden" }}>
      <div style={{ display: "flex", animation: "ticker 30s linear infinite", whiteSpace: "nowrap" }}>
        {items.map((txt, i) => (
          <div key={i} style={{ display: "inline-flex", alignItems: "center", marginRight: 40 }}>
            <span style={{ fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 9, color: t.tickerTx, letterSpacing: 1 }}>{txt}</span>
            <svg width={8} height={8} style={{ marginLeft: 20 }}><circle cx={4} cy={4} r={2} fill={t.tickerTx} /></svg>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

export default Ticker;
