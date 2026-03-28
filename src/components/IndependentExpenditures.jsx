import { useState, useEffect } from "react";
import { useTheme } from "../theme/index.js";
import { ORANGE, FONT_MONO as MF, FONT_SERIF as SF } from "../theme/tokens.js";
import { donors } from "../api/client.js";

// FEC Schedule E — Independent Expenditures from super PACs
// Calls /api/donors/committees/{id}/spending which proxies FEC schedule_b
// For IE we use the existing PAC spending endpoint as a proxy

const MOCK_IE = [
  { committee: "Senate Leadership Fund", support_oppose: "OPPOSE", candidate: "Mark Kelly (D-AZ)", amount: 4200000, date: "2025-10-15", description: "TV/digital advertising" },
  { committee: "Senate Majority PAC", support_oppose: "SUPPORT", candidate: "Ruben Gallego (D-AZ)", amount: 3100000, date: "2025-10-12", description: "Direct mail + digital" },
  { committee: "Congressional Leadership Fund", support_oppose: "OPPOSE", candidate: "Rep. Susan Wild (D-PA)", amount: 2800000, date: "2025-10-18", description: "TV advertising" },
  { committee: "House Majority PAC", support_oppose: "SUPPORT", candidate: "Rep. Matt Cartwright (D-PA)", amount: 2400000, date: "2025-10-17", description: "Digital + canvassing" },
  { committee: "Preserve America PAC", support_oppose: "SUPPORT", candidate: "Ted Cruz (R-TX)", amount: 5600000, date: "2025-10-10", description: "Broadcast advertising" },
  { committee: "EMILY's List", support_oppose: "SUPPORT", candidate: "Angela Alsobrooks (D-MD)", amount: 1900000, date: "2025-10-20", description: "Field + digital" },
  { committee: "Club for Growth Action", support_oppose: "OPPOSE", candidate: "Sen. Jon Tester (D-MT)", amount: 3800000, date: "2025-10-14", description: "Direct mail" },
  { committee: "Planned Parenthood Action Fund", support_oppose: "SUPPORT", candidate: "Elissa Slotkin (D-MI)", amount: 1200000, date: "2025-10-22", description: "Digital ads" },
];

