# ⛽ Gas Price Live Data — Implementation Progress

> **Goal:** Integrate live US gas price data (EIA weekly state prices + MyGasFeed station-level prices)
> into the UNREDACTED News Map with an enhanced D3 map featuring capital cities, tier-1/tier-2 cities,
> mountain range terrain, and zoom-aware city labels with gas price badges pinned above each city.

---

## Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Backend runtime | Node.js 18+ · Express 4 (ESM) | Existing backend at `backend/` |
| In-memory cache | `node-cache` | Swap with Redis for multi-instance |
| State prices | **EIA API** (free) | Weekly avg per state — `https://api.eia.gov/v2` |
| Station prices | **MyGasFeed API** (free) | Station-level lat/lng prices |
| Geocoding | **Google Geocoding API** (optional) | City/ZIP → coordinates; offline fallback included |
| Frontend | React 18 · D3 v7 · TopoJSON | Existing `USPoliticalMap.jsx` |

---

## API Keys Needed

| Key | Required? | Where to get |
|-----|-----------|--------------|
| `EIA_API_KEY` | ✅ For live state prices | https://www.eia.gov/opendata/register.php |
| `MYGASFEED_API_KEY` | ✅ For station-level data | http://www.mygasfeed.com/keys/app/request |
| `GOOGLE_GEOCODING_API_KEY` | ⬜ Optional — improves city search | https://console.cloud.google.com → Geocoding API |

> **Note:** All services have realistic mock fallbacks — the map works without any API keys.

---

## Part A — Backend: Gas Price API

### A1 · Dependencies
- [ ] Install `node-cache` in `backend/`
  ```bash
  cd backend && npm install node-cache
  ```

### A2 · Services (`backend/services/`)
- [ ] **`eiaService.js`** — Adapted from `files/eiaService.js` (converted to ESM)
  - `getStatePrices()` — fetches all 50-state weekly prices from EIA v2 API
  - `getNationalAverage()` — fetches US national average series `EMM_EPM0_PTE_NUS_DPG`
  - Graceful mock fallback when `EIA_API_KEY` is absent
  - 15-min cache TTL

- [ ] **`stationService.js`** — Adapted from `files/stationService.js` (converted to ESM)
  - `getStationsByLocation({ lat, lng, radiusMiles, fuelType, sortBy })`
  - `getStationsByZip({ zip, radiusMiles, fuelType, sortBy })`
  - Normalizes MyGasFeed response → consistent shape
  - 6 mock stations around requested coordinates as fallback

- [ ] **`gasPriceGeocode.js`** — Adapted from `files/geocodeService.js` (converted to ESM)
  - `geocode(query)` — Google Geocoding or offline city/ZIP fallback
  - Covers 20 major cities + ZIP-prefix approximation

### A3 · Cache Middleware (`backend/middleware/`)
- [ ] **`gasCache.js`** — Adapted from `files/cache.js` (converted to ESM)
  - `cacheMiddleware(ttlSeconds, keyFn?)` — Express middleware factory
  - `invalidate(key)` — manual cache bust
  - `stats()` — for health check endpoint

### A4 · Routes (`backend/routes/`)
- [ ] **`gasPrices.js`** — Adapted from `files/prices.js` (converted to ESM)
  - `GET /states` → all 50 state prices `{ prices: { CA: 4.72, TX: 2.89 … }, updatedAt, source }`
  - `GET /national` → `{ average: 3.41, updatedAt, source }`
  - `GET /state/:code` → single state `{ state: "CA", price: 4.72, updatedAt }`

- [ ] **`gasStations.js`** — Adapted from `files/stations.js` (converted to ESM)
  - `GET /` — query params: `lat`, `lng`, `zip`, `radius` (max 50mi), `fuel`, `sort`
  - `GET /search` — `?q=Austin TX&radius=10&fuel=regular&sort=price`
  - Returns `{ stations: [...], count, query, geocode, source }`

### A5 · Server Wiring
- [ ] **`backend/server.js`** — mount 2 new route groups
  ```js
  import gasPricesRouter  from './routes/gasPrices.js'
  import gasStationsRouter from './routes/gasStations.js'

  app.use('/api/gas/prices',   generalLimiter, gasPricesRouter)
  app.use('/api/gas/stations', generalLimiter, gasStationsRouter)
  ```

