import { searchCommittees, searchCandidates } from '../services/fec.js'

export async function runDonorAgent({ keywords, entities }) {
  const keyword = (keywords || []).join(' ') || (entities || [])[0] || ''
  try {
    const [committees, candidates] = await Promise.all([
      searchCommittees({ keyword, limit: 8 }),
      searchCandidates({ name: keyword, limit: 5 }),
    ])

    return {
      committees: committees.map(c => ({
        name: c.name,
        type: c.committee_type_full,
        party: c.party_full,
        totalReceipts: c.receipts,
        totalDisbursements: c.disbursements,
        state: c.state,
        id: c.id,
      })),
      candidates: candidates.map(c => ({
        name: c.name,
        office: c.office_full,
        party: c.party_full,
        state: c.state,
        totalRaised: c.receipts,
        electionYear: c.election_years?.[0],
      })),
    }
  } catch (e) {
    console.error('donorAgent error:', e.message)
    return { committees: [], candidates: [] }
  }
}
