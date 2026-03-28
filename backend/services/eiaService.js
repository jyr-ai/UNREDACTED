// backend/services/eiaService.js
// Fetches weekly retail gasoline prices from the U.S. Energy Information Administration.
// EIA Open Data API v2 documentation: https://www.eia.gov/opendata/documentation.php
// Dataset: Petroleum & Other Liquids — Gasoline and Diesel Retail Prices
// Endpoint: GET https://api.eia.gov/v2/petroleum/pri/gnd/data/
// Converted to ESM for the UNREDACTED backend (type: "module")

import axios from 'axios'

const EIA_BASE = 'https://api.eia.gov/v2'

/**
 * EIA v2 API — Gas price coverage overview
 * ─────────────────────────────────────────
 * EIA tracks weekly retail regular gasoline prices at two levels:
 *   1. Individual states  — 9 states: CA, CO, FL, MA, MN, NY, OH, TX, WA
 *   2. PADD sub-districts — 8 regions covering all 50 states
 *
 * Strategy:
 *   • Fetch both state AND PADD district prices in one query
 *   • Apply individual state price where available
 *   • Apply PADD sub-district price as regional average for remaining states
 *   • Fall back to mock data ONLY for states not covered by either
 *
 * facets:
 *   product  EPM0  = Regular gasoline
 *   process  PTE   = Retail sales including taxes
 *   duoarea  SXX   = State code (e.g. SCA, STX)
 *            RXX   = PADD district code (e.g. R1X, R20)
 *            NUS   = US national average
 */

// ── Individual state duoarea codes (EIA tracks these directly) ───────────────
const STATE_DUOAREA = {
  AL: 'SAL', AK: 'SAK', AZ: 'SAZ', AR: 'SAR', CA: 'SCA', CO: 'SCO',
  CT: 'SCT', DE: 'SDE', FL: 'SFL', GA: 'SGA', HI: 'SHI', ID: 'SID',
  IL: 'SIL', IN: 'SIN', IA: 'SIA', KS: 'SKS', KY: 'SKY', LA: 'SLA',
  ME: 'SME', MD: 'SMD', MA: 'SMA', MI: 'SMI', MN: 'SMN', MS: 'SMS',
  MO: 'SMO', MT: 'SMT', NE: 'SNE', NV: 'SNV', NH: 'SNH', NJ: 'SNJ',
  NM: 'SNM', NY: 'SNY', NC: 'SNC', ND: 'SND', OH: 'SOH', OK: 'SOK',
  OR: 'SOR', PA: 'SPA', RI: 'SRI', SC: 'SSC', SD: 'SSD', TN: 'STN',
  TX: 'STX', UT: 'SUT', VT: 'SVT', VA: 'SVA', WA: 'SWA', WV: 'SWV',
  WI: 'SWI', WY: 'SWY',
}

// Reverse map: EIA duoarea code → state abbreviation
const DUOAREA_TO_STATE = Object.fromEntries(
  Object.entries(STATE_DUOAREA).map(([abbr, code]) => [code, abbr])
)

// ── PADD sub-district duoarea codes ──────────────────────────────────────────
// EIA PADD (Petroleum Administration for Defense Districts)
//   R1X = PADD 1A New England
//   R1Y = PADD 1B Central Atlantic
//   R1Z = PADD 1C Lower Atlantic
//   R20 = PADD 2  Midwest
//   R30 = PADD 3  Gulf Coast
//   R40 = PADD 4  Rocky Mountain
//   R50 = PADD 5  West Coast excl. Alaska
//   PAD5 or R5XCA = Alaska (handled by national fallback)
const PADD_CODES = ['R1X', 'R1Y', 'R1Z', 'R20', 'R30', 'R40', 'R50']

