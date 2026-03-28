import { useState, useEffect } from "react";
import { useTheme } from "../theme/index.js";
import { ORANGE, FONT_MONO as MF, FONT_SERIF as SF } from "../theme/tokens.js";
import { policy } from "../api/client.js";

const AGENCY_COLOR = {
  "EPA":         "#22c55e",
  "DOD":         ORANGE,
  "DOE":         "#FFB84D",
  "HHS":         "#4A7FFF",
  "Treasury":    "#9966CC",
  "Justice":     "#CC44AA",
  "DHS":         "#00AADD",
};

function agencyTag(agencies = []) {
  const name = agencies[0] || "Federal";
  const short = name.replace("Department of ","Dept. ").replace("Environmental Protection Agency","EPA");
  const color = Object.entries(AGENCY_COLOR).find(([k]) => name.includes(k))?.[1] || "#666";
  return { short, color };
}

export default function ExecutiveOrders() {
  const t = useTheme();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    policy.executiveOrders(40)
      .then(res => setOrders(res.data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = orders.filter(o =>
    !search || (o.title || "").toLowerCase().includes(search.toLowerCase()) ||
    (o.agency_names || []).some(a => a.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ borderTop: `3px solid ${ORANGE}`, paddingTop: 16 }}>
        <div style={{ fontFamily: MF, fontSize: 9, color: ORANGE, letterSpacing: 3, marginBottom: 8 }}>
          PRESIDENTIAL DOCUMENTS · FEDERAL REGISTER · 2025–PRESENT
        </div>
        <h2 style={{ fontFamily: SF, fontSize: 28, color: t.hi, fontWeight: 700, lineHeight: 1.1, marginBottom: 6 }}>
          Executive Orders Timeline
        </h2>
        <p style={{ fontFamily: SF, fontSize: 13, fontStyle: "italic", color: t.mid, lineHeight: 1.7, maxWidth: 640 }}>
          Every executive order published in the Federal Register since January 2025, tagged by affected agency and policy area. Critical for tracking regulatory rollbacks and new mandates.
        </p>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Filter by keyword or agency…"
        style={{
          background: t.inputBg, border: `1px solid ${t.border}`, borderLeft: `2px solid ${ORANGE}`,
          padding: "9px 12px", fontFamily: MF, fontSize: 11, color: t.hi, outline: "none", maxWidth: 480,
        }}
      />

      {loading ? (
        <div style={{ fontFamily: MF, fontSize: 11, color: t.low, padding: 20, textAlign: "center" }}>
          Loading executive orders from Federal Register…
        </div>
      ) : error ? (
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderLeft: `3px solid ${ORANGE}`, padding: 16 }}>
          <div style={{ fontFamily: MF, fontSize: 9, color: ORANGE, letterSpacing: 1, marginBottom: 6 }}>⚠ FEDERAL REGISTER API</div>
          <div style={{ fontFamily: MF, fontSize: 10, color: t.mid }}>{error}</div>
        </div>
      ) : (
        <>
          <div style={{ fontFamily: MF, fontSize: 9, color: t.low, letterSpacing: 1 }}>
            {filtered.length} EXECUTIVE ORDER{filtered.length !== 1 ? "S" : ""} · JAN 2025 – PRESENT
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0, background: t.card, border: `1px solid ${t.border}` }}>
            {filtered.length === 0 && (
              <div style={{ padding: 20, fontFamily: MF, fontSize: 11, color: t.low, textAlign: "center" }}>
                No executive orders match your filter
              </div>
            )}
            {filtered.map((eo, i) => {
              const { short: agencyShort, color: agencyColor } = agencyTag(eo.agency_names || []);
              const date = eo.publication_date || "";
              const eoNum = eo.executive_order_number ? `EO ${eo.executive_order_number}` : eo.document_number || "";
              return (
                <div key={i} style={{
                  padding: "13px 16px",
                  borderBottom: `1px solid ${t.border}`,
                  background: i % 2 === 0 ? t.card : t.tableAlt,
                  display: "grid",
                  gridTemplateColumns: "90px 1fr auto",
                  gap: 14,
                  alignItems: "start",
                }}>
                  <div>
                    <div style={{ fontFamily: MF, fontSize: 9, color: ORANGE, fontWeight: 700, letterSpacing: 0.5 }}>{eoNum}</div>
                    <div style={{ fontFamily: MF, fontSize: 8, color: t.low, marginTop: 3 }}>{date}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: MF, fontSize: 10.5, color: t.hi, lineHeight: 1.4, marginBottom: 4 }}>
                      {eo.title || "Untitled"}
                    </div>
                    {eo.abstract && (
                      <div style={{ fontFamily: SF, fontStyle: "italic", fontSize: 11, color: t.mid, lineHeight: 1.5 }}>
                        {eo.abstract.slice(0, 180)}{eo.abstract.length > 180 ? "…" : ""}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                    <span style={{
                      fontFamily: MF, fontSize: 8, color: agencyColor,
                      border: `1px solid ${agencyColor}44`, padding: "2px 7px",
                      background: `${agencyColor}10`, whiteSpace: "nowrap",
                    }}>
                      {agencyShort}
                    </span>
                    {eo.html_url && (
                      <a href={eo.html_url} target="_blank" rel="noopener noreferrer"
                        style={{ fontFamily: MF, fontSize: 8, color: t.low, textDecoration: "none" }}>
                        FR ↗
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div style={{ fontFamily: MF, fontSize: 8.5, color: t.low, borderTop: `1px solid ${t.border}`, paddingTop: 10 }}>
        Sources: FederalRegister.gov API · Presidential Documents · Updated daily
      </div>
    </div>
  );
}
