/**
 * CandidatesBrowser — paginated, filterable lookup over the full FEC
 * candidate-cycle dataset (~15k rows for 2024+2026) served by
 * /api/donors/candidates?source=supabase.
 */
import { useEffect, useState } from "react";
import { useTheme } from "../theme/index.js";
import { ORANGE, FONT_MONO as MF, FONT_SERIF as SF } from "../theme/tokens.js";
import { Band, Card, CardTitle, SourceFooter } from "./ui/index.js";
import { donors } from "../api/client.js";

const PAGE_SIZE = 50;
const OFFICES = [["", "All"], ["H", "House"], ["S", "Senate"], ["P", "President"]];
const PARTIES = [["", "All"], ["DEM", "Dem"], ["REP", "Rep"], ["IND", "Ind"], ["LIB", "Lib"], ["GRE", "Grn"]];
const CYCLES  = [["", "All"], ["2026", "2026"], ["2024", "2024"]];

const STATES = [
  "","AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC","PR","VI","GU",
];

const fmt$ = v => v == null ? "—" : v >= 1e6 ? `$${(v/1e6).toFixed(1)}m` : v >= 1e3 ? `$${(v/1e3).toFixed(0)}k` : `$${v}`;

export default function CandidatesBrowser() {
  const t = useTheme();
  const [name, setName]   = useState("");
  const [nameQ, setNameQ] = useState("");
  const [office, setOffice] = useState("");
  const [state, setState]   = useState("");
  const [party, setParty]   = useState("");
  const [cycle, setCycle]   = useState("2026");
  const [offset, setOffset] = useState(0);
  const [sortBy,  setSortBy]  = useState("total_receipts");
  const [sortDir, setSortDir] = useState("desc");
  const [data, setData]   = useState({ results: [], pagination: { count: 0 } });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => { setNameQ(name); setOffset(0); }, 350);
    return () => clearTimeout(id);
  }, [name]);

  useEffect(() => { setOffset(0); }, [office, state, party, cycle, sortBy, sortDir]);

  // When filters are active, disable server-side sort (server falls back to name order)
  const hasFilters = nameQ || office || state || party;
  const serverSortBy  = hasFilters ? "name" : sortBy;
  const serverSortDir = hasFilters ? "asc"  : sortDir;

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setErr(null);
    donors.candidates({
      source: "supabase",
      ...(nameQ  && { name: nameQ }),
      ...(office && { office }),
      ...(state  && { state }),
      ...(party  && { party }),
      ...(cycle  && { cycle }),
      limit: PAGE_SIZE,
      offset,
      sortBy:  serverSortBy,
      sortDir: serverSortDir,
    })
      .then(r => { if (!cancelled) setData(r?.data || { results: [], pagination: { count: 0 } }); })
      .catch(e => { if (!cancelled) setErr(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [nameQ, office, state, party, cycle, offset, serverSortBy, serverSortDir]);

  const rawRows = data?.results || [];
  // When filters are active, apply client-side sort of the current page
  const rows = (hasFilters && sortBy === "total_receipts")
    ? [...rawRows].sort((a, b) => {
        const av = a.totals?.total_receipts ?? -1;
        const bv = b.totals?.total_receipts ?? -1;
        return sortDir === "desc" ? bv - av : av - bv;
      })
    : rawRows;

  const count = data?.pagination?.count ?? 0;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  function toggleRaisedSort() {
    if (sortBy === "total_receipts") {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortBy("total_receipts");
      setSortDir("desc");
    }
    setOffset(0);
  }

  const selectStyle = {
    background: t.card, color: t.hi, border: `1px solid ${t.border}`,
    padding: "6px 8px", fontFamily: MF, fontSize: 10, minWidth: 72,
  };

  return (
    <div>
      <Band label="Candidates — full FEC registry" right={`${count.toLocaleString()} RESULTS`} />
      <Card>
        <CardTitle
          h="Search every registered federal candidate across the 2024 and 2026 cycles."
          sub="Source: FEC bulk data (politicians + candidate_totals) — paginated, ~15k candidate-cycle rows"
        />

        {/* Filter bar */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:12 }}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Search name…"
            style={{ ...selectStyle, minWidth: 200, flex: "1 1 220px" }}
          />
          <select value={office} onChange={e => setOffice(e.target.value)} style={selectStyle}>
            {OFFICES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={state} onChange={e => setState(e.target.value)} style={selectStyle}>
            {STATES.map(s => <option key={s} value={s}>{s || "All states"}</option>)}
          </select>
          <select value={party} onChange={e => setParty(e.target.value)} style={selectStyle}>
            {PARTIES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={cycle} onChange={e => setCycle(e.target.value)} style={selectStyle}>
            {CYCLES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {/* Table */}
        <div style={{ border:`1px solid ${t.border}`, maxHeight: 440, overflow:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:MF, fontSize:10 }}>
            <thead>
              <tr style={{ background:t.cardB, position:"sticky", top:0 }}>
                {["Name","Party","State","Office","Cycle"].map(h => (
                  <th key={h} style={{ textAlign:"left", padding:"8px 10px", color:t.mid, borderBottom:`1px solid ${t.border}`, letterSpacing:1, fontSize:9 }}>{h.toUpperCase()}</th>
                ))}
                <th
                  onClick={toggleRaisedSort}
                  style={{ textAlign:"left", padding:"8px 10px", borderBottom:`1px solid ${t.border}`, letterSpacing:1, fontSize:9, cursor:"pointer", userSelect:"none", color: sortBy === "total_receipts" ? ORANGE : t.mid, whiteSpace:"nowrap" }}
                >
                  RAISED {sortBy === "total_receipts" ? (sortDir === "desc" ? "▼" : "▲") : ""}
                  {hasFilters && sortBy === "total_receipts" && <span style={{ fontSize:7, marginLeft:3, opacity:0.6 }}>(page)</span>}
                </th>
                {["Spent","Cash"].map(h => (
                  <th key={h} style={{ textAlign:"left", padding:"8px 10px", color:t.mid, borderBottom:`1px solid ${t.border}`, letterSpacing:1, fontSize:9 }}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 && (
                <tr><td colSpan={8} style={{ padding:"20px", textAlign:"center", color:t.low }}>Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && !err && (
                <tr><td colSpan={8} style={{ padding:"20px", textAlign:"center", color:t.low }}>No candidates match these filters.</td></tr>
              )}
              {err && (
                <tr><td colSpan={8} style={{ padding:"20px", textAlign:"center", color:ORANGE }}>Error: {err}</td></tr>
              )}
              {rows.map((r, i) => {
                const tot = r.totals || {};
                return (
                  <tr key={`${r.fec_candidate_id}-${r.cycle ?? "x"}-${i}`} style={{ borderBottom:`1px solid ${t.border}` }}>
                    <td style={{ padding:"7px 10px", color:t.hi, fontFamily:SF, fontSize:12 }}>{r.name || "—"}</td>
                    <td style={{ padding:"7px 10px", color:t.mid }}>{r.party || "—"}</td>
                    <td style={{ padding:"7px 10px", color:t.mid }}>{r.state || "—"}{r.district ? `-${r.district}` : ""}</td>
                    <td style={{ padding:"7px 10px", color:t.mid }}>{r.office || r.chamber || "—"}</td>
                    <td style={{ padding:"7px 10px", color:t.mid }}>{r.cycle ?? "—"}</td>
                    <td style={{ padding:"7px 10px", color:ORANGE }}>{fmt$(tot.total_receipts)}</td>
                    <td style={{ padding:"7px 10px", color:t.mid }}>{fmt$(tot.total_disbursements)}</td>
                    <td style={{ padding:"7px 10px", color:t.mid }}>{fmt$(tot.cash_on_hand)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:10, fontFamily:MF, fontSize:10, color:t.mid }}>
          <span>Page {page} of {totalPages.toLocaleString()} · showing {rows.length} of {count.toLocaleString()}</span>
          <div style={{ display:"flex", gap:6 }}>
            <button
              disabled={offset === 0 || loading}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              style={{ ...selectStyle, cursor: offset === 0 ? "not-allowed" : "pointer", opacity: offset === 0 ? 0.4 : 1 }}
            >← Prev</button>
            <button
              disabled={offset + PAGE_SIZE >= count || loading}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              style={{ ...selectStyle, cursor: offset + PAGE_SIZE >= count ? "not-allowed" : "pointer", opacity: offset + PAGE_SIZE >= count ? 0.4 : 1 }}
            >Next →</button>
          </div>
        </div>

        <SourceFooter s="FEC bulk data — candidate master (cn) + financial summaries (weball/webl) · cycles 2024, 2026" />
      </Card>
    </div>
  );
}
