import { useTheme } from '../../theme/index.js';

function Legend({ items }) {
  const t = useTheme();
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 9 }}>
      {items.map(([l, c, d]) => (
        <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width={20} height={5}><line x1={0} y1={2.5} x2={20} y2={2.5} stroke={c} strokeWidth={d ? 1.5 : 2.5} strokeDasharray={d ? "5 3" : "none"} /></svg>
          <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, color: t.mid }}>{l}</span>
        </div>
      ))}
    </div>
  );
}

export default Legend;
