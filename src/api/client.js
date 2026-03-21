/**
 * UNREDACTED API Client
 *
 * Uses relative URLs so it works seamlessly in both environments:
 *   - Local dev:  Vite proxies /api/* → http://localhost:3001
 *   - Production: Vercel routes /api/* → api/[[...path]].js serverless function
 *
 * No hardcoded localhost URLs needed.
 */

const BASE = ''  // relative — works in dev (Vite proxy) and prod (Vercel)

async function request(path, options = {}) {
  const url = `${BASE}${path}`
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Spending ──────────────────────────────────────────────────────────────────
export const spending = {
  contracts: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/spending/contracts${qs ? `?${qs}` : ''}`)
  },
  grants: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/spending/grants${qs ? `?${qs}` : ''}`)
  },
  agency: (year) => request(`/api/spending/agency${year ? `?year=${year}` : ''}`),
}

// ── Donors / FEC ──────────────────────────────────────────────────────────────
export const donors = {
  committees:    (keyword, limit = 10) => request(`/api/donors/committees?keyword=${encodeURIComponent(keyword)}&limit=${limit}`),
  candidates:    (name, office, state, limit = 10) => {
    const qs = new URLSearchParams({ ...(name && { name }), ...(office && { office }), ...(state && { state }), limit }).toString()
    return request(`/api/donors/candidates?${qs}`)
  },
  totals:        (id)  => request(`/api/donors/candidates/${id}/totals`),
  contributions: (id, limit = 50, minAmount = 1000) =>
    request(`/api/donors/candidates/${id}/contributions?limit=${limit}&minAmount=${minAmount}`),
  committeeContributions: (id, limit = 50) =>
    request(`/api/donors/committees/${id}/contributions?limit=${limit}`),
  byEmployer:    (employer, limit = 20) =>
    request(`/api/donors/donors/by-employer?employer=${encodeURIComponent(employer)}&limit=${limit}`),
  network:       (name, limit = 30) =>
    request(`/api/donors/donors/${encodeURIComponent(name)}/network?limit=${limit}`),
  byIndustry:    (keywords, limit = 50) =>
    request(`/api/donors/contributions/by-industry?keywords=${encodeURIComponent(keywords.join(','))}&limit=${limit}`),
  compare:       (ids) => request(`/api/donors/candidates/compare?ids=${ids.join(',')}`),
  pacSpending:   (id, limit = 20) => request(`/api/donors/committees/${id}/spending?limit=${limit}`),
}

// ── Policy / Federal Register ─────────────────────────────────────────────────
export const policy = {
  rules:       (params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/api/policy/rules${qs ? `?${qs}` : ''}`) },
  significant: (limit = 20) => request(`/api/policy/significant?limit=${limit}`),
}

// ── News Feed ─────────────────────────────────────────────────────────────────
export const feed = {
  spendingNews:       (limit = 12)  => request(`/api/feed/spending-news?limit=${limit}`),
  corruptionNews:     (limit = 15)  => request(`/api/feed/corruption-news?limit=${limit}`),
  secFilings:         (limit = 15)  => request(`/api/feed/sec-filings?limit=${limit}`),
  fecCampaign:        (limit = 15)  => request(`/api/feed/fec-campaign?limit=${limit}`),
  stockAct:           (limit = 15)  => request(`/api/feed/stock-act?limit=${limit}`),
  politicianSpending: (limit = 15)  => request(`/api/feed/politician-spending?limit=${limit}`),
  darkMoney:          (limit = 15)  => request(`/api/feed/dark-money?limit=${limit}`),
  allFeeds:           (limit = 30, category = null) =>
    request(`/api/feed/all?limit=${limit}${category ? `&category=${category}` : ''}`),
  categories:         ()            => request('/api/feed/categories'),
}

// ── Agent ─────────────────────────────────────────────────────────────────────
export const agent = {
  query: (query) => request('/api/agent/query', { method: 'POST', body: JSON.stringify({ query }) }),
}

// ── AI Agent (FastAPI proxy) ──────────────────────────────────────────────────
export const aiAgent = {
  health:     () => request('/api/ai-agent/health'),
  donor:      (query, context) => request('/api/ai-agent/donor', { method: 'POST', body: JSON.stringify({ query, context }) }),
  corruption: (query, context) => request('/api/ai-agent/corruption', { method: 'POST', body: JSON.stringify({ query, context }) }),
  orchestrate:(query, opts = {}) => request('/api/ai-agent/orchestrate', { method: 'POST', body: JSON.stringify({ query, ...opts }) }),
  fallbackDonor:(query, context) => request('/api/ai-agent/fallback/donor', { method: 'POST', body: JSON.stringify({ query, context }) }),
}

// ── Settings ──────────────────────────────────────────────────────────────────
export const settings = {
  get:  ()       => request('/api/settings'),
  save: (data)   => request('/api/settings', { method: 'POST', body: JSON.stringify(data) }),
  test: ()       => request('/api/settings/test', { method: 'POST', body: '{}' }),
}

// ── Corruption scoring ────────────────────────────────────────────────────────
export const corruption = {
  scoreCompany:   (name) => request(`/api/corruption/score/company?name=${encodeURIComponent(name)}`),
  scorePolitician:(candidateId) => request(`/api/corruption/score/politician?candidateId=${candidateId}`),
  leaderboard:    (chamber, party, limit) => {
    const qs = new URLSearchParams({ ...(chamber && { chamber }), ...(party && { party }), ...(limit && { limit }) }).toString()
    return request(`/api/corruption/leaderboard${qs ? `?${qs}` : ''}`)
  },
  patterns:  (params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/api/corruption/patterns${qs ? `?${qs}` : ''}`) },
  hotspots:  (agencyName) => request(`/api/corruption/hotspots${agencyName ? `?agencyName=${encodeURIComponent(agencyName)}` : ''}`),
  signals:   (name) => request(`/api/corruption/signals/company/${encodeURIComponent(name)}`),
  analyze:   (query) => request('/api/corruption/analyze', { method: 'POST', body: JSON.stringify({ query }) }),
}

