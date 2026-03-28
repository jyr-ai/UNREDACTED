/**
 * Campaign Watch service — aggregates political data by state for the 2026 election map
 * Phase 2D: Added caching, all-51-states support, AI narratives, Congress.gov + Google Civic
 */
import * as fec from './fec.js'
import * as darkMoney from './darkMoney.js'
import * as stockAct from './stockAct.js'
import * as usaSpending from './usaSpending.js'
import { quickCompletion } from './aiService.js'

// ─── State reference data ─────────────────────────────────────────────────────
const STATES = {
  AL: { name: 'Alabama', fips: '01' },         AK: { name: 'Alaska', fips: '02' },
  AZ: { name: 'Arizona', fips: '04' },          AR: { name: 'Arkansas', fips: '05' },
  CA: { name: 'California', fips: '06' },       CO: { name: 'Colorado', fips: '08' },
  CT: { name: 'Connecticut', fips: '09' },      DE: { name: 'Delaware', fips: '10' },
  FL: { name: 'Florida', fips: '12' },           GA: { name: 'Georgia', fips: '13' },
  HI: { name: 'Hawaii', fips: '15' },            ID: { name: 'Idaho', fips: '16' },
  IL: { name: 'Illinois', fips: '17' },          IN: { name: 'Indiana', fips: '18' },
  IA: { name: 'Iowa', fips: '19' },              KS: { name: 'Kansas', fips: '20' },
  KY: { name: 'Kentucky', fips: '21' },          LA: { name: 'Louisiana', fips: '22' },
  ME: { name: 'Maine', fips: '23' },             MD: { name: 'Maryland', fips: '24' },
  MA: { name: 'Massachusetts', fips: '25' },    MI: { name: 'Michigan', fips: '26' },
  MN: { name: 'Minnesota', fips: '27' },         MS: { name: 'Mississippi', fips: '28' },
  MO: { name: 'Missouri', fips: '29' },          MT: { name: 'Montana', fips: '30' },
  NE: { name: 'Nebraska', fips: '31' },          NV: { name: 'Nevada', fips: '32' },
  NH: { name: 'New Hampshire', fips: '33' },    NJ: { name: 'New Jersey', fips: '34' },
  NM: { name: 'New Mexico', fips: '35' },        NY: { name: 'New York', fips: '36' },
  NC: { name: 'North Carolina', fips: '37' },   ND: { name: 'North Dakota', fips: '38' },
  OH: { name: 'Ohio', fips: '39' },              OK: { name: 'Oklahoma', fips: '40' },
  OR: { name: 'Oregon', fips: '41' },            PA: { name: 'Pennsylvania', fips: '42' },
  RI: { name: 'Rhode Island', fips: '44' },      SC: { name: 'South Carolina', fips: '45' },
  SD: { name: 'South Dakota', fips: '46' },      TN: { name: 'Tennessee', fips: '47' },
  TX: { name: 'Texas', fips: '48' },             UT: { name: 'Utah', fips: '49' },
  VT: { name: 'Vermont', fips: '50' },           VA: { name: 'Virginia', fips: '51' },
  WA: { name: 'Washington', fips: '53' },        WV: { name: 'West Virginia', fips: '54' },
  WI: { name: 'Wisconsin', fips: '55' },         WY: { name: 'Wyoming', fips: '56' },
  DC: { name: 'District of Columbia', fips: '11' },
}

// ─── In-Memory Cache ──────────────────────────────────────────────────────────
const cache = new Map()

const CACHE_TTL = {
  stateSummaries:  60 * 60 * 1000,      // 1 hour
  stateDetails:    30 * 60 * 1000,      // 30 min
  corruptionIndex: 60 * 60 * 1000,      // 1 hour
  moneyFlows:      60 * 60 * 1000,      // 1 hour
  aiNarrative:      6 * 60 * 60 * 1000, // 6 hours — expensive LLM calls
  corruptionProfile: 30 * 60 * 1000,    // 30 min
}

function getCached(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null }
  return entry.data
}

function setCached(key, data, ttl) {
  if (cache.size >= 500) {
    const firstKey = cache.keys().next().value
    cache.delete(firstKey)
  }
  cache.set(key, { data, expiresAt: Date.now() + ttl })
}

// ─── Batch helpers ────────────────────────────────────────────────────────────
/**
 * Process an array in batches with a concurrency limit.
 * Adds a delay between batches to respect FEC rate limits.
 */
