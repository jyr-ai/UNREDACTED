/**
 * backend/test-eia-api.cjs
 * Quick sanity-check for the EIA v2 API integration.
 *
 * Usage:
 *   node backend/test-eia-api.cjs
 *
 * Requires EIA_API_KEY in backend/.env (or set it inline below for a quick test).
 * Sign up free at: https://www.eia.gov/opendata/register.php
 *
 * Without a key it will use the mock fallback and report that.
 */

'use strict'

require('dotenv').config({ path: require('path').join(__dirname, '.env') })

const https = require('https')
const http  = require('http')

const EIA_BASE  = 'https://api.eia.gov/v2'
const API_KEY   = process.env.EIA_API_KEY

// State abbreviation → EIA v2 duoarea code
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

const DUOAREA_TO_STATE = Object.fromEntries(
  Object.entries(STATE_DUOAREA).map(([abbr, code]) => [code, abbr])
)

const PADD_CODES = ['R1X', 'R1Y', 'R1Z', 'R20', 'R30', 'R40', 'R50']

const STATE_TO_PADD = {
  CT: 'R1X', MA: 'R1X', ME: 'R1X', NH: 'R1X', RI: 'R1X', VT: 'R1X',
  DE: 'R1Y', MD: 'R1Y', NJ: 'R1Y', NY: 'R1Y', PA: 'R1Y',
  FL: 'R1Z', GA: 'R1Z', NC: 'R1Z', SC: 'R1Z', VA: 'R1Z', WV: 'R1Z',
  IL: 'R20', IN: 'R20', IA: 'R20', KS: 'R20', KY: 'R20', MI: 'R20',
  MN: 'R20', MO: 'R20', NE: 'R20', ND: 'R20', OH: 'R20', OK: 'R20',
  SD: 'R20', TN: 'R20', WI: 'R20',
  AL: 'R30', AR: 'R30', LA: 'R30', MS: 'R30', NM: 'R30', TX: 'R30',
  CO: 'R40', ID: 'R40', MT: 'R40', UT: 'R40', WY: 'R40',
  AZ: 'R50', CA: 'R50', HI: 'R50', NV: 'R50', OR: 'R50', WA: 'R50',
  AK: 'NUS',
}

function get(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    lib.get(url, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }) }
        catch (e) { reject(new Error(`JSON parse error: ${e.message}\nBody: ${body.slice(0, 200)}`)) }
      })
    }).on('error', reject)
  })
}

async function testStatePrices() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  TEST: EIA v2 State Gas Prices')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  if (!API_KEY || API_KEY === 'your_eia_api_key_here') {
    console.warn('⚠  No EIA_API_KEY in backend/.env — skipping live API test')
    console.log('   Add your key at: https://www.eia.gov/opendata/register.php')
    return null
  }

  const params = new URLSearchParams()
  params.append('api_key', API_KEY)
  params.append('frequency', 'weekly')
  params.append('data[]', 'value')
  params.append('facets[product][]', 'EPM0')
  params.append('facets[process][]', 'PTE')

  for (const code of Object.values(STATE_DUOAREA)) {
    params.append('facets[duoarea][]', code)
  }
  for (const code of PADD_CODES) {
    params.append('facets[duoarea][]', code)
  }
  params.append('facets[duoarea][]', 'NUS')

  params.append('sort[0][column]', 'period')
  params.append('sort[0][direction]', 'desc')
  params.append('length', '500')

  const url = `${EIA_BASE}/petroleum/pri/gnd/data/?${params.toString()}`
  console.log(`\n📡 GET ${EIA_BASE}/petroleum/pri/gnd/data/`)
  console.log(`   facets: product=EPM0, process=PTE, duoarea=[50 states + 7 PADD districts + NUS]`)
  console.log(`   sort: period desc, length: 500\n`)

  const { status, data } = await get(url)
  console.log(`   HTTP Status: ${status}`)

  if (status !== 200) {
    console.error('❌ Non-200 response:', JSON.stringify(data, null, 2))
    return null
  }

  const rows = data?.response?.data || []
  console.log(`   Total rows returned: ${rows.length}`)

  if (rows.length === 0) {
    console.error('❌ Empty rows — check facet codes or API key permissions')
    return null
  }

  // Collect latest price per area code
  const areaPrice = {}
  let latestPeriod = null
  for (const row of rows) {
    if (row.value != null && !areaPrice[row.duoarea]) {
      areaPrice[row.duoarea] = parseFloat(row.value)
      if (!latestPeriod || row.period > latestPeriod) latestPeriod = row.period
    }
  }

  const nationalAvg = areaPrice['NUS']
  console.log(`   PADD districts found: ${PADD_CODES.filter(c => areaPrice[c]).join(', ') || 'none'}`)
  console.log(`   National avg (NUS): ${nationalAvg ? `$${nationalAvg.toFixed(3)}` : 'not found'}`)

  // Assign price per state using 3-tier strategy
  const prices = {}
  let liveState = 0, liveDistrict = 0, usedMock = 0

  for (const abbr of Object.keys(STATE_DUOAREA)) {
    const sc = STATE_DUOAREA[abbr]
    const pc = STATE_TO_PADD[abbr]
    if (areaPrice[sc] != null)        { prices[abbr] = areaPrice[sc];  liveState++ }
    else if (pc && areaPrice[pc])     { prices[abbr] = areaPrice[pc];  liveDistrict++ }
    else if (nationalAvg)             { prices[abbr] = nationalAvg;    liveDistrict++ }
    else                              { prices[abbr] = 3.50;           usedMock++ }
  }

  const stateCount = Object.keys(prices).length
  console.log(`\n   States with prices: ${stateCount} / 50`)
  console.log(`   Most recent period: ${latestPeriod || 'unknown'}`)
  console.log(`   Live state:     ${liveState}`)
  console.log(`   PADD district:  ${liveDistrict}`)
  console.log(`   Mock fallback:  ${usedMock}`)

  const sorted = Object.entries(prices).sort((a, b) => a[1] - b[1])
  console.log('\n   💚 Cheapest 5 states:')
  sorted.slice(0, 5).forEach(([s, p]) => console.log(`      ${s}: $${p.toFixed(3)}`))
  console.log('\n   🔴 Most expensive 5 states:')
  sorted.slice(-5).reverse().forEach(([s, p]) => console.log(`      ${s}: $${p.toFixed(3)}`))

  if (usedMock === 0) {
    console.log('\n   ✅ All 50 states covered by EIA live data!')
  } else {
    console.log(`\n   ⚠  ${usedMock} states fell through to mock`)
  }

  return prices
}

