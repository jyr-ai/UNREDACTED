/**
 * Congress.gov API Service
 * Fetches legislative data: members, bills, voting records
 * API docs: https://api.congress.gov/
 */
import axios from 'axios'

const BASE = 'https://api.congress.gov/v3'
const getKey = () => process.env.CONGRESS_GOV_API_KEY || ''

// ─── In-Memory Cache ──────────────────────────────────────────────────────────
const cache = new Map()

const CACHE_TTL = {
  members:  2 * 60 * 60 * 1000,  // 2 hours — membership changes slowly
  bills:    2 * 60 * 60 * 1000,  // 2 hours
  votes:    4 * 60 * 60 * 1000,  // 4 hours
  detail:  30 * 60 * 1000,       // 30 min
}

function cacheKey(prefix, params) {
  return `${prefix}:${JSON.stringify(params)}`
}

function getCached(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null }
  return entry.data
}

function setCached(key, data, ttl) {
  if (cache.size >= 300) {
    const firstKey = cache.keys().next().value
    cache.delete(firstKey)
  }
  cache.set(key, { data, expiresAt: Date.now() + ttl })
}

// ─── Core Fetch ───────────────────────────────────────────────────────────────
async function cgGet(endpoint, params = {}, ttl = CACHE_TTL.members) {
  const key = cacheKey(endpoint, params)
  const cached = getCached(key)
  if (cached) return cached

  const apiKey = getKey()
  if (!apiKey) {
    console.warn('[Congress.gov] CONGRESS_GOV_API_KEY not set — skipping request')
    return null
  }

  try {
    const res = await axios.get(`${BASE}${endpoint}`, {
      params: { api_key: apiKey, format: 'json', ...params },
      timeout: 15000,
    })
    const data = res.data
    setCached(key, data, ttl)
    return data
  } catch (err) {
    if (err.response?.status === 429) {
      console.warn('[Congress.gov] Rate limited — returning null')
      return null
    }
    console.error(`[Congress.gov] Error fetching ${endpoint}:`, err.message)
    return null
  }
}

// ─── Current Congress Number ──────────────────────────────────────────────────
// 119th Congress started Jan 2025
function getCurrentCongress() {
  return 119
}

// ─── State code → full name lookup (matches Congress.gov member.state field) ──
const STATE_FULL_NAMES = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',
  CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',
  HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',
  KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',
  MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',
  NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',
  NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',
  OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
  SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',
  VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
  DC:'District of Columbia',
}

// ─── Members ─────────────────────────────────────────────────────────────────

/**
 * Get all current members of Congress from a specific state.
 * Returns senators + representatives.
 */
export async function getMembersByState(stateCode) {
  const code = stateCode.toUpperCase()
  const key = cacheKey('membersByState', code)
  const cached = getCached(key)
  if (cached) return cached

  try {
    // Congress.gov /member doesn't filter by state — fetch all current members and filter client-side
    const stateFullName = STATE_FULL_NAMES[code]
    if (!stateFullName) return []

    const data = await cgGet('/member', {
      currentMember: 'true',
      limit: 540,   // covers all 535 members of Congress
    }, CACHE_TTL.members)

    const allMembers = data?.members || []
    const stateMembers = allMembers
      .filter(m => m.state === stateFullName)
      .map(m => ({
        bioguideId: m.bioguideId,
        name: m.name,
        partyName: m.partyName,
        party: m.partyName,
        chamber: m.terms?.item?.[m.terms.item.length - 1]?.chamber || 'Unknown',
        district: m.district || null,
        state: code,
        url: m.url,
        officialUrl: null,
        depiction: m.depiction?.imageUrl || null,
      }))

    setCached(key, stateMembers, CACHE_TTL.members)
    return stateMembers
  } catch (err) {
    console.error(`[Congress.gov] getMembersByState(${stateCode}) error:`, err.message)
    return []
  }
}

/**
 * Get a single member's profile + committee assignments.
 */
export async function getMemberDetails(bioguideId) {
  const data = await cgGet(`/member/${bioguideId}`, {}, CACHE_TTL.detail)
  if (!data?.member) return null

  const m = data.member
  return {
    bioguideId,
    name: m.directOrderName || m.invertedOrderName,
    party: m.partyHistory?.[0]?.partyName,
    state: m.state,
    terms: m.terms?.item || [],
    committees: (m.committeeAssignments?.item || []).map(c => ({
      name: c.committee?.name,
      role: c.rank,
    })),
    url: m.officialWebsiteUrl,
    depiction: m.depiction?.imageUrl || null,
    birthYear: m.birthYear,
  }
}

