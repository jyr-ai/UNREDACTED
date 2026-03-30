import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { rateLimit } from 'express-rate-limit'
import { buildOpenApiSpec, renderSwaggerUi } from './openapi.js'
dotenv.config()

import spendingRouter from './routes/spending.js'
import policyRouter from './routes/policy.js'
import donorsRouter from './routes/donors.js'
import agentRouter from './routes/agent.js'
import aiAgentRouter from './routes/ai_agent.js'
import feedRouter from './routes/feed.js'
import settingsRouter from './routes/settings.js'
import corruptionRouter from './routes/corruption.js'
import companiesRouter from './routes/companies.js'
import stockActRouter from './routes/stockact.js'
import darkMoneyRouter from './routes/darkmoney.js'
import conflictRouter from './routes/conflict.js'
// Campaign Watch — lives in backend/ (shared between dev and prod)
import campaignWatchRouter from '../backend/routes/campaignWatch.js'
// Gas price routes — EIA state prices + MyGasFeed station data
import gasPricesRouter  from '../backend/routes/gasPrices.js'
import gasStationsRouter from '../backend/routes/gasStations.js'
// Bootstrap (batch Redis read for map hydration)
import bootstrapRouter from './routes/bootstrap.js'
// Seed health dashboard
import seedHealthRouter from './routes/seed-health.js'
// Cron seed endpoints (triggered by Vercel Cron)
import cronRouter from './routes/cron.js'
// CNN Fear & Greed proxy (avoids browser CORS)
import fearGreedRouter from '../backend/routes/feargreed.js'
// BLS economic indicators (unemployment + CPI) — cached proxy
import economicRouter from '../backend/routes/economic.js'

const app = express()
const isVercelDeployment =
  process.env.VERCEL === '1' ||
  process.env.VERCEL === 'true' ||
  ['preview', 'production'].includes(process.env.VERCEL_ENV || '')
const apiDocsEnabled =
  process.env.ENABLE_API_DOCS === 'true' ||
  (!isVercelDeployment && process.env.ENABLE_API_DOCS !== 'false')

// Disable ETags so API responses are never served as 304 from browser cache
app.set('etag', false)

// CORS — permissive for API (same-origin on Vercel, cross-origin in local dev)
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  /\.vercel\.app$/,
  /^https:\/\/unredacted\./,  // custom domain prefix
]

app.use(cors({
  origin: (origin, cb) => {
    // Same-origin requests (Vercel prod) have no Origin header — always allow
    if (!origin) return cb(null, true)
    const ok = ALLOWED_ORIGINS.some(o =>
      typeof o === 'string' ? o === origin : o.test(origin)
    )
    cb(ok ? null : new Error('CORS'), ok)
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
}))

app.use(express.json({ limit: '10kb' }))

// ── Rate limiters ────────────────────────────────────────────────────────────
const agentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many queries. Please wait a moment before trying again.' },
})

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
})

// ── Request logging ──────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`)
  next()
})

// ── Health check & version ────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }))

app.get('/api/version', async (_req, res) => {
  try {
    const fs = await import('fs')
    const path = await import('path')
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'))
    res.json({ version: `v${pkg.version}`, source: 'package' })
  } catch (e) {
    console.error('version error:', e.message)
    res.json({ version: 'v1.0.0', source: 'fallback' })
  }
})

if (apiDocsEnabled) {
  app.get('/api/docs/openapi.json', (req, res) => {
    res.json(buildOpenApiSpec({
      serverUrl: `${req.protocol}://${req.get('host')}`,
    }))
  })

  app.get('/api/docs', (_req, res) => {
    res.type('html').send(renderSwaggerUi({ openApiUrl: '/api/docs/openapi.json' }))
  })
}

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/spending',    generalLimiter, spendingRouter)
app.use('/api/policy',      generalLimiter, policyRouter)
app.use('/api/donors',      generalLimiter, donorsRouter)
app.use('/api/agent',       agentLimiter,   agentRouter)
app.use('/api/ai-agent',    agentLimiter,   aiAgentRouter)
app.use('/api/feed',        generalLimiter, feedRouter)
app.use('/api/settings',    generalLimiter, settingsRouter)
app.use('/api/corruption',  generalLimiter, corruptionRouter)
app.use('/api/companies',   generalLimiter, companiesRouter)
app.use('/api/stockact',    generalLimiter, stockActRouter)
app.use('/api/darkmoney',   generalLimiter, darkMoneyRouter)
app.use('/api/conflict',       generalLimiter, conflictRouter)
app.use('/api/campaign-watch', generalLimiter, campaignWatchRouter)
// Gas price routes — EIA state prices + MyGasFeed station data
app.use('/api/gas/prices',   generalLimiter, gasPricesRouter)
app.use('/api/gas/stations', generalLimiter, gasStationsRouter)
// Map data pipeline routes (no rate limit — CDN-cached)
app.use('/api/bootstrap',  bootstrapRouter)
app.use('/api/seed-health', generalLimiter, seedHealthRouter)
app.use('/api/cron',        cronRouter)
app.use('/api/fear-greed',  generalLimiter, fearGreedRouter)
app.use('/api/economic',    generalLimiter, economicRouter)

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack)
  res.status(500).json({ success: false, error: 'Internal server error' })
})

export default app
