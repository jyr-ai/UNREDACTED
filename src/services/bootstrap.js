/**
 * Client-side hydration cache (adapted from Worldmonitor bootstrap.ts).
 *
 * On page load this module fires two parallel requests:
 *   GET /api/bootstrap?tier=fast  — FEC, elections, gas prices, news (s-maxage=600)
 *   GET /api/bootstrap?tier=slow  — corruption, spending, dark money (s-maxage=3600)
 *
 * Results are stored in `hydrationCache` (in-memory Map).
 * Individual service modules call `getHydratedData(key)` to get pre-loaded data
 * without making additional network calls.
 *
 * Phase 4: persistent cache integration.
 * Before making network calls, the IndexedDB/localStorage persistent cache is
 * checked for each key. This gives returning users instant data while the
 * network refresh happens in the background.
 * After a successful bootstrap, results are written back to persistent cache
 * with per-tier TTLs.
 */

import persistentCache from './persistent-cache.js'

const hydrationCache = new Map()
let _bootstrapPromise = null
const BOOTSTRAP_TIMEOUT_MS = 800

// Persistent cache TTLs (match the Redis seed schedules)
const PERSIST_TTL = {
  'news:geo:v1':          30 * 60 * 1000,   // 30 min
  'eia:gasprices:v1':     30 * 60 * 1000,   // 30 min
  'stockact:trades:v1':   60 * 60 * 1000,   // 1 h
  'fec:contributions:v1': 60 * 60 * 1000,   // 1 h
  'corruption:index:v1':  2  * 60 * 60 * 1000,  // 2 h
  'elections:races:v1':   2  * 60 * 60 * 1000,  // 2 h
  'darkmoney:flows:v1':   6  * 60 * 60 * 1000,  // 6 h
  'spending:bystate:v1':  6  * 60 * 60 * 1000,  // 6 h
}
const ALL_KEYS = Object.keys(PERSIST_TTL)

// ── Negative sentinel (avoid re-fetching keys that have "no data") ────────────
const NEG_SENTINEL = '__UNREDACTED_NEG__'

// ── Fetch with timeout ────────────────────────────────────────────────────────
function fetchWithTimeout(url, ms) {
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { signal: ctrl.signal })
    .then(r => r.ok ? r.json() : null)
    .catch(() => null)
    .finally(() => clearTimeout(timer))
}

// ── Pre-seed hydrationCache from IndexedDB/localStorage (synchronous path) ───
async function preSeedFromPersistentCache() {
  try {
    const results = await Promise.all(
      ALL_KEYS.map(async key => {
        const val = await persistentCache.get(key)
        return [key, val]
      })
    )
    let count = 0
    for (const [key, val] of results) {
      if (val != null) {
        hydrationCache.set(key, val)
        count++
      }
    }
    if (count > 0) {
      console.debug(`[bootstrap] pre-seeded ${count} keys from persistent cache`)
    }
  } catch (e) {
    // Non-fatal — persistent cache is best-effort
    console.debug('[bootstrap] persistent cache pre-seed skipped:', e.message)
  }
}

// ── Write bootstrap results to persistent cache (background) ─────────────────
function writeToPersistentCache(data) {
  try {
    for (const [key, val] of Object.entries(data)) {
      if (val && val !== NEG_SENTINEL) {
        const ttl = PERSIST_TTL[key] ?? 30 * 60 * 1000
        persistentCache.set(key, val, ttl).catch(() => {})
      }
    }
  } catch {}
}

// ── Prime the hydration cache ─────────────────────────────────────────────────
export async function primeHydrationCache() {
  if (_bootstrapPromise) return _bootstrapPromise

  // Phase 4: pre-seed from IndexedDB/localStorage so first render is instant
  await preSeedFromPersistentCache()

  _bootstrapPromise = Promise.all([
    fetchWithTimeout('/api/bootstrap?tier=fast', BOOTSTRAP_TIMEOUT_MS),
    fetchWithTimeout('/api/bootstrap?tier=slow', BOOTSTRAP_TIMEOUT_MS),
  ]).then(([fast, slow]) => {
    const merged = { ...(fast || {}), ...(slow || {}) }
    for (const [key, val] of Object.entries(merged)) {
      hydrationCache.set(key, val)
    }
    // Phase 4: persist fresh results for next visit (background, non-blocking)
    writeToPersistentCache(merged)
    console.debug(`[bootstrap] hydrated ${hydrationCache.size} keys`)
  }).catch(e => {
    console.warn('[bootstrap] hydration failed:', e.message)
  })

  return _bootstrapPromise
}

/**
 * Returns cached data for a given Redis key, or null if not available.
 * @param {string} key  Redis cache key (e.g. 'fec:contributions:v1')
 */
export function getHydratedData(key) {
  const val = hydrationCache.get(key)
  if (val === NEG_SENTINEL || val === null || val === undefined) return null
  return val
}

/**
 * Manually store a value in the hydration cache AND the persistent cache.
 * Called by individual service fetches so subsequent calls reuse the result.
 */
export function setHydratedData(key, value) {
  hydrationCache.set(key, value)
  // Also persist for next session
  if (value != null) {
    const ttl = PERSIST_TTL[key] ?? 30 * 60 * 1000
    persistentCache.set(key, value, ttl).catch(() => {})
  }
}

export { hydrationCache }
export default { primeHydrationCache, getHydratedData, setHydratedData, hydrationCache }
