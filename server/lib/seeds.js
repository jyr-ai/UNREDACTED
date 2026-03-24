/**
 * Seed functions — each function fetches fresh data from an external API,
 * transforms it into map-ready format, and writes it to Upstash Redis.
 *
 * Called by:
 *   - server/routes/cron.js  (via Vercel Cron HTTP trigger)
 *   - scripts/seed-*.mjs     (manual one-off runs)
 */

import { redisSet, NEG_SENTINEL } from './redis.js'
import { getCorruptionIndex, getMoneyFlows } from '../../backend/services/campaignWatch.js'
import { getStatePrices }                     from '../../backend/services/eiaService.js'
import { getDarkMoneyFlowData }               from '../../backend/services/darkMoney.js'
import { getAgencySpending }                  from '../../backend/services/usaSpending.js'
import { getRecentStockTrades }               from '../../backend/services/stockAct.js'
import { getAllFeeds }                         from '../../backend/services/rssFeed.js'
import { searchCandidates }                   from '../../backend/services/fec.js'
import { STATE_CENTROIDS, DC_CENTROID }        from '../../src/data/stateCentroids.js'

const SEED_META_TTL = 7 * 24 * 60 * 60 // 7 days — meta keys persist for audit trail

// ── Helper: write data + metadata ────────────────────────────────────────────
async function writeSeed(key, data, ttlSeconds) {
  const hasData = data !== null && data !== undefined &&
    (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0)

  const value = hasData ? data : NEG_SENTINEL
  await redisSet(key, value, ttlSeconds)

  const meta = {
    lastRunAt: new Date().toISOString(),
    status: hasData ? 'ok' : 'empty',
    count: Array.isArray(data) ? data.length : (hasData ? Object.keys(data).length : 0),
  }
  await redisSet(`seed-meta:${key}`, meta, SEED_META_TTL)

  return meta
}

// ── Centroid helper ───────────────────────────────────────────────────────────
function centroid(code) {
  return STATE_CENTROIDS[code?.toUpperCase()] ?? null
}

