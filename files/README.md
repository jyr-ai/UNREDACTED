# ⛽ FuelWatch US — Backend API

Real-time US gas price API server for the FuelWatch map frontend.

## Stack
- **Node.js 18+** · **Express 4** · **node-cache** (in-memory, swap with Redis for multi-instance)
- **EIA API** — free weekly state gas prices
- **MyGasFeed API** — station-level lat/lng prices
- **Google Geocoding API** (optional) — city/ZIP → coordinates

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in your API keys
cp .env.example .env
nano .env

# 3. Start dev server (auto-restarts on changes)
npm run dev

# 4. Start production server
npm start
```

Server starts on **http://localhost:4000** by default.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server status, uptime, cache stats, API key presence |
| GET | `/api` | Endpoint index |
| GET | `/api/prices/states` | All 50 state regular gas prices |
| GET | `/api/prices/national` | US national average price |
| GET | `/api/prices/state/:code` | Single state price (e.g. `/api/prices/state/CA`) |
| GET | `/api/stations` | Nearby stations by `lat`+`lng` or `zip` |
| GET | `/api/stations/search` | Stations by city/ZIP text query `?q=Austin TX` |

### Stations query params
| Param | Default | Description |
|-------|---------|-------------|
| `lat` + `lng` | — | Coordinates (alternative to `zip`) |
| `zip` | — | US ZIP code (alternative to `lat`/`lng`) |
| `radius` | `10` | Search radius in miles (max: 50) |
| `fuel` | `regular` | `regular` \| `midgrade` \| `premium` \| `diesel` |
| `sort` | `distance` | `distance` \| `price` |

### Example requests
```bash
# All state prices
curl http://localhost:4000/api/prices/states

# Single state
curl http://localhost:4000/api/prices/state/CA

# Stations near coordinates
curl "http://localhost:4000/api/stations?lat=34.05&lng=-118.24&radius=5&fuel=regular&sort=price"

# Stations near ZIP code
curl "http://localhost:4000/api/stations?zip=90210&radius=10"

# Stations by city search
curl "http://localhost:4000/api/stations/search?q=Austin%20TX&fuel=premium&sort=price"

# Health check
curl http://localhost:4000/health
```

---

## API Keys

### EIA (Free — Required for live state prices)
1. Register at https://www.eia.gov/opendata/register.php
2. Add to `.env`: `EIA_API_KEY=your_key`

### MyGasFeed (Free — Required for live station data)
1. Request at http://www.mygasfeed.com/keys/app/request
2. Add to `.env`: `MYGASFEED_API_KEY=your_key`

### Google Geocoding (Optional — improves city search)
1. Enable "Geocoding API" in Google Cloud Console
2. Add to `.env`: `GOOGLE_GEOCODING_API_KEY=your_key`

> **Without API keys**, all endpoints serve realistic mock data so the frontend works immediately.

---

## Frontend Integration

Point your React app at the backend:

```env
# .env (Vite)
VITE_API_BASE_URL=http://localhost:4000
```

Drop in the provided `App.jsx` — it consumes all endpoints automatically.

---

## Running Tests

```bash
npm test
```

Tests cover all endpoints including edge cases, error states, and caching behaviour.

---

## Project Structure

```
gas-price-backend/
├── server.js                 # Express app + route mounting
├── package.json
├── .env.example              # Environment variable template
├── App.jsx                   # React frontend (drop into your project)
├── routes/
│   ├── prices.js             # /api/prices/*
│   └── stations.js           # /api/stations/*
├── services/
│   ├── eiaService.js         # EIA API + mock fallback
│   ├── stationService.js     # MyGasFeed API + mock fallback
│   └── geocodeService.js     # Google Geocoding + fallback
├── middleware/
│   └── cache.js              # In-memory response cache
└── __tests__/
    └── api.test.js           # Jest + Supertest endpoint tests
```

---

## Production Notes

- **Cache**: Swap `node-cache` for Redis (`ioredis`) in `middleware/cache.js` for multi-instance deployments
- **Rate limiting**: 200 requests / 15 min per IP (configurable in `server.js`)
- **CORS**: Set `ALLOWED_ORIGINS` in `.env` to your production frontend URL
- **HTTPS**: Terminate SSL at your reverse proxy (nginx / Caddy) — don't expose this server directly
