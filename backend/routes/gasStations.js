// backend/routes/gasStations.js
// GET /api/gas/stations                  → nearby stations by lat/lng or ZIP
// GET /api/gas/stations/search?q=Austin  → geocode + find stations
// ESM — matches backend "type": "module"

import { Router } from 'express'
import { cacheMiddleware } from '../middleware/gasCache.js'
import { getStationsByLocation, getStationsByZip } from '../services/stationService.js'
import { geocode } from '../services/gasPriceGeocode.js'

const router = Router()

const STATIONS_TTL = parseInt(process.env.STATIONS_CACHE_TTL || '300', 10)  // 5 min

const parseF = v => { const n = parseFloat(v); return isNaN(n) ? null : n }
const parseI = v => { const n = parseInt(v, 10); return isNaN(n) ? null : n }

const VALID_FUELS = ['regular', 'midgrade', 'premium', 'diesel']
const VALID_SORTS = ['distance', 'price']

/**
 * GET /api/gas/stations
 * Query params:
 *   lat, lng   – coordinates (required if no zip)
 *   zip        – US ZIP code (alternative to lat/lng)
 *   radius     – search radius in miles (default: 10, max: 50)
 *   fuel       – "regular" | "midgrade" | "premium" | "diesel" (default: regular)
 *   sort       – "distance" | "price" (default: distance)
 *
 * Response:
 *   { stations: [...], count, query, source }
 */
router.get(
  '/',
  cacheMiddleware(STATIONS_TTL, req => {
    const { lat, lng, zip, radius, fuel, sort } = req.query
    return `gas:stations:${lat}:${lng}:${zip}:${radius}:${fuel}:${sort}`
  }),
  async (req, res, next) => {
    try {
      const { lat, lng, zip, radius = '10', fuel = 'regular', sort = 'distance' } = req.query

      const radiusMiles = Math.min(parseI(radius) || 10, 50)

      if (!VALID_FUELS.includes(fuel)) {
        return res.status(400).json({ error: `Invalid fuel type. Use one of: ${VALID_FUELS.join(', ')}` })
      }
      if (!VALID_SORTS.includes(sort)) {
        return res.status(400).json({ error: `sort must be "distance" or "price"` })
      }

      if (zip) {
        const result = await getStationsByZip({ zip, radiusMiles, fuelType: fuel, sortBy: sort })
        return res.json(result)
      }

      const latN = parseF(lat)
      const lngN = parseF(lng)

      if (latN === null || lngN === null) {
        return res.status(400).json({ error: 'Provide either lat & lng or zip query parameter.' })
      }
      if (latN < 17 || latN > 72 || lngN < -180 || lngN > -60) {
        return res.status(400).json({ error: 'Coordinates appear to be outside the United States.' })
      }

      const result = await getStationsByLocation({ lat: latN, lng: lngN, radiusMiles, fuelType: fuel, sortBy: sort })
      res.json(result)
    } catch (err) {
      next(err)
    }
  }
)

/**
 * GET /api/gas/stations/search?q=Austin TX&radius=10&fuel=regular&sort=distance
 * Geocodes the query string then finds nearby stations.
 *
 * Response:
 *   { stations: [...], count, query, geocode: { lat, lng, formattedAddress, state }, source }
 */
router.get(
  '/search',
  cacheMiddleware(STATIONS_TTL, req =>
    `gas:stations:search:${req.query.q}:${req.query.radius}:${req.query.fuel}:${req.query.sort}`
  ),
  async (req, res, next) => {
    try {
      const { q, radius = '10', fuel = 'regular', sort = 'distance' } = req.query

      if (!q || q.trim().length < 2) {
        return res.status(400).json({ error: 'q parameter is required (city name or ZIP code).' })
      }
      if (!VALID_FUELS.includes(fuel)) {
        return res.status(400).json({ error: `Invalid fuel type. Use: ${VALID_FUELS.join(', ')}` })
      }

      const geo          = await geocode(q.trim())
      const radiusMiles  = Math.min(parseI(radius) || 10, 50)
      const stationResult = await getStationsByLocation({
        lat: geo.lat, lng: geo.lng, radiusMiles, fuelType: fuel, sortBy: sort,
      })

      res.json({
        ...stationResult,
        geocode: {
          query:            q,
          formattedAddress: geo.formattedAddress,
          lat:              geo.lat,
          lng:              geo.lng,
          state:            geo.state,
        },
      })
    } catch (err) {
      next(err)
    }
  }
)

export default router
