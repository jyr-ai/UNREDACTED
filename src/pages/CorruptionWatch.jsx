import { useState } from "react";
import { useTheme } from "../theme/index.js";
import { ORANGE, FONT_MONO as MF, FONT_SERIF as SF } from "../theme/tokens.js";
import AccountabilityIndex from "../components/AccountabilityIndex.jsx";
import StockActMonitor from "../components/StockActMonitor.jsx";
import DarkMoneyTracker from "../components/DarkMoneyTracker.jsx";

const SUBTABS = [
  { id: "accountability", label: "Accountability Index" },
  { id: "stockact",       label: "STOCK Act Monitor"   },
  { id: "darkmoney",      label: "Dark Money"           },
];

export default function CorruptionWatch() {
  const t = useTheme();
  const [sub, setSub] = useState("accountability");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* ── Editorial header ─────────────────────────────────── */}
      <div style={{ borderTop: `3px solid ${ORANGE}`, paddingTop: 16 }}>
        <div style={{ fontFamily: MF, fontSize: 9, color: ORANGE, letterSpacing: 3, marginBottom: 8 }}>
          CORRUPTION SIGNALS · FEC · STOCK ACT · DARK MONEY
        </div>
        <h2 style={{ fontFamily: SF, fontSize: 32, color: t.hi, fontWeight: 700, lineHeight: 1.1, marginBottom: 8 }}>
          Corruption Watch
        </h2>
        <p style={{ fontFamily: SF, fontSize: 14, fontStyle: "italic", color: t.mid, lineHeight: 1.7, maxWidth: 640 }}>
          Politician accountability scores, congressional stock-trade disclosures, and dark money network traces —
          the full corruption signals layer across FEC filings and House &amp; Senate disclosure portals.
        </p>
      </div>

      {/* ── Sub-tab navigation ───────────────────────────────── */}
      <div style={{ display: "flex", borderBottom: `1px solid ${t.border}` }}>
        {SUBTABS.map(st => (
          <button
            key={st.id}
            onClick={() => setSub(st.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "10px 20px",
              fontFamily: MF,
              fontSize: 10.5,
              letterSpacing: 0.5,
              color: sub === st.id ? ORANGE : t.mid,
              borderBottom: `3px solid ${sub === st.id ? ORANGE : "transparent"}`,
              marginBottom: -1,
              transition: "all .14s",
            }}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* ── Sub-tab content ──────────────────────────────────── */}
      {sub === "accountability" && <AccountabilityIndex />}
      {sub === "stockact"       && <StockActMonitor />}
      {sub === "darkmoney"      && <DarkMoneyTracker />}
    </div>
  );
}
