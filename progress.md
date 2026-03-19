# Campaign Watch Map — Implementation Progress Tracker

## 📊 Current Status: **Phase 0-1 COMPLETED**

### ✅ Completed Tasks
- [x] Backend service created: `backend/services/campaignWatch.js`
- [x] API route created: `backend/routes/campaignWatch.js`
- [x] Frontend page skeleton: `src/pages/CampaignWatch.jsx`
- [x] Geo data file: `src/data/geo.js` (state boundaries + FEC data)
- [x] API keys configured in `.env`
- [x] Basic frontend test: `test-campaign-watch-frontend.html`

### 🔧 Current Problems (To Fix in Phase 2)
1. **Missing D3 map** — using static SVG instead of interactive D3
2. **Missing layer toggles** — no way to turn infrastructure layers on/off
3. **Missing floating dialog** — corruption data shown inline instead of draggable dialog
4. **Missing infrastructure data** — no pipeline/railway/data center coordinates
5. **Limited to 10 states** — backend only returns first 10 states
6. **Missing theme context** — uses `useTheme()` instead of App.jsx's `ThemeCtx`

---

## 🗺️ Revised Implementation Plan (Phase 2)

### Phase 2A: D3 Map Foundation + Infrastructure Data Layers
**Goal**: Interactive D3 map with infrastructure layers plotted ON the map

#### Tasks:
- [ ] Install dependencies: `d3` + `topojson-client`
- [ ] Download US states TopoJSON dataset
- [ ] Download infrastructure GeoJSON datasets:
  - EIA pipeline data (oil/gas pipelines)
  - BTS/FRA railroad network
  - EIA power grid transmission lines
- [ ] Create `src/components/USPoliticalMap.jsx`:
  - D3 `geoAlbersUsa()` projection
  - State paths from TopoJSON
  - In-map zoom/pan controls (like World Monitor)
  - In-map layer toggle checkboxes
  - In-map legend
  - State click handler → fires `onStateClick` callback
- [ ] Create infrastructure data files:
  - `src/data/pipelines.js` — major US oil/gas pipeline coordinates
  - `src/data/railways.js` — major rail line coordinates
  - `src/data/powerGrid.js` — transmission line coordinates
  - `src/data/stateEconomics.js` — GDP, debt, population per state
- [ ] Update `CampaignWatch.jsx` to use `USPoliticalMap` component

#### Estimated Time: 90 minutes
#### Dependencies: None
#### Output: Interactive D3 map with toggleable infrastructure layers

---

### Phase 2B: Draggable Floating Corruption Dialog
**Goal**: Draggable, closable dialog that shows corruption profile when clicking states

#### Tasks:
- [ ] Create `src/components/CorruptionDialog.jsx`:
  - Draggable container (CSS `position: fixed`, JS drag handlers)
  - ✕ close button to dismiss
  - Header with state name and corruption score
  - Sections for each accountability metric:
    - Corruption Index score
    - Fundraising breakdown
    - Dark money exposure
    - Federal contracts
    - STOCK Act violations
    - Lobbying spend
    - Revolving door
    - Legislative capture %
    - DOJ/enforcement actions
    - AI Analysis summary
  - Auto-updates when a new state is clicked
- [ ] Add drag functionality:
  - `mousedown` on header → track position
  - `mousemove` → update dialog position
  - `mouseup` → stop tracking
- [ ] Connect dialog to map's `onStateClick` callback
- [ ] Style dialog to match UNREDACTED theme

#### Estimated Time: 45 minutes
#### Dependencies: Phase 2A (map component)
#### Output: Draggable corruption dialog that appears on state click

---

### Phase 2C: Wire Into App.jsx
**Goal**: Integrate CampaignWatch into main app navigation

#### Tasks:
- [ ] Open `src/App.jsx` and add `"campaignwatch"` to TABS array
- [ ] Add `renderTab()` case for `"campaignwatch"`
- [ ] Update `CampaignWatch.jsx` to use App.jsx's `ThemeCtx` instead of `useTheme()`
- [ ] Test navigation from other tabs to CampaignWatch
- [ ] Verify theme consistency

#### Estimated Time: 15 minutes
#### Dependencies: Phase 2A (map component)
#### Output: CampaignWatch accessible from main app navigation

---

### Phase 2D: Backend Enhancements
**Goal**: Improve backend data quality and add new services

#### Tasks:
- [ ] Add caching layer to `backend/services/campaignWatch.js`:
  - Redis or in-memory cache for FEC API responses
  - Cache TTL: 1 hour for live data, 24 hours for historical
- [ ] Remove 10-state limit → return all 51 states
- [ ] Build Congress.gov service:
  - Fetch bill sponsorship data
  - Fetch voting records
  - Connect politicians to legislation
- [ ] Build Google Civic API service:
  - Look up representatives by address/state
  - Get contact info and committee assignments
- [ ] Add AI narrative endpoint:
  - DeepSeek API integration
  - Generate summary of state corruption profile
  - Include key metrics and patterns
- [ ] Add data validation and error handling

