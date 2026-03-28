import axios from 'axios'

const BASE = 'https://api.usaspending.gov/api/v2'

// Try to get contracts data with fiscal year fallback
async function tryGetContractsData({ keyword, keywords, agency, limit = 10 }) {
  const currentFiscalYear = getCurrentFiscalYear()

  // Try current fiscal year and previous 2 years
  for (let year = currentFiscalYear; year >= currentFiscalYear - 2; year--) {
    if (year < 2017) break;

    const filters = {
      award_type_codes: ['A', 'B', 'C', 'D'],
      time_period: [{ start_date: `${year}-10-01`, end_date: `${year + 1}-09-30` }],
    }

    // Accept either a keywords array (from agents) or a single keyword string (from routes)
    const kwArray = keywords?.length ? keywords : keyword ? [keyword] : null
    if (kwArray) filters.keywords = kwArray
    if (agency) filters.agencies = [{ type: 'awarding', tier: 'toptier', name: agency }]

    try {
      const res = await axios.post(`${BASE}/search/spending_by_award/`, {
        filters,
        fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Awarding Agency', 'Award Date', 'Description'],
        limit,
        sort: 'Award Amount',
        order: 'desc',
      })

      if (res.data.results && res.data.results.length > 0) {
        console.log(`Found ${res.data.results.length} contracts for FY${year}`)
        // Add fiscal year to each result
        const resultsWithYear = res.data.results.map(result => ({
          ...result,
          fiscalYear: year
        }))
        return { results: resultsWithYear, fiscalYear: year }
      }
    } catch (e) {
      console.error(`Error fetching FY${year} contracts:`, e.message)
      // Continue to next year
    }
  }

  console.log(`No contract data found for FY${currentFiscalYear} or previous 2 years`)
  return { results: [], fiscalYear: currentFiscalYear }
}

export async function searchContracts({ keyword, keywords, agency, limit = 10 }) {
  const { results } = await tryGetContractsData({ keyword, keywords, agency, limit })
  return results
}

// Get current fiscal year (Oct 1 - Sept 30)
function getCurrentFiscalYear() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-11
  // Fiscal year runs Oct 1 - Sept 30
  // If we're before October, we're in the previous fiscal year
  return month < 9 ? year - 1 : year
}

// State capital coordinates (lon, lat) for arc targets
const STATE_CAPITALS = {
  AL:[-86.27,32.38], AK:[-134.42,58.30], AZ:[-112.07,33.45], AR:[-92.29,34.75],
  CA:[-121.47,38.56], CO:[-104.98,39.74], CT:[-72.68,41.76], DE:[-75.52,39.16],
  FL:[-84.28,30.44], GA:[-83.64,33.76], HI:[-157.86,21.31], ID:[-116.24,43.62],
  IL:[-89.65,39.78], IN:[-86.15,39.77], IA:[-93.62,41.59], KS:[-95.69,39.05],
  KY:[-84.87,38.19], LA:[-91.19,30.46], ME:[-69.77,44.31], MD:[-76.49,38.97],
  MA:[-71.06,42.36], MI:[-84.55,42.73], MN:[-93.09,44.95], MS:[-90.18,32.30],
  MO:[-92.17,38.58], MT:[-112.03,46.60], NE:[-96.70,40.81], NV:[-119.77,39.16],
  NH:[-71.54,43.21], NJ:[-74.76,40.22], NM:[-105.94,35.68], NY:[-73.76,42.65],
  NC:[-78.64,35.78], ND:[-100.78,46.81], OH:[-82.99,39.96], OK:[-97.53,35.47],
  OR:[-123.03,44.94], PA:[-76.88,40.27], RI:[-71.41,41.82], SC:[-81.03,34.00],
  SD:[-100.35,44.37], TN:[-86.78,36.17], TX:[-97.74,30.27], UT:[-111.89,40.76],
  VT:[-72.58,44.26], VA:[-77.46,37.54], WA:[-122.91,47.04], WV:[-81.63,38.35],
  WI:[-89.38,43.07], WY:[-104.82,41.14],
}

// DC (source for all federal spending arcs)
const DC_LON = -77.04, DC_LAT = 38.91

// Try to get per-state spending data using the geography endpoint
async function tryGetStateSpendingData(targetYear, maxFallbackYears = 3) {
  for (let year = targetYear; year >= targetYear - maxFallbackYears; year--) {
    if (year < 2017) break

    const startDate = `${year}-10-01`
    const endDate = `${year + 1}-09-30`

    try {
      // Use spending_by_geography for per-state data (contracts only — cannot mix with grants)
      const res = await axios.post(`${BASE}/search/spending_by_geography/`, {
        scope: 'place_of_performance',
        geo_layer: 'state',
        filters: {
          award_type_codes: ['A', 'B', 'C', 'D'],
          time_period: [{ start_date: startDate, end_date: endDate }],
        },
        subawards: false,
      })

      if (res.data.results && res.data.results.length > 0) {
        console.log(`Found state spending data for FY${year} (${res.data.results.length} states)`)

        // Transform into flow arcs: DC → each state capital
        const flows = res.data.results
          .filter(r => r.shape_code && STATE_CAPITALS[r.shape_code] && r.aggregated_amount > 0)
          .map(r => ({
            fromLon: DC_LON,
            fromLat: DC_LAT,
            toLon: STATE_CAPITALS[r.shape_code][0],
            toLat: STATE_CAPITALS[r.shape_code][1],
            amount: r.aggregated_amount,
            state: r.shape_code,
            label: `Federal Spending → ${r.display_name}`,
            perCapita: r.per_capita,
            fiscalYear: year,
          }))
          .sort((a, b) => b.amount - a.amount)

        return { flows, fiscalYear: year }
      }
    } catch (e) {
      console.error(`Error fetching FY${year} state spending:`, e.message)
    }
  }

  console.log(`No state spending data found for FY${targetYear} or previous ${maxFallbackYears} years`)
  return { flows: [], fiscalYear: targetYear }
}

export async function getAgencySpending(fiscalYear) {
  const targetYear = fiscalYear || getCurrentFiscalYear()
  const { flows } = await tryGetStateSpendingData(targetYear)
  return flows
}

export async function searchGrants({ keyword, keywords, limit = 10 }) {
  const filters = {
    award_type_codes: ['02', '03', '04', '05'],
  }
  const kwArray = keywords?.length ? keywords : keyword ? [keyword] : null
  if (kwArray) filters.keywords = kwArray

  const res = await axios.post(`${BASE}/search/spending_by_award/`, {
    filters,
    fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Awarding Agency', 'Award Date', 'Description'],
    limit,
    sort: 'Award Amount',
    order: 'desc',
  })
  return res.data.results
}
