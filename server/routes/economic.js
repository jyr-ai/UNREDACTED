import express from 'express'

const router = express.Router()

// In-memory cache — BLS data updates monthly, so 6 hours is very safe
let cache = { unemployment: null, inflation: null, ts: 0 }
const CACHE_TTL = 6 * 60 * 60 * 1000 // 6 hours

// Hardcoded fallback — updated when BLS publishes new data.
// This ensures the KPI always renders even when BLS rate limits are hit.
const FALLBACK = {
  unemployment: { rate: 4.3, change: 0.1, period: 'March 2026' },
  inflation:    { rate: 3.3, change: 0.9, period: 'March 2026' },
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

function parseUnemployment(data) {
  // Filter out entries with missing values (BLS returns '-' for not-yet-released months)
  const valid = data.filter(r => r.value !== '-')
  if (valid.length < 13) return null
  const current  = parseFloat(valid[0].value)
  const yearAgo  = parseFloat(valid[12].value)
  return {
    rate:   current,
    change: +(current - yearAgo).toFixed(1),
    period: `${valid[0].periodName} ${valid[0].year}`,
  }
}

function parseInflation(data) {
  // Filter out entries with missing values
  const valid = data.filter(r => r.value !== '-')
  if (valid.length < 13) return null
  const cur  = parseFloat(valid[0].value)
  const prev = parseFloat(valid[12].value)
  const yoy  = +((cur - prev) / prev * 100).toFixed(1)
  const prevChange = valid.length >= 25
    ? +((parseFloat(valid[12].value) - parseFloat(valid[24].value)) / parseFloat(valid[24].value) * 100).toFixed(1)
    : null
  return {
    rate:   yoy,
    change: prevChange != null ? +(yoy - prevChange).toFixed(1) : null,
    period: `${valid[0].periodName} ${valid[0].year}`,
  }
}

async function loadData() {
  const now = Date.now()
  if (cache.ts && now - cache.ts < CACHE_TTL && cache.unemployment && cache.inflation) {
    return cache
  }

  const currentYear = new Date().getFullYear()

  try {
    const [unemploymentData, cpiData] = await Promise.all([
      fetchBLSSeries('LNS14000000', currentYear - 3, currentYear),
      fetchBLSSeries('CUUR0000SA0', currentYear - 3, currentYear),
    ])
    if (unemploymentData) cache.unemployment = parseUnemployment(unemploymentData) || cache.unemployment
    if (cpiData)          cache.inflation    = parseInflation(cpiData)             || cache.inflation
  } catch (e) {
    console.error('BLS fetch failed:', e.message)
  }

  // If BLS is rate-limited or unavailable, use hardcoded fallback
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
