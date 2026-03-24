import { useTheme } from '../../theme/index.js';

function ChartTooltip({ active, payload, label, fmt }) {
  const t = useTheme();
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: t.ink, border: `1px solid ${t.border}`, borderLeft: `3px solid ${t.accent}`, padding: "8px 12px", fontFamily: "'Roboto', sans-serif" }}>
      <div style={{ fontSize: 9, color: t.mid, letterSpacing: 1, marginBottom: 5 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 11, color: t.hi, marginBottom: 2 }}>
          <span style={{ color: p.color || t.mid, marginRight: 5, fontSize: 8 }}>■</span>
          {p.name}:&ensp;<span style={{ color: t.accent }}>{fmt ? fmt(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default ChartTooltip;
