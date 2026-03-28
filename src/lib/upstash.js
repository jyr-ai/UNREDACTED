/**
 * Upstash Redis client — dual-mode:
 *   - Production (Vercel): uses UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *   - Local dev: falls back to a no-op stub so the app runs without Redis
 *
 * Usage:
 *   import redis from '../lib/upstash.js'
 *   await redis.set('key', 'value', { ex: 3600 })
 *   const val = await redis.get('key')
 */

const UPSTASH_URL   = import.meta?.env?.VITE_UPSTASH_URL   || process.env.UPSTASH_REDIS_REST_URL   || ''
const UPSTASH_TOKEN = import.meta?.env?.VITE_UPSTASH_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ''

// ── Production Redis (Upstash REST) ──────────────────────────────────────────
let _redis = null

async function getUpstashClient() {
  if (_redis) return _redis
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null
  try {
    const { Redis } = await import('@upstash/redis')
    _redis = new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN })
    return _redis
  } catch {
    return null
  }
}

// ── No-op stub (used when Redis is not configured) ────────────────────────────
const stub = {
  get:    async () => null,
  set:    async () => 'OK',
  mget:   async (keys) => keys.map(() => null),
  del:    async () => 0,
  keys:   async () => [],
  pipeline: () => ({ exec: async () => [] }),
}

// ── Public interface ──────────────────────────────────────────────────────────
const redis = {
  /** Get a JSON value. Returns null if not found or Redis unavailable. */
  async get(key) {
    const client = await getUpstashClient()
    if (!client) return null
    try {
      const val = await client.get(key)
      return val
    } catch (e) {
      console.warn(`[redis] get(${key}) failed:`, e.message)
      return null
    }
  },

  /** Set a JSON value. Options: { ex: secondsTTL } */
  async set(key, value, opts = {}) {
    const client = await getUpstashClient()
    if (!client) return 'OK'
    try {
      return await client.set(key, value, opts)
    } catch (e) {
      console.warn(`[redis] set(${key}) failed:`, e.message)
      return null
    }
  },

  /** Batch-get multiple keys in a single pipeline call. */
  async mget(...keys) {
    const client = await getUpstashClient()
    if (!client) return keys.map(() => null)
    try {
      return await client.mget(...keys)
    } catch (e) {
      console.warn(`[redis] mget failed:`, e.message)
      return keys.map(() => null)
    }
  },

  /** Delete a key. */
  async del(key) {
    const client = await getUpstashClient()
    if (!client) return 0
    try {
      return await client.del(key)
    } catch (e) {
      console.warn(`[redis] del(${key}) failed:`, e.message)
      return 0
    }
  },

  /** Return all keys matching a pattern. */
  async keys(pattern) {
    const client = await getUpstashClient()
    if (!client) return []
    try {
      return await client.keys(pattern)
    } catch (e) {
      console.warn(`[redis] keys(${pattern}) failed:`, e.message)
      return []
    }
  },

  /** True if Upstash is configured. */
  get isConfigured() {
    return Boolean(UPSTASH_URL && UPSTASH_TOKEN)
  },
}

export default redis
