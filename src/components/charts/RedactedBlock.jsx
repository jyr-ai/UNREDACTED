import { useState } from 'react';
import { useTheme } from '../../theme/index.js';

function RedactedBlock({ children, w }) {
  const t = useTheme();
  const [on, setOn] = useState(false);
  return (
    <span onMouseEnter={() => setOn(true)} onMouseLeave={() => setOn(false)} title="hover to reveal"
      style={{ position: "relative", display: "inline-block", minWidth: w || "80px", cursor: "pointer" }}>
      <span style={{ opacity: on ? 1 : 0, transition: "opacity .18s", userSelect: on ? "text" : "none" }}>{children}</span>
      {!on && (
        <span style={{ position: "absolute", inset: "0 0 -1px 0", background: t.redactBg, border: `1px solid ${t.border}`, display: "flex", alignItems: "center", padding: "0 3px" }}>
          <span style={{ display: "block", width: "100%", height: 8, background: `repeating-linear-gradient(90deg,${t.redactSt})` }}/>
        </span>
      )}
    </span>
  );
}

export default RedactedBlock;