// State → PADD sub-district (used to apply regional price when no state-level data)
const STATE_TO_PADD = {
  // PADD 1A — New England
  CT: 'R1X', MA: 'R1X', ME: 'R1X', NH: 'R1X', RI: 'R1X', VT: 'R1X',
  // PADD 1B — Central Atlantic
  DE: 'R1Y', MD: 'R1Y', NJ: 'R1Y', NY: 'R1Y', PA: 'R1Y',
  // PADD 1C — Lower Atlantic
  FL: 'R1Z', GA: 'R1Z', NC: 'R1Z', SC: 'R1Z', VA: 'R1Z', WV: 'R1Z',
  // PADD 2 — Midwest
  IL: 'R20', IN: 'R20', IA: 'R20', KS: 'R20', KY: 'R20', MI: 'R20',
  MN: 'R20', MO: 'R20', NE: 'R20', ND: 'R20', OH: 'R20', OK: 'R20',
  SD: 'R20', TN: 'R20', WI: 'R20',
  // PADD 3 — Gulf Coast
  AL: 'R30', AR: 'R30', LA: 'R30', MS: 'R30', NM: 'R30', TX: 'R30',
  // PADD 4 — Rocky Mountain
  CO: 'R40', ID: 'R40', MT: 'R40', UT: 'R40', WY: 'R40',
  // PADD 5 — West Coast (AZ, HI are included in PADD 5 reporting)
  AZ: 'R50', CA: 'R50', HI: 'R50', NV: 'R50', OR: 'R50', WA: 'R50',
  // AK uses national average (no PADD 5 sub-district tracked by EIA separately)
  AK: 'NUS',
}

// Realistic fallback mock data — last resort when API is completely unavailable
const MOCK_FALLBACK = {
  AL: 3.05, AK: 3.89, AZ: 3.41, AR: 2.98, CA: 4.72, CO: 3.28, CT: 3.65, DE: 3.22,
  FL: 3.38, GA: 3.01, HI: 4.95, ID: 3.35, IL: 3.59, IN: 3.14, IA: 3.09, KS: 2.97,
  KY: 3.02, LA: 2.95, ME: 3.48, MD: 3.41, MA: 3.62, MI: 3.29, MN: 3.18, MS: 2.93,
  MO: 2.99, MT: 3.44, NE: 3.06, NV: 3.82, NH: 3.51, NJ: 3.45, NM: 3.19, NY: 3.71,
  NC: 3.14, ND: 3.08, OH: 3.22, OK: 2.91, OR: 3.88, PA: 3.52, RI: 3.57, SC: 3.08,
  SD: 3.11, TN: 3.01, TX: 2.89, UT: 3.38, VT: 3.59, VA: 3.25, WA: 4.01, WV: 3.17,
  WI: 3.21, WY: 3.15,
}

/**
 * Fetch the most recent weekly state-level regular gasoline prices from EIA v2.
 *
 * Coverage strategy (3 tiers):
 *   1. Direct state data  — 9 EIA-tracked states get individual live prices
 *   2. PADD district data — 41 remaining states get their regional average
 *   3. Mock fallback      — only if EIA API is completely unreachable
 *
 * @returns {{ prices: Object, updatedAt: string, source: string, sourceUrl: string }}
 */
