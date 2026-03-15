import axios from 'axios'

const BASE = 'https://api.open.fec.gov/v1'
const KEY = process.env.FEC_API_KEY || 'DEMO_KEY'
const IS_DEMO = KEY === 'DEMO_KEY'

// ─── Rate Limiting ────────────────────────────────────────────────────────────
// DEMO_KEY: 1,000 calls/day, 30 calls/hour
// Real key: 1,000 calls/hour (api.data.gov registered key)
const RATE_LIMIT = {
  maxPerHour: IS_DEMO ? 25 : 950,      // Leave a buffer below the hard limits
  windowMs: 60 * 60 * 1000,            // 1 hour window
  callTimestamps: [],                   // Sliding window of call times
}

function checkRateLimit() {
  const now = Date.now()
  // Prune timestamps older than 1 hour
  RATE_LIMIT.callTimestamps = RATE_LIMIT.callTimestamps.filter(
    t => now - t < RATE_LIMIT.windowMs
  )
  if (RATE_LIMIT.callTimestamps.length >= RATE_LIMIT.maxPerHour) {
    const oldestCall = RATE_LIMIT.callTimestamps[0]
    const waitMs = RATE_LIMIT.windowMs - (now - oldestCall) + 100
    throw new FECRateLimitError(
      `FEC API hourly rate limit reached (${RATE_LIMIT.callTimestamps.length}/${RATE_LIMIT.maxPerHour}). ` +
      `Retry in ${Math.ceil(waitMs / 1000)}s. ` +
      (IS_DEMO
        ? 'Set FEC_API_KEY in backend .env for higher limits (1000/hour).'
        : 'Current key: registered (1000/hour).')
    )
  }
  RATE_LIMIT.callTimestamps.push(now)
}

class FECRateLimitError extends Error {
  constructor(msg) {
    super(msg)
    this.name = 'FECRateLimitError'
    this.isRateLimit = true
  }
}

// ─── In-Memory Cache ──────────────────────────────────────────────────────────
const cache = new Map()

const CACHE_TTL = {
  search: 15 * 60 * 1000,      // 15 min — search results change slowly
  schedules: 20 * 60 * 1000,   // 20 min — contribution schedules
  totals: 60 * 60 * 1000,      // 60 min — financial totals
  candidate: 60 * 60 * 1000,   // 60 min — candidate info
  committee: 30 * 60 * 1000,   // 30 min — committee info
}

function cacheKey(endpoint, params) {
  const sorted = Object.keys(params)
    .filter(k => k !== 'api_key')
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&')
  return `${endpoint}?${sorted}`
}

function getCached(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.data
}

function setCached(key, data, ttl) {
  // Limit cache size to 500 entries (evict oldest)
  if (cache.size >= 500) {
    const firstKey = cache.keys().next().value
    cache.delete(firstKey)
  }
  cache.set(key, { data, expiresAt: Date.now() + ttl })
}

// ─── Core Fetch with Retry ────────────────────────────────────────────────────
async function fecGet(endpoint, params, ttl = CACHE_TTL.search) {
  const key = cacheKey(endpoint, params)
  const cached = getCached(key)
  if (cached) return cached

  checkRateLimit()

  const maxRetries = 3
  let lastError

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await axios.get(`${BASE}${endpoint}`, {
        params: { ...params, api_key: KEY },
        timeout: 15000,
      })
      const data = res.data
      setCached(key, data, ttl)
      return data
    } catch (err) {
      lastError = err

      // 429 Too Many Requests — exponential backoff
      if (err.response?.status === 429) {
        const retryAfter = parseInt(err.response.headers['retry-after'] || '5', 10)
        const backoff = Math.min(retryAfter * 1000 * attempt, 30000)
        console.warn(`[FEC] 429 rate limit on attempt ${attempt}/${maxRetries}. Waiting ${backoff}ms...`)
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, backoff))
          continue
        }
        throw new FECRateLimitError(
          `FEC API rate limited (HTTP 429). ` +
          (IS_DEMO
            ? 'DEMO_KEY: 1000 calls/day limit reached. Set FEC_API_KEY in backend .env for higher limits.'
            : 'Hourly limit reached. Requests will resume shortly.')
        )
      }

      // 503 / network errors — short retry
      if (!err.response || err.response.status >= 500) {
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * attempt))
          continue
        }
      }

      throw err
    }
  }

  throw lastError
}

// ─── Election Year Helper ─────────────────────────────────────────────────────
function getCurrentElectionYear() {
  const year = new Date().getFullYear()
  return year % 2 === 0 ? year : year - 1
}

