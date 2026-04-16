// Federal spending routes.
// Dual read-path: SPENDING_SOURCE=supabase env var OR ?source=supabase per-request
// switches from the live USASpending.gov API to the Supabase bulk-ingest tables.
// Default remains live API until backfill is verified.

import { Router } from 'express'
import { searchContracts as liveContracts, searchGrants as liveGrants, getAgencySpending as liveAgency } from '../services/usaSpending.js'
import {
  searchContracts as sbContracts,
  searchGrants as sbGrants,
  getAgencySpending as sbAgency,
  getDisbursements,
  getIndependentExpenditures,
  getLobbyistBundles,
} from '../services/supabaseSpending.js'

const router = Router()

// Feature flag: env sets default, per-request ?source= overrides
const DEFAULT_SOURCE = process.env.SPENDING_SOURCE || 'usaspending'

function useSupabase(req) {
  const src = req.query.source || DEFAULT_SOURCE
  return src === 'supabase'
}

// ─── /contracts ───────────────────────────────────────────────────────────────

router.get('/contracts', async (req, res) => {
  try {
    const { keyword, agency, limit, fiscal_year } = req.query
    let data
    if (useSupabase(req)) {
      data = await sbContracts({ keyword, agency, limit: parseInt(limit) || 10, fiscalYear: fiscal_year })
    } else {
      data = await liveContracts({ keyword, agency, limit: parseInt(limit) || 10 })
    }
    const fiscalYear = data.length > 0 && data[0].fiscalYear ? data[0].fiscalYear : null
    res.json({ success: true, data, fiscalYear, count: data.length })
  } catch (e) {
    console.error('spending/contracts error:', e.message)
    res.status(500).json({ success: false, error: 'Failed to fetch contract data' })
  }
})

// ─── /grants ─────────────────────────────────────────────────────────────────

router.get('/grants', async (req, res) => {
  try {
    const { keyword, limit, fiscal_year } = req.query
    let data
    if (useSupabase(req)) {
      data = await sbGrants({ keyword, limit: parseInt(limit) || 10, fiscalYear: fiscal_year })
    } else {
      data = await liveGrants({ keyword, limit: parseInt(limit) || 10 })
    }
    res.json({ success: true, data })
  } catch (e) {
    console.error('spending/grants error:', e.message)
    res.status(500).json({ success: false, error: 'Failed to fetch grants data' })
  }
})

// ─── /agency ─────────────────────────────────────────────────────────────────

router.get('/agency', async (req, res) => {
  try {
    const { year } = req.query
    let data
    if (useSupabase(req)) {
      data = await sbAgency(year ? parseInt(year) : null)
    } else {
      data = await liveAgency(year ? parseInt(year) : null)
    }
    res.json({ success: true, data })
  } catch (e) {
    console.error('spending/agency error:', e.message)
    res.status(500).json({ success: false, error: 'Failed to fetch agency spending data' })
  }
})

// ─── /disbursements (Supabase-only — oppexp hot tier, Story A) ────────────────

router.get('/disbursements', async (req, res) => {
  try {
    const { committee_id, cycle, recipient, min_amount, limit, offset } = req.query
    const data = await getDisbursements({
      committeeId:   committee_id,
      cycle:         cycle ? Number(cycle) : undefined,
      recipientName: recipient,
      minAmount:     min_amount ? Number(min_amount) : 2000,
      limit:         parseInt(limit)  || 50,
      offset:        parseInt(offset) || 0,
    })
    res.json({ success: true, data, count: data.length })
  } catch (e) {
    console.error('spending/disbursements error:', e.message)
    res.status(500).json({ success: false, error: 'Failed to fetch disbursement data' })
  }
})

// ─── /independent-expenditures (Supabase-only — Story F) ─────────────────────

router.get('/independent-expenditures', async (req, res) => {
  try {
    const { candidate_id, committee_id, cycle, limit, offset } = req.query
    const data = await getIndependentExpenditures({
      candidateId: candidate_id,
      committeeId: committee_id,
      cycle:       cycle ? Number(cycle) : undefined,
      limit:       parseInt(limit)  || 100,
      offset:      parseInt(offset) || 0,
    })
    res.json({ success: true, data, count: data.length })
  } catch (e) {
    console.error('spending/independent-expenditures error:', e.message)
    res.status(500).json({ success: false, error: 'Failed to fetch IE data' })
  }
})

// ─── /lobbyist-bundles (Supabase-only — Story D) ─────────────────────────────

router.get('/lobbyist-bundles', async (req, res) => {
  try {
    const { candidate_id, committee_id, cycle, limit, offset } = req.query
    const data = await getLobbyistBundles({
      candidateId: candidate_id,
      committeeId: committee_id,
      cycle:       cycle ? Number(cycle) : undefined,
      limit:       parseInt(limit)  || 100,
      offset:      parseInt(offset) || 0,
    })
    res.json({ success: true, data, count: data.length })
  } catch (e) {
    console.error('spending/lobbyist-bundles error:', e.message)
    res.status(500).json({ success: false, error: 'Failed to fetch lobbyist bundle data' })
  }
})

export default router
