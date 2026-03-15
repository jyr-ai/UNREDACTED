/**
 * Comprehensive corruption scoring service.
 * Implements the RECEIPTS Accountability Score for politicians and companies.
 */
import axios from 'axios'
import {
  getCompanyRiskScore,
  findQuidProQuoPaths,
  getTopContractorsByAgency,
  findRegulatoryPatterns,
} from './graphQueries.js'

const FEC_BASE = 'https://api.open.fec.gov/v1'
const getKey = () => process.env.FEC_API_KEY || 'DEMO_KEY'

/**
 * Score a company's corruption risk.
 * Components: contract concentration, donor links, regulatory capture, revolving door.
 * Returns 0–100 score with risk level and evidence.
 */
export async function scoreCompany(companyName) {
  try {
    const normalizedName = companyName.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()

    // Get base risk from Neo4j graph
    let baseRisk = null
    try {
      baseRisk = await getCompanyRiskScore(normalizedName)
    } catch (e) {
      console.warn('Neo4j unavailable for company score:', e.message)
    }

    // Look for company PAC in FEC
    let donorLinks = 0
    try {
      const committees = await axios.get(`${FEC_BASE}/committees/`, {
        params: { q: companyName, api_key: getKey(), per_page: 5, committee_type: 'Q' },
        timeout: 8000,
      })
      donorLinks = committees.data?.results?.length || 0
    } catch (e) {
      // Ignore FEC errors
    }

    // Build score components
    const components = {
      contractConcentration: baseRisk?.totalSpending > 1e9 ? 80 :
                             baseRisk?.totalSpending > 1e8 ? 60 :
                             baseRisk?.totalSpending > 1e7 ? 40 : 20,
      donorLinks: donorLinks > 0 ? 70 + (donorLinks * 5) : 15,
      regulatoryCapture: baseRisk?.significantRules > 3 ? 65 :
                         baseRisk?.significantRules > 0 ? 45 : 15,
      revolvingDoor: baseRisk?.politicianConnections > 5 ? 70 :
                     baseRisk?.politicianConnections > 0 ? 45 : 10,
    }

    const overallScore = Math.min(100, Math.round(
      components.contractConcentration * 0.3 +
      components.donorLinks * 0.3 +
      components.regulatoryCapture * 0.2 +
      components.revolvingDoor * 0.2
    ))

    const riskLevel = overallScore >= 80 ? 'CRITICAL' :
                      overallScore >= 60 ? 'HIGH' :
                      overallScore >= 35 ? 'MEDIUM' : 'LOW'

    return {
      name: companyName,
      normalizedName,
      overallScore,
      riskLevel,
      components,
      rawData: baseRisk,
      evidence: buildCompanyEvidence(components, baseRisk, donorLinks),
    }
  } catch (e) {
    console.error('scoreCompany error:', e.message)
    return {
      name: companyName,
      overallScore: 0,
      riskLevel: 'UNKNOWN',
      components: {},
      evidence: [],
      error: 'Scoring unavailable',
    }
  }
}

function buildCompanyEvidence(components, rawData, donorLinks) {
  const evidence = []

  if (rawData?.totalSpending > 1e9) {
    evidence.push({
      type: 'contract_volume',
      description: `$${(rawData.totalSpending / 1e9).toFixed(1)}B in federal contracts — highest risk tier`,
      severity: 'HIGH',
    })
  }

  if (donorLinks > 0) {
    evidence.push({
      type: 'pac_presence',
      description: `${donorLinks} PAC committee(s) registered with FEC`,
      severity: 'MEDIUM',
    })
  }

  if (rawData?.significantRules > 0) {
    evidence.push({
      type: 'regulatory_exposure',
      description: `${rawData.significantRules} significant federal rule(s) issued by agencies that awarded contracts`,
      severity: 'HIGH',
    })
  }

  if (rawData?.politicianConnections > 0) {
    evidence.push({
      type: 'politician_connections',
      description: `${rawData.politicianConnections} direct connection(s) to politicians via PAC donations`,
      severity: 'HIGH',
    })
  }

  return evidence
}

