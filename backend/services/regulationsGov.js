import axios from 'axios'

const BASE = 'https://api.regulations.gov/v4'
// Lazy getter — dotenv hasn't loaded yet at import time in ESM
function getKey() { return process.env.REGULATIONS_GOV_API_KEY || 'DEMO_KEY' }

function headers() {
  return { 'X-Api-Key': getKey() }
}

export async function searchDockets({ keyword, limit = 10 }) {
  const res = await axios.get(`${BASE}/dockets`, {
    headers: headers(),
    params: {
      'filter[searchTerm]': keyword,
      'page[size]': limit,
      'sort': '-lastModifiedDate',
    },
  })
  return (res.data.data || []).map(d => ({
    id: d.id,
    title: d.attributes?.title,
    agency: d.attributes?.agencyId,
    lastModified: d.attributes?.lastModifiedDate,
    type: d.attributes?.docketType,
  }))
}

export async function searchComments({ keyword, docketId, limit = 10 }) {
  const params = {
    'page[size]': limit,
    'sort': '-postedDate',
  }
  if (keyword) params['filter[searchTerm]'] = keyword
  if (docketId) params['filter[docketId]'] = docketId

  const res = await axios.get(`${BASE}/comments`, {
    headers: headers(),
    params,
  })
  return (res.data.data || []).map(c => ({
    id: c.id,
    title: c.attributes?.title,
    postedDate: c.attributes?.postedDate,
    organization: c.attributes?.organization,
    submitterType: c.attributes?.submitterRep,
    docketId: c.attributes?.docketId,
  }))
}
