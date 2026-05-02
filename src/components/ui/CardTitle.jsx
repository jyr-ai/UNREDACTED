import { useTheme } from '../../theme/index.js';
import { FONT_MONO } from '../../theme/tokens.js';

function CardTitle({ h, sub }) {
  const t = useTheme();
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 19.5, color: t.hi, lineHeight: 1.35, marginBottom: 4 }}>{h}</div>
      {sub && <div style={{ fontFamily: FONT_MONO, fontSize: 14, color: t.mid }}>{sub}</div>}
    </div>
  );
}

export default CardTitle;
