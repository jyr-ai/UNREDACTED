import { useState, useEffect } from "react";
import { useTheme } from "../theme/index.js";
import { ORANGE, FONT_MONO as MF, FONT_SERIF as SF } from "../theme/tokens.js";
import { policy } from "../api/client.js";

const TYPE_COLOR = { "Proposed Rule": ORANGE, "Rule": "#4A7FFF", "Notice": "#FFB84D", "Presidential Document": "#9966CC" };

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  const days = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
  return days;
}

export default function RegulatoryWatch() {
  const t = useTheme();
  const [data, setData] = useState({ proposed: [], dockets: [] });
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [activeKw, setActiveKw] = useState("");

  const load = (kw) => {
    setLoading(true);
    policy.rulemaking({ keyword: kw || undefined, limit: 25 })
      .then(res => setData(res.data || { proposed: [], dockets: [] }))
      .catch(() => setData({ proposed: [], dockets: [] }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(""); }, []);

  const QUICK = ["EPA", "FDA", "SEC", "FTC", "CFPB", "Defense", "Energy"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ borderTop: `3px solid ${ORANGE}`, paddingTop: 16 }}>
        <div style={{ fontFamily: MF, fontSize: 9, color: ORANGE, letterSpacing: 3, marginBottom: 8 }}>
          REGULATORY INTELLIGENCE · FEDERAL REGISTER · REGULATIONS.GOV
        </div>
        <h2 style={{ fontFamily: SF, fontSize: 28, color: t.hi, fontWeight: 700, lineHeight: 1.1, marginBottom: 6 }}>
          Regulatory Watch
        </h2>
        <p style={{ fontFamily: SF, fontSize: 13, fontStyle: "italic", color: t.mid, lineHeight: 1.7, maxWidth: 640 }}>
          Active Notice of Proposed Rulemaking (NPRM) periods, upcoming rule effective dates, and public comment deadlines.
          Advocacy watchdogs use this to intervene before rules are finalized.
        </p>
      </div>

      {/* Search + quick filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 0 }}>
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { setActiveKw(keyword); load(keyword); } }}
            placeholder="Search agency or topic…"
            style={{
              background: t.inputBg, border: `1px solid ${t.border}`, borderLeft: `2px solid ${ORANGE}`,
              borderRight: "none", padding: "8px 12px", fontFamily: MF, fontSize: 10.5, color: t.hi, outline: "none", width: 240,
            }}
          />
          <button onClick={() => { setActiveKw(keyword); load(keyword); }} style={{
            background: ORANGE, border: "none", padding: "0 14px",
            fontFamily: MF, fontSize: 9, color: "#fff", letterSpacing: 1, cursor: "pointer",
          }}>
            SEARCH
          </button>
        </div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {QUICK.map(q => (
            <button key={q} onClick={() => { setKeyword(q); setActiveKw(q); load(q); }} style={{
              background: activeKw === q ? ORANGE + "22" : t.cardB,
              border: `1px solid ${activeKw === q ? ORANGE : t.border}`,
              color: activeKw === q ? ORANGE : t.mid,
              padding: "4px 10px", fontFamily: MF, fontSize: 9, cursor: "pointer",
            }}>
              {q}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ fontFamily: MF, fontSize: 11, color: t.low, padding: 20, textAlign: "center" }}>
          Loading proposed rules from Federal Register…
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Proposed rules (NPRMs) */}
          {data.proposed.length > 0 && (
            <div>
              <div style={{ background: t.cardB, borderTop: `3px solid ${ORANGE}`, padding: "7px 14px", fontFamily: MF, fontSize: 8, color: t.low, letterSpacing: 2 }}>
                OPEN COMMENT PERIODS &amp; PROPOSED RULES — {data.proposed.length} FOUND
              </div>
              <div style={{ background: t.card, border: `1px solid ${t.border}`, borderTop: "none" }}>
                {data.proposed.map((rule, i) => {
                  const typeColor = TYPE_COLOR[rule.type] || t.mid;
                  return (
                    <div key={i} style={{
                      padding: "12px 14px",
                      borderBottom: `1px solid ${t.border}`,
                      background: i % 2 === 0 ? t.card : t.tableAlt,
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 12,
                      alignItems: "start",
                    }}>
                      <div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 5 }}>
                          <span style={{ fontFamily: MF, fontSize: 8, color: typeColor, border: `1px solid ${typeColor}44`, padding: "1px 6px" }}>
                            {rule.type || "Rule"}
                          </span>
                          <span style={{ fontFamily: MF, fontSize: 8, color: t.low }}>{rule.publication_date}</span>
                          {rule.significant && (
                            <span style={{ fontFamily: MF, fontSize: 8, color: ORANGE, border: `1px solid ${ORANGE}44`, padding: "1px 5px", background: ORANGE + "12" }}>
                              SIGNIFICANT
                            </span>
                          )}
                        </div>
                        <div style={{ fontFamily: MF, fontSize: 10.5, color: t.hi, lineHeight: 1.4, marginBottom: 4 }}>
                          {rule.title || "Untitled"}
                        </div>
                        <div style={{ fontFamily: MF, fontSize: 9, color: t.mid, marginBottom: rule.abstract ? 4 : 0 }}>
                          {(rule.agency_names || []).join(" · ")}
                        </div>
                        {rule.abstract && (
                          <div style={{ fontFamily: SF, fontStyle: "italic", fontSize: 11, color: t.mid, lineHeight: 1.5 }}>
                            {rule.abstract.slice(0, 160)}{rule.abstract.length > 160 ? "…" : ""}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
                        {rule.html_url && (
                          <a href={rule.html_url} target="_blank" rel="noopener noreferrer" style={{
                            fontFamily: MF, fontSize: 8, color: ORANGE, border: `1px solid ${ORANGE}44`,
                            padding: "2px 7px", textDecoration: "none",
                          }}>
                            COMMENT ↗
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dockets from Regulations.gov */}
          {data.dockets.length > 0 && (
            <div>
              <div style={{ background: t.cardB, borderTop: `3px solid #4A7FFF`, padding: "7px 14px", fontFamily: MF, fontSize: 8, color: t.low, letterSpacing: 2 }}>
                REGULATIONS.GOV DOCKETS — {data.dockets.length} ACTIVE
              </div>
              <div style={{ background: t.card, border: `1px solid ${t.border}`, borderTop: "none" }}>
                {data.dockets.map((docket, i) => (
                  <div key={i} style={{
                    padding: "12px 14px", borderBottom: `1px solid ${t.border}`,
                    background: i % 2 === 0 ? t.card : t.tableAlt,
                  }}>
                    <div style={{ fontFamily: MF, fontSize: 10.5, color: t.hi, marginBottom: 4 }}>
                      {docket.title || docket.id}
                    </div>
                    <div style={{ fontFamily: MF, fontSize: 9, color: t.mid }}>
                      {docket.agencyId || ""} · Docket: {docket.id || ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.proposed.length === 0 && data.dockets.length === 0 && (
            <div style={{ background: t.card, border: `1px solid ${t.border}`, borderLeft: `3px solid ${ORANGE}`, padding: 16 }}>
              <div style={{ fontFamily: MF, fontSize: 9, color: ORANGE, letterSpacing: 1, marginBottom: 6 }}>NO RESULTS</div>
              <div style={{ fontFamily: MF, fontSize: 10, color: t.mid }}>
                No proposed rules found{activeKw ? ` for "${activeKw}"` : ""}. Try a different agency name or keyword.
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ fontFamily: MF, fontSize: 8.5, color: t.low, borderTop: `1px solid ${t.border}`, paddingTop: 10 }}>
        Sources: FederalRegister.gov · Regulations.gov · Updated daily · Comment periods subject to change
      </div>
    </div>
  );
}
