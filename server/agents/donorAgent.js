import {
  searchCommittees,
  searchCandidates,
  getCandidateContributions,
  getCommitteeContributions,
  getDonorNetwork,
  getTopDonorsByEmployer,
  getCandidateComparison,
  getPACSpending
} from '../services/fec.js'

export async function runDonorAgent({ keywords, entities, query }) {
  const keyword = (keywords || []).join(' ') || (entities || [])[0] || query || ''

  try {
    // Phase 1: Core lookups — 3 parallel calls (committees, candidates, top donors)
    // Reduced limits to conserve API quota
    const [committees, candidates, topDonors] = await Promise.all([
      searchCommittees({ keyword, limit: 5 }),
      searchCandidates({ name: keyword, limit: 5 }),
      getTopDonorsByEmployer(keyword, 8),
    ])

    // Phase 2: Targeted follow-up calls — only when Phase 1 found results.
    // We run at most 2 follow-up calls to stay well within rate limits.
    let candidateContributions = []
    let committeeContributions = []
    let donorNetwork = null
    let pacSpending = null

    if (candidates.length > 0) {
      // Fetch top contributions for the single best-matching candidate only
      candidateContributions = await getCandidateContributions(
        candidates[0].candidate_id,
        8,   // reduced from 50
        1000
      )
    }

    if (committees.length > 0) {
      // Fetch contributions for the top committee only
      committeeContributions = await getCommitteeContributions(
        committees[0].committee_id,
        8,   // reduced from 50
        1000
      )
    }

    // PAC spending — only fetch if no candidate contributions found (saves a call)
    if (committees.length > 0 && candidateContributions.length === 0) {
      pacSpending = await getPACSpending(committees[0].committee_id, 8)
    }

    // Donor network — only for person-name queries (multi-word, no corporate suffixes)
    const looksLikePersonName =
      keyword.split(' ').length >= 2 &&
      !/\b(inc|llc|corp|pac|fund|committee|foundation|association|group)\b/i.test(keyword)

    if (looksLikePersonName) {
      try {
        donorNetwork = await getDonorNetwork(keyword, 12)
      } catch (e) {
        // Non-fatal — donor network lookup is best-effort
        console.warn('[donorAgent] Donor network lookup skipped:', e.message)
      }
    }

    // Analyze relationships and patterns
    const analysis = analyzeDonorPatterns({
      committees,
      candidates,
      topDonors,
      candidateContributions,
      committeeContributions,
      donorNetwork,
    })

    return {
      committees: committees.map(c => ({
        name: c.name,
        type: c.committee_type_full,
        party: c.party_full,
        totalReceipts: c.receipts,
        totalDisbursements: c.disbursements,
        state: c.state,
        id: c.committee_id,
        cashOnHand: c.cash_on_hand,
        designation: c.designation,
      })),
      candidates: candidates.map(c => ({
        name: c.name,
        office: c.office_full,
        party: c.party_full,
        state: c.state,
        totalRaised: c.receipts,
        electionYear: c.election_years?.[0],
        candidate_id: c.candidate_id,
        district: c.district,
        incumbent: c.incumbent_challenge_full,
      })),
      topDonors: topDonors.map(d => ({
        name: d.contributor_name,
        employer: d.contributor_employer,
        occupation: d.contributor_occupation,
        amount: d.contribution_receipt_amount,
        date: d.contribution_receipt_date,
        candidate: d.candidate?.name,
        committee: d.committee?.name,
      })),
      candidateContributions: candidateContributions.map(c => ({
        donor: c.contributor_name,
        employer: c.contributor_employer,
        amount: c.contribution_receipt_amount,
        date: c.contribution_receipt_date,
        state: c.contributor_state,
      })),
      committeeContributions: committeeContributions.map(c => ({
        donor: c.contributor_name,
        employer: c.contributor_employer,
        amount: c.contribution_receipt_amount,
        date: c.contribution_receipt_date,
        state: c.contributor_state,
      })),
      donorNetwork: donorNetwork ? {
        donor: donorNetwork.donor,
        totalContributions: donorNetwork.totalContributions,
        totalAmount: donorNetwork.totalAmount,
        recipients: donorNetwork.recipients,
      } : null,
      pacSpending: pacSpending ? {
        committee_id: pacSpending.committee_id,
        total_disbursements: pacSpending.total_disbursements,
        categorized: pacSpending.categorized,
      } : null,
      analysis,
      summary: generateSummary({
        keyword,
        committeesCount: committees.length,
        candidatesCount: candidates.length,
        topDonorsCount: topDonors.length,
        analysis,
      }),
    }
  } catch (e) {
    const isRateLimit = e.isRateLimit || e.response?.status === 429
    console.error('[donorAgent] error:', e.message)
    return {
      committees: [],
      candidates: [],
      topDonors: [],
      analysis: {
        error: e.message,
        isRateLimit,
      },
      summary: isRateLimit
        ? `FEC API rate limit reached. ${e.message}`
        : `Error analyzing donor data: ${e.message}`,
    }
  }
}

