import { useTheme } from '../../theme/index.js';

function SourceFooter({ s }) {
  const t = useTheme();
  return <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${t.border}`, fontFamily: "'Roboto', sans-serif", fontSize: 8.5, color: t.low }}>Sources: {s}</div>;
}

export default SourceFooter;
