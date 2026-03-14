import { useTheme } from '../../theme/index.js';

function Card({ children, p, style: sx }) {
  const t = useTheme();
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderTop: "none", padding: p || "18px 18px 14px", ...(sx || {}) }}>
      {children}
    </div>
  );
}

export default Card;
