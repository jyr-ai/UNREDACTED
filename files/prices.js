// routes/prices.js
// GET /api/prices/states     → all state-level regular gas prices
// GET /api/prices/national   → US national average
// GET /api/prices/state/:code → single state price

const express  = require("express");
const router   = express.Router();
const { cacheMiddleware } = require("../middleware/cache");
const { getStatePrices, getNationalAverage } = require("../services/eiaService");

const STATE_TTL    = parseInt(process.env.STATE_PRICES_CACHE_TTL  || "900");
const NATIONAL_TTL = parseInt(process.env.NATIONAL_AVG_CACHE_TTL  || "900");

/**
 * GET /api/prices/states
 * Returns regular gas prices for all 50 US states.
 *
 * Response:
 * {
 *   prices: { CA: 4.72, TX: 2.89, … },
 *   updatedAt: "2025-03-15",
 *   source: "EIA Weekly Retail Gasoline Prices",
 *   _cached: true | false
 * }
 */
router.get(
  "/states",
  cacheMiddleware(STATE_TTL),
  async (req, res, next) => {
    try {
      const result = await getStatePrices();
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/prices/national
 * Returns the current US national average gas price.
 *
 * Response:
 * { average: 3.41, updatedAt: "2025-03-15", source: "EIA" }
 */
router.get(
  "/national",
  cacheMiddleware(NATIONAL_TTL),
  async (req, res, next) => {
    try {
      const result = await getNationalAverage();
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/prices/state/:code
 * Returns the price for a single state (e.g. /api/prices/state/CA)
 *
 * Response:
 * { state: "CA", price: 4.72, updatedAt: "…", source: "…" }
 */
router.get(
  "/state/:code",
  cacheMiddleware(STATE_TTL, req => `/api/prices/state/${req.params.code.toUpperCase()}`),
  async (req, res, next) => {
    try {
      const code = req.params.code.toUpperCase();
      if (!/^[A-Z]{2}$/.test(code)) {
        return res.status(400).json({ error: "Invalid state code. Use 2-letter abbreviation (e.g. CA)." });
      }

      const { prices, updatedAt, source } = await getStatePrices();

      if (!prices[code]) {
        return res.status(404).json({ error: `No data available for state: ${code}` });
      }

      res.json({ state: code, price: prices[code], updatedAt, source });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