async function testNationalAverage() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  TEST: EIA v2 National Average')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  if (!API_KEY || API_KEY === 'your_eia_api_key_here') {
    console.warn('⚠  No EIA_API_KEY — skipping')
    return
  }

  const params = new URLSearchParams()
  params.append('api_key', API_KEY)
  params.append('frequency', 'weekly')
  params.append('data[]', 'value')
  params.append('facets[product][]', 'EPM0')
  params.append('facets[process][]', 'PTE')
  params.append('facets[duoarea][]', 'NUS')
  params.append('sort[0][column]', 'period')
  params.append('sort[0][direction]', 'desc')
  params.append('length', '1')

  const url = `${EIA_BASE}/petroleum/pri/gnd/data/?${params.toString()}`
  console.log(`\n📡 GET ${EIA_BASE}/petroleum/pri/gnd/data/ (NUS national average)\n`)

  const { status, data } = await get(url)
  console.log(`   HTTP Status: ${status}`)

  const row = data?.response?.data?.[0]
  if (row?.value) {
    console.log(`   ✅ US National Average: $${parseFloat(row.value).toFixed(3)}/gal`)
    console.log(`   Period: ${row.period}`)
  } else {
    console.error('❌ No national average row in response:', JSON.stringify(data?.response, null, 2))
  }
}

async function testBackendEndpoint() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  TEST: Backend /api/gas/prices/states')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const { status, data } = await get('http://localhost:3001/api/gas/prices/states')
    console.log(`\n   HTTP Status: ${status}`)

    if (status === 200 && data?.prices) {
      const stateCount = Object.keys(data.prices).length
      console.log(`   ✅ States returned: ${stateCount}`)
      console.log(`   Source: ${data.source}`)
      console.log(`   Updated: ${data.updatedAt}`)
      console.log(`   Cached: ${data._cached || false}`)

      // Spot-check a few states
      const spotCheck = ['CA', 'TX', 'NY', 'FL', 'WA']
      console.log('\n   Spot-check prices:')
      spotCheck.forEach(s => {
        const p = data.prices[s]
        console.log(`      ${s}: ${p != null ? `$${p.toFixed(3)}` : 'MISSING'}`)
      })
    } else {
      console.error('❌ Unexpected response:', JSON.stringify(data, null, 2))
    }
  } catch (err) {
    console.warn(`\n   ⚠  Backend not running on :3001 (${err.message})`)
    console.log('   Start with: cd backend && npm start')
  }
}

;(async () => {
  console.log('\n╔══════════════════════════════════════════════╗')
  console.log('║   EIA API v2 Integration Test                ║')
  console.log('╚══════════════════════════════════════════════╝')
  console.log(`\n  EIA_API_KEY present: ${API_KEY && API_KEY !== 'your_eia_api_key_here' ? '✅ Yes' : '❌ No (mock mode)'}`)

  try {
    await testNationalAverage()
    await testStatePrices()
    await testBackendEndpoint()
  } catch (err) {
    console.error('\n❌ Test error:', err.message)
    process.exit(1)
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Tests complete.')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
})()
