/**
 * Campaign Watch API routes for the 2026 election map
 * Phase 2D: Added corruption profile, AI analysis, representatives, legislation endpoints
 */
import express from 'express'
import campaignWatchService from '../services/campaignWatch.js'
import congressGovService from '../services/congressGov.js'
import googleCivicService from '../services/googleCivic.js'

const router = express.Router()

// ─── Valid state codes ────────────────────────────────────────────────────────
const VALID_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
])

function validateState(stateCode, res) {
  const code = (stateCode || '').toUpperCase()
  if (!code || !VALID_STATES.has(code)) {
    res.status(400).json({
      success: false,
      error: 'Invalid state code',
      message: `"${stateCode}" is not a valid US state code. Use 2-letter abbreviation (e.g. TX, CA).`,
    })
    return null
  }
  return code
}

/**
 * GET /api/campaign-watch/states
 * All 51 state summaries — cached 1 hour.
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
 */
router.get('/health', (req, res) => {
  const congress = congressGovService.getCongressStatus()
  const civic    = googleCivicService.getCivicStatus()
  const cacheStats = campaignWatchService.getCacheStats()
  res.json({
    success: true,
    service: 'campaign-watch',
    status:  'operational',
    version: '2.0.0',
    dependencies: {
      congressGov:  { keyConfigured: congress.keyConfigured, cacheEntries: congress.cacheEntries },
      googleCivic:  { keyConfigured: civic.keyConfigured,    cacheEntries: civic.cacheEntries    },
      campaignWatch:{ cacheEntries: cacheStats.entries },
    },
    timestamp: new Date().toISOString(),
  })
})

// ─── Phase 2D: New endpoints ──────────────────────────────────────────────────

/**
 * GET /api/campaign-watch/state/:stateCode/corruption
 * Structured corruption profile for CorruptionDialog — FEC + dark money + contracts + STOCK Act.
 */
router.get('/state/:stateCode/corruption', async (req, res) => {
  const code = validateState(req.params.stateCode, res)
  if (!code) return
  try {
    const profile = await campaignWatchService.getStateCorruptionProfile(code)
    res.json({ success: true, data: profile, lastUpdated: new Date().toISOString() })
  } catch (error) {
    console.error(`Error fetching corruption profile for ${req.params.stateCode}:`, error)
    res.status(500).json({ success: false, error: 'Failed to fetch corruption profile', message: error.message })
  }
})

/**
 * GET /api/campaign-watch/state/:stateCode/ai-analysis
 * AI-generated corruption narrative via DeepSeek. Cached 6 hours.
 */
router.get('/state/:stateCode/ai-analysis', async (req, res) => {
  const code = validateState(req.params.stateCode, res)
  if (!code) return
  try {
    const analysis = await campaignWatchService.generateAiNarrative(code)
    res.json({ success: true, data: analysis, lastUpdated: new Date().toISOString() })
  } catch (error) {
    console.error(`Error generating AI analysis for ${req.params.stateCode}:`, error)
    res.status(500).json({ success: false, error: 'Failed to generate AI analysis', message: error.message })
  }
})

/**
 * GET /api/campaign-watch/state/:stateCode/representatives
 * Elected officials via Google Civic API. Cached 24 hours.
 */
router.get('/state/:stateCode/representatives', async (req, res) => {
  const code = validateState(req.params.stateCode, res)
  if (!code) return
  try {
    const reps = await googleCivicService.getRepresentativesByState(code)
    if (!reps) {
      return res.json({
        success: true,
        data: { officials: [], federalSenators: [], federalRepresentatives: [], stateExecutive: [] },
        note: 'Google Civic API unavailable or no data for this state',
        lastUpdated: new Date().toISOString(),
      })
    }
    res.json({ success: true, data: reps, lastUpdated: new Date().toISOString() })
  } catch (error) {
    console.error(`Error fetching representatives for ${req.params.stateCode}:`, error)
    res.status(500).json({ success: false, error: 'Failed to fetch representatives', message: error.message })
  }
})

