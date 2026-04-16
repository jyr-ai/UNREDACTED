// Supabase read-path for spending + accountability data.
// Activated by SPENDING_SOURCE=supabase env var or ?source=supabase per-request.
// Mirrors the usaSpending.js interface so routes can swap without refactor.

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
)

// ─── Contracts ────────────────────────────────────────────────────────────────

/**
 * Search federal contracts by recipient name or description keyword.
 * Maps to the FEC pay-to-play story (B): contracts × donor employer cross-join.
 */
export async function searchContracts({ keyword, agency, limit = 10, offset = 0, fiscalYear } = {}) {
  let q = supabase
    .from('contracts')
    .select('award_id, recipient_name, recipient_state, awarding_agency, sub_agency, action_date, fiscal_year, amount, total_value, award_type, naics_code, naics_description, description')
    .order('amount', { ascending: false })
    .range(offset, offset + limit - 1)

  if (keyword) q = q.or(`recipient_name.ilike.%${keyword}%,description.ilike.%${keyword}%`)
  if (agency)  q = q.ilike('awarding_agency', `%${agency}%`)
  if (fiscalYear) q = q.eq('fiscal_year', Number(fiscalYear))

  const { data, error } = await q
  if (error) throw new Error(`supabaseSpending.searchContracts: ${error.message}`)

  return (data || []).map(r => ({
    id:           r.award_id,
    recipientName:r.recipient_name,
    state:        r.recipient_state,
    agency:       r.awarding_agency,
    subAgency:    r.sub_agency,
    date:         r.action_date,
    fiscalYear:   r.fiscal_year,
    amount:       Number(r.amount || 0),
    totalValue:   Number(r.total_value || 0),
    awardType:    r.award_type,
    naicsCode:    r.naics_code,
    description:  r.description,
  }))
}

/**
 * Search federal grants/assistance.
 */
export async function searchGrants({ keyword, agency, limit = 10, offset = 0, fiscalYear } = {}) {
  let q = supabase
    .from('grants')
    .select('award_id, recipient_name, recipient_state, awarding_agency, action_date, fiscal_year, amount, total_amount, award_type, assistance_type, cfda_number, cfda_title')
    .order('amount', { ascending: false })
    .range(offset, offset + limit - 1)

  if (keyword)    q = q.ilike('recipient_name', `%${keyword}%`)
  if (agency)     q = q.ilike('awarding_agency', `%${agency}%`)
  if (fiscalYear) q = q.eq('fiscal_year', Number(fiscalYear))

  const { data, error } = await q
  if (error) throw new Error(`supabaseSpending.searchGrants: ${error.message}`)

  return (data || []).map(r => ({
    id:            r.award_id,
    recipientName: r.recipient_name,
    state:         r.recipient_state,
    agency:        r.awarding_agency,
    date:          r.action_date,
    fiscalYear:    r.fiscal_year,
    amount:        Number(r.amount || 0),
    totalAmount:   Number(r.total_amount || 0),
    assistanceType:r.assistance_type,
    cfdaNumber:    r.cfda_number,
    cfdaTitle:     r.cfda_title,
  }))
}

/**
 * Aggregate spend by agency for a fiscal year.
 */
export async function getAgencySpending(fiscalYear) {
  const { data, error } = await supabase
    .from('contracts')
    .select('awarding_agency, amount.sum()')
    .eq('fiscal_year', fiscalYear || new Date().getFullYear())
    .order('sum', { ascending: false })
    .limit(50)

  if (error) throw new Error(`supabaseSpending.getAgencySpending: ${error.message}`)
  return (data || []).map(r => ({ agency: r.awarding_agency, totalSpend: Number(r.sum || 0) }))
}

// ─── Disbursements (self-dealing, Story A) ────────────────────────────────────

/**
 * Get disbursements for a committee, optionally filtered by recipient name or category.
 * Used by the self-dealing screen.
 */
export async function getDisbursements({ committeeId, cycle, recipientName, minAmount = 0, limit = 50, offset = 0 } = {}) {
  let q = supabase
    .from('disbursements_detail')
    .select('sub_id, committee_id, cycle, recipient_name, recipient_city, recipient_state, disbursement_date, disbursement_amount, disbursement_description, purpose_category, purpose_category_desc')
    .gte('disbursement_amount', minAmount)
    .order('disbursement_amount', { ascending: false })
    .range(offset, offset + limit - 1)

  if (committeeId)   q = q.eq('committee_id', committeeId)
  if (cycle)         q = q.eq('cycle', Number(cycle))
  if (recipientName) q = q.ilike('recipient_name', `%${recipientName}%`)

  const { data, error } = await q
  if (error) throw new Error(`supabaseSpending.getDisbursements: ${error.message}`)
  return data || []
}

// ─── Independent Expenditures (Story F) ───────────────────────────────────────

/**
 * Get IEs for a candidate or committee.
 */
export async function getIndependentExpenditures({ candidateId, committeeId, cycle, limit = 100, offset = 0 } = {}) {
  let q = supabase
    .from('independent_expenditures')
    .select('sub_id, committee_id, candidate_id, support_oppose, expenditure_date, expenditure_amount, payee_name, purpose, cycle')
    .order('expenditure_amount', { ascending: false })
    .range(offset, offset + limit - 1)

  if (candidateId)  q = q.eq('candidate_id', candidateId)
  if (committeeId)  q = q.eq('committee_id', committeeId)
  if (cycle)        q = q.eq('cycle', Number(cycle))

  const { data, error } = await q
  if (error) throw new Error(`supabaseSpending.getIndependentExpenditures: ${error.message}`)
  return data || []
}

// ─── Lobbyist Bundles (Story D) ───────────────────────────────────────────────

/**
 * Get lobbyist bundling records for a candidate or committee.
 */
export async function getLobbyistBundles({ candidateId, committeeId, cycle, limit = 100, offset = 0 } = {}) {
  let q = supabase
    .from('lobbyist_bundles')
    .select('sub_id, committee_id, candidate_id, lobbyist_name, lobbyist_registrant_id, bundled_amount, report_period, cycle')
    .order('bundled_amount', { ascending: false })
    .range(offset, offset + limit - 1)

  if (candidateId) q = q.eq('candidate_id', candidateId)
  if (committeeId) q = q.eq('committee_id', committeeId)
  if (cycle)       q = q.eq('cycle', Number(cycle))

  const { data, error } = await q
  if (error) throw new Error(`supabaseSpending.getLobbyistBundles: ${error.message}`)
  return data || []
}
