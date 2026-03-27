// backend/middleware/gasCache.js
// Lightweight in-memory cache for gas price API responses using node-cache.
// Swap the NodeCache instance for ioredis in multi-instance deployments.
// Converted to ESM for the UNREDACTED backend (type: "module")

import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const NodeCache = require('node-cache')

// checkperiod: purge expired keys every 60 seconds
const cache = new NodeCache({ checkperiod: 60 })

/**
 * Express middleware factory.
 *
 * @param {number}   ttlSeconds  How long to cache the response (seconds).
 * @param {Function} [keyFn]     Optional fn(req) → string for custom cache keys.
 *                               Defaults to req.originalUrl.
 */
export function cacheMiddleware(ttlSeconds, keyFn) {
  return (req, res, next) => {
    const key    = keyFn ? keyFn(req) : req.originalUrl
    const cached = cache.get(key)

    if (cached !== undefined) {
      return res.json({ ...cached, _cached: true })
    }

    // Monkey-patch res.json to intercept and store the response
    const originalJson = res.json.bind(res)
    res.json = (body) => {
      if (res.statusCode === 200) {
        cache.set(key, body, ttlSeconds)
      }
      return originalJson(body)
    }

    next()
  }
}

/**
 * Manually invalidate a cache key (for forced refresh / webhooks).
 */
export function invalidate(key) {
  cache.del(key)
}

/**
 * Return cache statistics for health check endpoints.
 */
export function gasCacheStats() {
  return cache.getStats()
}