// ─── Committee Endpoints ──────────────────────────────────────────────────────
export async function searchCommittees({ keyword, limit = 10 }) {
  const data = await fecGet('/committees/', {
    q: keyword,
    per_page: Math.min(limit, 20),
    sort: '-receipts',
  }, CACHE_TTL.committee)
  return data.results || []
}

export async function getCommitteeReceipts(committeeId, limit = 20) {
  const data = await fecGet('/schedules/schedule_b/', {
    committee_id: committeeId,
    per_page: Math.min(limit, 20),
    sort: '-disbursement_date',
  }, CACHE_TTL.schedules)
  return data.results || []
}

// ─── Candidate Endpoints ──────────────────────────────────────────────────────
export async function searchCandidates({ name, office, state, limit = 10, electionYear }) {
  const year = electionYear || getCurrentElectionYear()
  const params = {
    q: name,
    per_page: Math.min(limit, 20),
    election_year: year,
  }
  if (office) params.office = office
  if (state) params.state = state
  const data = await fecGet('/candidates/search/', params, CACHE_TTL.search)
  return data.results || []
}

export async function getCandidateRaisedTotals(candidateId, electionYear) {
  const year = electionYear || getCurrentElectionYear()
  const data = await fecGet(
    `/candidate/${candidateId}/totals/`,
    { election_year: year },
    CACHE_TTL.totals
  )
  return data.results?.[0] || null
}

// ─── Donor Intelligence ───────────────────────────────────────────────────────
export async function getCandidateContributions(candidateId, limit = 20, minAmount = 1000) {
  // FEC schedule_a requires two_year_transaction_period alongside candidate_id
  const data = await fecGet('/schedules/schedule_a/', {
    candidate_id: candidateId,
    per_page: Math.min(limit, 20),
    sort: '-contribution_receipt_amount',
    min_amount: minAmount,
    is_individual: true,
    two_year_transaction_period: getCurrentElectionYear(),
  }, CACHE_TTL.schedules)
  return data.results || []
}

export async function getCommitteeContributions(committeeId, limit = 20, minAmount = 1000) {
  const data = await fecGet('/schedules/schedule_a/', {
    committee_id: committeeId,
    per_page: Math.min(limit, 20),
    sort: '-contribution_receipt_amount',
    min_amount: minAmount,
    is_individual: true,
  }, CACHE_TTL.schedules)
  return data.results || []
}

export async function getTopDonorsByEmployer(employer, limit = 20, cycle = null) {
  const year = cycle || getCurrentElectionYear()
  const data = await fecGet('/schedules/schedule_a/', {
    contributor_employer: employer,
    per_page: Math.min(limit, 20),
    sort: '-contribution_receipt_amount',
    two_year_transaction_period: year,
  }, CACHE_TTL.schedules)
  return data.results || []
}

export async function getDonorNetwork(donorName, limit = 20) {
  const data = await fecGet('/schedules/schedule_a/', {
    contributor_name: donorName,
    per_page: Math.min(limit, 20),
    sort: '-contribution_receipt_date',
  }, CACHE_TTL.schedules)

  const contributions = data.results || []

  const network = {
    donor: donorName,
    totalContributions: contributions.length,
    totalAmount: contributions.reduce(
      (sum, c) => sum + (parseFloat(c.contribution_receipt_amount) || 0), 0
    ),
    recipients: {},
  }

  contributions.forEach(contribution => {
    const candidate = contribution.candidate
    const committee = contribution.committee
    const amount = parseFloat(contribution.contribution_receipt_amount) || 0
    const date = contribution.contribution_receipt_date

    if (candidate?.candidate_id) {
      const key = `candidate:${candidate.candidate_id}`
      if (!network.recipients[key]) {
        network.recipients[key] = {
          type: 'candidate',
          id: candidate.candidate_id,
          name: candidate.name,
          party: candidate.party_full,
          totalAmount: 0,
          contributions: [],
        }
      }
      network.recipients[key].totalAmount += amount
      network.recipients[key].contributions.push({ amount, date })
    }

    if (committee?.committee_id) {
      const key = `committee:${committee.committee_id}`
      if (!network.recipients[key]) {
        network.recipients[key] = {
          type: 'committee',
          id: committee.committee_id,
          name: committee.name,
          totalAmount: 0,
          contributions: [],
        }
      }
      network.recipients[key].totalAmount += amount
      network.recipients[key].contributions.push({ amount, date })
    }
  })

  network.recipients = Object.values(network.recipients).sort((a, b) => b.totalAmount - a.totalAmount)
  return network
}

