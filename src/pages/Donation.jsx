import { useState } from "react";
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useTheme } from "../theme/index.js";
import { ORANGE, FONT_MONO as MF, FONT_SERIF as SF } from "../theme/tokens.js";
import { Band, Card, CardTitle, SourceFooter, Legend } from "../components/ui/index.js";
import { DONORS, CORPS } from "../data/donors.js";
import { TREND } from "../data/spending.js";
import { GN_NODES, GN_EDGES, NODE_COL } from "../data/graph.js";

const ax = t => ({ axisLine:{ stroke:t.border }, tickLine:false, tick:{ fontFamily:MF, fontSize:9.5, fill:t.mid } });
const SUBTABS = [{ id:"intel", label:"Donor Intel" }, { id:"web", label:"Entity Network" }];

export default function Donation() {
  const t = useTheme();
  const [sub, setSub] = useState("intel");
  const [sel, setSel] = useState(null);

  const topDonors = [...DONORS].sort((a,b)=>b.pac-a.pac);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:22 }}>
      <div style={{ borderTop:`3px solid ${ORANGE}`, paddingTop:16 }}>
        <div style={{ fontFamily:MF, fontSize:9, color:ORANGE, letterSpacing:3, marginBottom:8 }}>DONOR INTELLIGENCE · FEC · OPENSECRETS · STOCKACT</div>
        <h2 style={{ fontFamily:SF, fontSize:32, color:t.hi, fontWeight:700, lineHeight:1.1, marginBottom:8 }}>Donation &amp; Donor Networks</h2>
        <p style={{ fontFamily:SF, fontSize:14, fontStyle:"italic", color:t.mid, lineHeight:1.7, maxWidth:640 }}>
          Corporate PAC contributions, congressional recipient profiles, and the dark money entity web linking donors to legislation.
        </p>
      </div>

      {/* Sub-tab nav */}
      <div style={{ display:"flex", borderBottom:`1px solid ${t.border}` }}>
        {SUBTABS.map(st => (
          <button key={st.id} onClick={()=>setSub(st.id)} style={{ background:"none", border:"none", cursor:"pointer", padding:"10px 20px", fontFamily:MF, fontSize:10.5, letterSpacing:0.5, color:sub===st.id?ORANGE:t.mid, borderBottom:`3px solid ${sub===st.id?ORANGE:"transparent"}`, marginBottom:-1, transition:"all .14s" }}>{st.label}</button>
        ))}
      </div>

      {sub === "intel" && (
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
            <div>
              <Band label="Top PAC donors" right="FEC · FY2024" />
              <Card>
                <CardTitle h="Blackstone leads corporate PAC contributions in 2024." sub="PAC donations ($m) · top 10 companies · FY2024" />
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={topDonors} layout="vertical" margin={{ left:4, right:46, top:0, bottom:0 }} barCategoryGap="22%">
                    <CartesianGrid horizontal={false} stroke={t.grid} />
                    <XAxis type="number" {...ax(t)} tickFormatter={v=>`$${v}m`} />
                    <YAxis type="category" dataKey="n" {...ax(t)} width={80} tick={{ fontFamily:MF, fontSize:8.5, fill:t.mid }} />
                    <Tooltip contentStyle={{ background:t.card, border:`1px solid ${t.border}`, fontFamily:MF }} formatter={v=>[`$${v}m`,"PAC"]} />
                    <Bar dataKey="pac" name="PAC ($m)" barSize={11} radius={0}>
                      {topDonors.map((d,i)=><Cell key={i} fill={i<3?ORANGE:t.blue} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <SourceFooter s="FEC campaign finance disclosure · Q4 2024" />
              </Card>
            </div>

            <div>
              <Band label="PAC trends by sector" right="2016–2024" />
              <Card>
                <CardTitle h="Finance and Pharma dominate the donor landscape." sub="PAC contributions by sector · $m · stacked" />
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={TREND} margin={{ left:0, right:48, top:10, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
                    <XAxis dataKey="y" {...ax(t)} />
                    <YAxis {...ax(t)} tickFormatter={v=>`$${v}m`} width={52} />
                    <Tooltip contentStyle={{ background:t.card, border:`1px solid ${t.border}`, fontFamily:MF, fontSize:11 }} formatter={v=>[`$${v}m`]} />
                    <Area type="monotone" dataKey="ph" name="Pharma"  stackId="1" fill={ORANGE+"55"} stroke={ORANGE} strokeWidth={2} />
                    <Area type="monotone" dataKey="f"  name="Finance" stackId="1" fill={t.blue+"55"} stroke={t.blue}  strokeWidth={2} />
                    <Area type="monotone" dataKey="d"  name="Defence" stackId="1" fill={t.mid+"33"}  stroke={t.mid}   strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
                <Legend items={[["Pharma",ORANGE],["Finance",t.blue],["Defence",t.mid]]} />
                <SourceFooter s="FEC Schedule B; OpenSecrets; election cycles 2016–2024" />
              </Card>
            </div>
          </div>

          {/* Politician profiles */}
          <Band label="Congressional recipient profiles" right="CURRENT SESSION" />
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
            {DONORS.slice(0,8).map((d,i) => (
              <div key={i} style={{ background:t.card, border:`1px solid ${t.border}`, borderTop:`3px solid ${d.pac>18?ORANGE:t.blue}`, padding:"14px 16px" }}>
                <div style={{ fontFamily:MF, fontSize:9, color:t.low, marginBottom:6 }}>{d.s?.toUpperCase()}</div>
                <div style={{ fontFamily:SF, fontSize:13, color:t.hi, lineHeight:1.3, fontWeight:700, marginBottom:8 }}>{d.n}</div>
                <div style={{ fontFamily:MF, fontSize:10, color:ORANGE, marginBottom:5 }}>${d.pac}m PAC</div>
                <div style={{ fontFamily:MF, fontSize:9, color:t.mid }}>Score: <span style={{ color:d.sc<40?ORANGE:d.sc<60?t.warn:t.ok, fontWeight:700 }}>{d.sc}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sub === "web" && (
        <div>
          <Band label="Entity network — dark money web" right="FEC · ProPublica · IRS 990" />
          <Card>
            <CardTitle h="Shell entities and PAC conduits connecting donors to legislation." sub="Click a node for details · edges show fund flow" />
            <div style={{ position:"relative" }}>
              <svg width="100%" viewBox="0 0 760 400" style={{ fontFamily:MF, cursor:"default" }}>
                <defs>
                  <marker id="arr" markerWidth="6" markerHeight="6" refX="4" refY="2" orient="auto">
                    <path d="M0,0 L0,4 L6,2 z" fill="#444" />
                  </marker>
                </defs>
                {GN_EDGES.map((e,i) => {
                  const src = GN_NODES.find(n=>n.id===e.s);
                  const tgt = GN_NODES.find(n=>n.id===e.t);
                  if (!src||!tgt) return null;
                  return <line key={i} x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y} stroke={e.suspicious?"#FF8000":"#3a3a3a"} strokeWidth={e.suspicious?1.8:1} strokeDasharray={e.suspicious?"6 3":undefined} markerEnd="url(#arr)" opacity={0.7} />;
                })}
                {GN_NODES.map(n => (
                  <g key={n.id} onClick={()=>setSel(sel?.id===n.id?null:n)} style={{ cursor:"pointer" }}>
                    <circle cx={n.x} cy={n.y} r={n.type==="hub"?20:n.type==="pac"?14:10} fill={NODE_COL[n.type]||"#444"} stroke={sel?.id===n.id?ORANGE:"#222"} strokeWidth={sel?.id===n.id?2.5:1} opacity={0.92} />
                    <text x={n.x} y={n.y+28} textAnchor="middle" fontSize={8} fill="#aaa" fontFamily={MF}>{n.label}</text>
                  </g>
                ))}
              </svg>
              {sel && (
                <div style={{ position:"absolute", top:10, right:10, background:t.cardB, border:`1px solid ${ORANGE}`, borderTop:`3px solid ${ORANGE}`, padding:"12px 16px", minWidth:200, fontFamily:MF }}>
                  <div style={{ fontSize:9, color:ORANGE, letterSpacing:2, marginBottom:8 }}>NODE DETAIL</div>
                  <div style={{ fontSize:12, color:"#fff", marginBottom:5, fontWeight:700 }}>{sel.label}</div>
                  <div style={{ fontSize:9.5, color:t.mid, marginBottom:4 }}>Type: <span style={{ color:NODE_COL[sel.type]||"#fff" }}>{sel.type?.toUpperCase()}</span></div>
                  {sel.desc && <div style={{ fontSize:10, color:t.mid, lineHeight:1.6 }}>{sel.desc}</div>}
                </div>
              )}
            </div>
            <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginTop:10 }}>
              {Object.entries(NODE_COL).map(([type, color]) => (
                <div key={type} style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <div style={{ width:10, height:10, borderRadius:"50%", background:color }} />
                  <span style={{ fontFamily:MF, fontSize:9, color:t.mid }}>{type}</span>
                </div>
              ))}
            </div>
            <SourceFooter s="FEC; ProPublica nonprofits; IRS 990; OpenSecrets dark money" />
          </Card>
        </div>
      )}
    </div>
  );
}
