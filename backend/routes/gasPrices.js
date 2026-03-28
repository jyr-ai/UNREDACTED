// backend/routes/gasPrices.js
// GET /api/gas/prices/states    → all 50-state regular gas prices
// GET /api/gas/prices/national  → US national average
// GET /api/gas/prices/state/:code → single state price
// ESM — matches backend "type": "module"

import { Router } from 'express'
import { cacheMiddleware } from '../middleware/gasCache.js'
import { getStatePrices, getNationalAverage } from '../services/eiaService.js'

const router = Router()

const STATE_TTL    = parseInt(process.env.STATE_PRICES_CACHE_TTL  || '900', 10)  // 15 min
const NATIONAL_TTL = parseInt(process.env.NATIONAL_AVG_CACHE_TTL  || '900', 10)  // 15 min

/**
 * GET /api/gas/prices/states
 * Returns regular gas prices for all 50 US states.
 *
 * Response:
 *   { prices: { CA: 4.72, TX: 2.89, … }, updatedAt: "2025-03-15", source: "EIA …", _cached: bool }
 */
router.get(
  '/states',
  cacheMiddleware(STATE_TTL),
  async (req, res, next) => {
    try {
      const result = await getStatePrices()
      res.json(result)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * GET /api/gas/prices/national
 * Returns the current US national average gas price.
 *
 * Response:
 *   { average: 3.41, updatedAt: "2025-03-15", source: "EIA …" }
 */
router.get(
  '/national',
  cacheMiddleware(NATIONAL_TTL),
  async (req, res, next) => {
    try {
      const result = await getNationalAverage()
      res.json(result)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * GET /api/gas/prices/state/:code
 * Returns the price for a single state (e.g. /api/gas/prices/state/CA)
 *
 * Response:
 *   { state: "CA", price: 4.72, updatedAt: "…", source: "…" }
 */
router.get(
  '/state/:code',
  cacheMiddleware(STATE_TTL, req => `/api/gas/prices/state/${req.params.code.toUpperCase()}`),
  async (req, res, next) => {
    try {
      const code = req.params.code.toUpperCase()
      if (!/^[A-Z]{2}$/.test(code)) {
        return res.status(400).json({ error: 'Invalid state code — use 2-letter abbreviation (e.g. CA).' })
      }

      const { prices, updatedAt, source } = await getStatePrices()

      if (!prices[code]) {
        return res.status(404).json({ error: `No data available for state: ${code}` })
      }

      res.json({ state: code, price: prices[code], updatedAt, source })
    } catch (err) {
      next(err)
    }
  }
)

export default router
