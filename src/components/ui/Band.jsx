import { useTheme } from '../../theme/index.js';
import { FONT_MONO } from '../../theme/tokens.js';

function Band({ label, right, color }) {
  const t = useTheme();
  return (
    <div style={{ background: color || t.band, padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: t.bandText, letterSpacing: 2 }}>{label.toUpperCase()}</span>
      {right && <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: "rgba(255,255,255,.55)", letterSpacing: 1 }}>{right}</span>}
    </div>
  );
}

export default Band;