// ═══════════════════════════════════════════════════════════════════════════
// SEED 1 — Corruption Index   key: corruption:index:v1   TTL: 2h
//
// NOTE: getCorruptionIndex() → getStateSummaries() makes 150+ FEC API calls
// (51 states × 3 candidates) which takes 2-5 minutes and always times out
// in a seed context. Instead, we build scores from the lightweight parallel
// sources: dark money orgs + STOCK Act violations only. FEC fundraising
// data is skipped here (it's already available via the fec seed separately).
// ═══════════════════════════════════════════════════════════════════════════
export async function seedCorruptionIndex() {
  try {
    // Import lightweight services directly (no 51-state FEC loop)
    const { getDarkMoneyOrgs }       = await import('../../backend/services/darkMoney.js')
    const { getViolationWatchlist }  = await import('../../backend/services/stockAct.js')

    const STATE_CODES = [
      'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
      'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
      'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
      'VA','WA','WV','WI','WY','DC',
    ]

    // Start all at base score 55
    const scores = {}
    for (const code of STATE_CODES) scores[code] = 55

    // Dark money — subtract up to 15 points
    const darkMoneyOrgs = await getDarkMoneyOrgs(50).catch(() => [])
    for (const org of darkMoneyOrgs) {
      const code = org.state?.toUpperCase()
      if (code && scores[code] !== undefined) {
        const spend = org.totalSpend || 0
        if (spend > 5_000_000)      scores[code] = Math.max(5,  scores[code] - 15)
        else if (spend > 1_000_000) scores[code] = Math.max(5,  scores[code] - 10)
        else if (spend > 100_000)   scores[code] = Math.max(5,  scores[code] - 5)
      }
    }

    // STOCK Act violations — subtract 3 pts per violation (max 15)
    const violations = await getViolationWatchlist().catch(() => [])
    for (const v of violations) {
      const code = v.state?.toUpperCase()
      if (code && scores[code] !== undefined) {
        const penalty = Math.min((v.filingCount || 1) * 3, 15)
        scores[code] = Math.max(5, scores[code] - penalty)
      }
    }

    return await writeSeed('corruption:index:v1', scores, 2 * 60 * 60)
  } catch (e) {
    await writeSeedError('corruption:index:v1', e)
    throw e
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SEED 2 — FEC Contribution Flows   key: fec:contributions:v1   TTL: 1h
// ═══════════════════════════════════════════════════════════════════════════
export async function seedFecContributions() {
  try {
    const raw = await getMoneyFlows(50) // top 50 money flows between states
    // getMoneyFlows() returns [{ from_state, to_state, amount, committee_name }]
    const arcs = (raw || []).flatMap(flow => {
      const from = centroid(flow.from_state || flow.fromState)
      // Contributions flow TO the recipient state (or DC for federal PACs)
      const toCode = flow.to_state || flow.toState || 'DC'
      const to = centroid(toCode) ?? DC_CENTROID

      if (!from) return []
      return [{
        fromLat: from.lat, fromLon: from.lon,
        toLat:   to.lat,   toLon:   to.lon,
        amount:  flow.amount || flow.totalAmount || 0,
        label:   flow.committee_name || flow.committeeName || '',
        fromState: flow.from_state || flow.fromState || '',
        toState:   toCode,
      }]
    })
    return await writeSeed('fec:contributions:v1', arcs, 60 * 60)
  } catch (e) {
    await writeSeedError('fec:contributions:v1', e)
    throw e
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SEED 3 — News Geo Locations   key: news:geo:v1   TTL: 30min
// ═══════════════════════════════════════════════════════════════════════════
export async function seedNewsGeo() {
  try {
    const feeds = await getAllFeeds({ limit: 50 })
    const items = Array.isArray(feeds) ? feeds : (feeds?.items || [])

    // Many news items have a `location` or `state` field from rssFeed.js's scoring
    // We map them to lat/lon using state centroids + a few major city coordinates
    const CITY_COORDS = {
      'washington':    { lat: 38.895, lon: -77.037 },
      'new york':      { lat: 40.713, lon: -74.006 },
      'los angeles':   { lat: 34.052, lon: -118.244 },
      'chicago':       { lat: 41.878, lon: -87.630 },
      'houston':       { lat: 29.760, lon: -95.370 },
      'miami':         { lat: 25.775, lon: -80.208 },
      'dallas':        { lat: 32.783, lon: -96.807 },
      'san francisco': { lat: 37.775, lon: -122.419 },
      'seattle':       { lat: 47.606, lon: -122.332 },
      'boston':        { lat: 42.360, lon: -71.059 },
      'atlanta':       { lat: 33.749, lon: -84.388 },
      'denver':        { lat: 39.739, lon: -104.984 },
      'phoenix':       { lat: 33.448, lon: -112.074 },
    }

    const geoItems = []
    for (const item of items) {
      // Try to extract location from item metadata
      const text = `${item.title || ''} ${item.description || ''}`.toLowerCase()
      let lat = null, lon = null

      // Check for city mentions first
      for (const [city, coords] of Object.entries(CITY_COORDS)) {
        if (text.includes(city)) {
          lat = coords.lat + (Math.random() - 0.5) * 0.3 // slight jitter
          lon = coords.lon + (Math.random() - 0.5) * 0.3
          break
        }
      }

      // Fall back to state mention
      if (!lat) {
        for (const [code, c] of Object.entries(STATE_CENTROIDS)) {
          if (text.includes(c.name.toLowerCase())) {
            lat = c.lat + (Math.random() - 0.5) * 1.5
            lon = c.lon + (Math.random() - 0.5) * 2.0
            break
          }
        }
      }

      if (!lat) continue // skip items with no detectable location

      geoItems.push({
        lat,
        lon,
        title:     item.title     || '',
        source:    item.source    || item.feed || '',
        url:       item.url       || item.link || '',
        timestamp: item.pubDate   || item.date || new Date().toISOString(),
        risk:      item.riskScore || 0,
      })
    }

    return await writeSeed('news:geo:v1', geoItems, 30 * 60)
  } catch (e) {
    await writeSeedError('news:geo:v1', e)
    throw e
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SEED 4 — EIA Gas Prices   key: eia:gasprices:v1   TTL: 30min
// ═══════════════════════════════════════════════════════════════════════════
export async function seedGasPrices() {
  try {
    const result = await getStatePrices()
    // getStatePrices() returns { prices: { CA: 4.72, TX: 2.89, ... }, updatedAt, source }
    const prices = result?.prices || result || {}
    return await writeSeed('eia:gasprices:v1', prices, 30 * 60)
  } catch (e) {
    await writeSeedError('eia:gasprices:v1', e)
    throw e
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SEED 5 — Election Races   key: elections:races:v1   TTL: 2h
// ═══════════════════════════════════════════════════════════════════════════
export async function seedElectionRaces() {
  try {
    // Search for 2026 Senate + House candidates with significant fundraising
    const [senators, representatives] = await Promise.allSettled([
      searchCandidates({ office: 'S', electionYear: 2026, limit: 20 }),
      searchCandidates({ office: 'H', electionYear: 2026, limit: 30 }),
    ])

    const allCandidates = [
      ...(senators.status  === 'fulfilled' ? senators.value  : []),
      ...(representatives.status === 'fulfilled' ? representatives.value : []),
    ]

    const races = allCandidates.flatMap(c => {
      const center = centroid(c.state)
      if (!center) return []
      return [{
        lat: center.lat + (Math.random() - 0.5) * 0.8,
        lon: center.lon + (Math.random() - 0.5) * 0.8,
        state:       c.state || '',
        candidate:   c.name  || '',
        office:      c.office_full || c.office || '',
        party:       c.party_full  || c.party  || '',
        candidateId: c.candidate_id || '',
      }]
    })

    return await writeSeed('elections:races:v1', races, 2 * 60 * 60)
  } catch (e) {
    await writeSeedError('elections:races:v1', e)
    throw e
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SEED 6 — Dark Money Flows   key: darkmoney:flows:v1   TTL: 6h
// ═══════════════════════════════════════════════════════════════════════════
export async function seedDarkMoney() {
  try {
    const data = await getDarkMoneyFlowData()
    // getDarkMoneyFlowData() returns { nodes, links, cycle }
    // Flatten links into ArcLayer-ready format using state centroids
    const arcs = (data?.nodes || []).map(node => {
      // Map orgs to approximate state locations based on their name
      // (no explicit state data in dark money flow, so use jittered DC)
      const angle = Math.random() * 2 * Math.PI
      const radius = 3 + Math.random() * 8
      return {
        fromLat: DC_CENTROID.lat + radius * Math.cos(angle),
        fromLon: DC_CENTROID.lon + radius * Math.sin(angle),
        toLat:   DC_CENTROID.lat,
        toLon:   DC_CENTROID.lon,
        amount:  node.amount || 0,
        label:   node.name   || '',
        type:    node.type   || 'unknown',
      }
    }).filter(a => a.amount > 0)

    return await writeSeed('darkmoney:flows:v1', arcs, 6 * 60 * 60)
  } catch (e) {
    await writeSeedError('darkmoney:flows:v1', e)
    throw e
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SEED 7 — Federal Spending Flows   key: spending:bystate:v1   TTL: 6h
// ═══════════════════════════════════════════════════════════════════════════
export async function seedSpendingFlows() {
  try {
    const agencies = await getAgencySpending()
    // agencies = [{ agency, totalAmount, count, fiscalYear }]
    // We build arcs: each state → DC with the spending amount flowing to that state

    // Distribute spending across states proportionally using GDP weight as proxy
    const STATE_WEIGHT = {
      CA: 15.0, TX: 9.0, NY: 8.5, FL: 5.5, PA: 4.0, IL: 4.0, OH: 3.5, GA: 3.5,
      WA: 3.0, NC: 3.0, MA: 2.8, VA: 2.8, MI: 2.7, NJ: 2.7, AZ: 2.3, CO: 2.3,
      TN: 2.0, MN: 2.0, IN: 1.8, MO: 1.8, WI: 1.7, MD: 1.7, CT: 1.6, OR: 1.6,
      SC: 1.4, LA: 1.3, AL: 1.2, KY: 1.2, OK: 1.1, UT: 1.1, IA: 1.0, AR: 0.9,
      NV: 0.9, MS: 0.8, KS: 0.8, NM: 0.7, NE: 0.7, ID: 0.6, WV: 0.6, HI: 0.5,
      NH: 0.5, ME: 0.4, RI: 0.4, MT: 0.4, DE: 0.3, SD: 0.3, ND: 0.3, AK: 0.3,
      VT: 0.2, WY: 0.2, DC: 0.5,
    }

    const totalAgencySpend = agencies.reduce((s, a) => s + (a.totalAmount || 0), 0)
    const totalWeight = Object.values(STATE_WEIGHT).reduce((s, w) => s + w, 0)

    const arcs = Object.entries(STATE_WEIGHT).map(([code, weight]) => {
      const center = centroid(code)
      if (!center) return null
      return {
        fromLat: DC_CENTROID.lat,
        fromLon: DC_CENTROID.lon,
        toLat:   center.lat,
        toLon:   center.lon,
        amount:  Math.round(totalAgencySpend * (weight / totalWeight)),
        label:   `Federal spending → ${center.name}`,
        state:   code,
      }
    }).filter(Boolean)

    return await writeSeed('spending:bystate:v1', arcs, 6 * 60 * 60)
  } catch (e) {
    await writeSeedError('spending:bystate:v1', e)
    throw e
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SEED 8 — STOCK Act Trades   key: stockact:trades:v1   TTL: 1h
// ═══════════════════════════════════════════════════════════════════════════
export async function seedStockActTrades() {
  try {
    const trades = await getRecentStockTrades(null, 100) // all chambers, up to 100
    const points = (trades || []).flatMap(t => {
      // Map politician to their state's centroid
      const state = t.state || t.district?.slice(0, 2) || ''
      const center = centroid(state)
      if (!center) return []
      return [{
        lat:       center.lat + (Math.random() - 0.5) * 1.2,
        lon:       center.lon + (Math.random() - 0.5) * 1.5,
        politician: t.politician || t.name || '',
        ticker:    t.ticker || '',
        amount:    t.amount || 0,
        action:    t.type   || t.transactionType || 'unknown',
        date:      t.transactionDate || t.date || '',
        state,
        chamber:   t.chamber || '',
      }]
    })
    return await writeSeed('stockact:trades:v1', points, 60 * 60)
  } catch (e) {
    await writeSeedError('stockact:trades:v1', e)
    throw e
  }
}

// ── Error metadata writer ─────────────────────────────────────────────────────
async function writeSeedError(key, err) {
  const meta = {
    lastRunAt: new Date().toISOString(),
    status: 'error',
    count: 0,
    error: err?.message || String(err),
  }
  await redisSet(`seed-meta:${key}`, meta, SEED_META_TTL)
}

// ── Timeout helper ────────────────────────────────────────────────────────────
/**
 * Run `fn()` with a hard timeout. If the promise doesn't resolve within
 * `ms` milliseconds, rejects with a timeout error so other seeds aren't blocked.
 */
function withTimeout(fn, ms = 25_000, label = '') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Seed "${label}" timed out after ${ms / 1000}s`))
    }, ms)
    fn()
      .then(result => { clearTimeout(timer); resolve(result) })
      .catch(err   => { clearTimeout(timer); reject(err)    })
  })
}

// ── Run all seeds ─────────────────────────────────────────────────────────────
export async function runAllSeeds() {
  const runners = [
    // [name, fn, timeoutMs]
    // Corruption calls getStateSummaries() → 51-state FEC batch — give it 45s
    ['corruption', seedCorruptionIndex,  45_000],
    ['fec',        seedFecContributions, 20_000],
    ['news',       seedNewsGeo,          15_000],
    ['gas',        seedGasPrices,        10_000],
    ['elections',  seedElectionRaces,    35_000],
    ['darkmoney',  seedDarkMoney,        15_000],
    ['spending',   seedSpendingFlows,    15_000],
    ['stockact',   seedStockActTrades,   15_000],
  ]

  // Run all seeds in parallel — each has its own timeout so one slow seed
  // never blocks the others.
  const settled = await Promise.allSettled(
    runners.map(([name, fn, ms]) =>
      withTimeout(fn, ms, name)
        .then(result => ({ name, ...result }))
        .catch(err   => ({ name, status: 'error', error: err.message }))
    )
  )

  const results = {}
  for (const outcome of settled) {
    const r = outcome.status === 'fulfilled' ? outcome.value : outcome.reason
    const name = r.name || 'unknown'
    results[name] = { status: r.status, count: r.count, error: r.error }
  }
  return results
}
