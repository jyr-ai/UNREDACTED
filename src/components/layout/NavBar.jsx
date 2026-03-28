import { useTheme } from '../../theme/index.js';

function NavBar({ active, onSelect }) {
  const t = useTheme();
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'policy', label: 'Policy' },
    { id: 'spending', label: 'Spending' },
    { id: 'donation', label: 'Donation' },
    { id: 'corruptionwatch', label: 'Corruption Watch' },
  ];
  return (
    <div style={{ background: t.navBg, borderBottom: `1px solid ${t.border}`, display: "flex" }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          style={{
            flex: 1,
            padding: "12px 0",
            background: active === tab.id ? t.card : "transparent",
            border: "none",
            borderBottom: active === tab.id ? `2px solid ${t.accent}` : "none",
            fontFamily: "'Roboto', sans-serif",
            fontSize: 15,
            color: active === tab.id ? t.hi : t.mid,
            letterSpacing: 1,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default NavBar;