// ── ZIP code → state lookup (covers all US zip prefix ranges) ────────────────
function zipToState(zip) {
  const n = parseInt(zip, 10)
  if (n >= 99500 && n <= 99999) return 'AK'
  if (n >= 35000 && n <= 36999) return 'AL'
  if (n >= 71600 && n <= 72999) return 'AR'
  if (n >= 85000 && n <= 86999) return 'AZ'
  if (n >= 90000 && n <= 96699) return 'CA'
  if (n >= 80000 && n <= 81999) return 'CO'
  if (n >= 6000  && n <= 6999)  return 'CT'
  if (n >= 20000 && n <= 20099) return 'DC'
  if (n >= 19700 && n <= 19999) return 'DE'
  if (n >= 32000 && n <= 34999) return 'FL'
  if (n >= 30000 && n <= 31999) return 'GA'
  if (n >= 96700 && n <= 96999) return 'HI'
  if (n >= 50000 && n <= 52999) return 'IA'
  if (n >= 83200 && n <= 83999) return 'ID'
  if (n >= 60000 && n <= 62999) return 'IL'
  if (n >= 46000 && n <= 47999) return 'IN'
  if (n >= 66000 && n <= 67999) return 'KS'
  if (n >= 40000 && n <= 42999) return 'KY'
  if (n >= 70000 && n <= 71599) return 'LA'
  if (n >= 1000  && n <= 2799)  return 'MA'
  if (n >= 20600 && n <= 21999) return 'MD'
  if (n >= 3900  && n <= 4999)  return 'ME'
  if (n >= 48000 && n <= 49999) return 'MI'
  if (n >= 55000 && n <= 56999) return 'MN'
  if (n >= 63000 && n <= 65999) return 'MO'
  if (n >= 38600 && n <= 39999) return 'MS'
  if (n >= 59000 && n <= 59999) return 'MT'
  if (n >= 27000 && n <= 28999) return 'NC'
  if (n >= 58000 && n <= 58999) return 'ND'
  if (n >= 68000 && n <= 69999) return 'NE'
  if (n >= 3000  && n <= 3899)  return 'NH'
  if (n >= 7000  && n <= 8999)  return 'NJ'
  if (n >= 87000 && n <= 88499) return 'NM'
  if (n >= 88900 && n <= 89999) return 'NV'
  if (n >= 10000 && n <= 14999) return 'NY'
  if (n >= 43000 && n <= 45999) return 'OH'
  if (n >= 73000 && n <= 74999) return 'OK'
  if (n >= 97000 && n <= 97999) return 'OR'
  if (n >= 15000 && n <= 19699) return 'PA'
  if (n >= 2800  && n <= 2999)  return 'RI'
  if (n >= 29000 && n <= 29999) return 'SC'
  if (n >= 57000 && n <= 57999) return 'SD'
  if (n >= 37000 && n <= 38599) return 'TN'
  if (n >= 75000 && n <= 79999) return 'TX'
  if (n >= 84000 && n <= 84999) return 'UT'
  if (n >= 20100 && n <= 24699) return 'VA'
  if (n >= 5000  && n <= 5999)  return 'VT'
  if (n >= 98000 && n <= 99499) return 'WA'
  if (n >= 53000 && n <= 54999) return 'WI'
  if (n >= 24700 && n <= 26999) return 'WV'
  if (n >= 82000 && n <= 83199) return 'WY'
  return null
}

// ── Parse state from address / zip / abbreviation ────────────────────────────
const STATE_NAME_TO_CODE = {
  'alabama':'AL','alaska':'AK','arizona':'AZ','arkansas':'AR','california':'CA',
  'colorado':'CO','connecticut':'CT','delaware':'DE','florida':'FL','georgia':'GA',
  'hawaii':'HI','idaho':'ID','illinois':'IL','indiana':'IN','iowa':'IA','kansas':'KS',
  'kentucky':'KY','louisiana':'LA','maine':'ME','maryland':'MD','massachusetts':'MA',
  'michigan':'MI','minnesota':'MN','mississippi':'MS','missouri':'MO','montana':'MT',
  'nebraska':'NE','nevada':'NV','new hampshire':'NH','new jersey':'NJ','new mexico':'NM',
  'new york':'NY','north carolina':'NC','north dakota':'ND','ohio':'OH','oklahoma':'OK',
  'oregon':'OR','pennsylvania':'PA','rhode island':'RI','south carolina':'SC',
  'south dakota':'SD','tennessee':'TN','texas':'TX','utah':'UT','vermont':'VT',
  'virginia':'VA','washington':'WA','west virginia':'WV','wisconsin':'WI','wyoming':'WY',
  'district of columbia':'DC','washington dc':'DC','washington d.c.':'DC',
}

function parseStateFromInput(input) {
  const s = input.trim()

  // Pure 5-digit zip code
  if (/^\d{5}$/.test(s)) return zipToState(s)

  // 2-letter state abbreviation on its own
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase()

  // State abbreviation at end after comma/space: "Union City, NJ" or "Union City NJ"
  const abbrMatch = s.match(/[,\s]+([A-Z]{2})\s*(?:\d{5})?$/i)
  if (abbrMatch) {
    const candidate = abbrMatch[1].toUpperCase()
    if (VALID_STATES.has(candidate)) return candidate
  }

  // Zip code somewhere in the string
  const zipMatch = s.match(/\b(\d{5})(?:-\d{4})?\b/)
  if (zipMatch) {
    const state = zipToState(zipMatch[1])
    if (state) return state
  }

  // Full state name anywhere in the string
  const lower = s.toLowerCase()
  for (const [name, code] of Object.entries(STATE_NAME_TO_CODE)) {
    if (lower.includes(name)) return code
  }

  return null
}

