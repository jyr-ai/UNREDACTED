import { useState, useEffect, useRef } from "react";
import { queryAgent, fetchContracts } from "./api/client.js";

const MODULES = [
  { id: "dashboard", label: "Dashboard", icon: "⬡" },
  { id: "agent", label: "AI Intel", icon: "◈" },
  { id: "spending", label: "Spending", icon: "◎" },
  { id: "politicians", label: "Politicians", icon: "◉" },
  { id: "graph", label: "Entity Graph", icon: "⬡" },
];

const CHAT_MESSAGES = [
  {
    role: "user",
    text: "Which defense companies donated to members of the Senate Armed Services Committee, then received sole-source contracts in the same fiscal year?",
  },
  {
    role: "ai",
    text: null,
    structured: {
      summary: "I found 14 companies matching this pattern across FY2022–2024. Here are the most significant:",
      findings: [
        { company: "Northrop Grumman", pattern: "PAC → Committee → Sole-source contract", spendingAmount: "$8.7B", riskScore: 88, confidence: "HIGH" },
        { company: "Raytheon Technologies", pattern: "PAC → 5 committee members → Contract", spendingAmount: "$5.1B", riskScore: 82, confidence: "HIGH" },
        { company: "L3Harris Technologies", pattern: "PAC → 2 committee members → Contract", spendingAmount: "$2.3B", riskScore: 71, confidence: "MED" },
      ],
      sources: ["USASpending.gov", "FEC Schedule B", "OpenSecrets", "DoD Procurement Records"],
      inference: "Pattern detected: donation → committee oversight → contract award within 11 months avg",
    },
  },
];

const FEED_ITEMS = [
  { type: "CONTRACT", text: "Lockheed Martin awarded $2.1B sole-source contract — DoD", time: "4m ago", risk: "HIGH" },
  { type: "DONATION", text: "Defense PACs donated $4.2M to Armed Services Committee chairs — FEC", time: "12m ago", risk: "MED" },
  { type: "TRADE", text: "Sen. Johnson traded $250K in Pfizer — 18 days before FDA vote", time: "31m ago", risk: "HIGH" },
  { type: "RULE", text: "EPA proposed rule weakened after 847 industry comments — FedReg", time: "1h ago", risk: "HIGH" },
  { type: "REVOLVE", text: "Former HHS Deputy joins PhRMA lobbying arm — OpenSecrets", time: "2h ago", risk: "MED" },
  { type: "GRANT", text: "DOE $890M clean energy grants — 67% to states with Senate Energy votes", time: "3h ago", risk: "LOW" },
];

const STATIC_KPIS = [
  { label: "STOCK Act Violations", value: "34", change: "12 new", up: true, sub: "pending DOJ review" },
  { label: "Nat'l Corruption Index", value: "61/100", change: "↓ 3 pts", up: false, sub: "higher = more corrupt" },
];

const POLITICIANS = [
  { name: "Sen. Robert Hughes", party: "R", state: "TX", score: 28, donors: "$4.2M", topIndustry: "Defense", trades: 12, conflicts: 3 },
  { name: "Rep. Diana Marsh", party: "D", state: "CA", score: 71, donors: "$1.8M", topIndustry: "Tech", trades: 2, conflicts: 0 },
  { name: "Sen. Craig Whitfield", party: "R", state: "FL", score: 19, donors: "$6.1M", topIndustry: "Finance", trades: 28, conflicts: 7 },
  { name: "Rep. Sandra Torres", party: "D", state: "NY", score: 84, donors: "$920K", topIndustry: "Labor", trades: 0, conflicts: 0 },
  { name: "Sen. Michael Pratt", party: "I", state: "VT", score: 91, donors: "$340K", topIndustry: "Small Biz", trades: 1, conflicts: 0 },
];

const DONOR_INDUSTRIES = [
  { name: "Defense & Aerospace", amount: 847, pct: 84, color: "#E63946" },
  { name: "Finance & Banking", amount: 612, pct: 61, color: "#F4A261" },
  { name: "Pharmaceuticals", amount: 498, pct: 49, color: "#E9C46A" },
  { name: "Energy & Fossil Fuels", amount: 441, pct: 44, color: "#2A9D8F" },
  { name: "Technology", amount: 389, pct: 38, color: "#457B9D" },
  { name: "Agriculture & Agribusiness", amount: 267, pct: 26, color: "#6A4C93" },
];


const GRAPH_NODES = [
  { id: 1, label: "Raytheon", type: "COMPANY", x: 320, y: 200, score: 34 },
  { id: 2, label: "Sen. Hughes", type: "POLITICIAN", x: 160, y: 120, score: 28 },
  { id: 3, label: "Armed Services\nCommittee", type: "COMMITTEE", x: 160, y: 300, score: null },
  { id: 4, label: "DoD / Air Force", type: "AGENCY", x: 320, y: 360, score: null },
  { id: 5, label: "RaytheonPAC", type: "PAC", x: 480, y: 120, score: null },
  { id: 6, label: "F-35 Contract\n$5.1B", type: "CONTRACT", x: 480, y: 360, score: null },
  { id: 7, label: "Former AF General\nNow Raytheon VP", type: "PERSON", x: 320, y: 80, score: null },
];