// ─── Bills ────────────────────────────────────────────────────────────────────

/**
 * Get recent bills sponsored by members from a state.
 */
export async function getBillsByState(stateCode, limit = 20) {
  const key = cacheKey('billsByState', { stateCode, limit })
  const cached = getCached(key)
  if (cached) return cached

  try {
    const congress = getCurrentCongress()
    const members = await getMembersByState(stateCode)

    if (!members || members.length === 0) return []

    // Get bills for the first 3 members (senators are usually most impactful)
    const senators = members.filter(m => m.chamber === 'Senate').slice(0, 2)
    const topReps  = members.filter(m => m.chamber === 'House').slice(0, 1)
    const selected = [...senators, ...topReps]

    const billResults = await Promise.allSettled(
      selected.map(member =>
        cgGet(`/member/${member.bioguideId}/sponsored-legislation`, {
          congress,
          limit: Math.ceil(limit / selected.length),
        }, CACHE_TTL.bills)
      )
    )

    const bills = []
    for (let i = 0; i < billResults.length; i++) {
      if (billResults[i].status !== 'fulfilled') continue
      const data = billResults[i].value
      const member = selected[i]
      for (const bill of (data?.sponsoredLegislation || [])) {
        bills.push({
          billId: `${bill.type}${bill.number}-${bill.congress}`,
          number: bill.number,
          type: bill.type,
          title: bill.title,
          congress: bill.congress,
          introducedDate: bill.introducedDate,
          latestAction: bill.latestAction?.text,
          latestActionDate: bill.latestAction?.actionDate,
          sponsor: member.name,
          sponsorParty: member.party,
          sponsorChamber: member.chamber,
          policyArea: bill.policyArea?.name,
          url: bill.url,
        })
      }
    }

    // Sort by most recent
    const result = bills
      .sort((a, b) => new Date(b.introducedDate || 0) - new Date(a.introducedDate || 0))
      .slice(0, limit)

    setCached(key, result, CACHE_TTL.bills)
    return result
  } catch (err) {
    console.error(`[Congress.gov] getBillsByState(${stateCode}) error:`, err.message)
    return []
  }
}

/**
 * Get bill detail including full sponsors list.
 */
export async function getBillDetails(congress, billType, billNumber) {
  const data = await cgGet(`/bill/${congress}/${billType.toLowerCase()}/${billNumber}`, {}, CACHE_TTL.detail)
  if (!data?.bill) return null

  const b = data.bill
  return {
    billId: `${billType}${billNumber}-${congress}`,
    title: b.title,
    summary: b.summaries?.summary?.[0]?.text,
    policyArea: b.policyArea?.name,
    subjects: (b.subjects?.legislativeSubjects?.item || []).map(s => s.name),
    sponsor: b.sponsors?.item?.[0],
    cosponsors: b.cosponsors?.count || 0,
    actions: (b.actions?.item || []).slice(0, 5).map(a => ({
      date: a.actionDate,
      text: a.text,
      type: a.type,
    })),
    relatedBills: (b.relatedBills?.item || []).slice(0, 3),
    latestAction: b.latestAction,
    constitutionalAuthorityStatement: b.constitutionalAuthorityStatementText,
  }
}

// ─── Votes ────────────────────────────────────────────────────────────────────

/**
 * Get recent roll-call votes from a chamber.
 */
export async function getRecentVotes(chamber = 'senate', limit = 20) {
  const congress = getCurrentCongress()
  const chamberPath = chamber.toLowerCase() === 'house' ? 'house' : 'senate'
  const data = await cgGet(`/${chamberPath}/votes/${congress}`, { limit }, CACHE_TTL.votes)
  return data?.votes || []
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────
export function getCongressStatus() {
  return {
    keyConfigured: !!getKey(),
    cacheEntries: cache.size,
    currentCongress: getCurrentCongress(),
  }
}

export default {
  getMembersByState,
  getMemberDetails,
  getBillsByState,
  getBillDetails,
  getRecentVotes,
  getCongressStatus,
}
