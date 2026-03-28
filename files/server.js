// server.js — FuelWatch US Backend
// Express API server for real-time US gas price data.
//
// Endpoints:
//   GET /health
//   GET /api/prices/states
//   GET /api/prices/national
//   GET /api/prices/state/:code
//   GET /api/stations?lat=&lng=&radius=&fuel=&sort=
//   GET /api/stations?zip=&radius=&fuel=&sort=
//   GET /api/stations/search?q=&radius=&fuel=

require("dotenv").config();

const express     = require("express");
const cors        = require("cors");
const helmet      = require("helmet");
const compression = require("compression");
const rateLimit   = require("express-rate-limit");

const pricesRouter   = require("./routes/prices");
const stationsRouter = require("./routes/stations");
const { stats }      = require("./middleware/cache");

const app  = express();
const PORT = process.env.PORT || 4000;

// ─── Security & Middleware ────────────────────────────────────────────────────

app.use(helmet());
app.use(compression());
app.use(express.json());

// CORS — configure per environment
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:5173")
  .split(",")
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === "development") {
      return callback(null, true);
    }
    callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  methods: ["GET"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ─── Rate Limiting ────────────────────────────────────────────────────────────

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,                  // requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

app.use("/api/", limiter);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/api/prices",   pricesRouter);
app.use("/api/stations", stationsRouter);

/**
 * GET /health
 * Returns server status, uptime, cache stats.
 */
app.get("/health", (req, res) => {
  res.json({
    status:  "ok",
    version: "1.0.0",
    uptime:  process.uptime(),
    env:     process.env.NODE_ENV || "development",
    apis: {
      eia:         !!process.env.EIA_API_KEY && process.env.EIA_API_KEY !== "your_eia_api_key_here",
      myGasFeed:   !!process.env.MYGASFEED_API_KEY && process.env.MYGASFEED_API_KEY !== "your_mygasfeed_api_key_here",
      googleGeo:   !!process.env.GOOGLE_GEOCODING_API_KEY && process.env.GOOGLE_GEOCODING_API_KEY !== "your_google_api_key_here",
    },
    cache: stats(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api
 * API index — lists all available endpoints.
 */
app.get("/api", (req, res) => {
  res.json({
    name:    "FuelWatch US API",
    version: "1.0.0",
    endpoints: [
      { method:"GET", path:"/health",                   description:"Server health, uptime & cache stats" },
      { method:"GET", path:"/api/prices/states",        description:"All 50 state average gas prices" },
      { method:"GET", path:"/api/prices/national",      description:"US national average gas price" },
      { method:"GET", path:"/api/prices/state/:code",   description:"Single state price (e.g. /api/prices/state/CA)" },
      { method:"GET", path:"/api/stations",             description:"Nearby stations by lat/lng or ZIP", params: ["lat","lng","zip","radius (mi)","fuel (regular|midgrade|premium|diesel)","sort (distance|price)"] },
      { method:"GET", path:"/api/stations/search",      description:"Stations by city/ZIP text search", params: ["q","radius","fuel","sort"] },
    ],
    dataSources: [
      { name:"EIA",        url:"https://www.eia.gov/opendata/",           notes:"Weekly state averages — free API key required" },
      { name:"MyGasFeed",  url:"http://www.mygasfeed.com/keys/app/request", notes:"Station-level prices — free API key required" },
      { name:"Google Geo", url:"https://developers.google.com/maps/documentation/geocoding", notes:"Optional — city/ZIP → lat/lng" },
    ],
  });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ─── Error Handler ────────────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[Error]", err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === "production"
      ? "An unexpected error occurred."
      : err.message,
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   ⛽  FuelWatch US API  v1.0.0        ║
╠════════════════════════════════════════╣
║  Server:  http://localhost:${PORT}       ║
║  Health:  http://localhost:${PORT}/health║
║  Docs:    http://localhost:${PORT}/api   ║
╚════════════════════════════════════════╝
  `);
});

module.exports = app; // for testing