#### Estimated Time: 60 minutes
#### Dependencies: None (can run parallel to frontend work)
#### Output: Enhanced backend with caching, full state data, and AI analysis

---

## 📈 Progress Metrics

### Phase Completion Status:
- **Phase 2A**: 0% (Not started)
- **Phase 2B**: 0% (Not started)
- **Phase 2C**: 0% (Not started)
- **Phase 2D**: 0% (Not started)

### Key Milestones:
1. **Milestone 1**: D3 map renders with US states
2. **Milestone 2**: Infrastructure layers toggle on/off
3. **Milestone 3**: State click opens draggable dialog
4. **Milestone 4**: Dialog shows corruption data
5. **Milestone 5**: CampaignWatch in main app navigation
6. **Milestone 6**: Backend returns all 51 states
7. **Milestone 7**: AI analysis in dialog

### Success Criteria:
- [ ] Map loads in < 3 seconds
- [ ] Layer toggles respond immediately
- [ ] Dialog drags smoothly
- [ ] Dialog updates within 1 second of state click
- [ ] All 51 states have data
- [ ] AI analysis loads within 2 seconds

---

## 🛠️ Technical Specifications

### Dependencies to Install:
```bash
npm install d3 topojson-client
```

### Required Data Sources:
1. **US States TopoJSON**: https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json
2. **EIA Pipeline Data**: https://www.eia.gov/maps/layer_info-m.php
3. **BTS Railroad Network**: https://geo.dot.gov/server/rest/services/NTAD/Railroads/MapServer
4. **BEA GDP Data**: https://apps.bea.gov/api/data/
5. **Census ACS Data**: https://api.census.gov/data.html
6. **USDA NASS Data**: https://quickstats.nass.usda.gov/api

### File Structure After Completion:
```
src/
├── components/
│   ├── USPoliticalMap.jsx      # D3 map with layer toggles
│   └── CorruptionDialog.jsx    # Draggable corruption dialog
├── data/
│   ├── geo.js                  # State boundaries + FEC data
│   ├── pipelines.js            # Pipeline coordinates
│   ├── railways.js             # Railway coordinates
│   ├── powerGrid.js            # Power grid lines
│   └── stateEconomics.js       # GDP, debt, population
└── pages/
    └── CampaignWatch.jsx       # Main page (updated)
```

### API Endpoints:
- `GET /api/campaign-watch/states` → All 51 states with corruption data
- `GET /api/campaign-watch/state/:stateCode` → Detailed state profile
- `POST /api/campaign-watch/analyze` → AI analysis of state corruption
- `GET /api/congress/politicians/:state` → Congress.gov data
- `GET /api/civic/representatives/:address` → Google Civic API data

---

## 🚀 Quick Start Commands

### To Start Development:
```bash
# Install dependencies
npm install d3 topojson-client

# Start backend
cd backend && npm run dev

# Start frontend (in another terminal)
npm run dev
```

### To Test Map Component:
```bash
# Open test page
open test-campaign-watch-frontend.html
```

### To Verify Backend:
```bash
# Test API endpoint
curl http://localhost:3000/api/campaign-watch/states
```

---

## 📝 Notes & Decisions

### Design Decisions:
1. **D3 over Mapbox/Leaflet**: More control, no API keys needed, matches World Monitor pattern
2. **Static infrastructure data**: Pre-downloaded GeoJSON to avoid external API calls during development
3. **Draggable dialog over modal**: Better UX for comparing multiple states
4. **Layer toggles inside map**: Consistent with World Monitor, saves screen space

### Future Enhancements (Post-Phase 2):
1. **Real-time data updates**: WebSocket for live FEC filings
2. **3D globe mode**: Like World Monitor's globe.gl option
3. **Mobile optimization**: Responsive layer toggles
4. **Export functionality**: Save corruption profiles as PDF
5. **Comparative analysis**: Compare two states side-by-side

### Risk Mitigation:
- **Data source availability**: Using multiple sources for redundancy
- **API rate limits**: Implementing caching layer
- **Performance**: Lazy loading for infrastructure layers
- **Browser compatibility**: Testing on Chrome, Firefox, Safari

---

## 🔄 Change Log

### 2026-03-18: Strategy Revision
- **Changed**: Map layers from corruption metrics to infrastructure/economics
- **Changed**: Fixed sidebar to draggable floating dialog
- **Changed**: Layer toggles from toolbar to inside map
- **Added**: World Monitor map pattern study
- **Added**: Detailed implementation plan with 4 phases

### 2026-03-18: Initial Implementation
- **Created**: Backend service and API route
- **Created**: Frontend page skeleton
- **Created**: Geo data file with state boundaries
- **Created**: Basic test page

---

## 📞 Contact & Support

For questions or issues:
- **Technical issues**: Check `campaign-watch-memory-bank.md` for architecture details
- **Design questions**: Reference World Monitor `Map.ts` implementation
- **Data sources**: See "Required Data Sources" section above
- **API documentation**: Check `backend/services/campaignWatch.js`

---

*Last updated: 2026-03-18*
*Next review: After Phase 2A completion*
