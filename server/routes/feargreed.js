import express from 'express'

const router = express.Router()

// Proxy for CNN Fear & Greed to avoid browser CORS restrictions
router.get('/', async (req, res) => {
  try {
    const resp = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.cnn.com/markets/fear-and-greed',
      },
    })
    if (!resp.ok) return res.status(resp.status).json({ error: 'Upstream error' })
    const data = await resp.json()
    const fg = data?.fear_and_greed
    if (!fg) return res.status(502).json({ error: 'Unexpected response shape' })
    res.json({ score: Math.round(fg.score), rating: fg.rating })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

export default router
