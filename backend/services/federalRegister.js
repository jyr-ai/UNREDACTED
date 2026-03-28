import axios from 'axios'

const BASE = 'https://www.federalregister.gov/api/v1'

const FIELDS = ['title', 'agency_names', 'publication_date', 'abstract', 'document_number', 'html_url', 'type', 'significant']

function buildFRUrl(path, queryParams, fields) {
  const url = new URL(`${BASE}${path}`)
  for (const [key, value] of Object.entries(queryParams)) {
    if (value === undefined || value === null) continue
    url.searchParams.append(key, value)
  }
  for (const f of fields) {
    url.searchParams.append('fields[]', f)
  }
  return url.toString()
}

// Get date from 2 years ago — ensures Jan 2025 EOs/rules are included
function getOneYearAgo() {
  const date = new Date()
  date.setFullYear(date.getFullYear() - 2)
  return date.toISOString().split('T')[0]
}

export async function searchRules({ keyword, agency, dateFrom, limit = 10 }) {
  const params = {
    'conditions[publication_date][gte]': dateFrom || getOneYearAgo(),
    per_page: limit,
    order: 'newest',
  }
  if (keyword) params['conditions[term]'] = keyword
  if (agency) params['conditions[agencies][]'] = agency

  const url = buildFRUrl('/documents.json', params, FIELDS)
  const res = await axios.get(url)
  return res.data.results || []
}

export async function getRecentSignificantRules(limit = 20) {
  const params = {
    'conditions[significant]': 1,
    'conditions[publication_date][gte]': getOneYearAgo(),
    per_page: limit,
    order: 'newest',
  }
  const url = buildFRUrl('/documents.json', params, FIELDS)
  const res = await axios.get(url)
  return res.data.results || []
}

export async function getExecutiveOrders(limit = 30) {
  const params = {
    'conditions[presidential_document_type]': 'executive_order',
    'conditions[publication_date][gte]': '2025-01-01',
    per_page: limit,
    order: 'newest',
  }
  const url = buildFRUrl('/documents.json', params, [...FIELDS, 'executive_order_number', 'presidential_document_type'])
  const res = await axios.get(url)
  return res.data.results || []
}

export async function getProposedRules(limit = 20, keyword) {
  const params = {
    'conditions[type]': 'PROPOSED_RULE',
    'conditions[publication_date][gte]': getOneYearAgo(),
    per_page: limit,
    order: 'newest',
  }
  if (keyword) params['conditions[term]'] = keyword
  const url = buildFRUrl('/documents.json', params, FIELDS)
  const res = await axios.get(url)
  return res.data.results || []
}
