import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTheme } from "../theme/index.js";
import { ORANGE, WHITE, FONT_MONO as MF, FONT_SERIF as SF } from "../theme/tokens.js";
import { Band, Card, CardTitle, SourceFooter, Legend } from "../components/ui/index.js";
import { POLICY_MONTHLY } from "../data/policy.js";
import { queryAgent } from "../api/client.js";

const ax = t => ({ axisLine:{ stroke:t.border }, tickLine:false, tick:{ fontFamily:MF, fontSize:9.5, fill:t.mid } });

const STARTERS = [
  "EOs affecting EPA 2025",
  "Bills correlated with defence donors",
  "Rules weakened post-lobbying",
  "Agencies over appropriation",
];

export default function Policy() {
  const t = useTheme();
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottom = useRef(null);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs, thinking]);

  const send = async (q) => {
    const text = (q || input).trim();
    if (!text) return;
    setInput(""); setThinking(true);
    setMsgs(m => [...m, { role:"user", text }]);
    try {
      const res = await queryAgent(text);
      const d = res.data || {};
      const findings = [];
      (d.policyResults||[]).slice(0,3).forEach(p => findings.push({ id:(p.url||"").split("/").slice(-1)[0]?.slice(0,14)||"RULE", title:(p.title||"Policy Finding").slice(0,70), date:p.date||"", detail:`${p.agency||"Federal Agency"}: ${(p.abstract||p.type||"").slice(0,140)}`, risk:p.significant?"HIGH":"MED" }));
      (d.findings||[]).slice(0,2).forEach(f => findings.push({ id:(f.company||"FINDING").slice(0,12), title:(f.pattern||"Pattern").slice(0,60), date:"", detail:[f.company,f.spendingAmount,f.policyLink].filter(Boolean).join(" · ").slice(0,140)||d.summary||"", risk:f.confidence==="HIGH"?"HIGH":"MED" }));
      if (!findings.length) findings.push({ id:"RESULT", title:"Analysis complete", date:"", detail:d.summary||"Query processed. No matching records found.", risk:"MED" });
      setMsgs(m => [...m, { role:"ai", findings, signal:d.inference||"Cross-source analysis complete.", sources:d.sources||["FEC","USASpending.gov","FederalRegister.gov"] }]);
    } catch(e) {
      setMsgs(m => [...m, { role:"ai", findings:[{ id:"ERR", title:"Agent unavailable", date:"", detail:e.message, risk:"MED" }], signal:"", sources:[] }]);
    }
    setThinking(false);
  };

  const rc = f => f.risk==="HIGH"?ORANGE:f.risk==="MED"?"#FFB84D":"#4A7FFF";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:22 }}>
      <div style={{ borderTop:`3px solid ${ORANGE}`, paddingTop:16 }}>
        <div style={{ fontFamily:MF, fontSize:9, color:ORANGE, letterSpacing:3, marginBottom:8 }}>POLICY INTELLIGENCE · FEDREGISTER · GOVINFO</div>
        <h2 style={{ fontFamily:SF, fontSize:32, color:t.hi, fontWeight:700, lineHeight:1.1, marginBottom:8 }}>AI policy agent</h2>
        <p style={{ fontFamily:SF, fontSize:14, fontStyle:"italic", color:t.mid, lineHeight:1.7, maxWidth:640 }}>Query federal regulations, executive orders, and spending data. Every response is grounded in primary federal records.</p>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 260px", gap:20 }}>
        {/* Chat panel */}
        <div style={{ background:t.card, border:`1px solid ${t.border}`, display:"flex", flexDirection:"column" }}>
          <div style={{ background:t.band, padding:"7px 14px", display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:"#00FF88", boxShadow:"0 0 6px #00FF88" }} />
            <span style={{ fontFamily:MF, fontSize:9, color:WHITE, letterSpacing:2 }}>UN*REDACTED POLICY AGENT — ONLINE</span>
          </div>

          <div style={{ flex:1, padding:18, display:"flex", flexDirection:"column", gap:14, overflowY:"auto", minHeight:280, maxHeight:400 }}>
            {msgs.map((m,i) => m.role==="user" ? (
              <div key={i} style={{ display:"flex", justifyContent:"flex-end" }}>
                <div style={{ background:t.cardB, border:`1px solid ${t.border}`, padding:"10px 14px", maxWidth:"82%", fontFamily:MF, fontSize:11, color:t.hi, lineHeight:1.6 }}>{m.text}</div>
              </div>
            ) : (
              <div key={i} style={{ maxWidth:"95%" }}>
                <div style={{ fontFamily:MF, fontSize:8.5, color:ORANGE, marginBottom:7, letterSpacing:1.5 }}>◈ UN*REDACTED AI · {m.sources?.join(" · ")}</div>
                <div style={{ background:t.findBg||t.cardB, border:`1px solid ${t.border}`, padding:14 }}>
                  <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:10 }}>
                    {m.findings?.map((f,j) => (
                      <div key={j} style={{ background:t.card, borderLeft:`3px solid ${rc(f)}`, padding:"9px 12px", display:"grid", gridTemplateColumns:"80px 1fr auto", gap:8 }}>
                        <div><div style={{ fontFamily:MF, fontSize:9, color:ORANGE }}>{f.id}</div><div style={{ fontFamily:MF, fontSize:8, color:t.low }}>{f.date}</div></div>
                        <div><div style={{ fontFamily:MF, fontSize:10.5, color:t.hi, marginBottom:3 }}>{f.title}</div><div style={{ fontFamily:SF, fontStyle:"italic", fontSize:11, color:t.mid }}>{f.detail}</div></div>
                        <span style={{ fontFamily:MF, fontSize:8, color:rc(f), border:`1px solid ${rc(f)}44`, padding:"2px 6px", whiteSpace:"nowrap" }}>{f.risk}</span>
                      </div>
                    ))}
                  </div>
                  {m.signal && <div style={{ fontFamily:MF, fontSize:9, color:ORANGE, borderTop:`1px solid ${t.border}`, paddingTop:8 }}>⚠ {m.signal}</div>}
                </div>
              </div>
            ))}
            {thinking && <div style={{ display:"flex", gap:5, alignItems:"center" }}>{[0,1,2].map(i=><div key={i} style={{ width:5, height:5, borderRadius:"50%", background:ORANGE, animation:`dot ${0.7+i*0.2}s ${i*0.15}s infinite alternate` }}/>)}<span style={{ fontFamily:MF, fontSize:9, color:t.low, marginLeft:8 }}>Querying FedReg…</span></div>}
            <div ref={bottom} />
          </div>

          <div style={{ borderTop:`1px solid ${t.border}`, padding:"12px 14px 14px", flexShrink:0 }}>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
              {STARTERS.map((s,i) => <button key={i} onClick={()=>setInput(s)} style={{ background:t.cardB, border:`1px solid ${t.border}`, padding:"4px 9px", fontFamily:MF, fontSize:9, color:t.mid, cursor:"pointer" }}>{s}</button>)}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Query regulations, executive orders, spending patterns…" style={{ flex:1, background:t.inputBg, border:`1px solid ${t.border}`, borderLeft:`2px solid ${ORANGE}`, padding:"9px 12px", fontFamily:MF, fontSize:11, color:t.hi, outline:"none" }} />
              <button onClick={()=>send()} style={{ background:ORANGE, border:"none", padding:"0 20px", fontFamily:MF, fontSize:10.5, color:WHITE, fontWeight:700, letterSpacing:1 }}>QUERY</button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <Band label="Policy activity FY2024" right="FED. REGISTER" />
            <Card>
              <CardTitle h="Executive orders and rules by month" sub="Count · 2024" />
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={POLICY_MONTHLY} margin={{ left:0, right:4, top:8, bottom:0 }} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
                  <XAxis dataKey="m" {...ax(t)} />
                  <YAxis {...ax(t)} width={24} />
                  <Tooltip contentStyle={{ background:t.cardB, border:`1px solid ${t.border}`, fontFamily:MF, fontSize:11 }} />
                  <Bar dataKey="eo" name="Exec. Orders" stackId="a" fill={ORANGE} barSize={14} />
                  <Bar dataKey="ru" name="Rules"         stackId="a" fill={t.blue} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
              <Legend items={[["Exec. Orders",ORANGE],["Rules",t.blue]]} />
              <SourceFooter s="FederalRegister.gov" />
            </Card>
          </div>
          <div style={{ background:t.card, border:`1px solid ${t.border}`, borderTop:`3px solid ${ORANGE}`, padding:"14px 16px" }}>
            <div style={{ fontFamily:MF, fontSize:9, color:ORANGE, letterSpacing:2, marginBottom:10 }}>ACTIVE DATA SOURCES</div>
            {["FederalRegister.gov","GovInfo","Regulations.gov","USASpending.gov","OpenSecrets","FEC Campaign API","GAO Reports"].map((s,i) => (
              <div key={i} style={{ display:"flex", gap:7, alignItems:"center", marginBottom:7 }}>
                <div style={{ width:5, height:5, borderRadius:"50%", background:"#00FF88", flexShrink:0 }} />
                <span style={{ fontFamily:MF, fontSize:9, color:t.mid }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
