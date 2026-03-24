/**
 * GET /api/seed-health
 *
 * Reads all seed-meta:* keys from Upstash Redis and returns a dashboard
 * showing the health of each seed script.
 *
 * Response shape:
 * {
 *   ok: true,
 *   seeds: {
 *     "corruption:index:v1": { lastRunAt, status, count, ageMinutes },
 *     ...
 *   }
 * }
 */

import { Router } from 'express'
import { redisKeys, redisMget } from '../lib/redis.js'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const metaKeys = await redisKeys('seed-meta:*')

    if (!metaKeys.length) {
      return res.json({
        ok: true,
        message: 'No seed metadata found. Run seed scripts or wait for cron to execute.',
        seeds: {},
      })
    }

    const values = await redisMget(metaKeys)
    const seeds = {}
    const now   = Date.now()

    metaKeys.forEach((metaKey, i) => {
      const key  = metaKey.replace('seed-meta:', '')
      const raw  = values[i]
      if (!raw) {
        seeds[key] = { status: 'missing', ageMinutes: null, count: 0 }
        return
      }
      const entry = typeof raw === 'string' ? JSON.parse(raw) : raw
      const ageMs = entry.lastRunAt ? now - new Date(entry.lastRunAt).getTime() : null
      const ageMinutes = ageMs !== null ? Math.round(ageMs / 60000) : null

      let status = entry.status || 'unknown'
      if (status === 'ok' && ageMinutes !== null) {
        if (ageMinutes > 360)      status = 'stale'
        else if (ageMinutes > 120) status = 'aging'
      }

      seeds[key] = {
        lastRunAt:  entry.lastRunAt  || null,
        status,
        count:      entry.count      || 0,
        ageMinutes,
        error:      entry.error      || null,
      }
    })

    res.json({ ok: true, seeds, checkedAt: new Date().toISOString() })
  } catch (e) {
    console.error('[seed-health]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

export default router
