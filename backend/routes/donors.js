import { Router } from 'express'
import { searchCommittees, getCommitteeReceipts, searchCandidates, getCandidateRaisedTotals } from '../services/fec.js'

const router = Router()

router.get('/committees', async (req, res) => {
  try {
    const { keyword, limit } = req.query
    if (!keyword) return res.status(400).json({ success: false, error: 'keyword parameter required' })
    const data = await searchCommittees({ keyword, limit: parseInt(limit) || 10 })
    res.json({ success: true, data })
  } catch (e) {
    console.error('donors/committees error:', e.message)
    res.status(500).json({ success: false, error: 'Failed to fetch committee data' })
  }
})

router.get('/committees/:id/receipts', async (req, res) => {
  try {
    const { limit } = req.query
    const data = await getCommitteeReceipts(req.params.id, parseInt(limit) || 20)
    res.json({ success: true, data })
  } catch (e) {
    console.error('donors/receipts error:', e.message)
    res.status(500).json({ success: false, error: 'Failed to fetch committee receipts' })
  }
})

router.get('/candidates', async (req, res) => {
  try {
    const { name, office, state, limit, cycle } = req.query
    const data = await searchCandidates({ name, office, state, limit: parseInt(limit) || 10, cycle })
    res.json({ success: true, data })
  } catch (e) {
    console.error('donors/candidates error:', e.message)
    res.status(500).json({ success: false, error: 'Failed to fetch candidates' })
  }
})

router.get('/candidates/:id/totals', async (req, res) => {
  try {
    const data = await getCandidateRaisedTotals(req.params.id)
    res.json({ success: true, data })
  } catch (e) {
    console.error('donors/totals error:', e.message)
    res.status(500).json({ success: false, error: 'Failed to fetch candidate totals' })
  }
})

export default router