// ── Companies ─────────────────────────────────────────────────────────────────
export const companies = {
  search:           (q, limit = 20) => request(`/api/companies/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  profile:          (name) => request(`/api/companies/${encodeURIComponent(name)}/profile`),
  politicalFootprint:(name) => request(`/api/companies/${encodeURIComponent(name)}/political-footprint`),
  contracts:        (name, params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/api/companies/${encodeURIComponent(name)}/contracts${qs ? `?${qs}` : ''}`) },
  regulatory:       (name) => request(`/api/companies/${encodeURIComponent(name)}/regulatory`),
  revolvingDoor:    (name) => request(`/api/companies/${encodeURIComponent(name)}/revolving-door`),
  conflicts:        (name) => request(`/api/companies/${encodeURIComponent(name)}/conflicts`),
}

// ── STOCK Act ─────────────────────────────────────────────────────────────────
export const stockAct = {
  recent:      (chamber, limit = 50) => request(`/api/stockact/recent${chamber ? `?chamber=${chamber}&limit=${limit}` : `?limit=${limit}`}`),
  violations:  () => request('/api/stockact/violations'),
  politician:  (name, chamber) => request(`/api/stockact/politician/${encodeURIComponent(name)}${chamber ? `?chamber=${chamber}` : ''}`),
  performance: (name) => request(`/api/stockact/politician/${encodeURIComponent(name)}/performance`),
  watchlist:   () => request('/api/stockact/watchlist'),
  mostTraded:  () => request('/api/stockact/companies/most-traded'),
}

// ── Dark Money ────────────────────────────────────────────────────────────────
export const darkMoney = {
  orgs:       (limit = 20) => request(`/api/darkmoney/orgs?limit=${limit}`),
  trace:      (committeeId) => request(`/api/darkmoney/trace/${committeeId}`),
  exposure:   (candidateId) => request(`/api/darkmoney/candidate/${candidateId}/exposure`),
  infer:      (committeeId) => request(`/api/darkmoney/candidate/${committeeId}/infer`),
  flow:       (cycle) => request(`/api/darkmoney/flow${cycle ? `?cycle=${cycle}` : ''}`),
  orgsIndex:  (limit = 50, level) => request(`/api/darkmoney/organizations/index?limit=${limit}${level ? `&level=${level}` : ''}`),
}

// ── Campaign Watch ────────────────────────────────────────────────────────────
export const campaignWatch = {
  states:          ()           => request('/api/campaign-watch/states'),
  state:           (stateCode)  => request(`/api/campaign-watch/state/${stateCode}`),
  moneyFlows:      (limit = 20) => request(`/api/campaign-watch/money-flows?limit=${limit}`),
  corruptionIndex: ()           => request('/api/campaign-watch/corruption-index'),
  // Phase 2D — new endpoints
  corruptionProfile: (stateCode) => request(`/api/campaign-watch/state/${stateCode}/corruption`),
  aiAnalysis:        (stateCode) => request(`/api/campaign-watch/state/${stateCode}/ai-analysis`),
  representatives:   (stateCode) => request(`/api/campaign-watch/state/${stateCode}/representatives`),
  repsByAddress:     (address)   => request(`/api/campaign-watch/representatives?address=${encodeURIComponent(address)}`),
  legislation:       (stateCode, limit = 20) => request(`/api/campaign-watch/state/${stateCode}/legislation?limit=${limit}`),
  elections:         ()          => request('/api/campaign-watch/elections'),
  health:            ()          => request('/api/campaign-watch/health'),
  clearCache:        (prefix)    => request(`/api/campaign-watch/cache${prefix ? `?prefix=${prefix}` : ''}`, { method: 'DELETE' }),
}

// ── Version ──────────────────────────────────────────────────────────────────
export const version = {
  get: () => request('/api/version'),
}

// ── Health ────────────────────────────────────────────────────────────────────
export const health = () => request('/api/health')

// ── Legacy named exports (used by components — map old function names to new API) ──
export const fetchSettings              = settings.get
export const saveSettings               = settings.save
export const testAIConnection           = settings.test

// App.jsx legacy exports
export const queryAgent          = agent.query
export const fetchContracts      = (params) => spending.contracts(params)
export const fetchSpendingNews   = (limit)  => feed.spendingNews(limit)
export const fetchAgencySpending = (year)   => spending.agency(year)

export const getAccountabilityLeaderboard = (chamber, party, limit) => corruption.leaderboard(chamber, party, limit)
export const getCompanyProfile            = (name)   => companies.profile(name)
export const getCompanyPoliticalFootprint = (name)   => companies.politicalFootprint(name)
export const getCompanyConflicts          = (name)   => companies.conflicts(name)
export const getDarkMoneyOrgs             = (limit)  => darkMoney.orgs(limit)
export const getDarkMoneyFlowData         = (cycle)  => darkMoney.flow(cycle)
export const getRecentStockTrades         = (chamber, limit) => stockAct.recent(chamber, limit)
export const getStockActWatchlist         = ()       => stockAct.watchlist()

export default {
  spending, donors, policy, feed, agent, aiAgent, settings,
  corruption, companies, stockAct, darkMoney, campaignWatch, health,
}
