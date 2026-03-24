/**
 * Server-side Upstash Redis client (Node.js / Vercel serverless).
 * Uses UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN from process.env.
 *
 * Falls back to a no-op stub when env vars are missing (local dev without Redis).
 */
import { Redis } from '@upstash/redis'

const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL   || ''
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || ''

/** Negative sentinel — written when a seed returns empty results */
export const NEG_SENTINEL = '__UNREDACTED_NEG__'

// ── Create client ─────────────────────────────────────────────────────────────
let _client = null
function getClient() {
  if (_client) return _client
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null
  _client = new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN })
  return _client
}

// ── Public helpers ────────────────────────────────────────────────────────────

/** Get one key. Returns null if not found or Redis unavailable. */
export async function redisGet(key) {
  const c = getClient()
  if (!c) return null
  try { return await c.get(key) }
  catch (e) { console.warn('[redis]', key, e.message); return null }
}

/** Set one key with optional TTL (seconds). */
export async function redisSet(key, value, ttlSeconds = 0) {
  const c = getClient()
  if (!c) return
  try {
    if (ttlSeconds > 0) await c.set(key, value, { ex: ttlSeconds })
    else                await c.set(key, value)
  } catch (e) { console.warn('[redis] set', key, e.message) }
}

/**
 * Batch-get many keys in a single pipeline (one HTTP call to Upstash).
 * Returns an array aligned with `keys`, each element is the parsed value or null.
 * @param {string[]} keys
 */
export async function redisMget(keys) {
  if (!keys.length) return []
  const c = getClient()
  if (!c) return keys.map(() => null)
  try {
    return await c.mget(...keys)
  } catch (e) {
    console.warn('[redis] mget failed:', e.message)
    return keys.map(() => null)
  }
}

/** Returns all keys matching a glob pattern. */
export async function redisKeys(pattern) {
  const c = getClient()
  if (!c) return []
  try { return await c.keys(pattern) }
  catch (e) { console.warn('[redis] keys', e.message); return [] }
}

/** True when Upstash is configured. */
export const isRedisConfigured = Boolean(UPSTASH_URL && UPSTASH_TOKEN)

export default { redisGet, redisSet, redisMget, redisKeys, isRedisConfigured, NEG_SENTINEL }
