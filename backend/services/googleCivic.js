/**
 * Google Civic Information API Service
 * Fetches representatives by address/state, election data
 * API docs: https://developers.google.com/civic-information
 */
import axios from 'axios'

const BASE = 'https://www.googleapis.com/civicinfo/v2'
const getKey = () => process.env.GOOGLE_CIVIC_API_KEY || ''

// ─── State capital addresses (used as proxy for state-level lookups) ──────────
const STATE_CAPITALS = {
  AL: 'Montgomery, AL',  AK: 'Juneau, AK',        AZ: 'Phoenix, AZ',
  AR: 'Little Rock, AR', CA: 'Sacramento, CA',     CO: 'Denver, CO',
  CT: 'Hartford, CT',    DE: 'Dover, DE',           FL: 'Tallahassee, FL',
  GA: 'Atlanta, GA',     HI: 'Honolulu, HI',        ID: 'Boise, ID',
  IL: 'Springfield, IL', IN: 'Indianapolis, IN',    IA: 'Des Moines, IA',
  KS: 'Topeka, KS',      KY: 'Frankfort, KY',       LA: 'Baton Rouge, LA',
  ME: 'Augusta, ME',     MD: 'Annapolis, MD',        MA: 'Boston, MA',
  MI: 'Lansing, MI',     MN: 'Saint Paul, MN',       MS: 'Jackson, MS',
  MO: 'Jefferson City, MO', MT: 'Helena, MT',        NE: 'Lincoln, NE',
  NV: 'Carson City, NV', NH: 'Concord, NH',          NJ: 'Trenton, NJ',
  NM: 'Santa Fe, NM',    NY: 'Albany, NY',            NC: 'Raleigh, NC',
  ND: 'Bismarck, ND',    OH: 'Columbus, OH',          OK: 'Oklahoma City, OK',
  OR: 'Salem, OR',       PA: 'Harrisburg, PA',         RI: 'Providence, RI',
  SC: 'Columbia, SC',    SD: 'Pierre, SD',             TN: 'Nashville, TN',
  TX: 'Austin, TX',      UT: 'Salt Lake City, UT',     VT: 'Montpelier, VT',
  VA: 'Richmond, VA',    WA: 'Olympia, WA',             WV: 'Charleston, WV',
  WI: 'Madison, WI',     WY: 'Cheyenne, WY',            DC: 'Washington, DC',
}

// ─── Circuit-breaker: Google Civic API was deprecated on May 1 2025 ──────────
// Once we see a "Method not found" 404 we know the whole API is gone, so we
// skip every future call immediately instead of making pointless network hops.
let apiDead = false

// ─── In-Memory Cache ──────────────────────────────────────────────────────────
const cache = new Map()