function analyzeDonorPatterns(data) {
  const { committees, candidates, topDonors, candidateContributions, committeeContributions, donorNetwork } = data

  const analysis = {
    totalFunds: 0,
    topIndustries: [],
    politicalLeaning: 'neutral',
    networkStrength: 'weak',
    notablePatterns: [],
  }

  // Calculate total funds
  const committeeFunds = committees.reduce((sum, c) => sum + (parseFloat(c.totalReceipts) || 0), 0)
  const candidateFunds = candidates.reduce((sum, c) => sum + (parseFloat(c.totalRaised) || 0), 0)
  analysis.totalFunds = committeeFunds + candidateFunds

  // Analyze political leaning based on party distribution
  const partyCounts = { democrat: 0, republican: 0, other: 0 }

  committees.forEach(c => {
    const party = (c.party || '').toLowerCase()
    if (party.includes('democrat')) partyCounts.democrat++
    else if (party.includes('republican')) partyCounts.republican++
    else partyCounts.other++
  })

  candidates.forEach(c => {
    const party = (c.party || '').toLowerCase()
    if (party.includes('democrat')) partyCounts.democrat++
    else if (party.includes('republican')) partyCounts.republican++
    else partyCounts.other++
  })

  if (partyCounts.democrat > partyCounts.republican * 2) analysis.politicalLeaning = 'strongly democratic'
  else if (partyCounts.democrat > partyCounts.republican) analysis.politicalLeaning = 'democratic'
  else if (partyCounts.republican > partyCounts.democrat * 2) analysis.politicalLeaning = 'strongly republican'
  else if (partyCounts.republican > partyCounts.democrat) analysis.politicalLeaning = 'republican'

  // Analyze network strength
  const totalConnections = committees.length + candidates.length + (donorNetwork?.recipients?.length || 0)
  if (totalConnections > 20) analysis.networkStrength = 'strong'
  else if (totalConnections > 10) analysis.networkStrength = 'moderate'

  // Identify notable patterns
  if (committeeContributions.length > 0) {
    const avgContribution =
      committeeContributions.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0) /
      committeeContributions.length
    if (avgContribution > 5000) analysis.notablePatterns.push('High average contribution amount')
  }

  if (candidateContributions.length > 0) {
    const now = new Date()
    const sixMonthsAgo = new Date(now.setMonth(now.getMonth() - 6))
    const recentContributions = candidateContributions.filter(c => new Date(c.date) > sixMonthsAgo)
    if (recentContributions.length > 3) analysis.notablePatterns.push('Active recent donor activity')
  }

  // Identify top industries from employer data
  const employerCounts = {}
  topDonors.forEach(d => {
    if (d.employer) {
      employerCounts[d.employer] = (employerCounts[d.employer] || 0) + 1
    }
  })

  analysis.topIndustries = Object.entries(employerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([employer, count]) => ({ employer, count }))

  return analysis
}

function generateSummary(data) {
  const { keyword, committeesCount, candidatesCount, topDonorsCount, analysis } = data
  const parts = []

  if (committeesCount > 0 || candidatesCount > 0) {
    parts.push(
      `Found ${committeesCount} political committee${committeesCount !== 1 ? 's' : ''} and ` +
      `${candidatesCount} candidate${candidatesCount !== 1 ? 's' : ''} related to "${keyword}".`
    )
  }

  if (topDonorsCount > 0) {
    parts.push(`Identified ${topDonorsCount} top donors from this sector.`)
  }

  if (analysis.totalFunds > 0) {
    const fundsFormatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(analysis.totalFunds)
    parts.push(`Total political funds: ${fundsFormatted}.`)
  }

  if (analysis.politicalLeaning !== 'neutral') {
    parts.push(`Political leaning: ${analysis.politicalLeaning}.`)
  }

  if (analysis.networkStrength !== 'weak') {
    parts.push(`Network strength: ${analysis.networkStrength}.`)
  }

  if (analysis.notablePatterns.length > 0) {
    parts.push(`Notable patterns: ${analysis.notablePatterns.join(', ')}.`)
  }

  if (analysis.topIndustries.length > 0) {
    const industries = analysis.topIndustries.map(i => i.employer).join(', ')
    parts.push(`Top contributing industries: ${industries}.`)
  }

  return parts.join(' ')
}
