# Campaign Watch Map Feature — Memory Bank

## 📋 Task Overview
Build a US political accountability map focused on the 2026 election, tracking money in each state for politicians running for office. Inspired by World Monitor app's map layering and humansfirst.com/ai-spending.

## 🎯 User's Vision (Revised After Clarification)

### Core Requirements:
1. **Map layers are plotted items ON the map** (pins, lines, icons) — NOT state coloring
2. **Draggable floating dialog** for corruption profile (not fixed sidebar)
3. **Layer toggles INSIDE the map** (like World Monitor's `createLayerToggles()`)
4. **Map layers are economic/infrastructure/physical** (pipelines, data centers, railways, GDP)
5. **Corruption data shown in floating dialog** when clicking a state
6. **Dialog has ✕ close button** to dismiss
7. **Dialog is reactive** — updates when clicking different states

### World Monitor Inspiration Studied:
- `Map.ts` — D3 + TopoJSON base map with layer toggles inside map
- `MapContainer.ts` — Conditional renderer (DeckGL desktop, D3/SVG mobile)
- Layer toggle buttons INSIDE map container (`createLayerToggles()`)
- Zoom/pan controls INSIDE map (`createControls()`)
- Legend INSIDE map (`createLegend()`)
- Popups for detailed info

## 🗺️ Revised Architecture

### Map Component — `USPoliticalMap.jsx`
- D3 + TopoJSON base map (US states, `geoAlbersUsa` projection)
- Layer toggle buttons INSIDE the map container
- Zoom/pan controls INSIDE the map
- Legend INSIDE the map
- Layers are checkbox toggles that plot/remove data ON the map
- State click → fires `onStateClick` callback

### Map Layers — Infrastructure/Economic (plotted ON the map)
| Layer | What's Plotted | Data Source |
|-------|---------------|-------------|
| 🛢️ Oil Pipelines | Line paths following real pipeline routes | EIA pipeline GeoJSON |
| 🖥️ Data Centers | Pin markers at lat/lon coordinates | `geo.js` + datacentermap |
| 🚂 Railways | Line paths following rail network | BTS/FRA railroad GeoJSON |
| 💰 GDP/Economy | State fill color by GDP (choropleth) | BEA GDP data |
| 📊 State Debt | State fill color by debt level | Census/Treasury data |
| 👥 Population | State fill color or proportional circles | Census ACS |
| ⚡ Power Grid | Major transmission line paths | EIA grid data |
| 🌾 Agriculture | Crop region shading | USDA NASS data |

**Purpose**: Help audience understand economic context — what does the state produce, what infrastructure runs through it, how rich/indebted is it — so when corruption dialog opens, you understand WHY corporations are spending money there.

### Floating Dialog — `CorruptionDialog.jsx`
- **Draggable** (mousedown on header → track mousemove → update position)
- **✕ close button** to dismiss
- **Reactive** — when user clicks a different state, dialog content updates automatically
- Contains ALL political accountability data:
  - Corruption Index score
  - Fundraising breakdown
  - Dark money exposure
  - Federal contracts
  - STOCK Act violations
  - Lobbying spend
  - Revolving door
  - Legislative capture %
  - DOJ/enforcement actions
  - **AI Analysis** summary (DeepSeek-generated narrative)

## 📊 Current Implementation Status

### ✅ Phase 0-1: COMPLETED
- Backend service: `backend/services/campaignWatch.js`
- API route: `backend/routes/campaignWatch.js`
- Frontend page skeleton: `src/pages/CampaignWatch.jsx`
- Geo data: `src/data/geo.js` (state boundaries + FEC data)
- API keys configured in `.env`

### 🔧 Problems Identified in Current Implementation:
1. **Missing D3 map** — using static SVG instead of interactive D3
2. **Missing layer toggles** — no way to turn infrastructure layers on/off
3. **Missing floating dialog** — corruption data shown inline instead of draggable dialog
4. **Missing infrastructure data** — no pipeline/railway/data center coordinates
5. **Limited to 10 states** — backend only returns first 10 states
6. **Missing theme context** — uses `useTheme()` instead of App.jsx's `ThemeCtx`

## 📋 Revised Implementation Plan

### Phase 2A: D3 Map Foundation + Infrastructure Data Layers
1. Install `d3` + `topojson-client`
2. Download US states TopoJSON + pipeline/railway GeoJSON datasets
3. Build `USPoliticalMap.jsx`:
   - D3 `geoAlbersUsa()` projection
   - State paths from TopoJSON
   - In-map zoom/pan controls
   - In-map layer toggle checkboxes
   - In-map legend
   - State click handler → fires callback
4. Build static infrastructure data files:
   - `src/data/pipelines.js` — major US oil/gas pipeline coordinates
   - `src/data/railways.js` — major rail line coordinates
   - `src/data/powerGrid.js` — transmission line coordinates
   - `src/data/stateEconomics.js` — GDP, debt, population per state

### Phase 2B: Draggable Floating Corruption Dialog
5. Build `CorruptionDialog.jsx`:
   - Draggable container (CSS `position: fixed`, JS drag handlers)
   - ✕ close button
   - Sections for each accountability metric
   - Auto-updates when a new state is clicked
   - AI analysis section (calls backend for narrative)

### Phase 2C: Wire Into App.jsx
6. Add `"campaignwatch"` to TABS array
7. Add `renderTab()` case
8. Rewrite to use App.jsx's `ThemeCtx` (not `useTheme()`)

### Phase 2D: Backend Enhancements
9. Add caching layer to `campaignWatch.js`
10. Remove 10-state limit → all 51 states
11. Build Congress.gov service for bill/vote data
12. Build Google Civic service for representative lookup
13. Add AI narrative endpoint (DeepSeek summary of state corruption profile)

## 🗓️ Estimated Timeline
| Phase | Tasks | Time |
|-------|-------|------|
| 2A | D3 map + layers + infrastructure data | ~90 min |
| 2B | Draggable corruption dialog | ~45 min |
| 2C | Wire into App.jsx | ~15 min |
| 2D | Backend caching + new services | ~60 min |
| **Total** | **All phases** | **~3.5 hours** |

## 🔗 Related Files
- `src/pages/CampaignWatch.jsx` — Main page component
- `backend/services/campaignWatch.js` — Backend service
- `backend/routes/campaignWatch.js` — API route
- `src/data/geo.js` — State boundaries + FEC data
- `src/App.jsx` — Needs CampaignWatch added to TABS
- `C:\Users\jroachell\Documents\projects\worldmonitor\src\components\Map.ts` — Reference implementation

## 🎨 Design Reference
- **World Monitor Map**: Layer toggles inside map, zoom controls inside map, legend inside map
- **humansfirst.com/ai-spending**: Political spending visualization inspiration
- **Floating dialog**: Draggable, closable, reactive to state clicks

## 📝 Notes
- Infrastructure layers help audience understand WHY corporations spend money in a state
- Corruption dialog shows the "so what" — how money influences politics
- AI analysis provides narrative summary of corruption patterns
- All data from public sources (FEC, EIA, BEA, Census, etc.)