### A6 · Environment
- [ ] **`backend/.env.example`** — append gas price API key variables
  ```
  # ─── Gas Price APIs ──────────────────────────────────────────────────────────
  EIA_API_KEY=your_eia_api_key_here
  MYGASFEED_API_KEY=your_mygasfeed_api_key_here
  GOOGLE_GEOCODING_API_KEY=your_google_api_key_here

  # Cache TTLs (seconds)
  STATE_PRICES_CACHE_TTL=900
  NATIONAL_AVG_CACHE_TTL=900
  STATIONS_CACHE_TTL=300
  ```

---

## Part B — Frontend Data

### B1 · US Cities Dataset
- [ ] **`src/data/usCities.js`** — ~200 cities with tier classification
  ```js
  // Shape: { name, state, lat, lng, tier, population }
  // tier: "capital" | "tier1" | "tier2"
  ```
  | Tier | Count | Visibility | Examples |
  |------|-------|------------|---------|
  | `capital` | 50 | Always (zoom ≥ 1) | Sacramento, Austin, Tallahassee |
  | `tier1` | ~40 | Zoom ≥ 2 | NYC, LA, Chicago, Houston, Phoenix |
  | `tier2` | ~110 | Zoom ≥ 3.5 | Richmond, Boise, Tucson, El Paso, Knoxville |

### B2 · Mountain Ranges Data
- [ ] **`src/data/mountainRanges.js`** — polyline coordinates for major ranges
  | Range | States | Style |
  |-------|--------|-------|
  | Rocky Mountains | MT → NM | Dashed ridge line |
  | Appalachian Mountains | ME → GA | Subtle ridge line |
  | Sierra Nevada | CA | Short ridge |
  | Cascade Range | WA → CA | Ridge line |
  | Great Smoky Mountains | TN/NC | Short ridge |
  | Ozark Highlands | MO/AR | Subtle area |

### B3 · API Client
- [ ] **`src/api/client.js`** — add `gasPrices` namespace
  ```js
  export const gasPrices = {
    states:   () => request('/api/gas/prices/states'),
    national: () => request('/api/gas/prices/national'),
    state:    (code) => request(`/api/gas/prices/state/${code}`),
    stations: (params) => { const qs = new URLSearchParams(params).toString(); return request(`/api/gas/stations?${qs}`) },
    search:   (q, fuel = 'regular', sort = 'distance') =>
      request(`/api/gas/stations/search?q=${encodeURIComponent(q)}&fuel=${fuel}&sort=${sort}`),
  }
  ```

---

## Part C — Frontend Components

### C1 · Gas Price Panel Component
- [ ] **`src/components/GasPricePanel.jsx`** — station finder sidebar
  - National average header badge
  - Fuel type selector (regular/midgrade/premium/diesel)
  - Sort toggle (distance / price)
  - Search bar → `gasPrices.search(q)`
  - Station cards: name, address, distance, all fuel prices, last updated
  - Loading spinner + error state

### C2 · USPoliticalMap.jsx — Major Enhancements
- [ ] Add 3 new layer toggles to `LAYER_DEFS`:
  ```js
  { id: 'gasPrices', name: '⛽ Gas Prices' },
  { id: 'cities',    name: '🏙️ Cities'     },
  { id: 'terrain',   name: '⛰️ Terrain'    },
  ```
- [ ] Import `US_CITIES` from `src/data/usCities.js`
- [ ] Import `MOUNTAIN_RANGES` from `src/data/mountainRanges.js`
- [ ] **Zoom-aware city rendering**:
  ```
  Zoom 1.0 → capitals (★ star) + tier1 dots only
  Zoom 2.0 → capital labels + tier1 labels + terrain ridgelines
  Zoom 3.5 → tier2 dots + labels
  Zoom 5.0 → full detail: all labels, population circles
  ```
- [ ] **Gas price badge overlay** (when `activeLayers.gasPrices === true`):
  - Fetch `/api/gas/prices/states` on toggle
  - State choropleth fill → green→yellow→red by price
  - `<rect>` + `<text>` price badge above each visible city dot
  - Badge color matches choropleth scale
  - Gas price legend replaces default legend
- [ ] **City click handler** → opens `GasPricePanel` with nearby stations
- [ ] **Terrain rendering** (when `activeLayers.terrain === true`):
  - Draw mountain range polylines with `d3.line()` + muted brown color
