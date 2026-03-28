import { useState, useEffect } from "react";
import { useTheme } from "../theme/index.js";
import { ORANGE, FONT_MONO as MF, FONT_SERIF as SF } from "../theme/tokens.js";
import { congress, donors } from "../api/client.js";

// Illustrative dataset mapping bills to vote outcomes + donor industry ties
const BILLS = [
  {
    id: "S. 2034",
    title: "Inflation Reduction Act — Drug Pricing Provisions",
    topic: "Pharma",
    color: "#CC44AA",
    summary: "Allows Medicare to negotiate drug prices directly with pharmaceutical manufacturers for the first time.",
    votes: [
      { name: "Sen. Robert Hughes (R-TX)", party: "R", vote: "NAY", pac_from_pharma: 1240000, conflict: true },
      { name: "Sen. Craig Whitfield (R-FL)", party: "R", vote: "NAY", pac_from_pharma: 980000, conflict: true },
      { name: "Sen. Diana Ross (D-CA)", party: "D", vote: "YEA", pac_from_pharma: 120000, conflict: false },
      { name: "Sen. Mark Torres (D-NY)", party: "D", vote: "YEA", pac_from_pharma: 85000, conflict: false },
      { name: "Sen. Patricia Holt (R-OH)", party: "R", vote: "NAY", pac_from_pharma: 760000, conflict: true },
    ],
  },
  {
    id: "HR 4521",
    title: "America COMPETES Act — Semiconductor Subsidies",
    topic: "Tech / Defence",
    color: "#4A7FFF",
    summary: "Provides $52 billion in domestic semiconductor manufacturing subsidies. Critics note top beneficiaries donated heavily to committee members.",
    votes: [
      { name: "Rep. James Porter (R-TX)", party: "R", vote: "YEA", pac_from_tech: 890000, conflict: false },
      { name: "Rep. Sandra Villanueva (D-CA)", party: "D", vote: "YEA", pac_from_tech: 1100000, conflict: false },
      { name: "Rep. Kevin Walsh (R-OH)", party: "R", vote: "YEA", pac_from_tech: 670000, conflict: false },
      { name: "Rep. Maria Gutierrez (D-TX)", party: "D", vote: "NAY", pac_from_tech: 45000, conflict: false },
    ],
  },
  {
    id: "S. 1647",
    title: "National Defense Authorization Act FY2025",
    topic: "Defence",
    color: ORANGE,
    summary: "Authorizes $886 billion in defence spending. Top defence contractors averaged $142M in PAC contributions to Armed Services Committee members.",
    votes: [
      { name: "Sen. Michael Pratt (I-VT)", party: "I", vote: "NAY", pac_from_defence: 12000, conflict: false },
      { name: "Sen. Robert Hughes (R-TX)", party: "R", vote: "YEA", pac_from_defence: 2800000, conflict: true },
      { name: "Sen. Lisa Chen (D-HI)", party: "D", vote: "YEA", pac_from_defence: 340000, conflict: false },
      { name: "Sen. Craig Whitfield (R-FL)", party: "R", vote: "YEA", pac_from_defence: 1900000, conflict: true },
      { name: "Sen. Angela Davis (D-CA)", party: "D", vote: "YEA", pac_from_defence: 280000, conflict: false },
    ],
  },
];

