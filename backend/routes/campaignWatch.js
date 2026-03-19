/**
 * Campaign Watch API routes for the 2026 election map
 */
import express from 'express';
import campaignWatchService from '../services/campaignWatch.js';

const router = express.Router();

/**
 * GET /api/campaign-watch/states
 * Get state-level summaries for all 50 states + DC
 */
router.get('/states', async (req, res) => {
  try {
    const states = await campaignWatchService.getStateSummaries();
    res.json({
      success: true,
      data: states,
      count: states.length,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching state summaries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch state data',
      message: error.message
    });
  }
});

/**
 * GET /api/campaign-watch/state/:stateCode
 * Get detailed data for a specific state
 */
router.get('/state/:stateCode', async (req, res) => {
  try {
    const { stateCode } = req.params;
    const stateData = await campaignWatchService.getStateDetails(stateCode);

    res.json({
      success: true,
      data: stateData,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error fetching state details for ${req.params.stateCode}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch state details',
      message: error.message
    });
  }
});

/**
 * GET /api/campaign-watch/money-flows
 * Get money flow data for arc visualization
 */
router.get('/money-flows', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const flows = await campaignWatchService.getMoneyFlows(limit);

    res.json({
      success: true,
      data: flows,
      count: flows.length,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching money flows:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch money flow data',
      message: error.message
    });
  }
});

/**
 * GET /api/campaign-watch/corruption-index
 * Get corruption index rankings
 */
router.get('/corruption-index', async (req, res) => {
  try {
    const rankings = await campaignWatchService.getCorruptionIndex();

    res.json({
      success: true,
      data: rankings,
      count: rankings.length,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching corruption index:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch corruption index',
      message: error.message
    });
  }
});

/**
 * GET /api/campaign-watch/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'campaign-watch',
    status: 'operational',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

export default router;
