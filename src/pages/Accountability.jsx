/**
 * Accountability — consolidated corruption & ethics monitoring tab
 *
 * Replaces Corruption Watch with Dark Money removed (it lives in Follow the Money now):
 * - Accountability Index (politician leaderboard)
 * - STOCK Act Monitor (live PTR filings)
 * - Vote ↔ Donor Alignment (NEW — cross-source conflict detection)
 * - My Watchlist (user's saved list, Supabase real-time)
 */

import { useState } from "react";
import { useTheme } from "../theme/index.js";
import { ORANGE, FONT_MONO as MF, FONT_SERIF as SF } from "../theme/tokens.js";
import AccountabilityIndex from "../components/AccountabilityIndex.jsx";
import StockActMonitor from "../components/StockActMonitor.jsx";
import Watchlist from "../components/Watchlist.jsx";
import VoteDonorAlignment from "../components/VoteDonorAlignment.jsx";
import FindYourRep from "../components/FindYourRep.jsx";

const SUBTABS = [
  { id: "accountability", label: "Accountability Index" },
  { id: "stockact",       label: "STOCK Act Monitor"   },
  { id: "vote_donor",     label: "Vote ↔ Donor",  badge: "NEW" },
  { id: "watchlist",      label: "My Watchlist"         },
];

function SubTabBar({ tabs, active, onChange }) {
  const t = useTheme();
  return (
    <div style={{ display: "flex", borderBottom: `1px solid ${t.border}`, flexWrap: "wrap" }}>
      {tabs.map(st => (
        <button key={st.id} onClick={() => onChange(st.id)} style={{
          background: "none", border: "none", cursor: "pointer",
          padding: "10px 18px", fontFamily: MF, fontSize: 10.5, letterSpacing: 0.5,
          color: active === st.id ? ORANGE : t.mid,
          borderBottom: `3px solid ${active === st.id ? ORANGE : "transparent"}`,
          marginBottom: -1, transition: "all .14s", whiteSpace: "nowrap",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          {st.label}
          {st.badge && (
            <span style={{ background: "#00CC6622", border: "1px solid #00CC6644", color: "#00CC66", fontSize: 7, padding: "1px 4px", borderRadius: 2, fontWeight: 700 }}>
              {st.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default function Accountability({ onSignInRequest }) {
  const t = useTheme();
  const [sub, setSub] = useState("accountability");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Editorial header */}
      <div style={{ borderTop: `3px solid ${ORANGE}`, paddingTop: 16 }}>
        <div style={{ fontFamily: MF, fontSize: 9, color: ORANGE, letterSpacing: 3, marginBottom: 8 }}>
          CORRUPTION SIGNALS · FEC · STOCK ACT · VOTE RECORDS · WATCHLIST
        </div>
        <h2 style={{ fontFamily: SF, fontSize: 32, color: t.hi, fontWeight: 700, lineHeight: 1.1, marginBottom: 8 }}>
          Accountability
        </h2>
        <p style={{ fontFamily: SF, fontSize: 14, fontStyle: "italic", color: t.mid, lineHeight: 1.7, maxWidth: 640 }}>
          Politician accountability scores, congressional stock-trade disclosures, vote-to-donor conflict analysis,
          and your personal watchlist — the full corruption signals layer.
        </p>
      </div>

      <SubTabBar tabs={SUBTABS} active={sub} onChange={setSub} />

      {sub === "accountability" && <AccountabilityIndex />}
      {sub === "stockact"       && <StockActMonitor />}
      {sub === "vote_donor"     && <VoteDonorAlignment />}
      {sub === "watchlist"      && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, alignItems: "start" }}>
          <FindYourRep />
          <Watchlist onSignInRequest={onSignInRequest} />
        </div>
      )}
    </div>
  );
}
