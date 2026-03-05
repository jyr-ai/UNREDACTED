const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

const TIMEOUT_MS = 15000

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timer)
    return res
  } catch (e) {
    clearTimeout(timer)
    if (e.name === 'AbortError') throw new Error('Request timed out (15s)')
    throw e
  }
}

export async function queryAgent(query) {
  const res = await fetchWithTimeout(`${BASE}/api/agent/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `API error: ${res.status}`)
  }
  return res.json()
}

export async function fetchContracts(params = {}) {
  const qs = new URLSearchParams(params).toString()
  const res = await fetchWithTimeout(`${BASE}/api/spending/contracts?${qs}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function fetchGrants(params = {}) {
  const qs = new URLSearchParams(params).toString()
  const res = await fetchWithTimeout(`${BASE}/api/spending/grants?${qs}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function fetchRules(params = {}) {
  const qs = new URLSearchParams(params).toString()
  const res = await fetchWithTimeout(`${BASE}/api/policy/rules?${qs}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}
