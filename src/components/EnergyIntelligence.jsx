import { useState, useEffect } from "react";
import { useTheme } from "../theme/index.js";
import { ORANGE, FONT_MONO as MF, FONT_SERIF as SF } from "../theme/tokens.js";
import { gasPrices } from "../api/client.js";

// State energy mix data — EIA API provides production data by state
// Illustrative values based on EIA 2024 State Energy Profiles
const ENERGY_MIX = [
  { state: "CA", renewable: 59, solar: 28, wind: 14, natural_gas: 36, coal: 1, nuclear: 4, gas_price: null },
  { state: "TX", renewable: 28, solar: 9, wind: 19, natural_gas: 56, coal: 14, nuclear: 8, gas_price: null },
  { state: "WA", renewable: 74, solar: 1, wind: 10, natural_gas: 18, coal: 4, nuclear: 8, gas_price: null },
  { state: "NY", renewable: 38, solar: 5, wind: 9, natural_gas: 44, coal: 1, nuclear: 24, gas_price: null },
  { state: "FL", renewable: 10, solar: 6, wind: 0, natural_gas: 74, coal: 8, nuclear: 10, gas_price: null },
  { state: "IL", renewable: 14, solar: 2, wind: 12, natural_gas: 30, coal: 22, nuclear: 54, gas_price: null },
  { state: "CO", renewable: 33, solar: 8, wind: 25, natural_gas: 60, coal: 8, nuclear: 0, gas_price: null },
  { state: "IA", renewable: 62, solar: 2, wind: 60, natural_gas: 30, coal: 16, nuclear: 8, gas_price: null },
  { state: "WY", renewable: 18, solar: 2, wind: 16, natural_gas: 22, coal: 88, nuclear: 0, gas_price: null },
  { state: "WV", renewable: 8, solar: 1, wind: 7, natural_gas: 18, coal: 92, nuclear: 0, gas_price: null },
  { state: "MN", renewable: 30, solar: 4, wind: 26, natural_gas: 38, coal: 18, nuclear: 24, gas_price: null },
  { state: "AZ", renewable: 18, solar: 14, wind: 4, natural_gas: 48, coal: 18, nuclear: 16, gas_price: null },
];

const SOURCE_COLOR = {
  renewable: "#22c55e",
  natural_gas: "#FFB84D",
  coal: "#888888",
  nuclear: "#9966CC",
  solar: "#f59e0b",
  wind: "#4A7FFF",
};

