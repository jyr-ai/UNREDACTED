import axios from 'axios'

const BASE = 'https://api.govinfo.gov'
// Lazy getter — dotenv hasn't loaded yet at import time in ESM
function getKey() { return process.env.GOVINFO_API_KEY || 'DEMO_KEY' }

export async function searchBills({ keyword, limit = 10 }) {
  const res = await axios.post(`${BASE}/search`, {
    query: keyword,
    pageSize: limit,
    offsetMark: '*',
    collections: ['BILLS'],
  }, {
    params: { api_key: getKey() },
  })
  return (res.data.results?.packages || []).map(pkg => ({
    title: pkg.title,
    packageId: pkg.packageId,
    date: pkg.dateIssued,
    congress: pkg.congress,
    branch: pkg.branch,
    url: pkg.packageLink,
  }))
}

export async function searchCFR({ keyword, limit = 10 }) {
  const res = await axios.post(`${BASE}/search`, {
    query: keyword,
    pageSize: limit,
    offsetMark: '*',
    collections: ['CFR'],
  }, {
    params: { api_key: getKey() },
  })
  return (res.data.results?.packages || []).map(pkg => ({
    title: pkg.title,
    packageId: pkg.packageId,
    date: pkg.dateIssued,
    branch: pkg.branch,
    url: pkg.packageLink,
  }))
}