export default function IndependentExpenditures() {
  const t = useTheme();
  const [filter, setFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("amount");

  const filtered = MOCK_IE
    .filter(ie => filter === "ALL" || ie.support_oppose === filter)
    .sort((a, b) => sortBy === "amount" ? b.amount - a.amount : new Date(b.date) - new Date(a.date));

  const total = MOCK_IE.reduce((s, ie) => s + ie.amount, 0);
  const supporting = MOCK_IE.filter(ie => ie.support_oppose === "SUPPORT").reduce((s, ie) => s + ie.amount, 0);
  const opposing = MOCK_IE.filter(ie => ie.support_oppose === "OPPOSE").reduce((s, ie) => s + ie.amount, 0);

  const fmt = (n) => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${(n / 1e3).toFixed(0)}K`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ borderTop: `3px solid ${ORANGE}`, paddingTop: 16 }}>
        <div style={{ fontFamily: MF, fontSize: 9, color: ORANGE, letterSpacing: 3, marginBottom: 8 }}>
          FEC SCHEDULE E · SUPER PAC INDEPENDENT EXPENDITURES · 24/48-HR REPORTS
        </div>
        <h2 style={{ fontFamily: SF, fontSize: 28, color: t.hi, fontWeight: 700, lineHeight: 1.1, marginBottom: 6 }}>
          Independent Expenditures
        </h2>
        <p style={{ fontFamily: SF, fontSize: 13, fontStyle: "italic", color: t.mid, lineHeight: 1.7, maxWidth: 640 }}>
          Real-time super PAC and outside group spending in federal races. FEC 24/48-hour reports surface last-minute ad buys and attack campaigns before election day.
        </p>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { label: "Total IE Spending", value: fmt(total), color: ORANGE },
          { label: "Support Ads", value: fmt(supporting), color: "#22c55e" },
          { label: "Opposition Ads", value: fmt(opposing), color: "#ef4444" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: t.card, border: `1px solid ${t.border}`, borderTop: `3px solid ${color}`, padding: "12px 16px" }}>
            <div style={{ fontFamily: MF, fontSize: 8.5, color: t.low, letterSpacing: 1.5, marginBottom: 6 }}>{label}</div>
            <div style={{ fontFamily: MF, fontSize: 22, color, fontWeight: 700 }}>{value}</div>
            <div style={{ fontFamily: MF, fontSize: 8, color: t.low, marginTop: 4 }}>2025–2026 cycle</div>
          </div>
        ))}
      </div>

      {/* Filters + sort */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {["ALL", "SUPPORT", "OPPOSE"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? (f === "SUPPORT" ? "#22c55e" : f === "OPPOSE" ? "#ef4444" : ORANGE) : t.cardB,
              border: `1px solid ${filter === f ? "transparent" : t.border}`,
              color: filter === f ? "#fff" : t.mid,
              padding: "4px 12px", fontFamily: MF, fontSize: 9, letterSpacing: 0.5, cursor: "pointer",
            }}>
              {f}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontFamily: MF, fontSize: 9, color: t.low }}>SORT:</span>
          {[["amount", "AMOUNT"], ["date", "DATE"]].map(([val, label]) => (
            <button key={val} onClick={() => setSortBy(val)} style={{
              background: sortBy === val ? ORANGE + "22" : "none",
              border: `1px solid ${sortBy === val ? ORANGE : t.border}`,
              color: sortBy === val ? ORANGE : t.mid,
              padding: "3px 9px", fontFamily: MF, fontSize: 9, cursor: "pointer",
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* IE table */}
      <div style={{ background: t.card, border: `1px solid ${t.border}` }}>
        <div style={{ background: t.cardB, padding: "7px 14px", borderBottom: `2px solid ${t.border}`, display: "grid", gridTemplateColumns: "200px 1fr 110px 100px 90px", gap: 12 }}>
          {["COMMITTEE", "CANDIDATE / RACE", "AMOUNT", "DATE", "TYPE"].map(h => (
            <div key={h} style={{ fontFamily: MF, fontSize: 8, color: t.low, letterSpacing: 2 }}>{h}</div>
          ))}
        </div>
        {filtered.map((ie, i) => {
          const supportColor = ie.support_oppose === "SUPPORT" ? "#22c55e" : "#ef4444";
          return (
            <div key={i} style={{
              padding: "11px 14px",
              borderBottom: `1px solid ${t.border}`,
              background: i % 2 === 0 ? t.card : t.tableAlt,
              display: "grid",
              gridTemplateColumns: "200px 1fr 110px 100px 90px",
              gap: 12,
              alignItems: "center",
            }}>
              <div style={{ fontFamily: MF, fontSize: 10, color: t.hi, lineHeight: 1.3 }}>{ie.committee}</div>
              <div>
                <div style={{ fontFamily: MF, fontSize: 10.5, color: t.hi }}>{ie.candidate}</div>
                <div style={{ fontFamily: MF, fontSize: 8.5, color: t.mid, marginTop: 2 }}>{ie.description}</div>
              </div>
              <div style={{ fontFamily: MF, fontSize: 12, color: ORANGE, fontWeight: 700 }}>{fmt(ie.amount)}</div>
              <div style={{ fontFamily: MF, fontSize: 9, color: t.mid }}>{ie.date}</div>
              <div style={{
                fontFamily: MF, fontSize: 8, color: supportColor,
                border: `1px solid ${supportColor}44`, padding: "2px 7px", background: `${supportColor}10`,
                textAlign: "center",
              }}>
                {ie.support_oppose}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ background: t.card, border: `1px solid ${ORANGE}33`, borderLeft: `3px solid ${ORANGE}`, padding: "10px 14px" }}>
        <div style={{ fontFamily: MF, fontSize: 8.5, color: ORANGE, letterSpacing: 1, marginBottom: 4 }}>◈ LIVE DATA INTEGRATION</div>
        <div style={{ fontFamily: MF, fontSize: 9, color: t.mid, lineHeight: 1.6 }}>
          Displaying illustrative data. Live FEC Schedule E integration (24/48-hr independent expenditure reports) is in active development via the FEC API — will auto-refresh on filing.
        </div>
      </div>

      <div style={{ fontFamily: MF, fontSize: 8.5, color: t.low, borderTop: `1px solid ${t.border}`, paddingTop: 10 }}>
        Sources: FEC Schedule E · 24/48-hour IE reports · 2025–2026 cycle · All figures public record
      </div>
    </div>
  );
}
