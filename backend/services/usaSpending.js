import axios from 'axios'

const BASE = 'https://api.usaspending.gov/api/v2'

export async function searchContracts({ keyword, keywords, agency, limit = 10 }) {
  const filters = {
    award_type_codes: ['A', 'B', 'C', 'D'],
  }
  // Accept either a keywords array (from agents) or a single keyword string (from routes)
  const kwArray = keywords?.length ? keywords : keyword ? [keyword] : null
  if (kwArray) filters.keywords = kwArray
  if (agency) filters.agencies = [{ type: 'awarding', tier: 'toptier', name: agency }]

  const res = await axios.post(`${BASE}/search/spending_by_award/`, {
    filters,
    fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Awarding Agency', 'Award Date', 'Description'],
    limit,
    sort: 'Award Amount',
    order: 'desc',
  })
  return res.data.results
}

export async function getAgencySpending(fiscalYear = 2024) {
  const res = await axios.get(`${BASE}/references/agency/awards/`, {
    params: { fiscal_year: fiscalYear, limit: 20 },
  })
  return res.data.results
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