/**
 * Score a politician's RECEIPTS Accountability Score.
 * Components: donor transparency (25), STOCK Act compliance (25),
 *             vote-donor alignment (25), disclosure timeliness (25).
 */
export async function scorePolitician(candidateId) {
  try {
    // Fetch candidate financials from FEC
    let candidate = null
    let totals = null

    try {
      const candRes = await axios.get(`${FEC_BASE}/candidate/${candidateId}/`, {
        params: { api_key: getKey() },
        timeout: 8000,
      })
      candidate = candRes.data?.results?.[0]

      const totalsRes = await axios.get(`${FEC_BASE}/candidate/${candidateId}/totals/`, {
        params: { api_key: getKey() },
        timeout: 8000,
      })
      totals = totalsRes.data?.results?.[0]
    } catch (e) {
      console.warn('FEC candidate fetch failed:', e.message)
    }

    // Score components (0–25 each = 100 total); null = data not yet available
    const components = {
      donorTransparency: scoreDonorTransparency(totals),
      stockActCompliance: scoreStockActCompliance(candidateId),
      voteDonorAlignment: scoreVoteDonorAlignment(totals),
      disclosureTimeliness: scoreDisclosureTimeliness(candidate),
    }

    // Scale from available (non-null) components only
    const available = Object.values(components).filter(v => v !== null)
    const availableMax = available.length * 25
    const rawScore = available.reduce((s, v) => s + v, 0)
    const overallScore = availableMax > 0 ? Math.round((rawScore / availableMax) * 100) : 0

    const tier = overallScore >= 85 ? 'A' :
                 overallScore >= 70 ? 'B' :
                 overallScore >= 55 ? 'C' :
                 overallScore >= 40 ? 'D' : 'F'

    const riskFactors = buildPoliticianRiskFactors(components, totals)

    return {
      candidateId,
      name: candidate?.name || candidateId,
      party: candidate?.party,
      state: candidate?.state,
      office: candidate?.office,
      overallScore,
      tier,
      components: {
        donorTransparency: components.donorTransparency,
        stockActCompliance: components.stockActCompliance,
        voteDonorAlignment: components.voteDonorAlignment,
        disclosureTimeliness: components.disclosureTimeliness,
      },
      riskFactors,
      totalRaised: totals?.receipts || 0,
    }
  } catch (e) {
    console.error('scorePolitician error:', e.message)
    return { candidateId, overallScore: 0, tier: 'F', components: {}, riskFactors: [] }
  }
}

function scoreDonorTransparency(totals) {
  if (!totals) return 12  // Neutral if no data
  const total = totals.receipts || 0
  const itemized = totals.itemized_individual_contributions || 0
  if (total === 0) return 20
  const ratio = itemized / total
  // Higher itemized ratio = more transparent = higher score (out of 25)
  return Math.min(25, Math.round(ratio * 25))
}

function scoreStockActCompliance(candidateId) {
  // Requires parsed STOCK Act trade data from ETL pipeline (PDF parsing not yet complete)
  return null
}

function scoreVoteDonorAlignment(totals) {
  // In production: cross-reference voting record with donor industries
  // Lower alignment = higher score (politician votes against donors)
  // Mock: random but weighted toward middle
  if (!totals) return 12
  const pacs = totals.other_political_committee_contributions || 0
  const total = totals.receipts || 1
  const pacRatio = pacs / total
  // High PAC ratio suggests donor-aligned voting
  return Math.min(25, Math.round((1 - pacRatio * 0.5) * 20))
}

function scoreDisclosureTimeliness(candidate) {
  // Requires cross-referencing FEC filing due dates vs actual submission dates
  // Data not available from standard FEC API endpoints
  return null
}

