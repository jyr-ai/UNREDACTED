import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell, ScatterChart, Scatter, ZAxis } from "recharts";
import { useTheme } from "../theme/index.js";
import { ORANGE, FONT_MONO as MF, FONT_SERIF as SF } from "../theme/tokens.js";
import { Band, Card, CardTitle, SourceFooter, Legend } from "../components/ui/index.js";
import { RedactedBlock } from "../components/charts/index.js";
import { SPEND, TREND } from "../data/spending.js";
import { CORPS } from "../data/donors.js";

const ax = t => ({ axisLine:{ stroke:t.border }, tickLine:false, tick:{ fontFamily:MF, fontSize:9.5, fill:t.mid } });

export default function Spending() {
  const t = useTheme();

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:22 }}>
      <div style={{ borderTop:`3px solid ${ORANGE}`, paddingTop:16 }}>
        <div style={{ fontFamily:MF, fontSize:9, color:ORANGE, letterSpacing:3, marginBottom:8 }}>SPENDING AUDIT · USASPENDING.GOV · FPDS-NG · FEC</div>
        <h2 style={{ fontFamily:SF, fontSize:32, color:t.hi, fontWeight:700, lineHeight:1.1, marginBottom:8 }}>Federal Spending &amp; Corporate Accountability</h2>
        <p style={{ fontFamily:SF, fontSize:14, fontStyle:"italic", color:t.mid, lineHeight:1.7, maxWidth:640 }}>
          Actual obligations versus congressional appropriations, cross-referenced with PAC donations and contract awards to top federal contractors.
        </p>
      </div>

      {/* Charts row */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
        <div>
          <Band label="Agency budget variance" right="FY2024" />
          <Card>
            <CardTitle h="Treasury and Justice show the largest overruns." sub="Appropriated vs. actual · $B · FY2024" />
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={SPEND} layout="vertical" margin={{ left:4, right:50, top:0, bottom:0 }} barCategoryGap="22%">
                <CartesianGrid horizontal={false} stroke={t.grid} />
                <XAxis type="number" {...ax(t)} tickFormatter={v=>`$${v}B`} />
                <YAxis type="category" dataKey="a" {...ax(t)} width={66} />
                <Tooltip contentStyle={{ background:t.card, border:`1px solid ${t.border}`, fontFamily:MF, fontSize:11 }} formatter={v=>[`$${v}B`]} />
                <Bar dataKey="b" name="Appropriated" barSize={8} fill={t.border} radius={0} />
                <Bar dataKey="v" name="Actual"       barSize={8} radius={0}>
                  {SPEND.map((d,i) => <Cell key={i} fill={d.v>d.b?ORANGE:t.ok} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display:"flex", gap:16, marginTop:8 }}>
              {[["Appropriated",t.border],["Over budget",ORANGE],["Under budget",t.ok]].map(([l,c]) => (
                <div key={l} style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:10, height:10, background:c, border:`1px solid ${t.low}` }}/><span style={{ fontFamily:MF, fontSize:9, color:t.mid }}>{l}</span></div>
              ))}
            </div>
            <SourceFooter s="USASpending.gov; GovInfo budget justifications" />
          </Card>
        </div>

        <div>
          <Band label="PAC donations vs. contracts — scatter" right="FY2024" />
          <Card>
            <CardTitle h="Strong positive correlation between PAC donations and federal contract awards." sub="PAC donations ($m) vs. contracts won · bubble = accountability score" />
            <ResponsiveContainer width="100%" height={230}>
              <ScatterChart margin={{ left:0, right:16, top:10, bottom:14 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical />
                <XAxis type="number" dataKey="pac" name="PAC ($m)" {...ax(t)} tickFormatter={v=>`$${v}m`} label={{ value:"PAC donations ($m)", position:"insideBottom", offset:-4, style:{ fontFamily:MF, fontSize:8.5, fill:t.low } }} />
                <YAxis type="number" dataKey="con" name="Contracts ($m)" {...ax(t)} tickFormatter={v=>`$${(v/1000).toFixed(0)}bn`} />
                <ZAxis dataKey="sc" range={[40,340]} />
                <Tooltip contentStyle={{ background:t.card, border:`1px solid ${t.border}`, fontFamily:MF, fontSize:11 }} formatter={(v,n,p) => n==="PAC ($m)" ? [`$${v}m`,n] : n==="Contracts ($m)" ? [`$${(v/1000).toFixed(1)}bn`,n] : [v,n]} />
                <Scatter data={CORPS}>
                  {CORPS.map((d,i) => <Cell key={i} fill={d.sc<40?ORANGE:d.sc<55?t.warn:t.ok} fillOpacity={0.8} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <SourceFooter s="FEC; USASpending.gov; UN*REDACTED accountability score; FY2024" />
          </Card>
        </div>
      </div>

      {/* Corporate accountability table */}
      <Band label="Accountability index — top federal contractors" right="FY2024 · LOWER SCORE = MORE RISK" />
      <div style={{ background:t.card, border:`1px solid ${t.border}`, borderTop:"none" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:t.cardB, borderBottom:`2px solid ${t.border}` }}>
              {[["COMPANY","170px"],["SECTOR","88px"],["PAC ($M)","88px"],["CONTRACTS","100px"],["ROI","70px"],["SCORE","140px"],["RISK","90px"]].map(([h,w]) => (
                <th key={h} style={{ padding:"8px 14px", width:w, textAlign:"left", fontFamily:MF, fontSize:8, color:t.low, letterSpacing:2, fontWeight:400, borderRight:`1px solid ${t.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CORPS.map((d,i) => {
              const rc = d.sc<35?ORANGE:d.sc<55?t.warn:t.ok;
              const rl = d.sc<35?"CRITICAL":d.sc<55?"HIGH":d.sc<70?"MEDIUM":"CLEAN";
              const roi = ((d.con/d.pac)*10).toFixed(1);
              return (
                <tr key={i} style={{ borderBottom:`1px solid ${t.border}`, background:i%2===0?t.card:t.tableAlt }}>
                  <td style={{ padding:"10px 14px", borderRight:`1px solid ${t.border}`, fontFamily:MF, fontSize:11, color:t.hi }}>{d.n}</td>
                  <td style={{ padding:"10px 14px", fontFamily:MF, fontSize:9.5, color:t.mid, borderRight:`1px solid ${t.border}` }}>{d.s}</td>
                  <td style={{ padding:"10px 14px", fontFamily:MF, fontSize:11, color:ORANGE, fontWeight:700, textAlign:"right", borderRight:`1px solid ${t.border}` }}>${d.pac}m</td>
                  <td style={{ padding:"10px 14px", textAlign:"right", borderRight:`1px solid ${t.border}` }}>
                    {d.sc<40 ? <RedactedBlock w="72px"><span style={{ fontFamily:MF, fontSize:11, color:ORANGE, fontWeight:700 }}>${(d.con/1000).toFixed(1)}bn</span></RedactedBlock>
                             : <span style={{ fontFamily:MF, fontSize:11, color:ORANGE, fontWeight:700 }}>${(d.con/1000).toFixed(1)}bn</span>}
                  </td>
                  <td style={{ padding:"10px 14px", fontFamily:MF, fontSize:11, color:t.hi, textAlign:"right", borderRight:`1px solid ${t.border}` }}>{roi}×</td>
                  <td style={{ padding:"10px 14px", borderRight:`1px solid ${t.border}` }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                      <div style={{ width:70, height:5, background:t.border }}><div style={{ width:`${d.sc}%`, height:"100%", background:rc }} /></div>
                      <span style={{ fontFamily:MF, fontSize:10.5, color:rc, fontWeight:700 }}>{d.sc}</span>
                    </div>
                  </td>
                  <td style={{ padding:"10px 14px" }}>
                    <span style={{ fontFamily:MF, fontSize:8, letterSpacing:1, color:rc, border:`1px solid ${rc}44`, padding:"2px 8px", background:rc+"12" }}>{rl}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding:"7px 14px", background:t.cardB, borderTop:`1px solid ${t.border}` }}>
          <span style={{ fontFamily:MF, fontSize:8.5, color:t.low }}>Sources: FEC; USASpending.gov; UN*REDACTED accountability score. All inferences are analytical — not legal conclusions.</span>
        </div>
      </div>
    </div>
  );
}
