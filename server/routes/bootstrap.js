/**
 * GET /api/bootstrap?tier=fast|slow
 *
 * Batch-reads all Upstash Redis cache keys for the requested tier in a single
 * pipeline call (one HTTP round-trip), then returns grouped JSON.
 *
 * Vercel CDN will cache the response using the s-maxage header:
 *   fast tier  — s-maxage=600,  stale-while-revalidate=300  (10 min fresh)
 *   slow tier  — s-maxage=3600, stale-while-revalidate=1800 (1 h fresh)
 *
 * Tier definitions
 * ─────────────────
 * FAST (changes frequently):
 *   fec:contributions:v1    — PAC contribution flows
 *   elections:races:v1      — 2026 competitive races
 *   eia:gasprices:v1        — Gas prices by state
 *   news:geo:v1             — Geolocated news headlines
 *   stockact:trades:v1      — Recent STOCK Act trades
 *
 * SLOW (changes infrequently):
 *   corruption:index:v1     — State corruption scores 0-100
 *   spending:bystate:v1     — Federal spending flows
 *   darkmoney:flows:v1      — Dark money network arcs
 */

import { Router } from 'express'
import { redisMget, NEG_SENTINEL } from '../lib/redis.js'

const router = Router()

const FAST_KEYS = [
  'fec:contributions:v1',
  'elections:races:v1',
  'eia:gasprices:v1',
  'news:geo:v1',
  'stockact:trades:v1',
]

const SLOW_KEYS = [
  'corruption:index:v1',
  'spending:bystate:v1',
  'darkmoney:flows:v1',
]

router.get('/', async (req, res) => {
  const tier = req.query.tier === 'slow' ? 'slow' : 'fast'
  const keys = tier === 'slow' ? SLOW_KEYS : FAST_KEYS

  // ── CDN caching headers ──────────────────────────────────────────────────
  const smaxage  = tier === 'slow' ? 3600  : 600
  const swr      = tier === 'slow' ? 1800  : 300
  const cdnTTL   = tier === 'slow' ? 7200  : 1200

  res.set('Cache-Control',     `public, s-maxage=${smaxage}, stale-while-revalidate=${swr}`)
  res.set('CDN-Cache-Control', `public, s-maxage=${cdnTTL},  stale-while-revalidate=${swr * 2}`)
  res.set('Vary', 'Accept-Encoding')

  // ── Batch read from Redis ────────────────────────────────────────────────
  let values
  try {
    values = await redisMget(keys)
  } catch (e) {
    console.error('[bootstrap] Redis mget error:', e.message)
    // Return empty payload — client will fall through to individual API calls
    return res.json({})
  }

  // ── Build response object ────────────────────────────────────────────────
  const out = {}
  keys.forEach((key, i) => {
    const raw = values[i]
    // Omit null / negative sentinel values — client treats missing key as "no data"
    if (raw === null || raw === undefined || raw === NEG_SENTINEL) return
    // Upstash auto-parses JSON; if for some reason it's a string, parse it
    out[key] = typeof raw === 'string' ? safeJsonParse(raw) : raw
  })

  res.json(out)
})

function safeJsonParse(str) {
  try { return JSON.parse(str) }
  catch { return str }
}

export default router