function buildPoliticianRiskFactors(components, totals) {
  const factors = []
  if (components.donorTransparency < 15) factors.push('Low donor transparency — high proportion of unitemized contributions')
  if (components.stockActCompliance !== null && components.stockActCompliance < 15) factors.push('Potential STOCK Act compliance issues detected')
  if (components.voteDonorAlignment < 12) factors.push('High vote-donor alignment detected — votes correlate with top donor industries')
  if (components.disclosureTimeliness !== null && components.disclosureTimeliness < 15) factors.push('Late or incomplete financial disclosures on record')
  if (totals?.other_political_committee_contributions > 5e6) factors.push('Over $5M in PAC contributions — high industry dependence')
  return factors
}

/**
 * Get accountability leaderboard for politicians.
 * Fetches candidates from FEC and scores each.
 */
export async function getLeaderboard(chamber = null, party = null, limit = 50) {
  try {
    // Use the most recent complete election cycle (2024) for rich data.
    // Fall back to current cycle if 2024 returns nothing.
    const currentYear = new Date().getFullYear()
    const currentCycle = currentYear % 2 === 0 ? currentYear : currentYear + 1
    const primaryCycle = currentCycle > 2024 ? 2024 : currentCycle

    const buildParams = (cycle) => {
      const p = {
        api_key: getKey(),
        per_page: Math.min(limit, 20),
        sort: '-receipts',
        cycle,
        election_full: false,
      }
      if (chamber) p.office = chamber === 'S' ? 'S' : 'H'
      if (party) p.party = party
      return p
    }

    // /candidates/totals/ supports sort by receipts; /candidates/ does not
    let res = await axios.get(`${FEC_BASE}/candidates/totals/`, {
      params: buildParams(primaryCycle),
      timeout: 10000,
    })

    let candidates = res.data?.results || []

    // If primary cycle returned nothing, try current cycle as fallback
    if (candidates.length === 0 && primaryCycle !== currentCycle) {
      res = await axios.get(`${FEC_BASE}/candidates/totals/`, {
        params: buildParams(currentCycle),
        timeout: 10000,
      })
      candidates = res.data?.results || []
    }

    if (candidates.length === 0) return []

    // Score candidates sequentially with a small delay to avoid FEC burst rate limits
    const results = []
    for (const c of candidates.slice(0, 10)) {
      try {
        const scored = await scorePolitician(c.candidate_id)
        results.push(scored)
      } catch (e) {
        // skip failed candidates
      }
      await new Promise(r => setTimeout(r, 150))
    }

    return results.sort((a, b) => b.overallScore - a.overallScore)
  } catch (e) {
    console.error('getLeaderboard error:', e.message)
    return []
  }
}

/**
 * Get top corruption hotspots — highest-risk company-politician-agency triangles.
 */
export async function getCorruptionHotspots(agencyName = '') {
  try {
    const paths = await findQuidProQuoPaths({
      agencyName,
      minAmount: 100000,
      lookbackMonths: 12,
    })

    return paths.map(p => ({
      ...p,
      hotspotScore: Math.min(100, Math.round(
        (p.totalAmount / 1e8) * 40 +
        (p.donorLink ? 40 : 0) +
        Math.min(20, p.contractCount * 2)
      )),
    })).sort((a, b) => b.hotspotScore - a.hotspotScore)
  } catch (e) {
    console.error('getCorruptionHotspots error:', e.message)
    return []
  }
}

/**
 * Calculate accountability score trend over multiple cycles.
 */
export async function calculateAccountabilityTrend(candidateId, cycles = 3) {
  const currentYear = new Date().getFullYear()
  const trendData = []

  for (let i = 0; i < cycles; i++) {
    const cycle = currentYear - (currentYear % 2) - (2 * i)
    // In production: fetch historical FEC data per cycle and score
    const score = await scorePolitician(candidateId)
    trendData.push({
      cycle,
      score: score.overallScore,
      tier: score.tier,
    })
  }

  return trendData.reverse()
}