const CACHE_TTL = {
  representatives: 24 * 60 * 60 * 1000,  // 24 hours — reps don't change often
  elections:        4 * 60 * 60 * 1000,  // 4 hours
  address:         12 * 60 * 60 * 1000,  // 12 hours
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

// ─── Core Fetch ───────────────────────────────────────────────────────────────
async function civicGet(endpoint, params = {}) {
  // Circuit-breaker: skip immediately if the API is known to be dead
  if (apiDead) return null

  const apiKey = getKey()
  if (!apiKey) {
    console.warn('[Google Civic] GOOGLE_CIVIC_API_KEY not set — skipping request')
    return null
  }

  try {
    const res = await axios.get(`${BASE}${endpoint}`, {
      params: { key: apiKey, ...params },
      timeout: 10000,
    })
    return res.data
  } catch (err) {
    if (err.response?.status === 403) {
      console.warn('[Google Civic] API key invalid or quota exceeded')
      return null
    }
    if (err.response?.status === 404) {
      // "Method not found" means the endpoint was deprecated — mark the whole API dead
      const reason = err.response?.data?.error?.errors?.[0]?.reason
      if (reason === 'notFound' || err.response?.data?.error?.message?.includes('Method not found')) {
        apiDead = true
        console.warn('[Google Civic] API returned "Method not found" — endpoint is deprecated. Switching to Congress.gov fallback.')
      }
      return null
    }
    console.error(`[Google Civic] Error fetching ${endpoint}:`, err.message)
    return null
  }
}

// ─── Representatives ──────────────────────────────────────────────────────────

/**
 * Get elected officials for a specific address.
 * Returns officials at all levels (federal, state, local).
 */
export async function getRepresentativesByAddress(address) {
  const cacheKey = `reps:address:${address.toLowerCase().trim()}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const data = await civicGet('/representatives', {
    address,
    includeOffices: true,
    levels: 'country,administrativeArea1',
    roles: 'legislatorUpperBody,legislatorLowerBody,headOfGovernment,deputyHeadOfGovernment',
  })

  if (!data) return null

  const result = normalizeRepresentatives(data)
  setCached(cacheKey, result, CACHE_TTL.address)
  return result
}

/**
 * Get elected officials for an entire state (uses state capital as proxy).
 */
export async function getRepresentativesByState(stateCode) {
  const code = stateCode.toUpperCase()
  const cacheKey = `reps:state:${code}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const address = STATE_CAPITALS[code]
  if (!address) return null

  const data = await civicGet('/representatives', {
    address,
    includeOffices: true,
    levels: 'country,administrativeArea1',
    roles: 'legislatorUpperBody,legislatorLowerBody,headOfGovernment',
  })

  if (!data) return null

  const result = normalizeRepresentatives(data)
  setCached(cacheKey, result, CACHE_TTL.representatives)
  return result
}

/**
 * Normalize Civic API response into a cleaner structure.
 */
function normalizeRepresentatives(data) {
  const offices   = data.offices   || []
  const officials = data.officials || []

  const normalized = []

  for (const office of offices) {
    const officeName  = office.name
    const officeLevels = office.levels || []
    const officeRoles  = office.roles  || []

    for (const idx of (office.officialIndices || [])) {
      const official = officials[idx]
      if (!official) continue

      normalized.push({
        office:    officeName,
        levels:    officeLevels,
        roles:     officeRoles,
        name:      official.name,
        party:     official.party,
        phones:    official.phones || [],
        urls:      official.urls || [],
        emails:    official.emails || [],
        photoUrl:  official.photoUrl || null,
        channels:  (official.channels || []).map(c => ({ type: c.type, id: c.id })),
        address:   official.address?.[0] || null,
      })
    }
  }

  return {
    normalizedInput: data.normalizedInput,
    officials: normalized,
    federalSenators:      normalized.filter(o => o.roles.includes('legislatorUpperBody') && o.levels.includes('country')),
    federalRepresentatives: normalized.filter(o => o.roles.includes('legislatorLowerBody') && o.levels.includes('country')),
    stateExecutive:       normalized.filter(o => o.levels.includes('administrativeArea1') && o.roles.includes('headOfGovernment')),
  }
}

// ─── Elections ────────────────────────────────────────────────────────────────

/**
 * Get upcoming elections relevant to an address.
 */
export async function getElectionsByAddress(address) {
  const cacheKey = `elections:${address.toLowerCase().trim()}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const data = await civicGet('/voterinfo', {
    address,
    officialOnly: false,
  })

  if (!data) return null

  const result = {
    election: data.election ? {
      id:   data.election.id,
      name: data.election.name,
      date: data.election.electionDay,
    } : null,
    pollingLocations: (data.pollingLocations || []).slice(0, 3).map(loc => ({
      address: loc.address,
      name: loc.address?.locationName,
      endDate: loc.endDate,
      sources: loc.sources,
    })),
    contests: (data.contests || []).slice(0, 10).map(c => ({
      type:    c.type,
      office:  c.office,
      level:   c.level,
      district: c.district?.name,
      candidates: (c.candidates || []).map(cand => ({
        name:    cand.name,
        party:   cand.party,
        phone:   cand.phone,
        email:   cand.email,
        website: cand.candidateUrl,
      })),
    })),
  }

  setCached(cacheKey, result, CACHE_TTL.elections)
  return result
}

/**
 * Get list of all upcoming elections (nationwide).
 */
export async function getElectionList() {
  const cacheKey = 'elections:list'
  const cached = getCached(cacheKey)
  if (cached) return cached

  const data = await civicGet('/elections')
  if (!data) return []

  const result = (data.elections || []).map(e => ({
    id:   e.id,
    name: e.name,
    date: e.electionDay,
    ocdDivisionId: e.ocdDivisionId,
  }))

  setCached(cacheKey, result, CACHE_TTL.elections)
  return result
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────
export function getCivicStatus() {
  return {
    keyConfigured: !!getKey(),
    apiDead,
    cacheEntries:  cache.size,
    supportedStates: Object.keys(STATE_CAPITALS).length,
  }
}

export default {
  getRepresentativesByAddress,
  getRepresentativesByState,
  getElectionsByAddress,
  getElectionList,
  getCivicStatus,
}