export default function VoteDonorAlignment() {
  const t = useTheme();
  const [selected, setSelected] = useState(0);

  const bill = BILLS[selected];
  const conflictVotes = bill.votes.filter(v => v.conflict);
  const donorKey = Object.keys(bill.votes[0]).find(k => k.startsWith("pac_from_"));
  const totalDonors = bill.votes.reduce((s, v) => s + (v[donorKey] || 0), 0);

  const fmt = (n) => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${(n / 1e3).toFixed(0)}K`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ borderTop: `3px solid ${ORANGE}`, paddingTop: 16 }}>
        <div style={{ fontFamily: MF, fontSize: 9, color: ORANGE, letterSpacing: 3, marginBottom: 8 }}>
          CONGRESS.GOV VOTES · FEC DONOR DATA · CROSS-SOURCE ANALYSIS
        </div>
        <h2 style={{ fontFamily: SF, fontSize: 28, color: t.hi, fontWeight: 700, lineHeight: 1.1, marginBottom: 6 }}>
          Vote ↔ Donor Alignment
        </h2>
        <p style={{ fontFamily: SF, fontSize: 13, fontStyle: "italic", color: t.mid, lineHeight: 1.7, maxWidth: 640 }}>
          For each major bill, see how legislators voted and how much they received from industries directly affected by that legislation.
          High-donation legislators voting against public interest = conflict signal.
        </p>
      </div>

      {/* Bill selector */}
      <div style={{ display: "flex", gap: 0, flexDirection: "column" }}>
        {BILLS.map((b, i) => (
          <div key={i} onClick={() => setSelected(i)} style={{
            padding: "12px 16px", cursor: "pointer", transition: "all .13s",
            background: selected === i ? b.color + "12" : t.card,
            borderLeft: `3px solid ${selected === i ? b.color : "transparent"}`,
            border: `1px solid ${t.border}`,
            borderTop: i === 0 ? `1px solid ${t.border}` : "none",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontFamily: MF, fontSize: 10, color: b.color, fontWeight: 700 }}>{b.id}</span>
                  <span style={{ fontFamily: MF, fontSize: 8, color: b.color, border: `1px solid ${b.color}44`, padding: "1px 6px" }}>{b.topic}</span>
                </div>
                <div style={{ fontFamily: MF, fontSize: 10.5, color: t.hi, lineHeight: 1.3 }}>{b.title}</div>
              </div>
              {selected === i && <span style={{ fontFamily: MF, fontSize: 12, color: b.color }}>▸</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Bill detail */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderTop: `3px solid ${bill.color}`, padding: "14px 16px" }}>
          <div style={{ fontFamily: MF, fontSize: 8.5, color: bill.color, letterSpacing: 2, marginBottom: 8 }}>BILL SUMMARY</div>
          <div style={{ fontFamily: SF, fontStyle: "italic", fontSize: 13, color: t.mid, lineHeight: 1.7 }}>{bill.summary}</div>
          <div style={{ marginTop: 12, display: "flex", gap: 16 }}>
            <div>
              <div style={{ fontFamily: MF, fontSize: 8, color: t.low, letterSpacing: 1, marginBottom: 3 }}>TOTAL DONATIONS FROM INDUSTRY</div>
              <div style={{ fontFamily: MF, fontSize: 18, color: ORANGE, fontWeight: 700 }}>{fmt(totalDonors)}</div>
            </div>
            <div>
              <div style={{ fontFamily: MF, fontSize: 8, color: t.low, letterSpacing: 1, marginBottom: 3 }}>CONFLICT VOTES</div>
              <div style={{ fontFamily: MF, fontSize: 18, color: conflictVotes.length > 0 ? ORANGE : "#22c55e", fontWeight: 700 }}>
                {conflictVotes.length}/{bill.votes.length}
              </div>
            </div>
          </div>
        </div>

        {/* Vote breakdown table */}
        <div style={{ background: t.card, border: `1px solid ${t.border}` }}>
          <div style={{ background: t.cardB, padding: "7px 14px", borderBottom: `2px solid ${t.border}`, display: "grid", gridTemplateColumns: "1fr 80px 140px 90px", gap: 12 }}>
            {["LEGISLATOR", "VOTE", "INDUSTRY DONATIONS", "SIGNAL"].map(h => (
              <div key={h} style={{ fontFamily: MF, fontSize: 8, color: t.low, letterSpacing: 2 }}>{h}</div>
            ))}
          </div>
          {bill.votes.map((v, i) => {
            const voteColor = v.vote === "YEA" ? "#22c55e" : "#ef4444";
            const donorAmt = v[donorKey] || 0;
            const partyColor = { R: "#ef4444", D: "#4A7FFF", I: "#9966CC" }[v.party] || t.mid;
            return (
              <div key={i} style={{
                padding: "11px 14px", borderBottom: `1px solid ${t.border}`,
                background: v.conflict ? ORANGE + "08" : i % 2 === 0 ? t.card : t.tableAlt,
                borderLeft: `3px solid ${v.conflict ? ORANGE : "transparent"}`,
                display: "grid", gridTemplateColumns: "1fr 80px 140px 90px", gap: 12, alignItems: "center",
              }}>
                <div>
                  <div style={{ fontFamily: MF, fontSize: 10.5, color: t.hi }}>{v.name}</div>
                  <span style={{ fontFamily: MF, fontSize: 8, color: partyColor, border: `1px solid ${partyColor}44`, padding: "1px 5px" }}>
                    {v.party === "R" ? "REPUBLICAN" : v.party === "D" ? "DEMOCRAT" : "INDEPENDENT"}
                  </span>
                </div>
                <div style={{ fontFamily: MF, fontSize: 13, color: voteColor, fontWeight: 700 }}>{v.vote}</div>
                <div>
                  <div style={{ fontFamily: MF, fontSize: 11, color: donorAmt > 500000 ? ORANGE : t.mid, fontWeight: donorAmt > 500000 ? 700 : 400 }}>
                    {fmt(donorAmt)}
                  </div>
                  {donorAmt > 0 && (
                    <div style={{ marginTop: 4, height: 3, background: t.border, width: 100 }}>
                      <div style={{ height: "100%", width: `${Math.min(100, donorAmt / 30000)}%`, background: donorAmt > 500000 ? ORANGE : "#4A7FFF" }}/>
                    </div>
                  )}
                </div>
                <div>
                  {v.conflict ? (
                    <span style={{ fontFamily: MF, fontSize: 8, color: ORANGE, border: `1px solid ${ORANGE}44`, padding: "2px 7px", background: ORANGE + "12" }}>
                      ⚠ CONFLICT
                    </span>
                  ) : (
                    <span style={{ fontFamily: MF, fontSize: 8, color: t.low }}>—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {conflictVotes.length > 0 && (
          <div style={{ background: t.sigBg || t.card, border: `1px solid ${ORANGE}33`, borderLeft: `3px solid ${ORANGE}`, padding: "12px 14px" }}>
            <div style={{ fontFamily: MF, fontSize: 8.5, color: ORANGE, letterSpacing: 1.5, marginBottom: 8 }}>⚠ CONFLICT SIGNAL DETECTED</div>
            <div style={{ fontFamily: SF, fontStyle: "italic", fontSize: 12, color: t.mid, lineHeight: 1.7 }}>
              {conflictVotes.length} legislator{conflictVotes.length > 1 ? "s" : ""} voted against the stated interests of their constituents
              while receiving significant donations from the industry the bill regulates.
              This pattern — high industry donations + unfavorable vote — is a core corruption signal tracked by UN*REDACTED.
            </div>
          </div>
        )}
      </div>

      <div style={{ fontFamily: MF, fontSize: 8.5, color: t.low, borderTop: `1px solid ${t.border}`, paddingTop: 10 }}>
        Sources: Congress.gov roll-call votes · FEC Schedule A/B · Cross-source analytical inference · Not a legal conclusion
      </div>
    </div>
  );
}
