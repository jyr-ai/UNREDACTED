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
import { useMobile } from "../hooks/useMediaQuery.js";
import PageSidebar from "../components/ui/PageSidebar.jsx";
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

export default function Accountability({ onSignInRequest }) {
  const t = useTheme();
  const isMobile = useMobile();
  const [sub, setSub] = useState("accountability");

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: 0, height: "100%" }}>
      <PageSidebar tabs={SUBTABS} active={sub} onChange={setSub} isMobile={isMobile} />
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: 14 }}>
          {sub === "accountability" && <AccountabilityIndex />}
          {sub === "stockact"       && <StockActMonitor />}
          {sub === "vote_donor"     && <VoteDonorAlignment />}
          {sub === "watchlist"      && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
              <FindYourRep />
              <Watchlist onSignInRequest={onSignInRequest} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
