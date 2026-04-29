/**
 * server/routes/galaxy.js
 *
 * Funding Flow Galaxy API. Gated by GALAXY_ENABLED env. Returns 404 when
 * disabled so the feature flag flip is zero-redeploy.
 */
import express from 'express'
import {
  getUniverse,
  getSector,
  getEmployer,
  getPatternDetail
} from '../services/galaxyService.js'
import { getNodeDetail } from '../services/galaxyNodeService.js'

const router = express.Router()

router.use((req, res, next) => {
  if (process.env.GALAXY_ENABLED !== 'true') {
    return res.status(404).json({ error: 'galaxy_disabled' })
  }
  next()
})

function wrap(fn) {
  return async (req, res) => {
    try {
      const result = await fn(req)
      if (result == null) return res.status(404).json({ error: 'not_found' })
      res.json(result)
    } catch (e) {
      console.error('[galaxy]', req.method, req.originalUrl, e.message)
      res.status(500).json({ error: 'galaxy_error', message: e.message })
    }
  }
}

router.get('/universe', wrap(req => getUniverse({
  cycle:  req.query.cycle  || '2024',
  nodeCap: Number(req.query.limit) || 500
})))

router.get('/sector/:sector', wrap(req => getSector({
  cycle:   req.query.cycle || '2024',
  sector:  decodeURIComponent(req.params.sector),
  nodeCap: Number(req.query.limit) || 80
})))

router.get('/employer/:employerId', wrap(req => getEmployer({
  cycle:      req.query.cycle || '2024',
  employerId: decodeURIComponent(req.params.employerId),
  nodeCap:    Number(req.query.limit) || 40
})))

router.get('/patterns/:id', wrap(req => getPatternDetail({ patternId: req.params.id })))

router.get('/node/:nodeId', wrap(req => getNodeDetail({
  nodeId: decodeURIComponent(req.params.nodeId),
  cycle:  req.query.cycle || '2024',
})))

export default router
