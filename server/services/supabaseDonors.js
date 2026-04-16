/**
 * Supabase-backed donor/committee/candidate queries.
 * Reads from bulk-ingested FEC tables (politicians, pac_committees,
 * candidate_totals, contributions, committee_transfers, money_flow_edges).
 *
 * Used by server/routes/donors.js when DONOR_SOURCE=supabase (or ?source=supabase).
 * Coexists with services/fec.js (live FEC API) so the cutover is a flag flip.
 */
import { supabase } from '../lib/supabase.js'

function ensure() {
  if (!supabase) throw new Error('Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)')
  return supabase
}

// ─── Candidates ───────────────────────────────────────────────────────────────

/**
 * Search politicians, optionally joined with candidate_totals for a given cycle
 * so the same candidate appears once per cycle they filed in.
 */
export async function searchCandidates({ name, office, state, party, cycle, limit = 100, offset = 0 }) {
  const db = ensure()

  // Two-step: filter politicians, then hydrate with candidate_totals for the
  // returned page. No FK between politicians.fec_candidate_id and
  // candidate_totals.candidate_id, so PostgREST embed isn't available.
  let q = db
    .from('politicians')
    .select('fec_candidate_id, name, party, state, district, chamber, office, in_office, next_election', { count: 'exact' })
  if (name)   q = q.ilike('name', `%${name}%`)
  if (office) q = q.ilike('office', `%${office}%`)
  if (state)  q = q.eq('state', state.toUpperCase())
  if (party)  q = q.eq('party', party.toUpperCase())
  q = q.order('name', { ascending: true }).range(offset, offset + limit - 1)

  const { data: pols, error, count } = await q
  if (error) throw new Error(`searchCandidates: ${error.message}`)
  if (!pols || pols.length === 0) return { results: [], pagination: { count: count || 0, limit, offset } }

  const ids = pols.map(p => p.fec_candidate_id).filter(Boolean)
  let tq = db.from('candidate_totals').select('*').in('candidate_id', ids)
  if (cycle) tq = tq.eq('cycle', Number(cycle))
  const { data: totals, error: tErr } = await tq
  if (tErr) throw new Error(`searchCandidates/totals: ${tErr.message}`)

  const byId = new Map()
  for (const t of totals || []) {
    if (!byId.has(t.candidate_id)) byId.set(t.candidate_id, [])
    byId.get(t.candidate_id).push(t)
  }

  // Emit one row per (candidate, cycle). If no totals row exists, emit once with cycle=null.
  const rows = []
  for (const p of pols) {
    const list = byId.get(p.fec_candidate_id) || []
    if (list.length === 0) {
      rows.push({ ...p, cycle: null, totals: null })
    } else {
      for (const t of list) rows.push({ ...p, cycle: t.cycle, totals: t })
    }
  }

  return { results: rows, pagination: { count, limit, offset } }
}

export async function getCandidateRaisedTotals(candidateId) {
  const db = ensure()
  const { data, error } = await db
    .from('candidate_totals')
    .select('*')
    .eq('candidate_id', candidateId)
    .order('cycle', { ascending: false })
  if (error) throw new Error(`getCandidateRaisedTotals: ${error.message}`)
  return { results: data || [] }
}

export async function getCandidateContributions(candidateId, limit = 50, minAmount = 1000, offset = 0) {
  const db = ensure()
  const { data, error, count } = await db
    .from('contributions')
    .select('*', { count: 'exact' })
    .eq('candidate_id', candidateId)
    .gte('amount', minAmount)
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw new Error(`getCandidateContributions: ${error.message}`)
  return { results: data || [], pagination: { count, limit, offset } }
}

// ─── Committees ───────────────────────────────────────────────────────────────

export async function searchCommittees({ keyword, cycle, limit = 100, offset = 0 }) {
  const db = ensure()
  let q = db
    .from('pac_committees')
    .select('*', { count: 'exact' })
    .order('total_receipts', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)
  if (keyword) q = q.ilike('name', `%${keyword}%`)
  if (cycle)   q = q.eq('cycle', Number(cycle))
  const { data, error, count } = await q
  if (error) throw new Error(`searchCommittees: ${error.message}`)
  return { results: data || [], pagination: { count, limit, offset } }
}

export async function getCommitteeContributions(committeeId, limit = 50, minAmount = 1000, offset = 0) {
  const db = ensure()
  const { data, error, count } = await db
    .from('contributions')
    .select('*', { count: 'exact' })
    .eq('committee_id', committeeId)
    .gte('amount', minAmount)
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw new Error(`getCommitteeContributions: ${error.message}`)
  return { results: data || [], pagination: { count, limit, offset } }
}

// ─── Donor-side aggregates ────────────────────────────────────────────────────

export async function getTopDonorsByEmployer(employer, limit = 20, cycle = null) {
  const db = ensure()
  let q = db
    .from('contributions')
    .select('contributor_name, contributor_employer, contributor_occupation, amount, date, candidate_id, committee_id')
    .ilike('contributor_employer', `%${employer}%`)
    .order('amount', { ascending: false })
    .limit(limit)
  if (cycle) {
    q = q.gte('date', `${cycle - 1}-01-01`).lte('date', `${cycle}-12-31`)
  }
  const { data, error } = await q
  if (error) throw new Error(`getTopDonorsByEmployer: ${error.message}`)
  return { results: data || [] }
}

// ─── Money-flow (Sankey) ──────────────────────────────────────────────────────

/**
 * Read edges from the money_flow_edges materialized view for the Sankey.
 * Filters by cycle + optional tier/node.
 */
export async function getMoneyFlow({ cycle, sourceTier, targetTier, nodeId, nodeType, minAmount = 0, limit = 500 }) {
  const db = ensure()
  let q = db
    .from('money_flow_edges')
    .select('*')
    .gte('amount', minAmount)
    .order('amount', { ascending: false })
    .limit(limit)
  if (cycle)      q = q.eq('cycle', Number(cycle))
  if (sourceTier) q = q.eq('source_tier', Number(sourceTier))
  if (targetTier) q = q.eq('target_tier', Number(targetTier))
  if (nodeId && nodeType) {
    // Match edges touching this node on either end
    q = q.or(`and(source_id.eq.${nodeId},source_type.eq.${nodeType}),and(target_id.eq.${nodeId},target_type.eq.${nodeType})`)
  }
  const { data, error } = await q
  if (error) throw new Error(`getMoneyFlow: ${error.message}`)
  return { edges: data || [] }
}
