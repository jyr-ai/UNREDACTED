# Map Revamp Progress — UNREDACTED News App Tab

## Status: Phase 4 COMPLETE ✅
Build: `✓ 1807 modules transformed` — 0 errors — 12.88s
(Phase 3 was `✓ 1806 modules` / 18.18s)

---

## Architecture Answer: Question 1 — Map Stack

**Chosen stack: MapLibre GL + deck.gl MapboxOverlay (interleaved mode)**

| Component | Choice | Reasoning |
|-----------|--------|-----------|
| Basemap tiles | OpenFreeMap CDN → CARTO fallback (auto-switching) | Free, no API key, PMTiles-ready when R2 is set up |
| WebGL renderer | `MapboxOverlay` in `interleaved: true` mode | One GPU pass — deck.gl renders inside MapLibre's WebGL context |
| Layer types active | ScatterplotLayer, PathLayer, GeoJsonLayer, TextLayer, ArcLayer | Covers all Phase 2 data types |
| Basemap self-hosting | PMTiles on Cloudflare R2 — **ready to enable** via `src/config/basemap.js` `PMTILES_BASE_URL` | Set env var to activate; falls back automatically if not set |

**PMTiles self-hosting**: set `VITE_PMTILES_BASE_URL=https://your-r2-bucket.cloudflare.com/tiles` in `.env` to switch from OpenFreeMap CDN to self-hosted tiles. The `registerPMTilesProtocol()` in `src/config/basemap.js` handles the protocol registration automatically.

---

## Architecture Answer: Question 2 — API Endpoint Processing Pipeline

### Adapted from Worldmonitor to UNREDACTED:

```
External APIs (FEC, EIA, USAspending, congress.gov, RSS feeds, OpenFEC)
        ↓ [Vercel Cron → GET /api/cron/seed-*  every 15-360 min]
    Upstash Redis (8 cache keys: corruption, fec, news, gas, elections, dark money, spending, stockact)
        ↓ [GET /api/bootstrap?tier=fast|slow  batch read — 1 HTTP call]
    Vercel CDN (s-maxage=600 fast / s-maxage=3600 slow + stale-while-revalidate)
        ↓ [Client: primeHydrationCache() — parallel fast+slow fetch, 800ms timeout]
    hydrationCache (in-memory Map in src/services/bootstrap.js)
        ↓ [loadMapData() checks cache first → falls through to individual API calls]
    React state setters (setCorruptionScores, setContributions, setElectionRaces, etc.)
        ↓ [useEffect → dataRef sync → rafRebuildRef() → 150ms debounce]
    deck.gl layers (GeoJsonLayer, ScatterplotLayer, ArcLayer × 14 layers)
        ↓ [MapboxOverlay interleaved: true — one WebGL GPU pass]
    User sees data points on map
```

---

## Files Created / Modified

### Phase 1 (map stack migration — prior work)
- `src/components/DeckGLMap.jsx` — MapLibre GL + deck.gl component
- `src/components/DeckGLMap.css` — map styles
- `src/config/basemap.js` — tile source config + PMTiles protocol

### Phase 2 (data pipeline — this session)

#### Infrastructure
| File | Purpose |
|------|---------|
| `src/lib/upstash.js` | Browser-side Upstash Redis client (fallback stub for local dev) |
| `server/lib/redis.js` | Server-side Upstash Redis client (Node.js) |
| `src/data/stateCentroids.js` | Lat/lon centroids for all 51 state codes (used by ArcLayer) |

#### Seed system
| File | Purpose |
|------|---------|
| `server/lib/seeds.js` | 8 seed functions: corruption, fec, newsGeo, gasPrices, elections, darkMoney, spending, stockAct |
| `server/routes/cron.js` | HTTP handlers for Vercel Cron — one route per seed + `/seed-all` |
| `server/routes/seed-health.js` | `GET /api/seed-health` — reads `seed-meta:*` keys from Redis |

#### API layer
| File | Purpose |
|------|---------|
| `server/routes/bootstrap.js` | `GET /api/bootstrap?tier=fast|slow` — batch Redis read, CDN-cached |
| `server/app.js` | Mounted bootstrap + seed-health + cron routes |
| `vercel.json` | Added 8 cron schedule entries + bootstrap cache headers |

#### Client
| File | Purpose |
|------|---------|
| `src/services/bootstrap.js` | `primeHydrationCache()` — parallel fast/slow fetch on page mount |
| `src/services/map-data.js` | `loadMapData(setters)` — cache-first loader for all 8 data types |
| `src/services/data-freshness.js` | `DataFreshnessTracker` singleton — fresh/stale/error status per source |

#### Map component
| File | Changes |
|------|---------|
| `src/components/DeckGLMap.jsx` | +4 new layer types: `electionRaces`, `darkMoneyFlows`, `spendingFlows`, `stockActTrades` |
| `src/pages/CampaignWatch.jsx` | `primeHydrationCache()` + `loadMapData()` wired on mount; 6 new state vars + props |

---

## Redis Key Reference

