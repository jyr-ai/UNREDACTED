import { Router } from 'express'
import { searchRules, getRecentSignificantRules, getExecutiveOrders, getProposedRules } from '../services/federalRegister.js'
import { searchDockets } from '../services/regulationsGov.js'

const router = Router()

router.get('/rules', async (req, res) => {
  try {
    const { keyword, agency, dateFrom, limit } = req.query
    const data = await searchRules({ keyword, agency, dateFrom, limit: parseInt(limit) || 10 })
    res.json({ success: true, data })
  } catch (e) {
    console.error('policy/rules error:', e.message)
    res.status(500).json({ success: false, error: 'Failed to fetch policy rules' })
  }
})

router.get('/significant', async (req, res) => {
  try {
    const { limit } = req.query
    const data = await getRecentSignificantRules(parseInt(limit) || 20)
    res.json({ success: true, data })
  } catch (e) {
    console.error('policy/significant error:', e.message)
    res.status(500).json({ success: false, error: 'Failed to fetch significant rules' })
  }
})

router.get('/executive-orders', async (req, res) => {
  try {
    const { limit } = req.query
    const data = await getExecutiveOrders(parseInt(limit) || 30)
    res.json({ success: true, data })
  } catch (e) {
    console.error('policy/executive-orders error:', e.message)
    res.status(500).json({ success: false, error: 'Failed to fetch executive orders' })
  }
})

router.get('/rulemaking', async (req, res) => {
  try {
    const { keyword, limit } = req.query
    const [proposed, dockets] = await Promise.allSettled([
      getProposedRules(parseInt(limit) || 20, keyword),
      searchDockets({ keyword: keyword || 'proposed rule', limit: parseInt(limit) || 10 }),
    ])
    res.json({
      success: true,
      data: {
        proposed: proposed.status === 'fulfilled' ? proposed.value : [],
        dockets:  dockets.status  === 'fulfilled' ? dockets.value  : [],
      },
    })
  } catch (e) {
    console.error('policy/rulemaking error:', e.message)
    res.status(500).json({ success: false, error: 'Failed to fetch rulemaking data' })
  }
})

export default router
