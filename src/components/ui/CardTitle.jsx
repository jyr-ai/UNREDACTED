import { useTheme } from '../../theme/index.js';

function CardTitle({ h, sub }) {
  const t = useTheme();
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 14.5, color: t.hi, lineHeight: 1.35, marginBottom: 4 }}>{h}</div>
      {sub && <div style={{ fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 9, color: t.mid }}>{sub}</div>}
    </div>
  );
}

export default CardTitle;
