import { useTheme } from '../../theme/index.js';
import { FONT_MONO } from '../../theme/tokens.js';

function SourceFooter({ s }) {
  const t = useTheme();
  return <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${t.border}`, fontFamily: FONT_MONO, fontSize: 8.5, color: t.low }}>Sources: {s}</div>;
}

export default SourceFooter;
