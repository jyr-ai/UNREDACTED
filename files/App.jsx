/**
 * US Gas Price Map — App.jsx  (Backend-connected version)
 *
 * Expects the backend server running at VITE_API_BASE_URL (default: http://localhost:4000)
 * Set in your .env:  VITE_API_BASE_URL=http://localhost:4000
 *
 * API endpoints consumed:
 *   GET /api/prices/states          → choropleth map colours
 *   GET /api/prices/national        → header average
 *   GET /api/stations/search?q=     → station finder (search bar)
 *   GET /api/stations?lat=&lng=     → station finder (state click)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";

const API = import.meta.env?.VITE_API_BASE_URL ?? "http://localhost:4000";

// ─── State metadata ────────────────────────────────────────────────────────────
const STATE_NAMES = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",
  CO:"Colorado",CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",
  HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",
  KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",
  MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",
  NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",
  NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",
  OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",
  SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",
  VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",
};

// FIPS → state abbreviation
const FIPS = {
  "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT",
  "10":"DE","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN",
  "19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA",
  "26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV",
  "33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH",
  "40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN",
  "48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY",
};

// ─── API helpers ───────────────────────────────────────────────────────────────
async function apiFetch(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Tooltip({ x, y, stateCode, prices }) {
  if (!stateCode || !prices[stateCode]) return null;
  return (
    <div style={{
      position:"fixed", left:x+14, top:y-10, pointerEvents:"none",
      background:"rgba(10,10,20,0.95)", border:"1px solid rgba(251,191,36,0.4)",
      borderRadius:8, padding:"10px 14px", zIndex:1000, minWidth:160,
      boxShadow:"0 8px 32px rgba(0,0,0,0.5)",
    }}>
      <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"#facc15", letterSpacing:2, marginBottom:4 }}>{stateCode}</div>
      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, color:"#fff", fontWeight:700, marginBottom:2 }}>{STATE_NAMES[stateCode]}</div>
      <div style={{ fontFamily:"'DM Mono',monospace", fontSize:20, color:"#fb923c", fontWeight:700 }}>
        ${prices[stateCode].toFixed(2)}<span style={{ fontSize:11, color:"#94a3b8", marginLeft:4 }}>/gal</span>
      </div>
      <div style={{ fontSize:10, color:"#64748b", marginTop:4, fontFamily:"'DM Mono',monospace" }}>Regular Unleaded</div>
    </div>
  );
}

function Legend({ min, max }) {
  const mid = ((min + max) / 2).toFixed(2);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
      <div style={{ fontSize:10, color:"#64748b", letterSpacing:2, fontFamily:"'DM Mono',monospace", marginBottom:4 }}>$/GAL</div>
      <div style={{ width:160, height:10, borderRadius:6, background:"linear-gradient(to right,#22c55e,#eab308,#ef4444)" }} />
      <div style={{ display:"flex", justifyContent:"space-between", width:160 }}>
        {[min.toFixed(2), mid, max.toFixed(2)].map(v => (
          <span key={v} style={{ fontSize:10, color:"#94a3b8", fontFamily:"'DM Mono',monospace" }}>${v}</span>
        ))}
      </div>
    </div>
  );
}

function RankedList({ title, entries, color }) {
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:10, letterSpacing:2, color:"#64748b", fontFamily:"'DM Mono',monospace", marginBottom:10 }}>{title}</div>
      {entries.map(([code, price], i) => (
        <div key={code} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:7 }}>
          <span style={{ fontSize:11, color:"#475569", fontFamily:"'DM Mono',monospace", width:16, textAlign:"right" }}>{i+1}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, color:"#e2e8f0", fontFamily:"'Playfair Display',serif", fontWeight:600 }}>{STATE_NAMES[code]}</div>
          </div>
          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:13, color, fontWeight:700 }}>${price.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

function StationCard({ s }) {
  const ago = s.updatedAt ? timeSince(new Date(s.updatedAt)) : "unknown";
  return (
    <div style={{
      background:"rgba(30,41,59,0.7)", borderRadius:10, padding:"12px 14px",
      border:"1px solid rgba(255,255,255,0.07)", marginBottom:8, transition:"border-color 0.2s",
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor="rgba(251,191,36,0.4)"}
      onMouseLeave={e => e.currentTarget.style.borderColor="rgba(255,255,255,0.07)"}
    >
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:15, color:"#f1f5f9", fontWeight:700 }}>{s.name}</div>
          <div style={{ fontSize:11, color:"#64748b", fontFamily:"'DM Mono',monospace", marginTop:2 }}>
            {s.address}{s.city ? `, ${s.city}` : ""}{s.state ? ` ${s.state}` : ""}
          </div>
          {s.distance != null && (
            <div style={{ fontSize:10, color:"#475569", marginTop:2, fontFamily:"'DM Mono',monospace" }}>
              {s.distance.toFixed(1)} mi away · updated {ago}
            </div>
          )}
        </div>
        <div style={{ textAlign:"right" }}>
          {s.prices?.regular != null ? (
            <>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:20, color:"#fb923c", fontWeight:700 }}>${s.prices.regular.toFixed(2)}</div>
              <div style={{ fontSize:10, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>regular</div>
            </>
          ) : <div style={{ fontSize:11, color:"#475569" }}>N/A</div>}
        </div>
      </div>
      <div style={{ display:"flex", gap:8, marginTop:10 }}>
        {["midgrade","premium","diesel"].map(type => (
          <div key={type} style={{
            flex:1, background:"rgba(15,23,42,0.6)", borderRadius:6, padding:"6px 4px", textAlign:"center",
          }}>
            <div style={{ fontSize:9, color:"#475569", fontFamily:"'DM Mono',monospace", letterSpacing:1 }}>{type.toUpperCase()}</div>
            <div style={{ fontSize:13, color: s.prices?.[type] ? "#cbd5e1" : "#334155", fontFamily:"'DM Mono',monospace", fontWeight:700 }}>
              {s.prices?.[type] != null ? `$${s.prices[type].toFixed(2)}` : "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorBanner({ message }) {
  return (
    <div style={{
      margin:"12px 24px", padding:"10px 16px", borderRadius:8,
      background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)",
      fontSize:11, color:"#fca5a5", fontFamily:"'DM Mono',monospace",
    }}>⚠ {message}</div>
  );
}

function Spinner() {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:200, flexDirection:"column", gap:12 }}>
      <div style={{
        width:32, height:32, borderRadius:"50%",
        border:"3px solid rgba(251,146,60,0.2)",
        borderTopColor:"#fb923c",
        animation:"spin 0.8s linear infinite",
      }} />
      <div style={{ fontSize:11, color:"#475569", fontFamily:"'DM Mono',monospace", letterSpacing:2 }}>LOADING…</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function timeSince(date) {
  const s = Math.floor((Date.now() - date) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400)return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const svgRef = useRef(null);

  // State prices from /api/prices/states
  const [prices, setPrices]       = useState({});
  const [pricesMeta, setPricesMeta] = useState({});
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [pricesError, setPricesError]     = useState(null);

  // National average from /api/prices/national
  const [nationalAvg, setNationalAvg] = useState(null);

  // Map topology
  const [geoData, setGeoData]   = useState(null);

  // UI state
  const [tooltip, setTooltip]   = useState({ x:0, y:0, stateCode:null });
  const [selectedState, setSelectedState] = useState(null);
  const [tab, setTab]           = useState("map");
  const [searchInput, setSearchInput] = useState("");
  const [fuelType, setFuelType] = useState("regular");
  const [sortBy, setSortBy]     = useState("distance");

  // Stations
  const [stations, setStations]         = useState([]);
  const [loadingStations, setLoadingStations] = useState(false);
  const [stationsError, setStationsError]     = useState(null);
  const [stationsMeta, setStationsMeta]       = useState(null);

  // ── Derived colour scale
  const priceValues = Object.values(prices);
  const minPrice = priceValues.length ? Math.min(...priceValues) : 2.5;
  const maxPrice = priceValues.length ? Math.max(...priceValues) : 5.0;
  const colorScale = d3.scaleSequential()
    .domain([minPrice, maxPrice])
    .interpolator(d3.interpolateRgbBasis(["#22c55e","#eab308","#ef4444"]));

  const sorted       = Object.entries(prices).sort((a,b) => a[1]-b[1]);
  const cheapest     = sorted.slice(0,5);
  const mostExp      = sorted.slice(-5).reverse();

  // ── Fetch state prices
  useEffect(() => {
    setLoadingPrices(true);
    apiFetch("/api/prices/states")
      .then(data => {
        setPrices(data.prices || {});
        setPricesMeta({ source: data.source, updatedAt: data.updatedAt });
        setPricesError(null);
      })
      .catch(err => setPricesError(err.message))
      .finally(() => setLoadingPrices(false));
  }, []);

  // ── Fetch national average
  useEffect(() => {
    apiFetch("/api/prices/national")
      .then(data => setNationalAvg(data.average))
      .catch(() => {});
  }, []);

  // ── Load TopoJSON
  useEffect(() => {
    fetch("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json")
      .then(r => r.json())
      .then(setGeoData)
      .catch(console.error);
  }, []);

  // ── Draw / redraw SVG map when prices or geoData change
  useEffect(() => {
    if (!geoData || !svgRef.current || !priceValues.length) return;

    const loadTopojson = () => {
      if (window.topojson) { drawMap(); return; }
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js";
      s.onload = drawMap;
      document.head.appendChild(s);
    };

    const drawMap = () => {
      const svg    = d3.select(svgRef.current);
      svg.selectAll("*").remove();
      const width  = svgRef.current.clientWidth  || 700;
      const height = svgRef.current.clientHeight || 420;
      const proj   = d3.geoAlbersUsa().fitSize(
        [width, height],
        window.topojson.feature(geoData, geoData.objects.states)
      );
      const path   = d3.geoPath().projection(proj);
      const states = window.topojson.feature(geoData, geoData.objects.states).features;

      svg.selectAll("path")
        .data(states)
        .join("path")
        .attr("d", path)
        .attr("fill", d => {
          const code  = FIPS[d.id.toString().padStart(2,"0")];
          const price = prices[code];
          return price ? colorScale(price) : "#1e293b";
        })
        .attr("stroke","rgba(15,23,42,0.9)")
        .attr("stroke-width", 1)
        .style("cursor","pointer")
        .on("mousemove", (event, d) => {
          const code = FIPS[d.id.toString().padStart(2,"0")];
          d3.select(event.currentTarget).attr("stroke","#facc15").attr("stroke-width",2);
          setTooltip({ x:event.clientX, y:event.clientY, stateCode:code });
        })
        .on("mouseleave", (event) => {
          d3.select(event.currentTarget).attr("stroke","rgba(15,23,42,0.9)").attr("stroke-width",1);
          setTooltip(t => ({...t, stateCode:null}));
        })
        .on("click", (event, d) => {
          const code = FIPS[d.id.toString().padStart(2,"0")];
          handleStateClick(code);
        });

      // State abbrev labels
      const skipSmall = new Set(["RI","CT","DE","NH","VT","MA","NJ","MD"]);
      svg.selectAll("text")
        .data(states)
        .join("text")
        .attr("transform", d => { const c = path.centroid(d); return c ? `translate(${c})` : ""; })
        .attr("text-anchor","middle").attr("dy","0.35em")
        .style("font-size","8px").style("font-family","'DM Mono',monospace")
        .style("fill","rgba(255,255,255,0.55)").style("pointer-events","none")
        .text(d => {
          const code = FIPS[d.id.toString().padStart(2,"0")];
          return (!skipSmall.has(code) && prices[code]) ? code : "";
        });
    };

    loadTopojson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoData, prices, colorScale]);

  // ── Station fetch by lat/lng (from state click)
  const fetchStationsByState = useCallback(async (stateCode) => {
    setLoadingStations(true);
    setStationsError(null);
    // Use search endpoint with state name
    const q = encodeURIComponent(STATE_NAMES[stateCode] || stateCode);
    try {
      const data = await apiFetch(`/api/stations/search?q=${q}&fuel=${fuelType}&sort=${sortBy}`);
      setStations(data.stations || []);
      setStationsMeta(data.geocode || null);
    } catch (err) {
      setStationsError(err.message);
      setStations([]);
    } finally {
      setLoadingStations(false);
    }
  }, [fuelType, sortBy]);

  const handleStateClick = (code) => {
    setSelectedState(code);
    setTab("stations");
    fetchStationsByState(code);
  };

  // ── Station fetch by search
  const handleSearch = useCallback(async (e) => {
    e?.preventDefault();
    if (!searchInput.trim()) return;
    setTab("stations");
    setSelectedState(null);
    setLoadingStations(true);
    setStationsError(null);
    try {
      const q = encodeURIComponent(searchInput.trim());
      const data = await apiFetch(`/api/stations/search?q=${q}&fuel=${fuelType}&sort=${sortBy}`);
      setStations(data.stations || []);
      setStationsMeta(data.geocode || null);
    } catch (err) {
      setStationsError(err.message);
      setStations([]);
    } finally {
      setLoadingStations(false);
    }
  }, [searchInput, fuelType, sortBy]);

  // ─── Styles
  const tabStyle = (active) => ({
    fontFamily:"'Playfair Display',serif", fontSize:13,
    color: active ? "#facc15" : "#64748b", cursor:"pointer",
    paddingBottom:8, marginRight:24,
    borderBottom: active ? "2px solid #facc15" : "2px solid transparent",
    transition:"all 0.2s",
  });

  const selectStyle = {
    background:"rgba(30,41,59,0.6)", border:"1px solid rgba(255,255,255,0.1)",
    borderRadius:6, padding:"6px 10px", color:"#f1f5f9",
    fontFamily:"'DM Mono',monospace", fontSize:11, cursor:"pointer", outline:"none",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Mono:wght@400;500;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#020817}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#1e293b;border-radius:4px}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .fadein{animation:fadeIn 0.5s ease both}
        select option{background:#0f172a}
      `}</style>

      <div style={{ minHeight:"100vh", background:"#020817", display:"flex", flexDirection:"column", color:"#f1f5f9" }}>

        {/* Header */}
        <header style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"18px 28px", borderBottom:"1px solid rgba(255,255,255,0.06)",
          background:"rgba(2,8,23,0.9)", backdropFilter:"blur(12px)",
          position:"sticky", top:0, zIndex:100,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{
              width:36, height:36, borderRadius:8,
              background:"linear-gradient(135deg,#fb923c,#f97316)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:18, boxShadow:"0 0 20px rgba(249,115,22,0.4)",
            }}>⛽</div>
            <div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:900, letterSpacing:-0.5 }}>
                FuelWatch <span style={{ color:"#fb923c" }}>US</span>
              </div>
              <div style={{ fontSize:9, color:"#475569", letterSpacing:2 }}>REAL-TIME GAS PRICE MAP</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:20 }}>
            {pricesMeta.updatedAt && (
              <div style={{ fontSize:9, color:"#334155", fontFamily:"'DM Mono',monospace" }}>
                Updated: {pricesMeta.updatedAt}
              </div>
            )}
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:9, color:"#475569", letterSpacing:2 }}>NATIONAL AVG</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, color:"#fb923c", fontWeight:700 }}>
                {nationalAvg ? `$${nationalAvg.toFixed(2)}` : "—"}
              </div>
            </div>
            <div style={{
              padding:"6px 14px", borderRadius:6,
              background:"rgba(251,146,60,0.1)", border:"1px solid rgba(251,146,60,0.3)",
              fontSize:10, color:"#fb923c", letterSpacing:1,
            }}>LIVE DATA</div>
          </div>
        </header>

        {/* Body */}
        <div style={{ flex:1, display:"flex", overflow:"hidden", height:"calc(100vh - 73px)" }}>

          {/* Sidebar */}
          <aside style={{
            width:260, borderRight:"1px solid rgba(255,255,255,0.06)",
            background:"rgba(2,8,23,0.7)", overflowY:"auto", padding:"20px 16px", flexShrink:0,
          }}>
            {loadingPrices
              ? <div style={{ fontSize:11, color:"#475569", fontFamily:"'DM Mono',monospace" }}>Loading prices…</div>
              : <>
                  <RankedList title="CHEAPEST STATES"   entries={cheapest} color="#22c55e" />
                  <div style={{ height:1, background:"rgba(255,255,255,0.06)", margin:"4px 0 20px" }} />
                  <RankedList title="MOST EXPENSIVE"    entries={mostExp}  color="#ef4444" />
                  <div style={{ height:1, background:"rgba(255,255,255,0.06)", margin:"4px 0 20px" }} />
                  <Legend min={minPrice} max={maxPrice} />
                </>
            }
            <div style={{ marginTop:20, padding:"12px", background:"rgba(251,146,60,0.06)", borderRadius:8, border:"1px solid rgba(251,146,60,0.15)" }}>
              <div style={{ fontSize:9, color:"#fb923c", letterSpacing:2, marginBottom:8 }}>DATA SOURCES</div>
              <div style={{ fontSize:10, color:"#64748b", lineHeight:1.7 }}>
                • EIA Weekly Survey<br/>
                • GasBuddy Community<br/>
                • MyGasFeed API<br/>
                <span style={{ color:"#334155" }}>via {API}</span>
              </div>
            </div>
          </aside>

          {/* Main */}
          <main style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

            {/* Tab bar */}
            <div style={{
              display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"14px 24px 0", borderBottom:"1px solid rgba(255,255,255,0.06)",
              background:"rgba(2,8,23,0.5)",
            }}>
              <div style={{ display:"flex" }}>
                <span style={tabStyle(tab==="map")}      onClick={() => setTab("map")}>Map View</span>
                <span style={tabStyle(tab==="stations")} onClick={() => setTab("stations")}>Station Finder</span>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <select value={fuelType} onChange={e => setFuelType(e.target.value)} style={selectStyle}>
                  <option value="regular">Regular</option>
                  <option value="midgrade">Mid-Grade</option>
                  <option value="premium">Premium</option>
                  <option value="diesel">Diesel</option>
                </select>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={selectStyle}>
                  <option value="distance">Sort: Distance</option>
                  <option value="price">Sort: Price</option>
                </select>
                <form onSubmit={handleSearch} style={{ display:"flex", gap:8 }}>
                  <input
                    value={searchInput} onChange={e => setSearchInput(e.target.value)}
                    placeholder="City, ZIP, or address…"
                    style={{
                      background:"rgba(30,41,59,0.6)", border:"1px solid rgba(255,255,255,0.1)",
                      borderRadius:6, padding:"7px 14px", color:"#f1f5f9",
                      fontFamily:"'DM Mono',monospace", fontSize:12, outline:"none", width:210,
                    }}
                  />
                  <button type="submit" style={{
                    background:"linear-gradient(135deg,#fb923c,#f97316)", border:"none",
                    borderRadius:6, padding:"7px 16px", color:"#fff",
                    fontFamily:"'DM Mono',monospace", fontSize:12, cursor:"pointer", fontWeight:700,
                  }}>Search</button>
                </form>
              </div>
            </div>

            {/* Content */}
            <div style={{ flex:1, overflow:"auto", position:"relative" }}>

              {pricesError && <ErrorBanner message={`Prices API error: ${pricesError}`} />}

              {/* MAP */}
              {tab === "map" && (
                <div className="fadein" style={{ height:"100%", position:"relative" }}>
                  {loadingPrices && <Spinner />}
                  <svg ref={svgRef} width="100%" height="100%" style={{ display:"block", padding:"24px 20px" }} />
                  <div style={{ position:"absolute", bottom:20, right:20, fontSize:10, color:"#334155", fontFamily:"'DM Mono',monospace" }}>
                    Click a state → Station Finder
                  </div>
                </div>
              )}

              {/* STATIONS */}
              {tab === "stations" && (
                <div className="fadein" style={{ padding:24, maxWidth:680 }}>
                  <div style={{ marginBottom:20 }}>
                    {selectedState ? (
                      <>
                        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, marginBottom:4 }}>
                          {STATE_NAMES[selectedState]}
                          <span style={{ color:"#fb923c", marginLeft:12 }}>
                            {prices[selectedState] ? `$${prices[selectedState].toFixed(2)}/gal` : ""}
                          </span>
                        </div>
                        <button onClick={() => setSelectedState(null)} style={{
                          fontSize:10, color:"#475569", background:"none", border:"none",
                          cursor:"pointer", fontFamily:"'DM Mono',monospace", padding:0,
                        }}>← Clear selection</button>
                      </>
                    ) : stationsMeta ? (
                      <>
                        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, marginBottom:4 }}>
                          {stationsMeta.formattedAddress}
                        </div>
                        <div style={{ fontSize:10, color:"#475569", letterSpacing:2, fontFamily:"'DM Mono',monospace" }}>
                          {stationsMeta.lat?.toFixed(4)}, {stationsMeta.lng?.toFixed(4)}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize:13, color:"#475569", fontFamily:"'DM Mono',monospace" }}>
                        Click a state on the map or search above.
                      </div>
                    )}
                  </div>

                  {stationsError && <ErrorBanner message={`Stations API error: ${stationsError}`} />}
                  {loadingStations && <Spinner />}
                  {!loadingStations && stations.map(s => <StationCard key={s.id} s={s} />)}
                  {!loadingStations && !stationsError && stations.length === 0 && stationsMeta && (
                    <div style={{ fontSize:12, color:"#475569", fontFamily:"'DM Mono',monospace" }}>No stations found in this area.</div>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      <Tooltip x={tooltip.x} y={tooltip.y} stateCode={tooltip.stateCode} prices={prices} />
    </>
  );
}
