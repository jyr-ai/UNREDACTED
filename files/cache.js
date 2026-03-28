// middleware/cache.js
// Lightweight in-memory cache wrapper around node-cache.
// Swap this with Redis (ioredis) for multi-instance deployments.

const NodeCache = require("node-cache");

const cache = new NodeCache({ checkperiod: 60 });

/**
 * Express middleware factory.
 * @param {number} ttlSeconds – How long to cache the response.
 * @param {function} [keyFn]  – Optional fn(req) → string for custom cache keys.
 */
function cacheMiddleware(ttlSeconds, keyFn) {
  return (req, res, next) => {
    const key = keyFn ? keyFn(req) : req.originalUrl;
    const cached = cache.get(key);

    if (cached !== undefined) {
      return res.json({ ...cached, _cached: true });
    }

    // Monkey-patch res.json to intercept and store the response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200) {
        cache.set(key, body, ttlSeconds);
      }
      return originalJson(body);
    };

    next();
  };
}

/**
 * Manually invalidate a cache key (useful for webhooks / forced refresh).
 */
function invalidate(key) {
  cache.del(key);
}

/**
 * Return cache statistics for the /health endpoint.
 */
function stats() {
  return cache.getStats();
}

module.exports = { cacheMiddleware, invalidate, stats };
