import { Router } from 'express'
import axios from 'axios'

const router = Router()

const UPSTREAM = 'https://meta-trials.vercel.app/api/conflict'

// GET /api/conflict
// Proxies the meta-trials conflict stats API so the browser avoids
// any cross-origin restrictions on the external endpoint.
router.get('/', async (req, res) => {
  try {
    const { data } = await axios.get(UPSTREAM, { timeout: 15000 })
    // Only forward the `damage` field the frontend needs
    res.json({ damage: data.damage ?? null })
  } catch (e) {
    console.error('conflict proxy error:', e.message)
    res.status(502).json({ success: false, error: 'Failed to fetch conflict data' })
  }
})

export default router
