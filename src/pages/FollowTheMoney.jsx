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

import { useState, useEffect } from "react";
import { useTheme } from "../theme/index.js";
import { ORANGE, FONT_MONO as MF, FONT_SERIF as SF } from "../theme/tokens.js";
import { useMobile } from "../hooks/useMediaQuery.js";
import { useTutorial } from "../features/tutorial/TutorialProvider.jsx";
import { STEPS } from "../features/tutorial/steps.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import PageSidebar from "../components/ui/PageSidebar.jsx";
import CoachMark from "../features/tutorial/CoachMark.jsx";
import DarkMoneyTracker from "../components/DarkMoneyTracker.jsx";
import LobbyistBundlers from "../components/LobbyistBundlers.jsx";
import IndependentExpenditures from "../components/IndependentExpenditures.jsx";
import EmployerLeaderboard from "../components/EmployerLeaderboard.jsx";
import CorporatePACFlow from "../components/CorporatePACFlow.jsx";
import CashFloodAnomalies from "../components/CashFloodAnomalies.jsx";

const SUBTABS = [
  { id: "intel",     label: "Donor Intelligence", coachMarkId: "donor-intel-explainer"               },
  { id: "flow",      label: "Money Flow",          badge: "NEW", coachMarkId: "money-flow-explainer"  },
  { id: "darkmoney", label: "Dark Money",           coachMarkId: "dark-money-explainer"               },
  // { id: "anomalies", label: "Cash Flood",           badge: "NEW" },  // not ready
  // { id: "web",       label: "Donor Web"                        },  // not ready
  // { id: "bundlers",  label: "Lobbyist Bundlers",   badge: "NEW" },  // not ready
  // { id: "ie",        label: "Indep. Expenditures", badge: "NEW" },  // not ready
  { id: "corpacs",   label: "Corporate PACs",      badge: "NEW", coachMarkId: "corp-pacs-explainer"   },
];

const GATED_TABS = new Set(["flow", "darkmoney", "corpacs"]);

function AuthGate({ tabLabel, onSignIn }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "60px 24px", textAlign: "center",
    }}>
      <div style={{ fontSize: 36, marginBottom: 16, color: ORANGE }}>◈</div>
      <div style={{ fontFamily: SF, fontSize: 22, color: "#FFFFFF", marginBottom: 10 }}>
        {tabLabel}
      </div>
      <p style={{ fontFamily: MF, fontSize: 11, color: "rgba(255,255,255,0.7)", lineHeight: 1.75, maxWidth: 400, marginBottom: 28 }}>
        Create a free account to access this feature and explore the full depth of campaign finance data.
      </p>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", marginBottom: 28 }}>
        {[
          ["◈", "FEC bulk data — all cycles"],
          ["⊗", "PAC & dark money networks"],
          ["⟳", "Live updates from filings"],
        ].map(([icon, text]) => (
          <div key={text} style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
            padding: "12px 16px", fontFamily: MF, fontSize: 10, color: "rgba(255,255,255,0.75)",
            display: "flex", alignItems: "center", gap: 8, maxWidth: 180,
          }}>
            <span style={{ color: ORANGE }}>{icon}</span> {text}
          </div>
        ))}
      </div>
      <button
        onClick={onSignIn}
        style={{
          background: ORANGE, border: "none", color: "#FFFFFF",
          fontFamily: MF, fontSize: 11, letterSpacing: 1.5,
          padding: "12px 28px", cursor: "pointer",
        }}
      >
        SIGN IN / CREATE ACCOUNT
      </button>
    </div>
  );
}

export default function FollowTheMoney({ DonorIntel, DonorWeb, theme, onSignInRequest }) {
  const t = useTheme();
  const isMobile = useMobile();
  const [sub, setSub] = useState("intel");
  const { phase, currentStep } = useTutorial();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (phase !== 'tour-running') return;
    const stepId = STEPS[currentStep]?.id;
    const subMap = {
      'donor-intel': 'intel',
      'money-flow':  'flow',
      'dark-money':  'darkmoney',
      'corp-pacs':   'corpacs',
    };
    const target = subMap[stepId];
    if (target) setSub(target);
  }, [phase, currentStep]);

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: 0, height: "100%" }}>
      <PageSidebar tabs={SUBTABS} active={sub} onChange={setSub} isMobile={isMobile} />
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: 14 }}>

      {GATED_TABS.has(sub) && !isAuthenticated
        ? <AuthGate tabLabel={SUBTABS.find(t => t.id === sub)?.label} onSignIn={onSignInRequest || (() => {})} />
        : <>
            {sub === "flow"      && <EmployerLeaderboard />}
            {sub === "intel"     && DonorIntel && <DonorIntel />}
            {sub === "darkmoney" && <DarkMoneyTracker />}
            {sub === "anomalies" && <CashFloodAnomalies />}
            {sub === "web"       && DonorWeb && <DonorWeb />}
            {sub === "bundlers"  && <LobbyistBundlers />}
            {sub === "ie"        && <IndependentExpenditures />}
            {sub === "corpacs"   && <CorporatePACFlow />}
          </>
      }
        </div>
      </div>
    </div>
  );
}