- [ ] Update legend to show gas price gradient when gas layer is active
- [ ] Capital cities use ★ star symbol instead of ● circle

---

## Part D — Visual Design Reference

### Gas Price Badge (per city)
```
      ╔══════╗
      ║$3.41 ║  ← rounded rect, colored by price scale
      ╚══╤═══╝
         │
         ●      ← city dot (size by tier)
      Austin    ← city label (IBM Plex Mono)
```

### Color Scale
```
Gas Prices Legend:
⛽ GAS PRICES $/GAL
[#22c55e ████████████████████ #ef4444]
 $2.79 (cheapest)          $4.72 (most exp.)
```

### Zoom Behavior
| Zoom Level | What's Visible |
|------------|----------------|
| 1.0 (default) | State fills, state labels, capitals (★) |
| 2.0 | + Tier-1 city dots and labels, terrain lines |
| 3.5 | + Tier-2 city dots and labels |
| 5.0+ | Full detail — all labels, building-level zoom |

---

## Endpoint Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/gas/prices/states` | All 50 state gas prices |
| `GET` | `/api/gas/prices/national` | US national average |
| `GET` | `/api/gas/prices/state/:code` | Single state (e.g. `/state/CA`) |
| `GET` | `/api/gas/stations` | Stations by `lat`+`lng` or `zip` |
| `GET` | `/api/gas/stations/search` | Stations by `?q=Austin TX` |

---

## File Change Summary

| Status | File | Description |
|--------|------|-------------|
| 🆕 CREATE | `backend/services/eiaService.js` | EIA API v2 + 50-state mock |
| 🆕 CREATE | `backend/services/stationService.js` | MyGasFeed + mock stations |
| 🆕 CREATE | `backend/services/gasPriceGeocode.js` | Google Geocoding + city fallback |
| 🆕 CREATE | `backend/middleware/gasCache.js` | node-cache TTL middleware |
| 🆕 CREATE | `backend/routes/gasPrices.js` | `/api/gas/prices/*` routes |
| 🆕 CREATE | `backend/routes/gasStations.js` | `/api/gas/stations/*` routes |
| ✏️ MODIFY | `backend/server.js` | Mount 2 new route groups |
| ✏️ MODIFY | `backend/.env.example` | Add 3 API key vars + TTL config |
| 🆕 CREATE | `src/data/usCities.js` | ~200 cities (capital/tier1/tier2) |
| 🆕 CREATE | `src/data/mountainRanges.js` | 6 mountain range polylines |
| ✏️ MODIFY | `src/api/client.js` | Add `gasPrices` namespace |
| 🆕 CREATE | `src/components/GasPricePanel.jsx` | Station finder sidebar |
| ✏️ MODIFY | `src/components/USPoliticalMap.jsx` | Enhanced map: cities, terrain, gas badges |

---

## Progress Tracker

### Backend
- [ ] A1 · `npm install node-cache` in backend
- [ ] A2a · `backend/services/eiaService.js`
- [ ] A2b · `backend/services/stationService.js`
- [ ] A2c · `backend/services/gasPriceGeocode.js`
- [ ] A3 · `backend/middleware/gasCache.js`
- [ ] A4a · `backend/routes/gasPrices.js`
- [ ] A4b · `backend/routes/gasStations.js`
- [ ] A5 · Wire routes in `backend/server.js`
- [ ] A6 · Update `backend/.env.example`

### Frontend Data
- [ ] B1 · `src/data/usCities.js` (~200 cities)
- [ ] B2 · `src/data/mountainRanges.js`
- [ ] B3 · Add `gasPrices` to `src/api/client.js`

### Frontend Components
- [ ] C1 · `src/components/GasPricePanel.jsx`
- [ ] C2a · Add new layer toggles to `USPoliticalMap.jsx`
- [ ] C2b · Zoom-aware city rendering in `USPoliticalMap.jsx`
- [ ] C2c · Gas price badge overlay in `USPoliticalMap.jsx`
- [ ] C2d · Terrain (mountain range) layer in `USPoliticalMap.jsx`
- [ ] C2e · Capital cities star (★) marker in `USPoliticalMap.jsx`

---

_Last updated: 2026-03-21 — tracking implementation of live gas price data in the UNREDACTED News Map_
