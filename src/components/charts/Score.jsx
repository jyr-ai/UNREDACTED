import { useTheme } from '../../theme/index.js';

function Score({ v }) {
  const t = useTheme();
  const c = v < 35 ? t.risk : v < 55 ? t.warn : t.ok;
  const l = v < 35 ? "CRITICAL" : v < 55 ? "HIGH" : v < 70 ? "MED" : "CLEAN";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", border: `2px solid ${c}`, background: c + "18", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Roboto', sans-serif", fontSize: 11, color: c, fontWeight: 700, boxShadow: `0 0 10px ${c}28` }}>{v}</div>
      <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 7.5, color: c, letterSpacing: 1.5 }}>{l}</span>
    </div>
  );
}

export default Score;
