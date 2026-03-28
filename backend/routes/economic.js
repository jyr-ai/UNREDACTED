import express from 'express'

const router = express.Router()

// In-memory cache — BLS data updates monthly, so 6 hours is very safe
let cache = { unemployment: null, inflation: null, ts: 0 }
const CACHE_TTL = 6 * 60 * 60 * 1000 // 6 hours

// Hardcoded fallback — updated manually when BLS publishes new data.
// This ensures the KPI always renders even when BLS rate limits are hit.
const FALLBACK = {
  unemployment: { rate: 4.2, change: 0.2, period: 'February 2026' },
  inflation:    { rate: 2.8, change: -0.4, period: 'February 2026' },
}

/**
 * Fetch both series in a single POST to BLS v1.
 * POST requests use a separate, more generous rate-limit pool than GET.
 */
async function fetchBLSSeries(seriesIds, startYear, endYear) {
  const resp = await fetch('https://api.bls.gov/publicAPI/v1/timeseries/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      seriesid: seriesIds,
      startyear: String(startYear),
      endyear: String(endYear),
    }),
  })
  if (!resp.ok) return null
  const json = await resp.json()
  if (json.status !== 'REQUEST_SUCCEEDED') return null
  return json?.Results?.series || null
}

function parseUnemployment(series) {
  if (!series || series.length < 13) return null
  const current = parseFloat(series[0].value)
  const yearAgo = parseFloat(series[12].value)
  return {
    rate: current,
    change: +(current - yearAgo).toFixed(1),
    period: `${series[0].periodName} ${series[0].year}`,
  }
}

function parseInflation(series) {
  if (!series || series.length < 13) return null
  const cur = parseFloat(series[0].value)
  const prev = parseFloat(series[12].value)
  const yoy = +((cur - prev) / prev * 100).toFixed(1)
  const prevChange = series.length >= 25
    ? +((prev - parseFloat(series[24].value)) / parseFloat(series[24].value) * 100).toFixed(1)
    : null
  return {
    rate: yoy,
    change: prevChange != null ? +(yoy - prevChange).toFixed(1) : null,
    period: `${series[0].periodName} ${series[0].year}`,
  }
}

async function loadData() {
  const now = Date.now()
  if (cache.ts && now - cache.ts < CACHE_TTL && cache.unemployment && cache.inflation) {
    return cache
  }

  const currentYear = new Date().getFullYear()

  try {
    // Single POST: fetch both unemployment and CPI in one request
    const allSeries = await fetchBLSSeries(
      ['LNS14000000', 'CUUR0000SA0'],
      currentYear - 3,
      currentYear
    )
    if (allSeries) {
      for (const s of allSeries) {
        if (s.seriesID === 'LNS14000000') {
          cache.unemployment = parseUnemployment(s.data) || cache.unemployment
        } else if (s.seriesID === 'CUUR0000SA0') {
          cache.inflation = parseInflation(s.data) || cache.inflation
        }
      }
    }
  } catch (e) {
    console.error('BLS fetch failed:', e.message)
  }

  // If BLS is rate-limited, use hardcoded fallback
  if (!cache.unemployment) cache.unemployment = FALLBACK.unemployment
  if (!cache.inflation) cache.inflation = FALLBACK.inflation

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
      inflation: data.inflation,
    })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

export default router