async function processBatch(items, fn, batchSize = 5, delayMs = 300) {
  const results = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.allSettled(batch.map(fn))
    results.push(...batchResults)
    if (i + batchSize < items.length) {
      await new Promise(r => setTimeout(r, delayMs))
    }
  }
  return results
}

// ─── Corruption index calculation ─────────────────────────────────────────────
function calcCorruptionIndex(summary) {
  let score = 55 // Base neutral score — slightly optimistic

  // Dark money: bigger exposure = lower (more corrupt) score
  if (summary.darkMoneyExposure > 5_000_000)  score -= 15
  else if (summary.darkMoneyExposure > 1_000_000) score -= 10
  else if (summary.darkMoneyExposure > 100_000)   score -= 5

  // STOCK Act violations
  score -= Math.min(summary.stockActViolations * 3, 15)

  // Very high fundraising can indicate pay-to-play dynamics
  if (summary.totalRaised > 50_000_000) score -= 8
  else if (summary.totalRaised > 10_000_000) score -= 4

  // Federal contracts relative to state (proxy for influence)
  if (summary.federalContracts > 1_000_000_000) score -= 5

  return Math.max(5, Math.min(100, Math.round(score)))
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get state-level summary for all 50 states + DC.
 * Results cached for 1 hour. First uncached call batches all 51 states.
 */
export async function getStateSummaries() {
  const cacheKey = 'state-summaries'
  const cached = getCached(cacheKey)
  if (cached) return cached

  const stateSummaries = {}
  const stateCodes = Object.keys(STATES)

  // Initialise all states with safe defaults
  for (const stateCode of stateCodes) {
    stateSummaries[stateCode] = {
      stateCode,
      name: STATES[stateCode].name,
      fips: STATES[stateCode].fips,
      candidateCount: 0,
      totalRaised: 0,
      topCandidate: null,
      darkMoneyExposure: 0,
      stockActViolations: 0,
      federalContracts: 0,
      corruptionIndex: 55,
      lastUpdated: new Date().toISOString(),
    }
  }

  try {
    // ── Dark money — fetch once, distribute by state ──────────────────────────
    const darkMoneyOrgs = await darkMoney.getDarkMoneyOrgs(30).catch(() => [])
    for (const org of darkMoneyOrgs) {
      if (org.state && stateSummaries[org.state]) {
        stateSummaries[org.state].darkMoneyExposure += org.totalSpend || 0
      }
    }

    // ── STOCK Act violations — fetch once, distribute by state ────────────────
    const violations = await stockAct.getViolationWatchlist().catch(() => [])
    for (const v of violations) {
      if (v.state && v.state !== '—' && stateSummaries[v.state]) {
        stateSummaries[v.state].stockActViolations += v.filingCount || 0
      }
    }

    // ── FEC candidate data — batch all 51 states ──────────────────────────────
    console.log(`[CampaignWatch] Fetching FEC data for all ${stateCodes.length} states (batched)…`)

    await processBatch(stateCodes, async (stateCode) => {
      try {
        const candidates = await fec.searchCandidates({
          electionYear: 2026,
          state: stateCode,
          limit: 10,
        })

        if (!candidates || candidates.length === 0) return

        stateSummaries[stateCode].candidateCount = candidates.length

        // Get totals for first 3 candidates to find top fundraiser without hammering rate limits
        let topCandidate = null
        let maxRaised = 0

        for (const candidate of candidates.slice(0, 3)) {
          try {
            const totals = await fec.getCandidateRaisedTotals(candidate.candidate_id, 2026)
            const raised = totals?.receipts || 0

            if (raised > maxRaised) {
              maxRaised = raised
              topCandidate = {
                name:       candidate.name,
                party:      candidate.party_full,
                office:     candidate.office_full,
                raised,
                cashOnHand: totals?.cash_on_hand || 0,
              }
            }

            stateSummaries[stateCode].totalRaised += raised
          } catch (err) {
            // Individual candidate errors are non-fatal
            if (!err.isRateLimit) {
              console.error(`[CampaignWatch] Totals error for ${candidate.candidate_id}:`, err.message)
            } else {
              console.warn(`[CampaignWatch] Rate limited while fetching totals for ${stateCode} — skipping remaining candidates`)
              break
            }
          }
        }

        stateSummaries[stateCode].topCandidate = topCandidate
      } catch (err) {
        if (err.isRateLimit) {
          console.warn(`[CampaignWatch] FEC rate limit hit at state ${stateCode} — stopping batch early`)
          throw err  // Let processBatch catch it; remaining states get defaults
        }
        console.error(`[CampaignWatch] Error fetching candidates for ${stateCode}:`, err.message)
      }
    }, 5, 300) // 5 states per batch, 300ms between batches

  } catch (err) {
    console.error('[CampaignWatch] Error in getStateSummaries outer:', err.message)
  }

  // Calculate corruption index for every state using aggregated data
  for (const stateCode of stateCodes) {
    stateSummaries[stateCode].corruptionIndex = calcCorruptionIndex(stateSummaries[stateCode])
  }

  const result = Object.values(stateSummaries)
  setCached(cacheKey, result, CACHE_TTL.stateSummaries)
  return result
}

/**
 * Get detailed data for a specific state.
 */
export async function getStateDetails(stateCode) {
  const code = stateCode.toUpperCase()
  const state = STATES[code]
  if (!state) throw new Error(`Invalid state code: ${stateCode}`)

  const cacheKey = `state-detail:${code}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const result = {
    stateCode: code,
    name:  state.name,
    fips:  state.fips,
    candidates:       [],
    darkMoneyOrgs:    [],
    stockTrades:      [],
    federalContracts: [],
    corruptionScore:  55,
    lastUpdated: new Date().toISOString(),
  }

  try {
    // Candidates
    result.candidates = await fec.searchCandidates({
      electionYear: 2026,
      state: code,
      limit: 20,
    }).catch(() => [])

    // Totals for first 5 candidates
    for (const candidate of result.candidates.slice(0, 5)) {
      try {
        const totals = await fec.getCandidateRaisedTotals(candidate.candidate_id, 2026)
        candidate.totals = totals || {}
        const darkMoneyExposure = await darkMoney.getCandidateDarkMoneyExposure(candidate.candidate_id)
        candidate.darkMoneyExposure = darkMoneyExposure
      } catch (err) {
        console.error(`[CampaignWatch] Details error for ${candidate.candidate_id}:`, err.message)
      }
    }

    // Dark money orgs in this state
    const allDarkMoneyOrgs = await darkMoney.getDarkMoneyOrgs(50).catch(() => [])
    result.darkMoneyOrgs = allDarkMoneyOrgs.filter(org => org.state === code)

    // STOCK Act trades
    const stockTrades = await stockAct.getRecentStockTrades('house', 20).catch(() => [])
    result.stockTrades = stockTrades.filter(t => t.state && t.state.toUpperCase() === code)

    // Federal contracts
    result.federalContracts = await usaSpending.searchContracts({
      keyword: state.name,
      limit: 10,
    }).catch(() => [])

    // Calculate score
    let score = 55
    if (result.darkMoneyOrgs.length > 0)                                          score -= 10
    if (result.stockTrades.length > 5)                                             score -= 5
    if (result.candidates.some(c => (c.darkMoneyExposure?.darkMoneyTotal || 0) > 100_000)) score -= 10

    result.corruptionScore = Math.max(5, Math.min(100, score))
  } catch (err) {
    console.error(`[CampaignWatch] getStateDetails(${code}) error:`, err.message)
  }

  setCached(cacheKey, result, CACHE_TTL.stateDetails)
  return result
}

/**
 * Get a state's full corruption profile — structured for CorruptionDialog.jsx.
 */
export async function getStateCorruptionProfile(stateCode) {
  const code = stateCode.toUpperCase()
  const state = STATES[code]
  if (!state) throw new Error(`Invalid state code: ${stateCode}`)

  const cacheKey = `corruption-profile:${code}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  // Fetch in parallel — every call is independently safe to fail
  const [
    candidatesRes,
    darkMoneyOrgsRes,
    stockTradesRes,
    contractsRes,
  ] = await Promise.allSettled([
    fec.searchCandidates({ electionYear: 2026, state: code, limit: 20 }),
    darkMoney.getDarkMoneyOrgs(50),
    stockAct.getRecentStockTrades('house', 30),
    usaSpending.searchContracts({ keyword: state.name, limit: 10 }),
  ])

  const candidates     = candidatesRes.status     === 'fulfilled' ? candidatesRes.value     : []
  const allDarkOrgs    = darkMoneyOrgsRes.status   === 'fulfilled' ? darkMoneyOrgsRes.value   : []
  const allTrades      = stockTradesRes.status     === 'fulfilled' ? stockTradesRes.value     : []
  const contracts      = contractsRes.status       === 'fulfilled' ? contractsRes.value       : []

  const stateDarkOrgs  = allDarkOrgs.filter(org => org.state === code)
  const stateTrades    = allTrades.filter(t => t.state && t.state.toUpperCase() === code)

  // Aggregate fundraising
  let totalRaised = 0
  let topCandidates = []
  for (const c of candidates.slice(0, 5)) {
    try {
      const totals = await fec.getCandidateRaisedTotals(c.candidate_id, 2026)
      const raised = totals?.receipts || 0
      totalRaised += raised
      topCandidates.push({
        name:       c.name,
        party:      c.party_full,
        office:     c.office_full,
        raised,
        cashOnHand: totals?.cash_on_hand || 0,
      })
    } catch (_) { /* skip */ }
  }
  topCandidates.sort((a, b) => b.raised - a.raised)

  // Dark money totals
  const darkMoneyTotal = stateDarkOrgs.reduce((s, o) => s + (o.totalSpend || 0), 0)
  const topDarkOrg     = stateDarkOrgs[0] || null

  // Federal contracts totals
  const contractTotal = contracts.reduce((s, c) => s + (parseFloat(c['Award Amount'] || c.award_amount) || 0), 0)
  const topContracts  = contracts.slice(0, 3).map(c => ({
    recipient: c['Recipient Name'] || c.recipient_name,
    amount:    parseFloat(c['Award Amount'] || c.award_amount) || 0,
    agency:    c['Awarding Agency'] || c.awarding_agency,
  }))

  // Corruption score
  const summaryForScore = {
    darkMoneyExposure:  darkMoneyTotal,
    stockActViolations: stateTrades.length,
    totalRaised,
    federalContracts:   contractTotal,
  }
  const corruptionIndex = calcCorruptionIndex(summaryForScore)

  const profile = {
    stateCode: code,
    name:      state.name,
    corruptionIndex,
    fundraising: {
      total:         totalRaised,
      candidateCount: candidates.length,
      topCandidates:  topCandidates.slice(0, 3),
    },
    darkMoney: {
      total:   darkMoneyTotal,
      orgCount: stateDarkOrgs.length,
      topOrg:  topDarkOrg ? { name: topDarkOrg.name, amount: topDarkOrg.totalSpend } : null,
    },
    federalContracts: {
      total:        contractTotal,
      contractCount: contracts.length,
      topContracts,
    },
    stockActFlags: {
      count:    stateTrades.length,
      members:  [...new Set(stateTrades.map(t => t.politician).filter(Boolean))].length,
    },
    lastUpdated: new Date().toISOString(),
  }

  setCached(cacheKey, profile, CACHE_TTL.corruptionProfile)
  return profile
}

/**
 * Generate an AI narrative for a state's corruption profile using DeepSeek.
 * Cached for 6 hours to minimise LLM costs.
 */
export async function generateAiNarrative(stateCode) {
  const code = stateCode.toUpperCase()
  const state = STATES[code]
  if (!state) throw new Error(`Invalid state code: ${stateCode}`)

  const cacheKey = `ai-narrative:${code}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  // Get the corruption profile to feed as context
  const profile = await getStateCorruptionProfile(code)

  const fmt = (n) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
    return `$${n}`
  }

  const systemPrompt = `You are UNREDACTED, a political accountability AI that analyzes corruption patterns in US politics using real data.
Be direct, factual, and concise. Use plain English. No markdown. 2-3 sentences maximum.
Focus on the most significant corruption signals: dark money influence, campaign finance patterns, federal contracting relationships, and legislative capture.
If data is limited, note what the available signals suggest.`

  const userPrompt = `Generate a corruption analysis for ${state.name} (${code}) based on this data:
- Corruption Index: ${profile.corruptionIndex}/100 (lower = higher risk)
- Total 2026 fundraising: ${fmt(profile.fundraising.total)} across ${profile.fundraising.candidateCount} candidates
- Top fundraiser: ${profile.fundraising.topCandidates[0]?.name || 'Unknown'} (${fmt(profile.fundraising.topCandidates[0]?.raised || 0)})
- Dark money exposure: ${fmt(profile.darkMoney.total)} from ${profile.darkMoney.orgCount} organizations
- Top dark money org: ${profile.darkMoney.topOrg?.name || 'None identified'} (${fmt(profile.darkMoney.topOrg?.amount || 0)})
- Federal contracts: ${fmt(profile.federalContracts.total)}
- STOCK Act flagged trades: ${profile.stockActFlags.count} trades by ${profile.stockActFlags.members} members

Provide a 2-3 sentence analysis of the most concerning corruption signals for ${state.name}.`

  try {
    const narrative = await quickCompletion(systemPrompt, userPrompt, {
      maxTokens: 200,
      temperature: 0.4,
    })

    const result = {
      stateCode: code,
      analysis: narrative.trim(),
      generatedAt: new Date().toISOString(),
      dataSource: 'FEC + USASpending.gov + DeepSeek AI',
    }

    setCached(cacheKey, result, CACHE_TTL.aiNarrative)
    return result
  } catch (err) {
    console.error(`[CampaignWatch] AI narrative error for ${code}:`, err.message)
    // Return a data-driven fallback instead of crashing
    const fallback = `${state.name} shows ${profile.corruptionIndex < 40 ? 'elevated' : profile.corruptionIndex < 60 ? 'moderate' : 'lower'} corruption risk with ${fmt(profile.darkMoney.total)} in dark money exposure and ${fmt(profile.fundraising.total)} raised in the 2026 cycle. ${profile.stockActFlags.count > 0 ? `${profile.stockActFlags.count} STOCK Act flagged trades detected.` : 'No STOCK Act violations flagged.'}`

    return {
      stateCode: code,
      analysis: fallback,
      generatedAt: new Date().toISOString(),
      dataSource: 'FEC + USASpending.gov (AI unavailable)',
      fallback: true,
    }
  }
}

/**
 * Get money flow data for arc visualization.
 */
export async function getMoneyFlows(limit = 20) {
  const cacheKey = `money-flows:${limit}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  try {
    const darkMoneyOrgs = await darkMoney.getDarkMoneyOrgs(limit)
    const flows = []

    for (const org of darkMoneyOrgs.slice(0, 5)) {
      try {
        const flow = await darkMoney.traceDarkMoneyFlow(org.id)
        if (flow.flow.length > 0) {
          flows.push({
            source: 'Unknown Donors',
            target: org.name,
            amount: flow.totalTraceable,
            state:  org.state,
            type:   'dark_money',
          })
        }
      } catch (err) {
        console.error(`[CampaignWatch] Error tracing flow for ${org.id}:`, err.message)
      }
    }

    setCached(cacheKey, flows, CACHE_TTL.moneyFlows)
    return flows
  } catch (err) {
    console.error('[CampaignWatch] getMoneyFlows error:', err.message)
    return []
  }
}

/**
 * Get corruption index rankings for all states.
 */
export async function getCorruptionIndex() {
  const cacheKey = 'corruption-index'
  const cached = getCached(cacheKey)
  if (cached) return cached

  const stateSummaries = await getStateSummaries()

  const result = stateSummaries
    .map(state => ({
      stateCode:          state.stateCode,
      name:               state.name,
      corruptionIndex:    state.corruptionIndex,
      darkMoneyExposure:  state.darkMoneyExposure,
      stockActViolations: state.stockActViolations,
      totalRaised:        state.totalRaised,
    }))
    .sort((a, b) => a.corruptionIndex - b.corruptionIndex)  // Lower = more corrupt first

  setCached(cacheKey, result, CACHE_TTL.corruptionIndex)
  return result
}

// ─── Cache management ─────────────────────────────────────────────────────────
export function getCacheStats() {
  return {
    entries: cache.size,
    keys: [...cache.keys()],
  }
}

export function clearCache(keyPrefix = null) {
  if (keyPrefix) {
    for (const key of cache.keys()) {
      if (key.startsWith(keyPrefix)) cache.delete(key)
    }
  } else {
    cache.clear()
  }
}

export default {
  getStateSummaries,
  getStateDetails,
  getStateCorruptionProfile,
  generateAiNarrative,
  getMoneyFlows,
  getCorruptionIndex,
  getCacheStats,
  clearCache,
}
