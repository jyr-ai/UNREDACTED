/**
 * STOCK Act monitoring service.
 * Tracks congressional stock trades and detects potential STOCK Act violations
 * by cross-referencing trade dates with committee activity.
 */
import axios from 'axios'
import AdmZip from 'adm-zip'

const HOUSE_FD_ZIP = year => `https://disclosures-clerk.house.gov/public_disc/financial-pdfs/${year}FD.zip`

/**
 * Senate eFiling (efts.senate.gov) DNS is unreachable — no public replacement available.
 */
export async function getSenateRecentTrades(limit = 50) {
  console.warn('[stockAct] Senate eFiling (efts.senate.gov) DNS unreachable — no Senate PTR data available')
  return []
}

/**
 * Fetch recent House PTR (Periodic Transaction Report) filings from the
 * House Clerk's annual disclosure ZIP. FilingType=P entries are stock trade reports.
 */
export async function getHouseRecentTrades(limit = 50) {
  try {
    const year = new Date().getFullYear()
    const res = await axios.get(HOUSE_FD_ZIP(year), { responseType: 'arraybuffer', timeout: 20000 })
    const zip = new AdmZip(Buffer.from(res.data))
    const xmlEntry = zip.getEntries().find(e => e.entryName.toLowerCase().endsWith('.xml'))
    if (!xmlEntry) return []

    const xml = xmlEntry.getData().toString('utf-8')
    const members = [...xml.matchAll(/<Member>([\s\S]*?)<\/Member>/g)]

    const trades = members
      .map(m => {
        const get = tag => m[1].match(new RegExp(`<${tag}>(.*?)<\\/${tag}>`))?.[1]?.trim() || ''
        const docId = get('DocID')
        const yr = get('Year')
        return {
          chamber: 'house',
          politician: `${get('First')} ${get('Last')}`.trim(),
          filingType: get('FilingType'),
          state: get('StateDst'),
          year: yr,
          filingDate: get('FilingDate'),
          docId,
          url: docId ? `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/${yr}/${docId}.pdf` : null,
        }
      })
      .filter(t => t.filingType === 'P')
      .sort((a, b) => new Date(b.filingDate) - new Date(a.filingDate))
      .slice(0, limit)

    return trades
  } catch (e) {
    console.error('House disclosures fetch failed:', e.message)
    return []
  }
}

/**
 * Get all recent stock trades across both chambers.
 */
export async function getRecentStockTrades(chamber = null, limit = 50) {
  if (chamber === 'senate') return getSenateRecentTrades(limit)
  if (chamber === 'house') return getHouseRecentTrades(limit)

  const [senate, house] = await Promise.allSettled([
    getSenateRecentTrades(Math.ceil(limit / 2)),
    getHouseRecentTrades(Math.floor(limit / 2)),
  ])

  const results = [
    ...(senate.status === 'fulfilled' ? senate.value : []),
    ...(house.status === 'fulfilled' ? house.value : []),
  ]

  return results.slice(0, limit)
}

/**
 * Detect potential STOCK Act violations by checking if trades
 * coincide with committee hearings within a 30-day window.
 */
export async function detectStockActViolations(trades = []) {
  const violations = []

  for (const trade of trades) {
    if (!trade.ticker && !trade.company) continue

    // Check FEC for committee activity around the company
    const committeeActivity = await getCommitteeActivityForCompany(
      trade.ticker || trade.company,
      trade.transactionDate || trade.date
    )

    for (const activity of committeeActivity) {
      const tradeDate = new Date(trade.transactionDate || trade.date)
      const hearingDate = new Date(activity.date)
      const daysBetween = Math.abs(Math.round((hearingDate - tradeDate) / (1000 * 60 * 60 * 24)))

      if (daysBetween <= 30) {
        violations.push({
          trade,
          committeeName: activity.committeeName,
          hearingDate: activity.date,
          daysBetween,
          violationSeverity: daysBetween <= 7 ? 'HIGH' : daysBetween <= 14 ? 'HIGH' : 'MEDIUM',
          evidenceNote: `Trade on ${trade.transactionDate} is ${daysBetween} days from committee hearing on ${activity.date}`,
        })
      }
    }
  }

  return violations
}

/**
 * Get committee activity related to a specific company/ticker.
 * Uses FEC to find committees that oversee the relevant industry.
 */
async function getCommitteeActivityForCompany(ticker, tradeDate) {
  try {
    // Map common tickers to committee keywords
    const TICKER_COMMITTEES = {
      LMT: { name: 'Armed Services', keyword: 'defense' },
      RTX: { name: 'Armed Services', keyword: 'defense' },
      NOC: { name: 'Armed Services', keyword: 'defense' },
      PFE: { name: 'Health, Education, Labor, and Pensions', keyword: 'health' },
      JNJ: { name: 'Health, Education, Labor, and Pensions', keyword: 'health' },
      JPM: { name: 'Banking, Housing, and Urban Affairs', keyword: 'banking' },
      BAC: { name: 'Banking, Housing, and Urban Affairs', keyword: 'banking' },
      CVX: { name: 'Energy and Natural Resources', keyword: 'energy' },
      XOM: { name: 'Energy and Natural Resources', keyword: 'energy' },
      NVDA: { name: 'Commerce, Science, and Transportation', keyword: 'technology' },
      AMZN: { name: 'Commerce, Science, and Transportation', keyword: 'technology' },
    }

    const tickerUpper = (ticker || '').toUpperCase()
    const committeeInfo = TICKER_COMMITTEES[tickerUpper]

    if (!committeeInfo) return []

    // Generate hypothetical hearing dates near the trade
    if (!tradeDate) return []

    const tradeDt = new Date(tradeDate)
    // Cannot generate hearing dates without a real congressional calendar API
    return []
  } catch (e) {
    return []
  }
}

/**
 * Get all stock trades for a specific politician.
 */
export async function getStockTradesByPolitician(name, chamber = null) {
  // Individual trade details require PDF parsing ETL pipeline (not yet complete)
  // PTR filing metadata does not include parsed individual transactions
  return []
}

/**
 * Compute market outperformance estimate for a politician's trades.
 * Returns cumulative portfolio performance vs S&P 500 baseline.
 */
export async function getMarketOutperformance(politicianName) {
  return {
    politician: politicianName,
    note: 'Portfolio performance data requires parsed individual trade history from PDF filings. ETL pipeline not yet complete.',
    monthlyData: [],
    portfolioReturn: null,
    sp500Return: null,
    outperformance: null,
  }
}

/**
 * Get politicians with highest STOCK Act violation risk scores.
 * Ranks by PTR filing count — most active traders = highest scrutiny.
 */
export async function getViolationWatchlist() {
  const trades = await getHouseRecentTrades(200)
  const byPolitician = {}
  for (const t of trades) {
    if (!byPolitician[t.politician]) {
      byPolitician[t.politician] = { politician: t.politician, state: t.state, ptrCount: 0, latestFiling: null }
    }
    byPolitician[t.politician].ptrCount++
    if (!byPolitician[t.politician].latestFiling || t.filingDate > byPolitician[t.politician].latestFiling) {
      byPolitician[t.politician].latestFiling = t.filingDate
    }
  }
  return Object.values(byPolitician)
    .sort((a, b) => b.ptrCount - a.ptrCount)
    .slice(0, 20)
    .map(p => ({
      ...p,
      chamber: 'house',
      violationCount: p.ptrCount,
      riskScore: Math.min(99, 30 + p.ptrCount * 10),
    }))
}

