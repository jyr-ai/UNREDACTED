import { Router } from 'express'
import { getMembersByState, getBillsByState, getRecentVotes } from '../services/congressGov.js'

const router = Router()

router.get('/bills', async (req, res) => {
  try {
    const { state, limit } = req.query
    const data = await getBillsByState(state || 'CA', parseInt(limit) || 20)
    res.json({ success: true, data })
  } catch (e) {
    console.error('congress/bills error:', e.message)
    res.status(500).json({ success: false, error: e.message })
  }
})

router.get('/votes', async (req, res) => {
  try {
    const { chamber, limit } = req.query
    const data = await getRecentVotes(chamber || 'senate', parseInt(limit) || 20)
    res.json({ success: true, data })
  } catch (e) {
    console.error('congress/votes error:', e.message)
    res.status(500).json({ success: false, error: e.message })
  }
})

router.get('/members', async (req, res) => {
  try {
    const { state } = req.query
    if (!state) return res.status(400).json({ success: false, error: 'state parameter required' })
    const data = await getMembersByState(state)
    res.json({ success: true, data })
  } catch (e) {
    console.error('congress/members error:', e.message)
    res.status(500).json({ success: false, error: e.message })
  }
})

export default router
