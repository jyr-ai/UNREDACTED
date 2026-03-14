import { useState, useEffect } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";
import { useTheme } from "../theme/index.js";
import { ORANGE, BLUE, FONT_MONO as MF, FONT_SERIF as SF } from "../theme/tokens.js";
import { Band, Card, CardTitle, SourceFooter, Legend } from "../components/ui/index.js";
import { SPEND, TREND } from "../data/spending.js";
import { fetchContracts } from "../api/client.js";
import LiveFeedPanel from "../components/LiveFeedPanel.jsx";

function Tip({ active, payload, label, fmt }) {
  const t = useTheme();
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: t.ink, border: `1px solid ${t.border}`, borderLeft: `3px solid ${t.accent}`, padding: "8px 12px", fontFamily: MF }}>
      <div style={{ fontSize: 9, color: t.mid, letterSpacing: 1, marginBottom: 5 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 11, color: t.hi, marginBottom: 2 }}>
          <span style={{ color: p.color || t.mid, marginRight: 5, fontSize: 8 }}>■</span>
          {p.name}:&ensp;<span style={{ color: t.accent }}>{fmt ? fmt(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

const ax = (t) => ({ axisLine: { stroke: t.border }, tickLine: false, tick: { fontFamily: MF, fontSize: 9.5, fill: t.mid } });

export default function Overview() {
  const t = useTheme();
  const [live, setLive] = useState(null);

  useEffect(() => {
    fetchContracts({ limit: 50 }).then(r => { if (r.success) setLive(r); }).catch(() => {});
  }, []);

  const totalSpend  = live ? live.data.reduce((s, c) => s + parseFloat(c["Award Amount"] || 0), 0) : null;
  const flaggedCnt  = live ? live.data.filter(c => parseFloat(c["Award Amount"] || 0) >= 5e8).length : null;
  const fmtK = n => n >= 1e12 ? `$${(n/1e12).toFixed(1)}T` : n >= 1e9 ? `$${(n/1e9).toFixed(1)}bn` : n >= 1e6 ? `$${(n/1e6).toFixed(0)}m` : `$${n?.toFixed(0)}`;

  const kpis = [
    { v: totalSpend != null ? fmtK(totalSpend) : "$157bn", d: totalSpend != null ? "Contract obligations loaded" : "Overspent vs appropriations", s: live?.fiscalYear ? `FY${live.fiscalYear} · live · USASpending.gov` : "FY2024 federal agencies" },
    { v: flaggedCnt != null ? String(flaggedCnt) : "1,847", d: flaggedCnt != null ? "Contracts ≥ $500M flagged" : "Contracts flagged anomalous", s: flaggedCnt != null ? `From ${live?.data?.length} loaded` : "Across 23 federal agencies" },
    { v: "34",    d: "STOCK Act potential violations", s: "Current congressional session" },
    { v: "$18bn", d: "PAC donations to Congress",     s: "2023–24 election cycle" },
  ];

  const findings = [
    { c: ORANGE,  h: "Defence dominates",         b: "Four of the five lowest accountability scores belong to defence contractors. Sole-source contracts account for 68% of total awards." },
    { c: t.blue,  h: "Pharma's rising footprint", b: "Pharmaceutical PAC spending rose 106% from 2016–2024 — faster than any sector — while drug-pricing legislation stalled in committee." },
    { c: t.warn,  h: "No STOCK Act prosecution",  b: "Despite 34 flagged potential violations in the current session, no member of Congress has faced criminal prosecution since 2012." },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

      {/* ── LIVE INTELLIGENCE FEEDS (pinned at top of Overview) ── */}
      <LiveFeedPanel />

      <div style={{ borderTop: `3px solid ${ORANGE}`, paddingTop: 16 }}>
        <div style={{ fontFamily: MF, fontSize: 9, color: ORANGE, letterSpacing: 3, marginBottom: 8 }}>SPECIAL REPORT · FISCAL YEAR 2024</div>
        <h2 style={{ fontFamily: SF, fontSize: 36, color: t.hi, fontWeight: 700, lineHeight: 1.1, marginBottom: 10, maxWidth: 680 }}>The price of influence</h2>
        <p style={{ fontFamily: SF, fontSize: 14, fontStyle: "italic", color: t.mid, lineHeight: 1.75, maxWidth: 640 }}>
          American companies that donate most generously to congressional campaigns receive disproportionate federal contracts. A cross-source analysis of FEC, USASpending and procurement data reveals the pattern in stark relief.
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}` }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ padding: "18px 20px", borderRight: i < 3 ? `1px solid ${t.border}` : "none" }}>
            <div style={{ fontFamily: SF, fontSize: 34, color: t.kpiNum, lineHeight: 1, marginBottom: 5 }}>{k.v}</div>
            <div style={{ fontFamily: MF, fontSize: 10.5, color: t.hi, marginBottom: 3 }}>{k.d}</div>
            <div style={{ fontFamily: MF, fontSize: 9, color: t.low }}>{k.s}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div>
          <Band label="Federal spending deviation" right="USASPENDING.GOV" />
          <Card>
            <CardTitle h="Most agencies exceeded their appropriation in FY2024." sub="Actual spending as % of appropriation · FY2024 · 100 = on budget" />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={SPEND} layout="vertical" margin={{ left: 4, right: 46, top: 0, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid horizontal={false} stroke={t.grid} />
                <XAxis type="number" domain={[82,118]} {...ax(t)} tickFormatter={v => `${v}%`} ticks={[85,90,95,100,105,110,115]} />
                <YAxis type="category" dataKey="a" {...ax(t)} width={66} />
                <Tooltip content={<Tip fmt={v => `${v}%`} />} />
                <ReferenceLine x={100} stroke={t.mid} strokeWidth={1} strokeDasharray="4 2" label={{ value:"100%", position:"top", style:{ fontFamily:MF, fontSize:8, fill:t.mid } }} />
                <Bar dataKey="p" name="% of budget" radius={0} barSize={13}>
                  {SPEND.map((d,i) => <Cell key={i} fill={d.p > 100 ? ORANGE : t.ok} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display:"flex", gap:16, marginTop:8 }}>
              {[["Over budget", ORANGE],["Under budget", t.ok]].map(([l,c]) => (
                <div key={l} style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <div style={{ width:10, height:10, background:c }} /><span style={{ fontFamily:MF, fontSize:9, color:t.mid }}>{l}</span>
                </div>
              ))}
            </div>
            <SourceFooter s="USASpending.gov; GovInfo budget justifications" />
          </Card>
        </div>
        <div>
          <Band label="PAC contribution trends" right="FEC · OPENSECRETS" />
          <Card>
            <CardTitle h="Pharmaceutical PAC spending has nearly doubled since 2016." sub="Annual PAC contributions by sector · $m · 2016–2024" />
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={TREND} margin={{ left: 0, right: 52, top: 12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
                <XAxis dataKey="y" {...ax(t)} />
                <YAxis {...ax(t)} tickFormatter={v => `$${v}m`} width={52} />
                <Tooltip content={<Tip fmt={v => `$${v}m`} />} />
                <ReferenceLine x="2020" stroke={t.border} strokeDasharray="3 3" label={{ value:"Covid-19", position:"insideTopRight", style:{ fontFamily:MF, fontSize:8, fill:t.low } }} />
                <Line type="monotone" dataKey="d"  name="Defence" stroke={t.mid}  strokeWidth={2}   dot={false} />
                <Line type="monotone" dataKey="ph" name="Pharma"  stroke={ORANGE} strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="f"  name="Finance" stroke={t.blue} strokeWidth={2}   dot={false} />
                <Line type="monotone" dataKey="e"  name="Energy"  stroke={t.warn} strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
            <Legend items={[["Defence",t.mid],["Pharma",ORANGE],["Finance",t.blue],["Energy",t.warn,true]]} />
            <SourceFooter s="FEC schedule B; OpenSecrets; 2016–2024 election cycles" />
          </Card>
        </div>
      </div>

      {/* Key findings */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        {findings.map((f, i) => (
          <div key={i} style={{ background: t.card, border: `1px solid ${t.border}`, borderTop: `3px solid ${f.c}`, padding: "18px 18px 16px" }}>
            <div style={{ fontFamily: MF, fontSize: 8.5, color: f.c, letterSpacing: 2, marginBottom: 8 }}>▸ KEY FINDING</div>
            <div style={{ fontFamily: SF, fontSize: 14, color: t.hi, lineHeight: 1.3, fontWeight: 700, marginBottom: 8 }}>{f.h}</div>
            <div style={{ fontFamily: SF, fontStyle: "italic", fontSize: 12, color: t.mid, lineHeight: 1.65 }}>{f.b}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
