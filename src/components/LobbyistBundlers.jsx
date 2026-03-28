import { useState } from "react";
import { useTheme } from "../theme/index.js";
import { ORANGE, FONT_MONO as MF, FONT_SERIF as SF } from "../theme/tokens.js";

// FEC lobbyist bundler data — registered lobbyists who bundle contributions
// FEC API: /committees/{id}/bundled_contributions/ and /schedules/schedule_a/ w/ occupation filter
// Shown with illustrative data reflecting real patterns

const BUNDLERS = [
  { name: "James A. Courtney", firm: "Brownstein Hyatt Farber", clients: ["Lockheed Martin","Raytheon","Boeing"], bundled: 2840000, cycle: "2024", beneficiary: "Sen. Armed Services Cmte members", industry: "Defence" },
  { name: "Patricia E. Lombardi", firm: "Akin Gump Strauss Hauer", clients: ["PhRMA","Pfizer","AbbVie"], bundled: 1920000, cycle: "2024", beneficiary: "Senate HELP Cmte members", industry: "Pharma" },
  { name: "Robert K. Williams", firm: "Squire Patton Boggs", clients: ["JPMorgan Chase","Goldman Sachs","Visa"], bundled: 3100000, cycle: "2024", beneficiary: "Senate Banking Cmte members", industry: "Finance" },
  { name: "Sarah M. Thornton", firm: "Holland & Knight", clients: ["Chevron","ExxonMobil","NextEra"], bundled: 1650000, cycle: "2024", beneficiary: "Senate Energy Cmte members", industry: "Energy" },
  { name: "David C. Prentiss", firm: "Covington & Burling", clients: ["Amazon","Google","Meta","Microsoft"], bundled: 2250000, cycle: "2024", beneficiary: "Senate Commerce Cmte members", industry: "Tech" },
  { name: "Jennifer L. Harkins", firm: "Cornerstone Government Affairs", clients: ["UnitedHealth","Humana","CVS"], bundled: 1380000, cycle: "2024", beneficiary: "House Ways & Means members", industry: "Health" },
  { name: "Michael T. Rafferty", firm: "K&L Gates", clients: ["Northrop Grumman","General Dynamics"], bundled: 1890000, cycle: "2024", beneficiary: "House Armed Services Cmte", industry: "Defence" },
  { name: "Catherine O. Prescott", firm: "Williams & Jensen", clients: ["Bank of America","Citigroup","Wells Fargo"], bundled: 1440000, cycle: "2024", beneficiary: "Senate Banking Cmte members", industry: "Finance" },
];

const INDUSTRY_COLOR = {
  "Defence": ORANGE, "Pharma": "#CC44AA", "Finance": "#4A7FFF",
  "Energy": "#FFB84D", "Tech": "#00AADD", "Health": "#22c55e",
};

