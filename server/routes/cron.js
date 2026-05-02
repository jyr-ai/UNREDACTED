/**
 * Vercel Cron endpoints — each route is triggered by a scheduled cron job.
 *
 * All endpoints verify CRON_SECRET to prevent unauthorized invocation.
 * Set CRON_SECRET in Vercel environment variables (any random string ≥ 32 chars).
 *
 * Routes:
 *   GET  /api/cron/seed-corruption          → runs seedCorruptionIndex()
 *   GET  /api/cron/seed-fec                 → runs seedFecContributions()
 *   GET  /api/cron/seed-news-geo            → runs seedNewsGeo()
 *   GET  /api/cron/seed-gas-prices          → runs seedGasPrices()
 *   GET  /api/cron/seed-elections           → runs seedElectionRaces()
 *   GET  /api/cron/seed-dark-money          → runs seedDarkMoney()
 *   GET  /api/cron/seed-spending            → runs seedSpendingFlows()
 *   GET  /api/cron/seed-stockact            → runs seedStockActTrades()
 *   GET  /api/cron/seed-all                 → runs all seeds sequentially
 *   POST /api/cron/detect-funding-patterns  → spawns ETL pattern detection (Galaxy AI)
 */

import { Router } from 'express'
import { spawn } from 'node:child_process'
import path from 'node:path'
import {
  seedCorruptionIndex,
  seedFecContributions,
  seedNewsGeo,
  seedGasPrices,
  seedElectionRaces,
  seedDarkMoney,
  seedSpendingFlows,
  seedStockActTrades,
  runAllSeeds,
} from '../lib/seeds.js'

const router = Router()

// ── Auth middleware ───────────────────────────────────────────────────────────
function verifyCronSecret(req, res, next) {
  const secret = process.env.CRON_SECRET || ''
  // Vercel Cron sends the secret in Authorization: Bearer <secret>
  const authHeader  = req.headers.authorization || ''
  const querySecret = req.query.secret || ''

  if (!secret) {
    // No secret configured — allow in dev, log warning
    console.warn('[cron] CRON_SECRET not set — skipping auth check (dev mode)')
    return next()
  }

  const provided = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : querySecret

  if (provided !== secret) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }
  next()
}

router.use(verifyCronSecret)

// ── Individual seed routes ────────────────────────────────────────────────────
const routes = [
  { path: '/seed-corruption',   fn: seedCorruptionIndex,  label: 'corruption:index:v1' },
  { path: '/seed-fec',          fn: seedFecContributions, label: 'fec:contributions:v1' },
  { path: '/seed-news-geo',     fn: seedNewsGeo,          label: 'news:geo:v1' },
  { path: '/seed-gas-prices',   fn: seedGasPrices,        label: 'eia:gasprices:v1' },
  { path: '/seed-elections',    fn: seedElectionRaces,    label: 'elections:races:v1' },
  { path: '/seed-dark-money',   fn: seedDarkMoney,        label: 'darkmoney:flows:v1' },
  { path: '/seed-spending',     fn: seedSpendingFlows,    label: 'spending:bystate:v1' },
  { path: '/seed-stockact',     fn: seedStockActTrades,   label: 'stockact:trades:v1' },
]

for (const { path, fn, label } of routes) {
  router.get(path, async (_req, res) => {
    const t0 = Date.now()
    try {
      const result = await fn()
      res.json({
        ok:      true,
        key:     label,
        count:   result.count,
        status:  result.status,
        elapsed: `${Date.now() - t0}ms`,
      })
    } catch (e) {
      console.error(`[cron] ${label} error:`, e.message)
      res.status(500).json({ ok: false, key: label, error: e.message })
    }
  })
}

// ── Run all seeds at once ─────────────────────────────────────────────────────
router.get('/seed-all', async (_req, res) => {
  const t0 = Date.now()
  try {
    const results = await runAllSeeds()
    res.json({ ok: true, results, elapsed: `${Date.now() - t0}ms` })
  } catch (e) {
    console.error('[cron] seed-all error:', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ── Galaxy AI: weekly funding pattern detection ───────────────────────────────
function requireCronAuth(req, res, next) {
  const secret = process.env.CRON_AUTH_SECRET
  if (!secret) return next()                              // auth not configured — skip in dev
  const got = req.header('x-cron-secret') || req.query.secret
  if (got !== secret) return res.status(401).json({ error: 'unauthorized' })
  return next()
}

router.post('/detect-funding-patterns', requireCronAuth, (req, res) => {
  if (process.env.GALAXY_AI_ENABLED !== 'true') {
    return res.status(200).json({ ok: true, skipped: true, reason: 'galaxy_ai_disabled' })
  }
  const cycle = req.query.cycle || process.env.PATTERN_CYCLE || '2024'
  const scriptPath = path.resolve('etl/patterns/detectFundingPatterns.js')
  const child = spawn('node', [scriptPath, '--cycle', cycle], {
    stdio: 'ignore',
    detached: true,
    env: process.env
  })
  child.unref()
  return res.status(202).json({ ok: true, queued: true, cycle, pid: child.pid })
})

export default router
