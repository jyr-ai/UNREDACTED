/**
 * Supabase-backed spending queries.
 * Reads from bulk-ingested USASpending + FEC spending tables:
 * contracts, grants, disbursements_detail.
 *
 * Used by server/routes/spending.js when SPENDING_SOURCE=supabase.
 */
import { supabase } from '../lib/supabase.js'

function ensure() {
  if (!supabase) throw new Error('Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)')
  return supabase
}

// ─── Contracts ────────────────────────────────────────────────────────────────

export async function searchContracts({ keyword, agency, limit = 50, offset = 0, fiscalYear }) {
  const db = ensure()
  let q = db
    .from('contracts')
    .select('*', { count: 'exact' })
    .order('award_amount', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)
  if (keyword)    q = q.ilike('recipient_name', `%${keyword}%`)
  if (agency)     q = q.ilike('awarding_agency_name', `%${agency}%`)
  if (fiscalYear) q = q.eq('fiscal_year', Number(fiscalYear))
  const { data, error, count } = await q
  if (error) throw new Error(`searchContracts: ${error.message}`)
  return { results: data || [], pagination: { count, limit, offset } }
}

export async function searchGrants({ keyword, agency, limit = 50, offset = 0, fiscalYear }) {
  const db = ensure()
  let q = db
    .from('grants')
    .select('*', { count: 'exact' })
    .order('award_amount', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)
  if (keyword)    q = q.ilike('recipient_name', `%${keyword}%`)
  if (agency)     q = q.ilike('awarding_agency_name', `%${agency}%`)
  if (fiscalYear) q = q.eq('fiscal_year', Number(fiscalYear))
  const { data, error, count } = await q
  if (error) throw new Error(`searchGrants: ${error.message}`)
  return { results: data || [], pagination: { count, limit, offset } }
}

export async function getAgencySpending(fiscalYear) {
  const db = ensure()
  const { data, error } = await db
    .from('contracts')
    .select('awarding_agency_name, award_amount')
    .eq('fiscal_year', fiscalYear || new Date().getFullYear())
  if (error) throw new Error(`getAgencySpending: ${error.message}`)

  const byAgency = new Map()
  for (const row of (data || [])) {
    const agency = row.awarding_agency_name || 'Unknown'
    byAgency.set(agency, (byAgency.get(agency) || 0) + (row.award_amount || 0))
  }
  return Object.fromEntries(
    [...byAgency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
  )
}

// ─── Disbursements (Story A — Self-Dealing) ───────────────────────────────────

/**
 * Campaign committee disbursements from FEC Schedule B (oppexp bulk file).
 * Used to surface self-dealing patterns — payments to candidate-affiliated vendors.
 */
export async function getDisbursements({ committeeId, cycle, recipientName, minAmount = 2000, limit = 50, offset = 0 }) {
  const db = ensure()
  let q = db
    .from('disbursements_detail')
    .select('*', { count: 'exact' })
    .gte('disbursement_amount', minAmount)
    .order('disbursement_amount', { ascending: false })
    .range(offset, offset + limit - 1)
  if (committeeId)   q = q.eq('committee_id', committeeId)
  if (cycle)         q = q.eq('cycle', Number(cycle))
  if (recipientName) q = q.ilike('recipient_name', `%${recipientName}%`)
  const { data, error, count } = await q
  if (error) throw new Error(`getDisbursements: ${error.message}`)
  return { results: data || [], pagination: { count, limit, offset } }
}

// ─── Pay-to-Play (Story B) ────────────────────────────────────────────────────

/**
 * Find donation→contract timelines for a company.
 * Cross-references FEC contributions (contributor_employer) against
 * federal contracts (recipient_name) and returns matches where a donation
 * preceded a contract award within 12 months.
 */
export async function getPayToPlayMatches({ company, limit = 20 }) {
  const db = ensure()
  if (!company) throw new Error('company parameter required')

  const [contribRes, contractRes] = await Promise.all([
    db
      .from('contributions')
      .select('contributor_employer, contributor_name, amount, date, candidate_id, committee_id')
      .ilike('contributor_employer', `%${company}%`)
      .order('amount', { ascending: false })
      .limit(limit * 5),
    db
      .from('contracts')
      .select('recipient_name, award_amount, period_of_performance_start_date, awarding_agency_name')
      .ilike('recipient_name', `%${company}%`)
      .order('award_amount', { ascending: false })
      .limit(limit * 3),
  ])

  if (contribRes.error) throw new Error(`getPayToPlayMatches/contribs: ${contribRes.error.message}`)
  if (contractRes.error) throw new Error(`getPayToPlayMatches/contracts: ${contractRes.error.message}`)

  const contribs = contribRes.data || []
  const contracts = contractRes.data || []

  if (contracts.length === 0 || contribs.length === 0) {
    return { matches: [], contractCount: contracts.length, donationCount: contribs.length }
  }

  // Cross-reference: find donations within 365 days before each contract
  const matches = []
  for (const contract of contracts) {
    const contractDate = new Date(contract.period_of_performance_start_date)
    if (isNaN(contractDate.getTime())) continue
    const oneYearBefore = new Date(contractDate.getTime() - 365 * 24 * 60 * 60 * 1000)

    for (const donation of contribs) {
      const donDate = new Date(donation.date)
      if (isNaN(donDate.getTime())) continue
      if (donDate >= oneYearBefore && donDate <= contractDate) {
        const daysBefore = Math.round((contractDate - donDate) / (24 * 60 * 60 * 1000))
        matches.push({
          company: contract.recipient_name,
          contractAmount: contract.award_amount,
          contractDate: contract.period_of_performance_start_date,
          agency: contract.awarding_agency_name,
          donorName: donation.contributor_name,
          donorEmployer: donation.contributor_employer,
          donationAmount: donation.amount,
          donationDate: donation.date,
          candidateId: donation.candidate_id,
          committeeId: donation.committee_id,
          daysBefore,
        })
      }
    }
  }

  // Deduplicate by (contractDate, donationDate) and sort by contract amount
  const seen = new Set()
  const deduped = matches.filter(m => {
    const key = `${m.contractDate}|${m.donationDate}|${m.donorName}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  deduped.sort((a, b) => b.contractAmount - a.contractAmount)

  return { matches: deduped.slice(0, limit), contractCount: contracts.length, donationCount: contribs.length }
}
