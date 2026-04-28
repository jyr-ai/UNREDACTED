/**
 * Follow the Money — canonical campaign finance intelligence tab
 *
 * Consolidates all donor/money features:
 * - Donor Intelligence  (top donors, politician profiles) — via DonorIntel prop
 * - Dark Money Tracker  (single canonical location — removed from Corruption Watch)
 * - Donor Web           (entity relationship graph) — via DonorWeb prop
 * - Lobbyist Bundlers   (NEW — FEC Schedule A + LD-203)
 * - Independent Expenditures (NEW — FEC Schedule E 24/48-hr reports)
 *
 * DonorIntel and DonorWeb are passed as component props from App.jsx to avoid
 * circular dependencies (both are defined inline in App.jsx).
 */

import { useState } from "react";
import { useTheme } from "../theme/index.js";
import { ORANGE, FONT_MONO as MF, FONT_SERIF as SF } from "../theme/tokens.js";
import { useMobile } from "../hooks/useMediaQuery.js";
import PageSidebar from "../components/ui/PageSidebar.jsx";
import DarkMoneyTracker from "../components/DarkMoneyTracker.jsx";
import LobbyistBundlers from "../components/LobbyistBundlers.jsx";
import IndependentExpenditures from "../components/IndependentExpenditures.jsx";
import EmployerLeaderboard from "../components/EmployerLeaderboard.jsx";
import CorporatePACFlow from "../components/CorporatePACFlow.jsx";
import CashFloodAnomalies from "../components/CashFloodAnomalies.jsx";

const SUBTABS = [
  { id: "flow",      label: "Money Flow",          badge: "NEW" },
  { id: "intel",     label: "Donor Intelligence"               },
  { id: "darkmoney", label: "Dark Money"                       },
  // { id: "anomalies", label: "Cash Flood",           badge: "NEW" },  // not ready
  // { id: "web",       label: "Donor Web"                        },  // not ready
  // { id: "bundlers",  label: "Lobbyist Bundlers",   badge: "NEW" },  // not ready
  // { id: "ie",        label: "Indep. Expenditures", badge: "NEW" },  // not ready
  { id: "corpacs",   label: "Corporate PACs",      badge: "NEW" },
];

export default function FollowTheMoney({ DonorIntel, DonorWeb, theme }) {
  const t = useTheme();
  const isMobile = useMobile();
  const [sub, setSub] = useState("flow");

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: 0, height: "100%" }}>
      <PageSidebar tabs={SUBTABS} active={sub} onChange={setSub} isMobile={isMobile} />
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: 14 }}>

      {sub === "flow"      && <EmployerLeaderboard />}
      {sub === "intel"     && DonorIntel && <DonorIntel />}
      {sub === "darkmoney" && <DarkMoneyTracker />}
      {sub === "anomalies" && <CashFloodAnomalies />}
      {sub === "web"       && DonorWeb && <DonorWeb />}
      {sub === "bundlers"  && <LobbyistBundlers />}
      {sub === "ie"        && <IndependentExpenditures />}
      {sub === "corpacs"   && <CorporatePACFlow />}
        </div>
      </div>
    </div>
  );
}