const GRAPH_EDGES = [
  { from: 5, to: 2, label: "$2.8M PAC", color: "#E63946" },
  { from: 2, to: 3, label: "Sits on", color: "#888" },
  { from: 3, to: 4, label: "Oversees", color: "#888" },
  { from: 4, to: 6, label: "Awarded", color: "#F4A261" },
  { from: 6, to: 1, label: "Recipient", color: "#2A9D8F" },
  { from: 1, to: 5, label: "Controls", color: "#6A4C93" },
  { from: 7, to: 4, label: "Former role", color: "#888" },
  { from: 7, to: 1, label: "Now employed", color: "#E63946" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDollar(amount) {
  if (!amount && amount !== 0) return "N/A";
  const n = parseFloat(amount);
  if (isNaN(n)) return "N/A";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function amountColor(amount) {
  const n = parseFloat(amount);
  if (isNaN(n)) return "#888";
  if (n >= 1e9) return "#E63946";
  if (n >= 1e8) return "#F4A261";
  return "#F0EDE8";
}

function ScoreBadge({ score }) {
  const color = score >= 70 ? "#2A9D8F" : score >= 40 ? "#F4A261" : "#E63946";
  const label = score >= 70 ? "CLEAN" : score >= 40 ? "WATCH" : "HIGH RISK";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        border: `2px solid ${color}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color,
        fontWeight: 700,
      }}>{score}</div>
      <span style={{ fontSize: 9, color, fontFamily: "monospace", letterSpacing: 1 }}>{label}</span>
    </div>
  );
}

function RiskBadge({ level }) {
  const colors = { HIGH: "#E63946", MED: "#F4A261", LOW: "#2A9D8F" };
  return (
    <span style={{
      padding: "2px 6px", borderRadius: 2, fontSize: 9, fontWeight: 700,
      background: (colors[level] || "#888") + "22", color: colors[level] || "#888",
      fontFamily: "monospace", letterSpacing: 1,
    }}>{level}</span>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", padding: 10 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ width: 6, height: 6, background: "#E63946", borderRadius: "50%", animation: `pulse ${0.8 + i * 0.15}s infinite alternate` }} />
      ))}
    </div>
  );
}

function Ticker() {
  const [offset, setOffset] = useState(0);
  const items = ["● FEC FILING: $12M dark money Q1 2025", "● STOCK ACT: 3 new potential violations detected", "● CONTRACT: $4.2B DoD award — sole source justification filed", "● RULE: FTC antitrust rulemaking comment period closes in 4 days", "● DONOR: Top 5 defense PACs collectively donated $18M this cycle"];
  const text = items.join("     ");

  useEffect(() => {
    const interval = setInterval(() => setOffset(o => (o + 1) % (text.length * 8)), 40);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ background: "#E6394611", borderTop: "1px solid #E6394633", padding: "6px 20px", overflow: "hidden" }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#E63946", whiteSpace: "nowrap", transform: `translateX(-${offset}px)`, transition: "transform 0.04s linear" }}>
        {text + "     " + text}
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchContracts({ limit: 50 })
      .then(res => {
        if (res.success) setContracts(res.data || []);
        else setError("Failed to load contract data");
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const totalSpend = contracts.reduce((sum, c) => sum + parseFloat(c["Award Amount"] || 0), 0);
  const flagged = contracts.filter(c => parseFloat(c["Award Amount"] || 0) >= 5e8).length;

  const dynamicKPIs = [
    {
      label: "FY2024 Contracts Loaded",
      value: loading ? "…" : error ? "ERR" : contracts.length.toLocaleString(),
      change: loading ? "fetching…" : error ? "API error" : `+${flagged} >$500M`,
      up: true,
      sub: loading ? "loading from USASpending.gov" : "from USASpending.gov (live)",
    },
    {
      label: "Total Contract Spend",
      value: loading ? "…" : error ? "ERR" : formatDollar(totalSpend),
      change: loading ? "calculating…" : `across ${contracts.length} awards`,
      up: true,
      sub: loading ? "" : "FY2024 · top 50 by amount",
    },
    ...STATIC_KPIS,
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {dynamicKPIs.map((kpi, i) => (
          <div key={i} style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 4, padding: "16px 18px" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#555", letterSpacing: 2, marginBottom: 8 }}>{kpi.label.toUpperCase()}</div>
            {loading && i < 2 ? (
              <Spinner />
            ) : (
              <>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: "#F0EDE8", marginBottom: 4 }}>{kpi.value}</div>
                <div style={{ fontFamily: "monospace", fontSize: 11, color: kpi.up ? "#E63946" : "#2A9D8F" }}>{kpi.change}</div>
                <div style={{ fontFamily: "monospace", fontSize: 10, color: "#444", marginTop: 4 }}>{kpi.sub}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ background: "#E6394611", border: "1px solid #E6394644", borderRadius: 4, padding: "12px 16px", fontFamily: "monospace", fontSize: 11, color: "#E63946" }}>
          ⚠ Dashboard data error: {error} — static values shown below
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
        <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 4, padding: 20 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#E63946", letterSpacing: 2, marginBottom: 16 }}>▲ INDUSTRY DONOR INFLUENCE — FY2024 ($M PAC CONTRIBUTIONS)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {DONOR_INDUSTRIES.map((ind, i) => (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "#CCC" }}>{ind.name}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: ind.color }}>${ind.amount}M</span>
                </div>
                <div style={{ background: "#111", height: 6, borderRadius: 1 }}>
                  <div style={{ background: ind.color, height: "100%", width: `${ind.pct}%`, borderRadius: 1, transition: "width 1s ease" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 4, padding: 20, overflow: "hidden" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#E63946", letterSpacing: 2, marginBottom: 16 }}>◈ LIVE INTELLIGENCE FEED</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FEED_ITEMS.map((item, i) => (
              <div key={i} style={{ borderLeft: `2px solid ${item.risk === "HIGH" ? "#E63946" : item.risk === "MED" ? "#F4A261" : "#2A9D8F"}`, paddingLeft: 10 }}>
                <div style={{ fontFamily: "monospace", fontSize: 10, color: "#CCC", lineHeight: 1.4 }}>{item.text}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
                  <span style={{ fontFamily: "monospace", fontSize: 9, color: "#444" }}>{item.time}</span>
                  <RiskBadge level={item.risk} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Spending Module ───────────────────────────────────────────────────────────

function SpendingModule() {
  const [keyword, setKeyword] = useState("");
  const [inputVal, setInputVal] = useState("");
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = (kw) => {
    setLoading(true);
    setError(null);
    fetchContracts({ keyword: kw || undefined, limit: 25 })
      .then(res => {
        if (res.success) setContracts(res.data || []);
        else setError("Failed to load contract data");
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(""); }, []);

  const handleSearch = () => {
    setKeyword(inputVal);
    load(inputVal);
  };

  const topRecipients = [...contracts]
    .sort((a, b) => parseFloat(b["Award Amount"] || 0) - parseFloat(a["Award Amount"] || 0))
    .slice(0, 6);

  const maxAmount = topRecipients.length ? parseFloat(topRecipients[0]["Award Amount"] || 1) : 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Search bar */}
      <div style={{ display: "flex", gap: 10 }}>
        <input
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          placeholder="Search contractors, agencies, keywords… (e.g. Lockheed, defense, energy)"
          style={{ flex: 1, background: "#1A1A1A", border: "1px solid #333", borderRadius: 2, padding: "10px 14px", fontFamily: "monospace", fontSize: 12, color: "#F0EDE8", outline: "none" }}
        />
        <button onClick={handleSearch} style={{ background: "#E63946", border: "none", borderRadius: 2, padding: "10px 20px", fontFamily: "monospace", fontSize: 12, color: "#fff", cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>
          SEARCH
        </button>
        {keyword && (
          <button onClick={() => { setInputVal(""); setKeyword(""); load(""); }} style={{ background: "#222", border: "1px solid #333", borderRadius: 2, padding: "10px 14px", fontFamily: "monospace", fontSize: 12, color: "#888", cursor: "pointer" }}>
            CLEAR
          </button>
        )}
      </div>

      {/* Top contractors bar chart */}
      {!loading && !error && topRecipients.length > 0 && (
        <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 4, padding: 20 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#E63946", letterSpacing: 2, marginBottom: 14 }}>
            ▲ TOP CONTRACTORS{keyword ? ` — "${keyword.toUpperCase()}"` : " — ALL"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topRecipients.map((c, i) => {
              const amt = parseFloat(c["Award Amount"] || 0);
              const pct = (amt / maxAmount) * 100;
              return (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: "#CCC" }}>{(c["Recipient Name"] || "Unknown").slice(0, 40)}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: amountColor(amt) }}>{formatDollar(amt)}</span>
                  </div>
                  <div style={{ background: "#111", height: 5, borderRadius: 1 }}>
                    <div style={{ background: amountColor(amt), height: "100%", width: `${pct}%`, borderRadius: 1, transition: "width 0.5s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Status / error */}
      {error && (
        <div style={{ background: "#E6394611", border: "1px solid #E6394644", borderRadius: 4, padding: "12px 16px", fontFamily: "monospace", fontSize: 11, color: "#E63946" }}>
          ⚠ {error}
          <button onClick={() => load(keyword)} style={{ marginLeft: 12, background: "none", border: "1px solid #E63946", borderRadius: 2, padding: "2px 10px", color: "#E63946", cursor: "pointer", fontFamily: "monospace", fontSize: 10 }}>RETRY</button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #2A2A2A", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#E63946", letterSpacing: 2 }}>
          ◎ FEDERAL CONTRACTS — USASPENDING.GOV {loading ? "(loading…)" : `(${contracts.length} results${keyword ? ` for "${keyword}"` : ""})`}
        </div>

        {loading ? (
          <div style={{ padding: 20 }}><Spinner /></div>
        ) : contracts.length === 0 ? (
          <div style={{ padding: 24, fontFamily: "monospace", fontSize: 12, color: "#444", textAlign: "center" }}>
            No contracts found{keyword ? ` for "${keyword}"` : ""}. Try a different search term.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#111" }}>
                  {["Recipient", "Amount", "Agency", "Date", "Description"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontFamily: "monospace", fontSize: 9, color: "#555", letterSpacing: 1, borderBottom: "1px solid #222", whiteSpace: "nowrap" }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contracts.map((c, i) => {
                  const amt = parseFloat(c["Award Amount"] || 0);
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid #1E1E1E", background: i % 2 === 0 ? "transparent" : "#111" }}>
                      <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#F0EDE8", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c["Recipient Name"] || "—"}</td>
                      <td style={{ padding: "10px 14px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: amountColor(amt), whiteSpace: "nowrap" }}>{formatDollar(amt)}</td>
                      <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 10, color: "#888", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c["Awarding Agency"] || "—"}</td>
                      <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 10, color: "#666", whiteSpace: "nowrap" }}>{c["Award Date"] || "—"}</td>
                      <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 10, color: "#555", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(c["Description"] || "—").slice(0, 80)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Politician Module ─────────────────────────────────────────────────────────

function PoliticianModule() {
  const [selected, setSelected] = useState(0);
  const pol = POLITICIANS[selected];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, height: "100%" }}>
      <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #2A2A2A", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#E63946", letterSpacing: 2 }}>◉ POLITICIANS</div>
        {POLITICIANS.map((p, i) => (
          <div key={i} onClick={() => setSelected(i)} style={{
            padding: "14px 16px", borderBottom: "1px solid #1E1E1E", cursor: "pointer",
            background: selected === i ? "#222" : "transparent",
            borderLeft: selected === i ? "3px solid #E63946" : "3px solid transparent",
            transition: "all 0.15s",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontFamily: "monospace", fontSize: 12, color: "#F0EDE8", marginBottom: 2 }}>{p.name}</div>
                <div style={{ fontFamily: "monospace", fontSize: 10, color: "#555" }}>{p.party} · {p.state}</div>
              </div>
              <ScoreBadge score={p.score} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 4, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#F0EDE8" }}>{pol.name}</div>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "#666", marginTop: 4 }}>{pol.party === "R" ? "Republican" : pol.party === "D" ? "Democrat" : "Independent"} · {pol.state} · U.S. Senate</div>
          </div>
          <ScoreBadge score={pol.score} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Total Donations", value: pol.donors },
            { label: "Top Industry", value: pol.topIndustry },
            { label: "Stock Trades", value: pol.trades },
            { label: "Conflicts Found", value: pol.conflicts },
          ].map((s, i) => (
            <div key={i} style={{ background: "#111", borderRadius: 3, padding: "12px 14px" }}>
              <div style={{ fontFamily: "monospace", fontSize: 9, color: "#555", letterSpacing: 1, marginBottom: 6 }}>{s.label.toUpperCase()}</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, color: i === 3 && pol.conflicts > 0 ? "#E63946" : "#F0EDE8" }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "#0D0D0D", border: "1px solid #E6394633", borderRadius: 3, padding: 14 }}>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#E63946", letterSpacing: 2, marginBottom: 10 }}>⚠ AI-DETECTED CONFLICT SIGNALS</div>
          {pol.conflicts > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "#CCC", lineHeight: 1.5, borderLeft: "2px solid #E63946", paddingLeft: 10 }}>
                Traded {pol.topIndustry} sector stocks 18 days before committee vote. Pattern matches 3 prior cycles. Confidence: 87%
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "#CCC", lineHeight: 1.5, borderLeft: "2px solid #F4A261", paddingLeft: 10 }}>
                Top PAC donors received $1.2B in sole-source contracts from oversight committee agencies (FY2023–24)
              </div>
            </div>
          ) : (
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "#2A9D8F" }}>✓ No significant conflict signals detected in current cycle</div>
          )}
          <div style={{ fontFamily: "monospace", fontSize: 9, color: "#333", marginTop: 10 }}>Inference only — not a legal conclusion. Sources: FEC, USASpending, Senate Disclosure</div>
        </div>
      </div>
    </div>
  );
}

// ── Agent Module ──────────────────────────────────────────────────────────────

const RISK_COLORS = { HIGH: "#E63946", MED: "#F4A261", LOW: "#2A9D8F" };

function AiMessage({ structured }) {
  const [showSources, setShowSources] = useState(false);
  const { summary, findings, sources, inference, riskLevel, flags, policyResults, donorResults } = structured;
  const riskColor = RISK_COLORS[riskLevel] || "#888";

  return (
    <div style={{ maxWidth: "92%" }}>
      {/* Header row: source list + risk level badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontFamily: "monospace", fontSize: 11, color: "#E63946", letterSpacing: 1 }}>
          ◈ RECEIPTS AI{sources?.length ? ` — ${sources.join(" · ")}` : ""}
        </div>
        {riskLevel && (
          <span style={{ padding: "2px 8px", borderRadius: 2, fontSize: 9, fontWeight: 700, background: riskColor + "22", color: riskColor, fontFamily: "monospace", letterSpacing: 1 }}>
            RISK: {riskLevel}
          </span>
        )}
      </div>

      <div style={{ background: "#111", border: "1px solid #2A2A2A", borderRadius: "0 4px 4px 4px", padding: 16 }}>
        {/* Summary */}
        <div style={{ fontFamily: "monospace", fontSize: 12, color: "#CCC", marginBottom: 14, lineHeight: 1.6 }}>{summary}</div>

        {/* Findings table */}
        {findings?.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            <div style={{ fontFamily: "monospace", fontSize: 9, color: "#555", letterSpacing: 1, marginBottom: 4 }}>ENTITY · PATTERN · AMOUNT · FEC LINK · CONFIDENCE</div>
            {findings.map((f, j) => {
              const fColor = f.confidence === "HIGH" ? "#E63946" : f.confidence === "MED" ? "#F4A261" : "#888";
              return (
                <div key={j} style={{ padding: "10px 12px", background: "#1A1A1A", borderRadius: 2, borderLeft: `2px solid ${fColor}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <span style={{ fontFamily: "monospace", fontSize: 12, color: "#F0EDE8", fontWeight: 600 }}>{f.company}</span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {f.spendingAmount && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#F4A261" }}>{f.spendingAmount}</span>}
                      {f.riskScore != null && <span style={{ fontFamily: "monospace", fontSize: 10, color: fColor }}>SCORE: {f.riskScore}</span>}
                      <span style={{ padding: "1px 6px", borderRadius: 2, background: fColor + "22", color: fColor, fontFamily: "monospace", fontSize: 9, fontWeight: 700 }}>{f.confidence}</span>
                    </div>
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: 10, color: "#AAA", lineHeight: 1.5 }}>{f.pattern}</div>
                  {f.donorLink && <div style={{ fontFamily: "monospace", fontSize: 10, color: "#E63946", marginTop: 4 }}>◆ FEC: {f.donorLink}</div>}
                  {f.policyLink && <div style={{ fontFamily: "monospace", fontSize: 10, color: "#457B9D", marginTop: 2 }}>§ Rule: {f.policyLink}</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* Red flags */}
        {flags?.length > 0 && (
          <div style={{ background: "#E6394608", border: "1px solid #E6394633", borderRadius: 3, padding: "10px 12px", marginBottom: 14 }}>
            <div style={{ fontFamily: "monospace", fontSize: 9, color: "#E63946", letterSpacing: 1, marginBottom: 6 }}>⚑ RED FLAGS</div>
            {flags.map((flag, k) => (
              <div key={k} style={{ fontFamily: "monospace", fontSize: 10, color: "#CCC", lineHeight: 1.5, paddingLeft: 8, borderLeft: "1px solid #E6394644", marginBottom: 4 }}>{flag}</div>
            ))}
          </div>
        )}

        {/* Inference */}
        {inference && (
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#555", borderTop: "1px solid #222", paddingTop: 10, marginBottom: donorResults || policyResults ? 10 : 0 }}>
            ⚠ {inference}
          </div>
        )}

        {/* Source data toggle */}
        {(policyResults?.length > 0 || donorResults?.committees?.length > 0) && (
          <div style={{ borderTop: "1px solid #222", paddingTop: 10 }}>
            <button onClick={() => setShowSources(s => !s)} style={{ background: "none", border: "1px solid #2A2A2A", borderRadius: 2, padding: "4px 10px", fontFamily: "monospace", fontSize: 9, color: "#555", cursor: "pointer", letterSpacing: 1 }}>
              {showSources ? "▲ HIDE" : "▼ SHOW"} SOURCE DATA ({(policyResults?.length || 0) + (donorResults?.committees?.length || 0)} records)
            </button>

            {showSources && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Policy rules */}
                {policyResults?.length > 0 && (
                  <div>
                    <div style={{ fontFamily: "monospace", fontSize: 9, color: "#457B9D", letterSpacing: 1, marginBottom: 6 }}>FEDERAL REGISTER RULES</div>
                    {policyResults.slice(0, 4).map((r, k) => (
                      <div key={k} style={{ padding: "6px 10px", background: "#0D0D0D", borderRadius: 2, marginBottom: 4 }}>
                        <div style={{ fontFamily: "monospace", fontSize: 10, color: "#CCC" }}>{r.title?.slice(0, 80)}</div>
                        <div style={{ fontFamily: "monospace", fontSize: 9, color: "#444", marginTop: 2 }}>{r.agency} · {r.date} · {r.type}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* FEC committees */}
                {donorResults?.committees?.length > 0 && (
                  <div>
                    <div style={{ fontFamily: "monospace", fontSize: 9, color: "#E63946", letterSpacing: 1, marginBottom: 6 }}>FEC COMMITTEES / PACs</div>
                    {donorResults.committees.slice(0, 4).map((c, k) => (
                      <div key={k} style={{ padding: "6px 10px", background: "#0D0D0D", borderRadius: 2, marginBottom: 4 }}>
                        <div style={{ fontFamily: "monospace", fontSize: 10, color: "#CCC" }}>{c.name}</div>
                        <div style={{ fontFamily: "monospace", fontSize: 9, color: "#444", marginTop: 2 }}>
                          {c.type} · {c.party || "—"} · Receipts: {c.totalReceipts ? `$${(c.totalReceipts / 1e6).toFixed(1)}M` : "N/A"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentModule() {
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [msgs, setMsgs] = useState(CHAT_MESSAGES);
  const chatRef = useRef(null);

  const suggestions = [
    "Which companies donated to SASC chairs then got sole-source contracts?",
    "Show stock trades before pharma committee hearings",
    "Map dark money trail to FTC rulemaking",
    "Agencies overspending appropriations FY2024",
  ];

  const handleQuery = async () => {
    if (!input.trim() || thinking) return;
    const userMsg = { role: "user", text: input };
    setMsgs(m => [...m, userMsg]);
    setInput("");
    setThinking(true);

    try {
      const result = await queryAgent(input);
      const d = result.data;
      const aiMsg = {
        role: "ai",
        text: null,
        structured: {
          summary: d.summary || d.plan?.intent || "Analysis complete.",
          findings: d.findings || [],
          sources: d.sources || ["USASpending.gov", "Federal Register", "FEC"],
          inference: d.inference || "",
          riskLevel: d.riskLevel || null,
          flags: d.flags || [],
          policyResults: d.policyResults || [],
          donorResults: d.donorResults || null,
        },
      };
      setMsgs(m => [...m, aiMsg]);
    } catch (e) {
      setMsgs(m => [...m, {
        role: "ai", text: null,
        structured: {
          summary: `Error: ${e.message}. Please check that the backend is running on port 3001.`,
          findings: [], sources: [], inference: "", riskLevel: null, flags: [], policyResults: [], donorResults: null,
        },
      }]);
    } finally {
      setThinking(false);
      setTimeout(() => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }), 100);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 16, height: "calc(100vh - 200px)" }}>
      <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 4, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #2A2A2A", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2A9D8F", boxShadow: "0 0 8px #2A9D8F" }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#2A9D8F", letterSpacing: 2 }}>RECEIPTS INTELLIGENCE AGENT — ONLINE</span>
        </div>

        <div ref={chatRef} style={{ flex: 1, padding: 20, overflow: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {msgs.map((msg, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
              {msg.role === "user" ? (
                <div style={{ background: "#2A2A2A", border: "1px solid #333", borderRadius: "4px 4px 0 4px", padding: "10px 14px", maxWidth: "80%", fontFamily: "monospace", fontSize: 12, color: "#F0EDE8", lineHeight: 1.5 }}>{msg.text}</div>
              ) : (
                <AiMessage structured={msg.structured} />
              )}
            </div>
          ))}
          {thinking && (
            <div style={{ display: "flex", gap: 6, alignItems: "center", padding: 10 }}>
              <Spinner />
              <span style={{ fontFamily: "monospace", fontSize: 10, color: "#555", marginLeft: 6 }}>Querying FEC, USASpending, Federal Register… analyzing with Claude…</span>
            </div>
          )}
        </div>

        <div style={{ padding: 16, borderTop: "1px solid #2A2A2A" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => setInput(s)} style={{ background: "#111", border: "1px solid #333", borderRadius: 2, padding: "5px 10px", fontFamily: "monospace", fontSize: 10, color: "#888", cursor: "pointer", whiteSpace: "nowrap" }}>{s.slice(0, 34)}…</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleQuery()}
              placeholder="Query the intelligence agent… (press Enter or click QUERY)"
              style={{ flex: 1, background: "#111", border: "1px solid #333", borderRadius: 2, padding: "10px 14px", fontFamily: "monospace", fontSize: 12, color: "#F0EDE8", outline: "none" }}
            />
            <button
              onClick={handleQuery}
              disabled={thinking}
              style={{ background: thinking ? "#444" : "#E63946", border: "none", borderRadius: 2, padding: "10px 20px", fontFamily: "monospace", fontSize: 12, color: "#fff", cursor: thinking ? "not-allowed" : "pointer", fontWeight: 700 }}
            >
              {thinking ? "…" : "QUERY"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 4, padding: 16 }}>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#E63946", letterSpacing: 2, marginBottom: 12 }}>SOURCES ACTIVE</div>
          {[
            { label: "FEC Campaign API", live: true },
            { label: "USASpending.gov", live: true },
            { label: "Federal Register", live: true },
            { label: "GovInfo", live: false },
            { label: "OpenSecrets", live: false },
            { label: "Senate Disclosures", live: false },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 6, height: 6, background: s.live ? "#2A9D8F" : "#333", borderRadius: "50%" }} />
              <span style={{ fontFamily: "monospace", fontSize: 10, color: s.live ? "#888" : "#444" }}>{s.label}</span>
              {!s.live && <span style={{ fontFamily: "monospace", fontSize: 8, color: "#333" }}>—</span>}
            </div>
          ))}
        </div>
        <div style={{ background: "#1A1A1A", border: "1px solid #E6394633", borderRadius: 4, padding: 16 }}>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#E63946", letterSpacing: 2, marginBottom: 10 }}>DISCLAIMER</div>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#444", lineHeight: 1.6 }}>All data from public federal records. AI inferences are investigative hypotheses, not legal conclusions. Signal ≠ proof.</div>
        </div>
      </div>
    </div>
  );
}

// ── Graph Module ──────────────────────────────────────────────────────────────

function GraphModule() {
  const [hoveredNode, setHoveredNode] = useState(null);
  const typeColors = { COMPANY: "#2A9D8F", POLITICIAN: "#F4A261", COMMITTEE: "#6A4C93", AGENCY: "#457B9D", PAC: "#E63946", CONTRACT: "#E9C46A", PERSON: "#F0EDE8" };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 16, height: "calc(100vh - 200px)" }}>
      <div style={{ background: "#0D0D0D", border: "1px solid #2A2A2A", borderRadius: 4, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 14, left: 16, fontFamily: "monospace", fontSize: 10, color: "#E63946", letterSpacing: 2 }}>⬡ ENTITY RELATIONSHIP GRAPH — RAYTHEON DONOR WEB</div>
        <svg width="100%" height="100%" viewBox="0 0 640 480">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {GRAPH_EDGES.map((edge, i) => {
            const from = GRAPH_NODES.find(n => n.id === edge.from);
            const to = GRAPH_NODES.find(n => n.id === edge.to);
            const mx = (from.x + to.x) / 2;
            const my = (from.y + to.y) / 2;
            return (
              <g key={i}>
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={edge.color} strokeWidth={1.5} strokeOpacity={0.5} strokeDasharray={edge.color === "#888" ? "4,4" : "0"} />
                <text x={mx} y={my - 6} textAnchor="middle" fill={edge.color} fontSize={8} fontFamily="monospace" opacity={0.7}>{edge.label}</text>
              </g>
            );
          })}
          {GRAPH_NODES.map((node) => (
            <g key={node.id} onMouseEnter={() => setHoveredNode(node.id)} onMouseLeave={() => setHoveredNode(null)} style={{ cursor: "pointer" }}>
              <circle cx={node.x} cy={node.y} r={hoveredNode === node.id ? 28 : 22} fill={typeColors[node.type] + "22"} stroke={typeColors[node.type]} strokeWidth={hoveredNode === node.id ? 2 : 1} filter={hoveredNode === node.id ? "url(#glow)" : ""} />
              {node.label.split("\n").map((line, li) => (
                <text key={li} x={node.x} y={node.y + (li - (node.label.split("\n").length - 1) / 2) * 12 + 4} textAnchor="middle" fill={typeColors[node.type]} fontSize={8.5} fontFamily="monospace" fontWeight={600}>{line}</text>
              ))}
              {node.score && (
                <text x={node.x + 18} y={node.y - 18} fill="#E63946" fontSize={9} fontFamily="monospace" fontWeight={700}>{node.score}</text>
              )}
            </g>
          ))}
        </svg>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 4, padding: 16 }}>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#E63946", letterSpacing: 2, marginBottom: 12 }}>NODE LEGEND</div>
          {Object.entries(typeColors).map(([type, color]) => (
            <div key={type} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: color + "44", border: `1px solid ${color}` }} />
              <span style={{ fontFamily: "monospace", fontSize: 10, color: "#888" }}>{type}</span>
            </div>
          ))}
        </div>
        <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 4, padding: 16, flex: 1 }}>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#E63946", letterSpacing: 2, marginBottom: 12 }}>VIEWS</div>
          {["Donor Web", "Dark Money Chain", "Revolving Door", "Follow the Money", "Regulatory Capture"].map((v, i) => (
            <div key={i} style={{ padding: "8px 10px", marginBottom: 4, background: i === 0 ? "#E6394611" : "#111", border: `1px solid ${i === 0 ? "#E6394644" : "#1E1E1E"}`, borderRadius: 2, fontFamily: "monospace", fontSize: 11, color: i === 0 ? "#E63946" : "#666", cursor: "pointer" }}>{v}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── App Shell ─────────────────────────────────────────────────────────────────

export default function App() {
  const [active, setActive] = useState("dashboard");

  const renderContent = () => {
    if (active === "dashboard") return <Dashboard />;
    if (active === "politicians") return <PoliticianModule />;
    if (active === "agent") return <AgentModule />;
    if (active === "graph") return <GraphModule />;
    if (active === "spending") return <SpendingModule />;
    return null;
  };

  return (
    <div style={{ background: "#0D0D0D", minHeight: "100vh", color: "#F0EDE8", fontFamily: "monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=IBM+Plex+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #111; } ::-webkit-scrollbar-thumb { background: #333; }
        @keyframes pulse { from { opacity: 0.3; transform: scale(0.8); } to { opacity: 1; transform: scale(1.2); } }
        input::placeholder { color: #444; }
        button:hover { opacity: 0.85; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#111", borderBottom: "1px solid #1E1E1E", padding: "0 24px", display: "flex", alignItems: "center", gap: 0, height: 52 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 1, marginRight: 40 }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#F0EDE8", letterSpacing: 2 }}>R</span>
          <div style={{ width: 7, height: 7, background: "#E63946", borderRadius: "50%", marginBottom: 2, marginLeft: 1, marginRight: 1 }} />
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#F0EDE8", letterSpacing: 2 }}>CEIPTS</span>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", background: "#0D0D0D", border: "1px solid #1E1E1E", borderRadius: 2, padding: "0 14px", height: 34, maxWidth: 480, gap: 8 }}>
          <span style={{ color: "#444", fontSize: 12 }}>⌕</span>
          <input placeholder="Search entities, agencies, politicians, companies…" style={{ flex: 1, background: "none", border: "none", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#F0EDE8", outline: "none" }} />
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{ fontFamily: "monospace", fontSize: 10, color: "#E63946", letterSpacing: 1 }}>● LIVE</span>
          <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 2, padding: "5px 12px", fontFamily: "monospace", fontSize: 10, color: "#888" }}>🔔 12</div>
          <div style={{ background: "#E6394622", border: "1px solid #E6394644", borderRadius: 2, padding: "5px 12px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#E63946", cursor: "pointer" }}>ANALYST</div>
        </div>
      </div>

      <Ticker />

      <div style={{ display: "flex" }}>
        {/* Sidebar */}
        <div style={{ width: 56, background: "#111", borderRight: "1px solid #1E1E1E", minHeight: "calc(100vh - 72px)", display: "flex", flexDirection: "column", gap: 2, padding: "12px 0" }}>
          {MODULES.map((mod) => (
            <button key={mod.id} onClick={() => setActive(mod.id)} title={mod.label} style={{
              background: active === mod.id ? "#E6394611" : "transparent",
              border: "none", borderLeft: active === mod.id ? "2px solid #E63946" : "2px solid transparent",
              width: "100%", padding: "12px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            }}>
              <span style={{ fontSize: 14, color: active === mod.id ? "#E63946" : "#444" }}>{mod.icon}</span>
              <span style={{ fontFamily: "monospace", fontSize: 7, color: active === mod.id ? "#E63946" : "#333", letterSpacing: 0.5 }}>{mod.label.slice(0, 5).toUpperCase()}</span>
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, padding: 20, overflow: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#E63946", letterSpacing: 2 }}>{MODULES.find(m => m.id === active)?.icon}</span>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#F0EDE8", fontWeight: 400 }}>
              {active === "dashboard" ? "National Accountability Dashboard" :
               active === "agent" ? "Policy Intelligence Agent" :
               active === "politicians" ? "Politician Donor Intelligence" :
               active === "graph" ? "Entity Relationship Graph" :
               active === "spending" ? "Federal Spending Audit" :
               MODULES.find(m => m.id === active)?.label}
            </h1>
            <div style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: 10, color: "#333" }}>
              Last sync: {new Date().toLocaleTimeString()} · Data: FEC + USASpending + FedReg + GovInfo + OpenSecrets
            </div>
          </div>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