export async function getStatePrices() {
  const apiKey = process.env.EIA_API_KEY

  if (!apiKey || apiKey === 'your_eia_api_key_here') {
    console.warn('[EIA] No API key — serving mock data')
    return buildMockResponse()
  }

  try {
    const params = new URLSearchParams()
    params.append('api_key', apiKey)
    params.append('frequency', 'weekly')
    params.append('data[]', 'value')

    // Filter: regular gasoline (EPM0) at retail with taxes (PTE)
    params.append('facets[product][]', 'EPM0')
    params.append('facets[process][]', 'PTE')

    // Include individual state codes AND PADD district codes AND national average
    for (const code of Object.values(STATE_DUOAREA)) {
      params.append('facets[duoarea][]', code)
    }
    for (const code of PADD_CODES) {
      params.append('facets[duoarea][]', code)
    }
    params.append('facets[duoarea][]', 'NUS')  // national average for AK fallback

    // Sort newest first; fetch enough rows for multiple weeks per area
    params.append('sort[0][column]', 'period')
    params.append('sort[0][direction]', 'desc')
    params.append('length', '500')

    const { data } = await axios.get(`${EIA_BASE}/petroleum/pri/gnd/data/`, {
      params,
      timeout: 15000,
    })

    const rows = data?.response?.data || []

    if (rows.length === 0) {
      console.warn('[EIA] Empty response — falling back to mock data')
      return buildMockResponse()
    }

    // ── Pass 1: collect the most recent value per duoarea ────────────────────
    const areaPrice  = {}   // duoarea code → latest price
    let latestPeriod = null

    for (const row of rows) {
      if (row.value != null && !areaPrice[row.duoarea]) {
        areaPrice[row.duoarea] = parseFloat(row.value)
        if (!latestPeriod || row.period > latestPeriod) latestPeriod = row.period
      }
    }

    const nationalAvg = areaPrice['NUS'] || null

    // ── Pass 2: assign a price to every state ────────────────────────────────
    const prices       = {}
    let liveState      = 0
    let liveDistrict   = 0
    let usedMock       = 0

    for (const abbr of Object.keys(STATE_DUOAREA)) {
      const stateCode   = STATE_DUOAREA[abbr]
      const paddCode    = STATE_TO_PADD[abbr]

      if (areaPrice[stateCode] != null) {
        // Tier 1 — individual EIA state series
        prices[abbr] = areaPrice[stateCode]
        liveState++
      } else if (paddCode && areaPrice[paddCode] != null) {
        // Tier 2 — PADD district average (much better than mock)
        prices[abbr] = areaPrice[paddCode]
        liveDistrict++
      } else if (nationalAvg != null) {
        // Tier 3 — national average (e.g. AK when PADD 5 not available)
        prices[abbr] = nationalAvg
        liveDistrict++
      } else {
        // Last resort — static mock fallback
        prices[abbr] = MOCK_FALLBACK[abbr]
        usedMock++
      }
    }

    console.info(
      `[EIA] Gas prices loaded — ` +
      `${liveState} state-level live, ` +
      `${liveDistrict} PADD district, ` +
      `${usedMock} mock fallback | period: ${latestPeriod}`
    )

    const sourceDesc = usedMock === 0
      ? `EIA Weekly Retail Gasoline Prices — ${liveState} states + ${liveDistrict} PADD districts`
      : `EIA Retail Gas Prices (${usedMock} states used mock)`

    return {
      prices,
      updatedAt:  latestPeriod || new Date().toISOString().slice(0, 10),
      source:     sourceDesc,
      sourceUrl:  'https://www.eia.gov/petroleum/gasdiesel/',
    }
  } catch (err) {
    console.error('[EIA] API error:', err.message)
    return buildMockResponse()
  }
}

/**
 * Fetch the US national average weekly regular gasoline price from EIA v2.
 * duoarea=NUS, product=EPM0, process=PTE — US weekly regular retail gas price
 *
 * @returns {{ average: number, updatedAt: string, source: string }}
 */
export async function getNationalAverage() {
  const apiKey = process.env.EIA_API_KEY

  if (!apiKey || apiKey === 'your_eia_api_key_here') {
    return buildMockNational()
  }

  try {
    const params = new URLSearchParams()
    params.append('api_key', apiKey)
    params.append('frequency', 'weekly')
    params.append('data[]', 'value')
    params.append('facets[product][]', 'EPM0')
    params.append('facets[process][]', 'PTE')
    params.append('facets[duoarea][]', 'NUS')
    params.append('sort[0][column]', 'period')
    params.append('sort[0][direction]', 'desc')
    params.append('length', '1')

    const { data } = await axios.get(`${EIA_BASE}/petroleum/pri/gnd/data/`, {
      params,
      timeout: 8000,
    })

    const row = data?.response?.data?.[0]

    if (!row?.value) {
      console.warn('[EIA] No national average row returned')
      return buildMockNational()
    }

    return {
      average:    parseFloat(row.value),
      updatedAt:  row.period,
      source:     'EIA Weekly Retail Gasoline Prices',
      sourceUrl:  'https://www.eia.gov/petroleum/gasdiesel/',
    }
  } catch (err) {
    console.error('[EIA] national avg error:', err.message)
    return buildMockNational()
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildMockResponse() {
  return {
    prices:     MOCK_FALLBACK,
    updatedAt:  new Date().toISOString().slice(0, 10),
    source:     'mock — add EIA_API_KEY to backend/.env for live data',
    sourceUrl:  'https://www.eia.gov/opendata/register.php',
  }
}

function buildMockNational() {
  const vals = Object.values(MOCK_FALLBACK)
  return {
    average:    parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3)),
    updatedAt:  new Date().toISOString().slice(0, 10),
    source:     'mock',
  }
}