/**
 * GET /api/campaign-watch/representatives?address=...
 * Representatives by address/zip/state — Google Civic primary, Congress.gov fallback.
 */
router.get('/representatives', async (req, res) => {
  const { address } = req.query
  if (!address || address.trim().length < 2) {
    return res.status(400).json({ success: false, error: 'Missing address', message: 'Provide ?address=123+Main+St+City+NJ or a zip code like ?address=07087' })
  }
  try {
    // 1. Try Google Civic API (full address → richer data with local officials)
    let reps = await googleCivicService.getRepresentativesByAddress(address)

    // 2. Fallback → Congress.gov (federal only, but reliable)
    if (!reps) {
      const stateCode = parseStateFromInput(address)
      if (!stateCode) {
        return res.json({
          success: true,
          data: null,
          fallback: true,
          note: 'Could not determine state from input. Try including a state abbreviation (e.g. "NJ") or zip code.',
          lastUpdated: new Date().toISOString(),
        })
      }
      const members = await congressGovService.getMembersByState(stateCode)
      if (!members || members.length === 0) {
        return res.json({ success: true, data: null, fallback: true, note: `No congressional data found for ${stateCode}.`, lastUpdated: new Date().toISOString() })
      }
      // Normalize to same shape the frontend expects
      const officials = members.map(m => ({
        name:     m.name || `${m.lastName}, ${m.firstName}`,
        office:   m.chamber === 'Senate' ? `U.S. Senator, ${stateCode}` : `U.S. Representative, ${stateCode} ${m.district ? `District ${m.district}` : ''}`.trim(),
        party:    m.partyName || m.party || '',
        phones:   m.officialUrl ? [] : [],
        urls:     m.officialUrl ? [m.officialUrl] : [],
        photoUrl: null,
        channels: [],
      }))
      return res.json({
        success: true,
        data: { normalizedInput: { line1: address }, officials, source: 'congress.gov' },
        fallback: true,
        note: 'Google Civic API unavailable — showing federal representatives from Congress.gov.',
        lastUpdated: new Date().toISOString(),
      })
    }

    res.json({ success: true, data: reps, lastUpdated: new Date().toISOString() })
  } catch (error) {
    console.error('Error fetching representatives by address:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch representatives', message: error.message })
  }
})

/**
 * GET /api/campaign-watch/state/:stateCode/legislation
 * Recent bills from state's congressional delegation via Congress.gov.
 */
router.get('/state/:stateCode/legislation', async (req, res) => {
  const code = validateState(req.params.stateCode, res)
  if (!code) return
  const limit = Math.min(parseInt(req.query.limit) || 20, 50)
  try {
    const [members, bills] = await Promise.allSettled([
      congressGovService.getMembersByState(code),
      congressGovService.getBillsByState(code, limit),
    ])
    res.json({
      success: true,
      data: {
        stateCode: code,
        members:    members.status === 'fulfilled' ? members.value : [],
        bills:      bills.status   === 'fulfilled' ? bills.value   : [],
        memberCount: members.status === 'fulfilled' ? members.value.length : 0,
        billCount:   bills.status   === 'fulfilled' ? bills.value.length   : 0,
      },
      lastUpdated: new Date().toISOString(),
    })
  } catch (error) {
    console.error(`Error fetching legislation for ${req.params.stateCode}:`, error)
    res.status(500).json({ success: false, error: 'Failed to fetch legislation data', message: error.message })
  }
})

/**
 * GET /api/campaign-watch/elections
 */
router.get('/elections', async (req, res) => {
  try {
    const elections = await googleCivicService.getElectionList()
    res.json({ success: true, data: elections, count: elections.length, lastUpdated: new Date().toISOString() })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch elections', message: error.message })
  }
})

/**
 * DELETE /api/campaign-watch/cache
 */
router.delete('/cache', (req, res) => {
  const { prefix } = req.query
  campaignWatchService.clearCache(prefix || null)
  const stats = campaignWatchService.getCacheStats()
  res.json({ success: true, message: `Cache cleared${prefix ? ` (prefix: ${prefix})` : ''}`, remaining: stats.entries })
})

export default router