| Key | Tier | TTL | Layer | Schedule |
|-----|------|-----|-------|---------|
| `news:geo:v1` | fast | 30m | `news-locations-layer` | `*/15 * * * *` |
| `eia:gasprices:v1` | fast | 30m | gas-price choropleth | `*/15 * * * *` |
| `stockact:trades:v1` | fast | 1h | `stockact-trades-layer` | `*/30 * * * *` |
| `fec:contributions:v1` | fast | 1h | `contribution-arcs-layer` | `*/30 * * * *` |
| `corruption:index:v1` | slow | 2h | state choropleth | `0 * * * *` |
| `elections:races:v1` | slow | 2h | `election-races-layer` | `0 */2 * * *` |
| `darkmoney:flows:v1` | slow | 6h | `dark-money-arcs-layer` | `0 */6 * * *` |
| `spending:bystate:v1` | slow | 6h | `spending-flows-layer` | `0 */6 * * *` |

---

## Environment Variables Required

```bash
# Upstash Redis (https://console.upstash.com/)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token_here

# Cron security (any random string ≥ 32 chars)
CRON_SECRET=replace_with_long_random_secret_32chars_min

# Optional: Self-hosted PMTiles basemap on Cloudflare R2
VITE_PMTILES_BASE_URL=https://your-r2.cloudflare.com/tiles
```

---

## Phase 3 — COMPLETE ✅

### Code changes implemented

| Feature | File(s) | Detail |
|---------|---------|--------|
| **Supercluster clustering** | `DeckGLMap.jsx` | `electionRaces` + `stockActTrades` use `buildClusters()` at all zoom levels; cluster dots show count TextLayer labels; click tooltip says "Zoom in to expand" |
| **Time-range filter** | `DeckGLMap.jsx`, `DeckGLMap.css` | `1H / 6H / 24H / 7D / ALL` toolbar (bottom-center); `filterByTime()` utility filters all timestamped data before layer build; synced via `timeRangeRef` for zero-stale-closure |
| **Data freshness badge** | `DeckGLMap.jsx`, `DeckGLMap.css` | Bottom-left badge shows `DATA n/total` with green/amber/red dot; click expands panel listing all 8 sources with status + age in minutes; polls `DataFreshnessTracker` every 30s |
| **Persistent cache** | `src/services/persistent-cache.js` | Three-tier: IndexedDB → localStorage → in-memory Map; TTL-aware; `persistentCache.set/get/clear()` API |
| **Elections route** | `backend/routes/campaignWatch.js` | Already existed (`GET /api/campaign-watch/elections` via `googleCivicService.getElectionList()`) |

---

## Infrastructure Next Steps (manual — required to activate live data)

- [ ] **Provision Upstash Redis** — create free database at [console.upstash.com](https://console.upstash.com), add env vars to Vercel
- [ ] **Prime the cache** — call `GET /api/cron/seed-all?secret=<CRON_SECRET>` once to populate all 8 Redis keys
- [ ] **Enable Phase 2/3 layers** — toggle on in the map: Election Races, Dark Money, Fed Spending, STOCK Act
- [ ] **Verify seed-health** — `GET /api/seed-health` should show all 8 seeds as `ok`; freshness badge will turn green
- [ ] **Optional: PMTiles self-hosting** — upload tiles to Cloudflare R2, set `VITE_PMTILES_BASE_URL`

## Phase 4 — COMPLETE ✅

| Feature | File(s) | Detail |
|---------|---------|--------|
| **Persistent cache pre-seed** | `src/services/bootstrap.js` | Before network calls, reads all 8 keys from IndexedDB/localStorage — returning users see instant data |
| **Persistent cache write-back** | `src/services/bootstrap.js` | After each bootstrap, writes fresh results to IndexedDB with per-key TTL (30min–6h) |
| **`setHydratedData` persistence** | `src/services/bootstrap.js` | Individual API fallback results also persist to IndexedDB for next session |
| **HeatmapLayer hybrid** | `src/components/DeckGLMap.jsx` | Contributions: zoom < 5 → `HeatmapLayer` (density heatmap); zoom ≥ 5 → `ArcLayer` (individual arcs) |
| **Viewport bounds tracking** | `src/components/DeckGLMap.jsx` | `onBoundsChange` prop fires on every moveend/zoomend with `{north,south,east,west}` — allows parent to filter data by viewport |
| **Render pause on tab hide** | `src/components/DeckGLMap.jsx` | `visibilitychange` listener: cancels RAF + debounce + pulse interval when tab hidden; force-rebuilds on resume |

---

## Phase 5 Ideas (future)

- [ ] **Viewport-aware seed fetching** — pass bounding box from `onBoundsChange` to seed endpoints to fetch only visible region
- [ ] **`HexagonLayer` for spending** — aggregate state spending into H3 hexagons at zoom < 3
- [ ] **WebGL context loss recovery** — automatically re-init MapboxOverlay on `webglcontextrestored`
- [ ] **Offline mode** — when navigator.onLine = false, serve entirely from persistentCache
- [ ] **More seed sources** — add OpenSky (military flights), GDELT (geopolitical events), ACLED (protests)
