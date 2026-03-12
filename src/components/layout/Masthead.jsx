import { useTheme } from '../../theme/index.js';

function Masthead() {
  const t = useTheme();
  return (
    <div style={{ background: t.navBg, borderBottom: `1px solid ${t.border}`, padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={t.hi} strokeWidth={2}>
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
        <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 18, color: t.hi }}>UNREDACTED</div>
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 9, color: t.mid, letterSpacing: 1 }}>
        <span style={{ color: t.accent }}>LIVE</span> &nbsp;|&nbsp; 03‑12‑2026 &nbsp;|&nbsp; 01:17 EST
      </div>
    </div>
  );
}

export default Masthead;
