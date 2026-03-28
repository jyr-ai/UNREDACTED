// routes/stations.js
// GET /api/stations?lat=&lng=&radius=&fuel=&sort=
// GET /api/stations?zip=&radius=&fuel=&sort=
// GET /api/stations/search?q=&radius=&fuel=

const express  = require("express");
const router   = express.Router();
const { cacheMiddleware } = require("../middleware/cache");
const { getStationsByLocation, getStationsByZip } = require("../services/stationService");
const { geocode } = require("../services/geocodeService");

const STATIONS_TTL = parseInt(process.env.STATIONS_CACHE_TTL || "300");

// Helpers
const parseFloat2 = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
const parseInt10   = v => { const n = parseInt(v, 10); return isNaN(n) ? null : n; };

/**
 * GET /api/stations
 * Query params:
 *   lat, lng      – coordinates (required if no zip)
 *   zip           – US ZIP code (alternative to lat/lng)
 *   radius        – search radius in miles (default: 10, max: 50)
 *   fuel          – "regular" | "midgrade" | "premium" | "diesel" (default: regular)
 *   sort          – "distance" | "price" (default: distance)
 *
 * Response:
 * {
 *   stations: [{ id, name, address, city, state, lat, lng, distance, prices: { regular, midgrade, premium, diesel }, updatedAt }],
 *   count: 6,
 *   query: { … },
 *   source: "MyGasFeed"
 * }
 */
router.get(
  "/",
  cacheMiddleware(STATIONS_TTL, req => {
    const { lat, lng, zip, radius, fuel, sort } = req.query;
    return `stations:${lat}:${lng}:${zip}:${radius}:${fuel}:${sort}`;
  }),
  async (req, res, next) => {
    try {
      const { lat, lng, zip, radius = "10", fuel = "regular", sort = "distance" } = req.query;

      // Validate radius
      const radiusMiles = Math.min(parseInt10(radius) || 10, 50);

      // Validate fuel type
      const validFuels = ["regular", "midgrade", "premium", "diesel"];
      if (!validFuels.includes(fuel)) {
        return res.status(400).json({ error: `Invalid fuel type. Use one of: ${validFuels.join(", ")}` });
      }

      // Validate sort
      if (!["distance","price"].includes(sort)) {
        return res.status(400).json({ error: 'sort must be "distance" or "price"' });
      }

      // Route to appropriate service method
      if (zip) {
        const result = await getStationsByZip({ zip, radiusMiles, fuelType: fuel, sortBy: sort });
        return res.json(result);
      }

      const latN = parseFloat2(lat);
      const lngN = parseFloat2(lng);

      if (latN === null || lngN === null) {
        return res.status(400).json({ error: "Provide either lat & lng or zip query parameter." });
      }

      if (latN < 17 || latN > 72 || lngN < -180 || lngN > -60) {
        return res.status(400).json({ error: "Coordinates appear to be outside the United States." });
      }

      const result = await getStationsByLocation({ lat: latN, lng: lngN, radiusMiles, fuelType: fuel, sortBy: sort });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/stations/search?q=Austin TX&radius=10&fuel=regular
 * Geocodes the query string first, then finds nearby stations.
 */
router.get(
  "/search",
  cacheMiddleware(STATIONS_TTL, req => `stations:search:${req.query.q}:${req.query.radius}:${req.query.fuel}`),
  async (req, res, next) => {
    try {
      const { q, radius = "10", fuel = "regular", sort = "distance" } = req.query;

      if (!q || q.trim().length < 2) {
        return res.status(400).json({ error: "q parameter is required (city name or ZIP code)." });
      }

      const geo = await geocode(q.trim());
      const radiusMiles = Math.min(parseInt10(radius) || 10, 50);

      const stationResult = await getStationsByLocation({
        lat: geo.lat, lng: geo.lng, radiusMiles, fuelType: fuel, sortBy: sort,
      });

      res.json({
        ...stationResult,
        geocode: {
          query: q,
          formattedAddress: geo.formattedAddress,
          lat: geo.lat,
          lng: geo.lng,
          state: geo.state,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
