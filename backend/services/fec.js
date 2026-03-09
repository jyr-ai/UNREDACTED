import axios from 'axios'

const BASE = 'https://api.open.fec.gov/v1'
const KEY = process.env.FEC_API_KEY || 'DEMO_KEY'

export async function searchCommittees({ keyword, limit = 10 }) {
  const res = await axios.get(`${BASE}/committees/`, {
    params: { q: keyword, api_key: KEY, per_page: limit, sort: '-receipts' },
  })
  return res.data.results
}

export async function getCommitteeReceipts(committeeId, limit = 20) {
  const res = await axios.get(`${BASE}/schedules/schedule_b/`, {
    params: { committee_id: committeeId, api_key: KEY, per_page: limit, sort: '-disbursement_date' },
  })
  return res.data.results
}

// Get current election cycle (most recent even year)
function getCurrentElectionYear() {
  const year = new Date().getFullYear()
  // Presidential/congressional elections are on even years
  // If current year is odd, use the previous even year
  return year % 2 === 0 ? year : year - 1
}

export async function searchCandidates({ name, office, state, limit = 10, electionYear }) {
  const year = electionYear || getCurrentElectionYear()
  const res = await axios.get(`${BASE}/candidates/search/`, {
    params: { q: name, office, state, api_key: KEY, per_page: limit, election_year: year },
  })
  return res.data.results
}

export async function getCandidateRaisedTotals(candidateId, electionYear) {
  const year = electionYear || getCurrentElectionYear()
  const res = await axios.get(`${BASE}/candidate/${candidateId}/totals/`, {
    params: { api_key: KEY, election_year: year },
  })
  return res.data.results?.[0]
}