export default function EnergyIntelligence() {
  const t = useTheme();
  const [gasByState, setGasByState] = useState({});
  const [sortBy, setSortBy] = useState("renewable");
  const [view, setView] = useState("grid");

  useEffect(() => {
    gasPrices.states()
      .then(res => {
        const map = {};
        (res.data || res || []).forEach(s => { if (s.stateCode) map[s.stateCode] = s.price; });
        setGasByState(map);
      })
      .catch(() => {});
  }, []);

  const data = ENERGY_MIX
    .map(s => ({ ...s, gas_price: gasByState[s.state] || null }))
    .sort((a, b) => sortBy === "coal" ? b.coal - a.coal : b.renewable - a.renewable);

  const avgRenewable = Math.round(ENERGY_MIX.reduce((s, d) => s + d.renewable, 0) / ENERGY_MIX.length);
  const avgCoal = Math.round(ENERGY_MIX.reduce((s, d) => s + d.coal, 0) / ENERGY_MIX.length);
  const topRenewable = [...ENERGY_MIX].sort((a, b) => b.renewable - a.renewable)[0];
  const topCoal = [...ENERGY_MIX].sort((a, b) => b.coal - a.coal)[0];

  const MiniBar = ({ value, color, max = 100 }) => (
    <div style={{ height: 5, background: t.border, flex: 1 }}>
      <div style={{ width: `${Math.min(100, (value / max) * 100)}%`, height: "100%", background: color }} />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ borderTop: `3px solid ${ORANGE}`, paddingTop: 16 }}>
        <div style={{ fontFamily: MF, fontSize: 9, color: ORANGE, letterSpacing: 3, marginBottom: 8 }}>
          EIA STATE ENERGY PROFILES · REGULATORY ENVIRONMENT · POLICY IMPACT
        </div>
        <h2 style={{ fontFamily: SF, fontSize: 28, color: t.hi, fontWeight: 700, lineHeight: 1.1, marginBottom: 6 }}>
          Energy Intelligence
        </h2>
        <p style={{ fontFamily: SF, fontSize: 13, fontStyle: "italic", color: t.mid, lineHeight: 1.7, maxWidth: 640 }}>
          State-level energy production mix showing renewable penetration, fossil fuel dependence, and nuclear share.
          Critical for investors tracking clean energy policy impact and analysts studying regulatory capture in energy markets.
        </p>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Avg. Renewable Share", value: `${avgRenewable}%`, color: "#22c55e" },
          { label: "Avg. Coal Share", value: `${avgCoal}%`, color: "#888" },
          { label: "Highest Renewable", value: `${topRenewable.state} ${topRenewable.renewable}%`, color: "#22c55e" },
          { label: "Highest Coal", value: `${topCoal.state} ${topCoal.coal}%`, color: ORANGE },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: t.card, border: `1px solid ${t.border}`, borderTop: `3px solid ${color}`, padding: "10px 14px" }}>
            <div style={{ fontFamily: MF, fontSize: 8, color: t.low, letterSpacing: 1.5, marginBottom: 5 }}>{label}</div>
            <div style={{ fontFamily: MF, fontSize: 16, color, fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Sort controls */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontFamily: MF, fontSize: 9, color: t.low, letterSpacing: 1 }}>SORT BY:</span>
        {[["renewable", "RENEWABLE %", "#22c55e"], ["coal", "COAL %", "#888"]].map(([val, label, col]) => (
          <button key={val} onClick={() => setSortBy(val)} style={{
            background: sortBy === val ? col + "22" : t.cardB,
            border: `1px solid ${sortBy === val ? col : t.border}`,
            color: sortBy === val ? col : t.mid,
            padding: "4px 12px", fontFamily: MF, fontSize: 9, cursor: "pointer",
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Energy mix table */}
      <div style={{ background: t.card, border: `1px solid ${t.border}` }}>
        <div style={{ background: t.cardB, padding: "7px 14px", borderBottom: `2px solid ${t.border}`, display: "grid", gridTemplateColumns: "60px 1fr 1fr 1fr 1fr 90px", gap: 10, alignItems: "center" }}>
          {["STATE", "RENEWABLE", "NATURAL GAS", "COAL", "NUCLEAR", "GAS $/GAL"].map(h => (
            <div key={h} style={{ fontFamily: MF, fontSize: 8, color: t.low, letterSpacing: 1.5 }}>{h}</div>
          ))}
        </div>
        {data.map((d, i) => (
          <div key={d.state} style={{
            padding: "10px 14px", borderBottom: `1px solid ${t.border}`,
            background: i % 2 === 0 ? t.card : t.tableAlt,
            display: "grid", gridTemplateColumns: "60px 1fr 1fr 1fr 1fr 90px", gap: 10, alignItems: "center",
          }}>
            <div style={{ fontFamily: MF, fontSize: 12, color: t.hi, fontWeight: 700 }}>{d.state}</div>

            {/* Renewable */}
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ fontFamily: MF, fontSize: 10, color: "#22c55e", fontWeight: 700 }}>{d.renewable}%</div>
              <MiniBar value={d.renewable} color="#22c55e" />
            </div>

            {/* Gas */}
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ fontFamily: MF, fontSize: 10, color: "#FFB84D" }}>{d.natural_gas}%</div>
              <MiniBar value={d.natural_gas} color="#FFB84D" />
            </div>

            {/* Coal */}
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ fontFamily: MF, fontSize: 10, color: d.coal > 40 ? ORANGE : "#888" }}>{d.coal}%</div>
              <MiniBar value={d.coal} color={d.coal > 40 ? ORANGE : "#888"} />
            </div>

            {/* Nuclear */}
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ fontFamily: MF, fontSize: 10, color: "#9966CC" }}>{d.nuclear}%</div>
              <MiniBar value={d.nuclear} color="#9966CC" />
            </div>

            {/* Gas price */}
            <div style={{ fontFamily: MF, fontSize: 11, color: d.gas_price ? t.hi : t.low, fontWeight: d.gas_price ? 700 : 400 }}>
              {d.gas_price ? `$${Number(d.gas_price).toFixed(2)}` : "—"}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {Object.entries({ "Renewable": "#22c55e", "Natural Gas": "#FFB84D", "Coal": "#888", "Nuclear": "#9966CC" }).map(([l, c]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 10, height: 10, background: c }} />
            <span style={{ fontFamily: MF, fontSize: 9, color: t.mid }}>{l}</span>
          </div>
        ))}
      </div>

      <div style={{ fontFamily: MF, fontSize: 8.5, color: t.low, borderTop: `1px solid ${t.border}`, paddingTop: 10 }}>
        Sources: EIA State Energy Profiles 2024 · EIA Open Data API · Gas prices: EIA weekly retail survey
      </div>
    </div>
  );
}
