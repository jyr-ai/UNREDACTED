import { Router } from 'express'
import { searchContracts as liveSearchContracts, searchGrants as liveSearchGrants, getAgencySpending as liveGetAgencySpending } from '../services/usaSpending.js'
import * as sbSpending from '../services/supabaseSpending.js'

const router = Router()

const DEFAULT_SOURCE = (process.env.SPENDING_SOURCE || 'usaspending').toLowerCase()
function useSupabase(req) {
  return (req.query.source || DEFAULT_SOURCE).toString().toLowerCase() === 'supabase'
}

router.get('/contracts', async (req, res) => {
  try {
    const { keyword, agency, limit, fiscal_year } = req.query
    if (useSupabase(req)) {
      const data = await sbSpending.searchContracts({ keyword, agency, limit: parseInt(limit) || 50, fiscalYear: fiscal_year })
      return res.json({ success: true, source: 'supabase', data })
    }
    const data = await liveSearchContracts({ keyword, agency, limit: parseInt(limit) || 10 })
    const fiscalYear = data.length > 0 && data[0].fiscalYear ? data[0].fiscalYear : null
    res.json({ success: true, source: 'usaspending', data, fiscalYear, count: data.length })
  } catch (e) {
    console.error('spending/contracts error:', e.message)
    res.status(500).json({ success: false, error: 'Failed to fetch contract data' })
  }
})

router.get('/grants', async (req, res) => {
  try {
    const { keyword, limit } = req.query
    if (useSupabase(req)) {
      const data = await sbSpending.searchGrants({ keyword, limit: parseInt(limit) || 50 })
      return res.json({ success: true, source: 'supabase', data })
    }
    const data = await liveSearchGrants({ keyword, limit: parseInt(limit) || 10 })
    res.json({ success: true, source: 'usaspending', data })
  } catch (e) {
    console.error('spending/grants error:', e.message)
    res.status(500).json({ success: false, error: 'Failed to fetch grants data' })
  }
})

router.get('/agency', async (req, res) => {
  try {
    const { year } = req.query
    if (useSupabase(req)) {
      const data = await sbSpending.getAgencySpending(year ? parseInt(year) : null)
      return res.json({ success: true, source: 'supabase', data })
    }
    const data = await liveGetAgencySpending(year ? parseInt(year) : null)
    res.json({ success: true, source: 'usaspending', data })
  } catch (e) {
    console.error('spending/agency error:', e.message)
    res.status(500).json({ success: false, error: 'Failed to fetch agency spending data' })
  }
})

// ─── Story A: Self-Dealing — disbursements from a campaign committee ──────────
router.get('/disbursements', async (req, res) => {
  try {
    const { committee_id, cycle, recipient, min_amount, limit, offset } = req.query
    const data = await sbSpending.getDisbursements({
      committeeId:   committee_id,
      cycle:         cycle ? Number(cycle) : undefined,
      recipientName: recipient,
      minAmount:     min_amount ? Number(min_amount) : 2000,
      limit:         parseInt(limit)  || 50,
      offset:        parseInt(offset) || 0,
    })
    res.json({ success: true, source: 'supabase', ...data })
  } catch (e) {
    console.error('spending/disbursements error:', e.message)
    res.status(500).json({ success: false, error: e.message })
  }
})

// ─── Story B: Pay-to-Play — contractor donations adjacent to contract awards ──
router.get('/pay-to-play', async (req, res) => {
  try {
    const { company, limit } = req.query
    if (!company) return res.status(400).json({ success: false, error: 'company parameter required' })
    const data = await sbSpending.getPayToPlayMatches({ company, limit: parseInt(limit) || 20 })
    res.json({ success: true, source: 'supabase', ...data })
  } catch (e) {
    console.error('spending/pay-to-play error:', e.message)
    res.status(500).json({ success: false, error: e.message })
  }
})

export default router
