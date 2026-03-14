import { useTheme } from '../../theme/index.js';

function Band({ label, right, color }) {
  const t = useTheme();
  return (
    <div style={{ background: color || t.band, padding: "7px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 9, color: t.bandText, letterSpacing: 2 }}>{label.toUpperCase()}</span>
      {right && <span style={{ fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,.45)", letterSpacing: 1 }}>{right}</span>}
    </div>
  );
}

export default Band;