export async function getIndustryContributions(industryKeywords, limit = 20, cycle = null) {
  const year = cycle || getCurrentElectionYear()
  const results = []

  // Cap at 2 keywords to avoid excessive calls; each keyword = 1 API call
  const keywords = industryKeywords.slice(0, 2)
  const perKeyword = Math.min(Math.floor(limit / keywords.length), 10)

  for (const keyword of keywords) {
    try {
      const data = await fecGet('/schedules/schedule_a/', {
        contributor_occupation: keyword,
        per_page: perKeyword,
        sort: '-contribution_receipt_amount',
        two_year_transaction_period: year,
      }, CACHE_TTL.schedules)

      if (data.results) {
        results.push(...data.results.map(r => ({ ...r, industry_keyword: keyword })))
      }
    } catch (error) {
      console.error(`[FEC] Error fetching contributions for keyword "${keyword}":`, error.message)
    }
  }

  return results
}

export async function getCandidateComparison(candidateIds, cycle = null) {
  const year = cycle || getCurrentElectionYear()
  const comparisons = []

  // Fetch all candidates in a single batched call (comma-separated IDs)
  // Then fetch totals individually (no batch endpoint exists for totals)
  const batchedIds = candidateIds.slice(0, 5).join(',')

  try {
    // Batched candidate info call
    const candidateData = await fecGet('/candidates/', {
      candidate_id: batchedIds,
      per_page: Math.min(candidateIds.length, 5),
      election_year: year,
    }, CACHE_TTL.candidate)

    const candidateMap = {}
    for (const c of (candidateData.results || [])) {
      candidateMap[c.candidate_id] = c
    }

    // Fetch totals for each candidate (sequential to respect rate limits)
    for (const candidateId of candidateIds.slice(0, 5)) {
      try {
        const totalsData = await fecGet(
          `/candidate/${candidateId}/totals/`,
          { election_year: year },
          CACHE_TTL.totals
        )
        const candidate = candidateMap[candidateId]
        const totals = totalsData.results?.[0] || {}

        if (candidate) {
          comparisons.push({
            candidate_id: candidateId,
            name: candidate.name,
            party: candidate.party_full,
            state: candidate.state,
            office: candidate.office_full,
            totals,
            top_contributions: [],
            total_raised: totals.receipts || 0,
            cash_on_hand: totals.cash_on_hand || 0,
          })
        }
      } catch (error) {
        console.error(`[FEC] Error fetching totals for candidate ${candidateId}:`, error.message)
      }
    }
  } catch (error) {
    console.error('[FEC] Error fetching batched candidate comparison:', error.message)
  }

  return comparisons.sort((a, b) => b.total_raised - a.total_raised)
}

export async function getPACSpending(committeeId, limit = 10) {
  const data = await fecGet('/schedules/schedule_b/', {
    committee_id: committeeId,
    per_page: Math.min(limit, 20),
    sort: '-disbursement_amount',
  }, CACHE_TTL.schedules)

  const disbursements = data.results || []
  const categorized = { candidate_support: [], operating_expenses: [], other: [] }

  disbursements.forEach(d => {
    const amount = parseFloat(d.disbursement_amount) || 0
    const purpose = d.disbursement_purpose?.toLowerCase() || ''
    const item = { ...d, amount, category: '' }

    if (purpose.includes('contribution') || purpose.includes('donation') || d.candidate) {
      item.category = 'candidate_support'
      categorized.candidate_support.push(item)
    } else if (purpose.includes('salary') || purpose.includes('rent') || purpose.includes('travel')) {
      item.category = 'operating_expenses'
      categorized.operating_expenses.push(item)
    } else {
      item.category = 'other'
      categorized.other.push(item)
    }
  })

  return {
    committee_id: committeeId,
    total_disbursements: disbursements.reduce(
      (sum, d) => sum + (parseFloat(d.disbursement_amount) || 0), 0
    ),
    categorized,
    raw_disbursements: disbursements,
  }
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────
export function getFecStatus() {
  const now = Date.now()
  const recentCalls = RATE_LIMIT.callTimestamps.filter(t => now - t < RATE_LIMIT.windowMs)
  return {
    keyType: IS_DEMO ? 'DEMO_KEY' : 'registered',
    callsThisHour: recentCalls.length,
    hourlyLimit: RATE_LIMIT.maxPerHour,
    cacheEntries: cache.size,
    remaining: RATE_LIMIT.maxPerHour - recentCalls.length,
  }
}