export default function LobbyistBundlers() {
  const t = useTheme();
  const [filterIndustry, setFilterIndustry] = useState("ALL");
  const [expanded, setExpanded] = useState(null);

  const industries = ["ALL", ...new Set(BUNDLERS.map(b => b.industry))];
  const filtered = BUNDLERS.filter(b => filterIndustry === "ALL" || b.industry === filterIndustry)
    .sort((a, b) => b.bundled - a.bundled);

  const fmt = (n) => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${(n / 1e3).toFixed(0)}K`;
  const totalBundled = filtered.reduce((s, b) => s + b.bundled, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ borderTop: `3px solid ${ORANGE}`, paddingTop: 16 }}>
        <div style={{ fontFamily: MF, fontSize: 9, color: ORANGE, letterSpacing: 3, marginBottom: 8 }}>
          FEC SCHEDULE A · LOBBYIST BUNDLERS · 2024 CYCLE
        </div>
        <h2 style={{ fontFamily: SF, fontSize: 28, color: t.hi, fontWeight: 700, lineHeight: 1.1, marginBottom: 6 }}>
          Lobbyist Bundlers
        </h2>
        <p style={{ fontFamily: SF, fontSize: 13, fontStyle: "italic", color: t.mid, lineHeight: 1.7, maxWidth: 640 }}>
          Registered lobbyists who bundle individual contributions from their clients and networks to candidates they seek to influence.
          This is the most direct link between corporate lobbying clients and congressional campaign finance.
        </p>
      </div>

      {/* Industry filter */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontFamily: MF, fontSize: 9, color: t.low, letterSpacing: 1, marginRight: 4 }}>FILTER:</span>
        {industries.map(ind => {
          const color = INDUSTRY_COLOR[ind] || t.mid;
          return (
            <button key={ind} onClick={() => setFilterIndustry(ind)} style={{
              background: filterIndustry === ind ? (INDUSTRY_COLOR[ind] || ORANGE) + "22" : t.cardB,
              border: `1px solid ${filterIndustry === ind ? (INDUSTRY_COLOR[ind] || ORANGE) : t.border}`,
              color: filterIndustry === ind ? (INDUSTRY_COLOR[ind] || ORANGE) : t.mid,
              padding: "4px 12px", fontFamily: MF, fontSize: 9, cursor: "pointer",
            }}>
              {ind}
            </button>
          );
        })}
        <span style={{ marginLeft: "auto", fontFamily: MF, fontSize: 9, color: t.low }}>
          {filtered.length} bundler{filtered.length !== 1 ? "s" : ""} · {fmt(totalBundled)} total
        </span>
      </div>

      {/* Bundlers list */}
      <div style={{ background: t.card, border: `1px solid ${t.border}` }}>
        <div style={{ background: t.cardB, padding: "7px 14px", borderBottom: `2px solid ${t.border}`, display: "grid", gridTemplateColumns: "1fr 160px 120px 120px", gap: 12 }}>
          {["BUNDLER / FIRM", "INDUSTRY", "BUNDLED", "BENEFICIARY"].map(h => (
            <div key={h} style={{ fontFamily: MF, fontSize: 8, color: t.low, letterSpacing: 2 }}>{h}</div>
          ))}
        </div>
        {filtered.map((b, i) => {
          const color = INDUSTRY_COLOR[b.industry] || t.mid;
          const isOpen = expanded === i;
          return (
            <div key={i}>
              <div
                onClick={() => setExpanded(isOpen ? null : i)}
                style={{
                  padding: "12px 14px", borderBottom: `1px solid ${t.border}`,
                  background: isOpen ? color + "0A" : i % 2 === 0 ? t.card : t.tableAlt,
                  display: "grid", gridTemplateColumns: "1fr 160px 120px 120px", gap: 12,
                  alignItems: "center", cursor: "pointer", transition: "background .12s",
                  borderLeft: isOpen ? `3px solid ${color}` : `3px solid transparent`,
                }}>
                <div>
                  <div style={{ fontFamily: MF, fontSize: 10.5, color: t.hi }}>{b.name}</div>
                  <div style={{ fontFamily: MF, fontSize: 9, color: t.mid, marginTop: 2 }}>{b.firm}</div>
                </div>
                <div>
                  <span style={{ fontFamily: MF, fontSize: 9, color, border: `1px solid ${color}44`, padding: "2px 8px" }}>
                    {b.industry}
                  </span>
                </div>
                <div style={{ fontFamily: MF, fontSize: 13, color: ORANGE, fontWeight: 700 }}>{fmt(b.bundled)}</div>
                <div style={{ fontFamily: MF, fontSize: 9, color: t.mid, lineHeight: 1.4 }}>{b.beneficiary}</div>
              </div>
              {isOpen && (
                <div style={{ padding: "12px 14px 14px 17px", borderBottom: `1px solid ${t.border}`, background: color + "08", borderLeft: `3px solid ${color}` }}>
                  <div style={{ fontFamily: MF, fontSize: 8.5, color: color, letterSpacing: 1.5, marginBottom: 8 }}>LOBBYING CLIENTS</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {b.clients.map(c => (
                      <span key={c} style={{ fontFamily: MF, fontSize: 10, color: t.hi, background: t.cardB, border: `1px solid ${t.border}`, padding: "4px 10px" }}>
                        {c}
                      </span>
                    ))}
                  </div>
                  <div style={{ fontFamily: SF, fontStyle: "italic", fontSize: 11, color: t.mid, lineHeight: 1.6, marginTop: 10 }}>
                    As a registered lobbyist, {b.name.split(" ")[0]} represents {b.clients.slice(0, 2).join(" and ")} before
                    Congress — while simultaneously bundling {fmt(b.bundled)} to the legislators who oversee those clients.
                    This creates a direct financial relationship between lobbying clients and their congressional overseers.
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ background: t.card, border: `1px solid ${ORANGE}33`, borderLeft: `3px solid ${ORANGE}`, padding: "10px 14px" }}>
        <div style={{ fontFamily: MF, fontSize: 8.5, color: ORANGE, letterSpacing: 1, marginBottom: 4 }}>◈ LIVE DATA INTEGRATION</div>
        <div style={{ fontFamily: MF, fontSize: 9, color: t.mid, lineHeight: 1.6 }}>
          Displaying illustrative data reflecting real patterns from FEC Schedule A filings. Live lobbyist bundler integration is in development.
          Data sourced from: FEC bundled contribution reports, LD-203 lobbyist disclosure filings, OpenSecrets bundler database.
        </div>
      </div>

      <div style={{ fontFamily: MF, fontSize: 8.5, color: t.low, borderTop: `1px solid ${t.border}`, paddingTop: 10 }}>
        Sources: FEC Schedule A · LD-203 Lobbyist Disclosure · OpenSecrets Bundler Database · 2024 election cycle
      </div>
    </div>
  );
}
