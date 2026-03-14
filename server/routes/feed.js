import { Router } from 'express'
import { getSpendingNews, getCategoryFeed, getAllFeeds, FEED_CATEGORIES } from '../services/rssFeed.js'

const router = Router()

// ── GET /api/feed/spending-news?limit=12  (legacy — kept for Ticker) ─────────
router.get('/spending-news', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 12, 30)
    const result = await getSpendingNews({ limit })
    res.json({ success: true, ...result })
  } catch (e) {
    console.error('feed/spending-news error:', e.message)
    res.status(500).json({ success: false, error: 'Failed to fetch spending news feed' })
  }
})

// ── GET /api/feed/corruption-news?limit=15 ────────────────────────────────────
router.get('/corruption-news', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 15, 40)
    const result = await getCategoryFeed('CORRUPTION', { limit })
    res.json({ success: true, ...result })
  } catch (e) {
    console.error('feed/corruption-news error:', e.message)
    res.status(500).json({ success: false, error: 'Failed to fetch corruption news feed' })
  }
})

// ── GET /api/feed/sec-filings?limit=15 ───────────────────────────────────────
router.get('/sec-filings', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 15, 40)
    const result = await getCategoryFeed('SEC_FILING', { limit })
    res.json({ success: true, ...result })
  } catch (e) {
    console.error('feed/sec-filings error:', e.message)
    res.status(500).json({ success: false, error: 'Failed to fetch SEC filings feed' })
  }
})

// ── GET /api/feed/fec-campaign?limit=15 ──────────────────────────────────────
router.get('/fec-campaign', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 15, 40)
    const result = await getCategoryFeed('FEC_CAMPAIGN', { limit })
    res.json({ success: true, ...result })
  } catch (e) {
    console.error('feed/fec-campaign error:', e.message)
    res.status(500).json({ success: false, error: 'Failed to fetch FEC campaign feed' })
  }
})

// ── GET /api/feed/stock-act?limit=15 ─────────────────────────────────────────
router.get('/stock-act', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 15, 40)
    const result = await getCategoryFeed('STOCK_ACT', { limit })
    res.json({ success: true, ...result })
  } catch (e) {
    console.error('feed/stock-act error:', e.message)
    res.status(500).json({ success: false, error: 'Failed to fetch STOCK Act feed' })
  }
})

// ── GET /api/feed/politician-spending?limit=15 ───────────────────────────────
router.get('/politician-spending', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 15, 40)
    const result = await getCategoryFeed('POLITICIAN_SPEND', { limit })
    res.json({ success: true, ...result })
  } catch (e) {
    console.error('feed/politician-spending error:', e.message)
    res.status(500).json({ success: false, error: 'Failed to fetch politician spending feed' })
  }
})

// ── GET /api/feed/dark-money?limit=15 ────────────────────────────────────────
router.get('/dark-money', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 15, 40)
    const result = await getCategoryFeed('DARK_MONEY', { limit })
    res.json({ success: true, ...result })
  } catch (e) {
    console.error('feed/dark-money error:', e.message)
    res.status(500).json({ success: false, error: 'Failed to fetch dark money feed' })
  }
})

// ── GET /api/feed/all?limit=30&category=CORRUPTION  (aggregated) ─────────────
router.get('/all', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 60)
    const category = req.query.category || null
    // Validate category if provided
    if (category && !FEED_CATEGORIES[category]) {
      return res.status(400).json({
        success: false,
        error: `Unknown category. Valid categories: ${Object.keys(FEED_CATEGORIES).join(', ')}`,
      })
    }
    const result = await getAllFeeds({ limit, category })
    res.json({ success: true, ...result })
  } catch (e) {
    console.error('feed/all error:', e.message)
    res.status(500).json({ success: false, error: 'Failed to fetch aggregated feeds' })
  }
})

// ── GET /api/feed/categories  (list of available categories) ─────────────────
router.get('/categories', (_req, res) => {
  const categories = Object.entries(FEED_CATEGORIES).map(([key, def]) => ({
    key,
    label: def.label,
    color: def.color,
    icon: def.icon,
    sourceCount: def.sources.length,
  }))
  res.json({ success: true, categories })
})

export default router
