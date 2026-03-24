/**
 * Map data loader — unified service that feeds DeckGLMap with all dynamic data.
 *
 * Strategy (Worldmonitor bootstrap pattern):
 *   1. Check `hydrationCache` first (pre-loaded by bootstrap on page mount)
 *   2. Fall back to individual API calls if bootstrap missed / timed out
 *   3. Mark each source in DataFreshnessTracker
 *   4. Call the React state setters to push data to the map
 *
 * Usage in CampaignWatch:
 *   import { loadMapData } from '../services/map-data.js'
 *   useEffect(() => { loadMapData(setters) }, [])
 */

import { getHydratedData, setHydratedData } from './bootstrap.js'
import freshness from './data-freshness.js'

// Fetch with timeout + fallback
async function safeFetch(url, timeoutMs = 5000) {
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(url, { signal: ctrl.signal })
    return r.ok ? r.json() : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ── Individual fallback fetches ───────────────────────────────────────────────

async function fetchCorruption() {
  const raw = await safeFetch('/api/campaign-watch/corruption-index')
  if (!raw) return null
  // Normalise to { stateCode: score } whether response is array or object
  if (Array.isArray(raw?.data || raw)) {
    const arr = raw?.data || raw
    const out = {}
    arr.forEach(s => { if (s.stateCode) out[s.stateCode] = s.corruptionIndex ?? 55 })
    return out
  }
  return raw?.data || raw
}

async function fetchGasPrices() {
  const raw = await safeFetch('/api/gas/prices/states')
  return raw?.prices || null
}

async function fetchContributions() {
  const raw = await safeFetch('/api/campaign-watch/money-flows?limit=50')
  if (!raw?.data) return null
  // Server returns raw money-flow objects; convert to ArcLayer format
  return (raw.data || []).map(f => ({
    fromLat: f.fromLat, fromLon: f.fromLon,
    toLat:   f.toLat,   toLon:   f.toLon,
    amount:  f.amount   || 0,
    label:   f.label    || f.committee_name || '',
  }))
}

async function fetchElections() {
  const raw = await safeFetch('/api/campaign-watch/elections')
  return raw?.data || null
}

async function fetchDarkMoney() {
  const raw = await safeFetch('/api/darkmoney/flow-data')
  return raw?.data || null
}

async function fetchSpending() {
  const raw = await safeFetch('/api/spending/agencies')
  return raw?.data || null
}

async function fetchStockAct() {
  const raw = await safeFetch('/api/stockact/recent')
  return raw?.data || null
}

async function fetchNewsGeo() {
  const raw = await safeFetch('/api/feed/all?limit=30')
  if (!Array.isArray(raw?.data)) return null
  return raw.data.filter(item => item.lat && item.lon)
}

// ── Main loader ───────────────────────────────────────────────────────────────

/**
 * Load all map data and call the provided setters.
 *
 * @param {object} setters
 *   setCorruptionScores(obj)   — { stateCode: 0-100 }
 *   setGasPriceByState(obj)    — { stateCode: USD/gal }
 *   setContributions(arr)      — ArcLayer data
 *   setElectionRaces(arr)      — ScatterplotLayer data
 *   setDarkMoneyFlows(arr)     — ArcLayer data
 *   setSpendingFlows(arr)      — ArcLayer data
 *   setStockActTrades(arr)     — ScatterplotLayer data
 *   setNewsLocations(arr)      — ScatterplotLayer + pulse data
 */
export async function loadMapData({
  setCorruptionScores,
  setGasPriceByState,
  setContributions,
  setElectionRaces,
  setDarkMoneyFlows,
  setSpendingFlows,
  setStockActTrades,
  setNewsLocations,
} = {}) {

  const tasks = [
    // [redisKey, fallbackFn, setter, freshnessKey]
    ['corruption:index:v1',   fetchCorruption,   setCorruptionScores, 'corruption'],
    ['eia:gasprices:v1',      fetchGasPrices,    setGasPriceByState,  'gasPrices'],
    ['fec:contributions:v1',  fetchContributions,setContributions,    'contributions'],
    ['elections:races:v1',    fetchElections,    setElectionRaces,    'elections'],
    ['darkmoney:flows:v1',    fetchDarkMoney,    setDarkMoneyFlows,   'darkMoney'],
    ['spending:bystate:v1',   fetchSpending,     setSpendingFlows,    'spending'],
    ['stockact:trades:v1',    fetchStockAct,     setStockActTrades,   'stockAct'],
    ['news:geo:v1',           fetchNewsGeo,      setNewsLocations,    'newsGeo'],
  ]

  // Run all tasks in parallel (no one task blocks the others)
  await Promise.allSettled(tasks.map(async ([key, fallbackFn, setter, fKey]) => {
    if (!setter) return // no setter provided → skip

    try {
      // 1. Try hydration cache first
      let data = getHydratedData(key)

      // 2. Fall back to individual API call
      if (data === null) {
        data = await fallbackFn()
        if (data !== null) {
          setHydratedData(key, data) // store so next call is free
        }
      }

      if (data !== null) {
        setter(data)
        freshness.mark(fKey, Array.isArray(data) ? data.length : Object.keys(data).length)
      } else {
        freshness.markError(fKey, 'No data returned')
      }
    } catch (e) {
      console.warn(`[map-data] ${key} failed:`, e.message)
      freshness.markError(fKey, e)
    }
  }))
}
