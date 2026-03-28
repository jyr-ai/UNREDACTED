import { useState, useEffect } from "react";
import { useTheme } from "../theme/index.js";
import { ORANGE, FONT_MONO as MF, FONT_SERIF as SF } from "../theme/tokens.js";
import { congress } from "../api/client.js";

const STATES = [
  "CA","TX","FL","NY","PA","IL","OH","GA","NC","MI",
  "NJ","VA","WA","AZ","MA","TN","IN","MO","MD","WI",
];

const BILL_TYPE_COLOR = (type) => ({
  "hr": "#4A7FFF",
  "s":  ORANGE,
  "hjres": "#9966CC",
  "sjres": "#CC44AA",
}[type?.toLowerCase()] || "#888");

export default function BillsVotes() {
  const t = useTheme();
  const [state, setState] = useState("CA");
  const [chamber, setChamber] = useState("senate");
  const [bills, setBills] = useState([]);
  const [votes, setVotes] = useState([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [loadingVotes, setLoadingVotes] = useState(false);
  const [view, setView] = useState("bills");
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoadingBills(true);
    setError(null);
    congress.bills({ state, limit: 20 })
      .then(res => setBills(res.data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoadingBills(false));
  }, [state]);

  useEffect(() => {
    setLoadingVotes(true);
    congress.votes({ chamber, limit: 15 })
      .then(res => setVotes(res.data || []))
      .catch(() => setVotes([]))
      .finally(() => setLoadingVotes(false));
  }, [chamber]);

  const statusColor = (status) => {
    if (!status) return t.low;
    const s = status.toLowerCase();
    if (s.includes("signed") || s.includes("enacted")) return "#22c55e";
    if (s.includes("passed")) return "#4A7FFF";
    if (s.includes("committee")) return ORANGE;
    if (s.includes("introduced")) return t.mid;
    return t.mid;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ borderTop: `3px solid ${ORANGE}`, paddingTop: 16 }}>
        <div style={{ fontFamily: MF, fontSize: 9, color: ORANGE, letterSpacing: 3, marginBottom: 8 }}>
          LEGISLATION · CONGRESS.GOV · 119TH CONGRESS
        </div>
        <h2 style={{ fontFamily: SF, fontSize: 28, color: t.hi, fontWeight: 700, lineHeight: 1.1, marginBottom: 6 }}>
          Bills &amp; Votes Tracker
        </h2>
        <p style={{ fontFamily: SF, fontSize: 13, fontStyle: "italic", color: t.mid, lineHeight: 1.7, maxWidth: 640 }}>
          Track active legislation, roll-call votes, and bill sponsorship from the 119th Congress. Filter by state to see your delegation's activity.
        </p>
      </div>

      {/* View toggle */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${t.border}` }}>
        {[["bills", "Bills by State"], ["votes", "Roll-Call Votes"]].map(([id, label]) => (
          <button key={id} onClick={() => setView(id)} style={{
            background: "none", border: "none", cursor: "pointer",
            padding: "9px 20px", fontFamily: MF, fontSize: 10, letterSpacing: 0.5,
            color: view === id ? ORANGE : t.mid,
            borderBottom: `3px solid ${view === id ? ORANGE : "transparent"}`,
            marginBottom: -1,
          }}>
            {label}
          </button>
        ))}
      </div>

      {view === "bills" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* State selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: MF, fontSize: 9, color: t.low, letterSpacing: 1 }}>STATE:</span>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {STATES.map(s => (
                <button key={s} onClick={() => setState(s)} style={{
                  background: state === s ? ORANGE : t.cardB,
                  border: `1px solid ${state === s ? ORANGE : t.border}`,
                  color: state === s ? "#fff" : t.mid,
                  padding: "3px 8px", fontFamily: MF, fontSize: 9, cursor: "pointer",
                }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Bills list */}
          {loadingBills ? (
            <div style={{ fontFamily: MF, fontSize: 11, color: t.low, padding: 20, textAlign: "center" }}>
              Loading bills from Congress.gov…
            </div>
          ) : error ? (
            <div style={{ background: t.card, border: `1px solid ${t.border}`, borderLeft: `3px solid ${ORANGE}`, padding: 16 }}>
              <div style={{ fontFamily: MF, fontSize: 9, color: ORANGE, letterSpacing: 1, marginBottom: 6 }}>⚠ API CONNECTION</div>
              <div style={{ fontFamily: MF, fontSize: 10, color: t.mid }}>{error}</div>
            </div>
          ) : bills.length === 0 ? (
            <div style={{ fontFamily: MF, fontSize: 11, color: t.low, padding: 20, textAlign: "center" }}>
              No bills found for {state}
            </div>
          ) : (
            <div style={{ background: t.card, border: `1px solid ${t.border}`, borderTop: "none" }}>
              <div style={{ background: t.cardB, padding: "7px 14px", borderBottom: `2px solid ${t.border}`, fontFamily: MF, fontSize: 8, color: t.low, letterSpacing: 2 }}>
                BILLS SPONSORED/CO-SPONSORED BY {state} DELEGATION · 119TH CONGRESS
              </div>
              {bills.map((bill, i) => {
                const type = bill.type || bill.bill_type || "";
                const num  = bill.number || bill.bill_number || "";
                const title = bill.title || "Untitled Bill";
                const status = bill.status || bill.latest_action?.text || "In Committee";
                const sponsor = bill.sponsor?.name || bill.sponsor || "";
                const date = bill.introducedDate || bill.latest_action?.actionDate || "";
                return (
                  <div key={i} style={{
                    padding: "12px 14px",
                    borderBottom: `1px solid ${t.border}`,
                    background: i % 2 === 0 ? t.card : t.tableAlt,
                    display: "grid",
                    gridTemplateColumns: "80px 1fr auto",
                    gap: 12,
                    alignItems: "start",
                  }}>
                    <div>
                      <div style={{ fontFamily: MF, fontSize: 10, color: BILL_TYPE_COLOR(type), fontWeight: 700 }}>
                        {type.toUpperCase()}&nbsp;{num}
                      </div>
                      {date && <div style={{ fontFamily: MF, fontSize: 8, color: t.low, marginTop: 2 }}>{date}</div>}
                    </div>
                    <div>
                      <div style={{ fontFamily: MF, fontSize: 10.5, color: t.hi, lineHeight: 1.4, marginBottom: 3 }}>{title}</div>
                      {sponsor && <div style={{ fontFamily: MF, fontSize: 9, color: t.mid }}>Sponsor: {sponsor}</div>}
                    </div>
                    <div style={{
                      fontFamily: MF, fontSize: 8, letterSpacing: 0.5, whiteSpace: "nowrap",
                      color: statusColor(status), border: `1px solid ${statusColor(status)}44`,
                      padding: "2px 7px", background: `${statusColor(status)}10`,
                    }}>
                      {(status || "").slice(0, 30)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {view === "votes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Chamber selector */}
          <div style={{ display: "flex", gap: 8 }}>
            {["senate", "house"].map(c => (
              <button key={c} onClick={() => setChamber(c)} style={{
                background: chamber === c ? ORANGE : t.cardB,
                border: `1px solid ${chamber === c ? ORANGE : t.border}`,
                color: chamber === c ? "#fff" : t.mid,
                padding: "5px 16px", fontFamily: MF, fontSize: 9, letterSpacing: 1, cursor: "pointer",
              }}>
                {c.toUpperCase()}
              </button>
            ))}
          </div>

          {loadingVotes ? (
            <div style={{ fontFamily: MF, fontSize: 11, color: t.low, padding: 20, textAlign: "center" }}>
              Loading roll-call votes…
            </div>
          ) : votes.length === 0 ? (
            <div style={{ background: t.card, border: `1px solid ${t.border}`, borderLeft: `3px solid ${ORANGE}`, padding: 16 }}>
              <div style={{ fontFamily: MF, fontSize: 9, color: ORANGE, letterSpacing: 1, marginBottom: 6 }}>CONGRESS.GOV · ROLL-CALL VOTES</div>
              <div style={{ fontFamily: MF, fontSize: 10, color: t.mid, lineHeight: 1.7 }}>
                Roll-call vote data is available via Congress.gov API. Results will appear here once the API returns vote records for the current session.
              </div>
            </div>
          ) : (
            <div style={{ background: t.card, border: `1px solid ${t.border}` }}>
              {votes.map((vote, i) => (
                <div key={i} style={{ padding: "12px 14px", borderBottom: `1px solid ${t.border}`, background: i % 2 === 0 ? t.card : t.tableAlt }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontFamily: MF, fontSize: 10.5, color: t.hi, marginBottom: 3 }}>
                        {vote.description || vote.question || "Vote"}
                      </div>
                      <div style={{ fontFamily: MF, fontSize: 9, color: t.mid }}>
                        {vote.date} · {vote.session || "119th Congress"}
                      </div>
                    </div>
                    <div style={{ fontFamily: MF, fontSize: 9, color: vote.result?.includes("Passed") ? "#22c55e" : ORANGE, border: `1px solid currentColor`, padding: "2px 7px" }}>
                      {vote.result || "Pending"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ fontFamily: MF, fontSize: 8.5, color: t.low, borderTop: `1px solid ${t.border}`, paddingTop: 10 }}>
        Sources: Congress.gov API · 119th Congress · Data updated daily
      </div>
    </div>
  );
}
