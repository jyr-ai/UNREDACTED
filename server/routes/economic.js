import express from 'express'
import Parser from 'rss-parser'

const router = express.Router()
const rssParser = new Parser({ timeout: 8000 })

// In-memory cache — BLS data updates monthly, so 6 hours is very safe
let cache = { unemployment: null, inflation: null, ts: 0 }
const CACHE_TTL = 6 * 60 * 60 * 1000 // 6 hours

// Hardcoded fallback — updated when BLS publishes new data.
// This ensures the KPI always renders even when BLS rate limits are hit.
const FALLBACK = {
  unemployment: { rate: 4.3, change: 0.1, period: 'March 2026' },
  inflation:    { rate: 3.8, change: 0.5, period: 'April 2026' },
}

/**
 * Fetch CPI headline rate from the BLS latest-news RSS feed.
 * Returns { rate, change: null, period } or null if unavailable.
 * BLS Akamai may block automated requests — this is attempted first
 * and the BLS data API is used as fallback.
 */
async function fetchCPIFromRSS() {
  try {
    const feed = await rssParser.parseURL('https://www.bls.gov/feed/bls_latest.rss')
    const cpiItem = feed.items.find(item =>
      /consumer price index/i.test(item.title || '')
    )
    if (!cpiItem) return null

    const text = cpiItem.contentSnippet || cpiItem.summary || cpiItem.content || ''
    // BLS news releases say "X.X percent over the last 12 months"
    const yoyMatch = text.match(/(\d+\.?\d*)\s*percent over the last 12[- ]month/i)
    if (!yoyMatch) return null

    const rate = parseFloat(yoyMatch[1])
    const titleMatch = (cpiItem.title || '').match(/([A-Z][a-z]+ \d{4})/)
    const period = titleMatch ? titleMatch[1] : null
    if (!period) return null

    console.log(`[economic] CPI from RSS: ${rate}% (${period})`)
    return { rate, change: null, period }
  } catch (e) {
    console.log('[economic] RSS fetch skipped:', e.message)
    return null
  }
}

/**
 * Fetch a single BLS series via the v2 GET API.
 * The v1 POST endpoint returns 404; v2 GET works without a key.
 */
async function fetchBLSSeries(seriesId, startYear, endYear) {
  const url = `https://api.bls.gov/publicAPI/v2/timeseries/data/${seriesId}?startyear=${startYear}&endyear=${endYear}`
  const resp = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!resp.ok) return null
  const json = await resp.json()
  if (json.status !== 'REQUEST_SUCCEEDED') return null
  return json?.Results?.series?.[0]?.data || null
}

// Find the entry for the same month N years prior — robust against BLS data gaps.
function findYearAgo(data, latest, yearsBack = 1) {
  const targetYear = String(parseInt(latest.year) - yearsBack)
  return data.find(r => r.periodName === latest.periodName && r.year === targetYear) || null
}

function parseUnemployment(data) {
  const valid = data.filter(r => r.value !== '-')
  if (!valid.length) return null
  const latest  = valid[0]
  const yearAgo = findYearAgo(valid, latest)
  if (!yearAgo) return null
  const current = parseFloat(latest.value)
  const prior   = parseFloat(yearAgo.value)
  return {
    rate:   current,
    change: +(current - prior).toFixed(1),
    period: `${latest.periodName} ${latest.year}`,
  }
}

function parseInflation(data) {
  const valid = data.filter(r => r.value !== '-')
  if (!valid.length) return null
  const latest   = valid[0]
  const yearAgo  = findYearAgo(valid, latest, 1)
  const twoYrAgo = findYearAgo(valid, latest, 2)
  if (!yearAgo) return null
  const cur  = parseFloat(latest.value)
  const prev = parseFloat(yearAgo.value)
  const yoy  = +((cur - prev) / prev * 100).toFixed(1)
  let change = null
  if (twoYrAgo) {
    const prevYoy = +((prev - parseFloat(twoYrAgo.value)) / parseFloat(twoYrAgo.value) * 100).toFixed(1)
    change = +(yoy - prevYoy).toFixed(1)
  }
  return {
    rate:   yoy,
    change,
    period: `${latest.periodName} ${latest.year}`,
  }
}

async function loadData() {
  const now = Date.now()
  if (cache.ts && now - cache.ts < CACHE_TTL && cache.unemployment && cache.inflation) {
    return cache
  }

  const currentYear = new Date().getFullYear()

  // Try RSS feed first for CPI headline (real-time news releases)
  const rssInflation = await fetchCPIFromRSS()
  if (rssInflation) cache.inflation = rssInflation

  // BLS API: always needed for unemployment; used for CPI only if RSS failed
  // (RSS gives rate+period but no change; API gives the full computed picture)
  try {
    const [unemploymentData, cpiData] = await Promise.all([
      fetchBLSSeries('LNS14000000', currentYear - 3, currentYear),
      rssInflation ? Promise.resolve(null) : fetchBLSSeries('CUUR0000SA0', currentYear - 3, currentYear),
    ])
    if (unemploymentData) cache.unemployment = parseUnemployment(unemploymentData) || cache.unemployment
    if (cpiData)          cache.inflation    = parseInflation(cpiData)             || cache.inflation
  } catch (e) {
    console.error('BLS API fetch failed:', e.message)
  }

  // If both sources failed, use hardcoded fallback
  if (!cache.unemployment) cache.unemployment = FALLBACK.unemployment
  if (!cache.inflation)    cache.inflation    = FALLBACK.inflation

  cache.ts = now
  return cache
}

// Pre-warm the cache on server start
loadData().catch(() => {})

router.get('/', async (_req, res) => {
  try {
    const data = await loadData()
    res.json({
      unemployment: data.unemployment,
      inflation:    data.inflation,
    })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

export default router
