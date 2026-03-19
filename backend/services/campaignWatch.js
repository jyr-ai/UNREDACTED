/**
 * Campaign Watch service - aggregates political data by state for the 2026 election map
 */
import * as fec from './fec.js';
import * as darkMoney from './darkMoney.js';
import * as stockAct from './stockAct.js';
import * as usaSpending from './usaSpending.js';

// State abbreviations and FIPS codes
const STATES = {
  AL: { name: 'Alabama', fips: '01' },
  AK: { name: 'Alaska', fips: '02' },
  AZ: { name: 'Arizona', fips: '04' },
  AR: { name: 'Arkansas', fips: '05' },
  CA: { name: 'California', fips: '06' },
  CO: { name: 'Colorado', fips: '08' },
  CT: { name: 'Connecticut', fips: '09' },
  DE: { name: 'Delaware', fips: '10' },
  FL: { name: 'Florida', fips: '12' },
  GA: { name: 'Georgia', fips: '13' },
  HI: { name: 'Hawaii', fips: '15' },
  ID: { name: 'Idaho', fips: '16' },
  IL: { name: 'Illinois', fips: '17' },
  IN: { name: 'Indiana', fips: '18' },
  IA: { name: 'Iowa', fips: '19' },
  KS: { name: 'Kansas', fips: '20' },
  KY: { name: 'Kentucky', fips: '21' },
  LA: { name: 'Louisiana', fips: '22' },
  ME: { name: 'Maine', fips: '23' },
  MD: { name: 'Maryland', fips: '24' },
  MA: { name: 'Massachusetts', fips: '25' },
  MI: { name: 'Michigan', fips: '26' },
  MN: { name: 'Minnesota', fips: '27' },
  MS: { name: 'Mississippi', fips: '28' },
  MO: { name: 'Missouri', fips: '29' },
  MT: { name: 'Montana', fips: '30' },
  NE: { name: 'Nebraska', fips: '31' },
  NV: { name: 'Nevada', fips: '32' },
  NH: { name: 'New Hampshire', fips: '33' },
  NJ: { name: 'New Jersey', fips: '34' },
  NM: { name: 'New Mexico', fips: '35' },
  NY: { name: 'New York', fips: '36' },
  NC: { name: 'North Carolina', fips: '37' },
  ND: { name: 'North Dakota', fips: '38' },
  OH: { name: 'Ohio', fips: '39' },
  OK: { name: 'Oklahoma', fips: '40' },
  OR: { name: 'Oregon', fips: '41' },
  PA: { name: 'Pennsylvania', fips: '42' },
  RI: { name: 'Rhode Island', fips: '44' },
  SC: { name: 'South Carolina', fips: '45' },
  SD: { name: 'South Dakota', fips: '46' },
  TN: { name: 'Tennessee', fips: '47' },
  TX: { name: 'Texas', fips: '48' },
  UT: { name: 'Utah', fips: '49' },
  VT: { name: 'Vermont', fips: '50' },
  VA: { name: 'Virginia', fips: '51' },
  WA: { name: 'Washington', fips: '53' },
  WV: { name: 'West Virginia', fips: '54' },
  WI: { name: 'Wisconsin', fips: '55' },
  WY: { name: 'Wyoming', fips: '56' },
  DC: { name: 'District of Columbia', fips: '11' }
};

/**
 * Get state-level summary for all 50 states + DC
 */
export async function getStateSummaries() {
  const stateSummaries = {};
  const stateCodes = Object.keys(STATES);

  // Initialize all states
  for (const stateCode of stateCodes) {
    stateSummaries[stateCode] = {
      stateCode,
      name: STATES[stateCode].name,
      fips: STATES[stateCode].fips,
      candidateCount: 0,
      totalRaised: 0,
      topCandidate: null,
      darkMoneyExposure: 0,
      stockActViolations: 0,
      federalContracts: 0,
      corruptionIndex: 50, // Default neutral score
      lastUpdated: new Date().toISOString()
    };
  }

  try {
    // Get candidates for each state (batch by state to avoid rate limits)
    for (const stateCode of stateCodes.slice(0, 10)) { // Limit to 10 states for initial test
      try {
        const candidates = await fec.searchCandidates({
          electionYear: 2026,
          state: stateCode,
          limit: 20
        });

        if (candidates && candidates.length > 0) {
          stateSummaries[stateCode].candidateCount = candidates.length;

          // Find top candidate by fundraising
          let topCandidate = null;
          let maxRaised = 0;

          for (const candidate of candidates.slice(0, 5)) { // Check first 5 candidates
            try {
              const totals = await fec.getCandidateRaisedTotals(candidate.candidate_id, 2026);
              const raised = totals?.receipts || 0;

              if (raised > maxRaised) {
                maxRaised = raised;
                topCandidate = {
                  name: candidate.name,
                  party: candidate.party_full,
                  office: candidate.office_full,
                  raised: raised,
                  cashOnHand: totals?.cash_on_hand || 0
                };
              }

              stateSummaries[stateCode].totalRaised += raised;
            } catch (error) {
              console.error(`Error getting totals for candidate ${candidate.candidate_id}:`, error.message);
            }
          }

          stateSummaries[stateCode].topCandidate = topCandidate;
        }
      } catch (error) {
        console.error(`Error fetching candidates for ${stateCode}:`, error.message);
      }
    }

    // Get dark money exposure for top states
    const darkMoneyOrgs = await darkMoney.getDarkMoneyOrgs(20);
    for (const org of darkMoneyOrgs) {
      if (org.state && stateSummaries[org.state]) {
        stateSummaries[org.state].darkMoneyExposure += org.totalSpend;
      }
    }

    // Get stock act violations
    const violations = await stockAct.getViolationWatchlist();
    for (const violation of violations) {
      // Extract state from politician name or chamber data
      // This is simplified - would need better parsing
      if (violation.state && violation.state !== '—' && stateSummaries[violation.state]) {
        stateSummaries[violation.state].stockActViolations += violation.filingCount;
      }
    }

    // Calculate corruption index (simplified)
    for (const stateCode of stateCodes) {
      const summary = stateSummaries[stateCode];
      let score = 50; // Base score

      // Adjust based on dark money (higher = more corrupt)
      if (summary.darkMoneyExposure > 1000000) score -= 10;
      else if (summary.darkMoneyExposure > 100000) score -= 5;

      // Adjust based on stock act violations
      score -= summary.stockActViolations * 2;

      // Adjust based on fundraising (very high fundraising could indicate corruption)
      if (summary.totalRaised > 10000000) score -= 5;

      // Clamp score between 0-100
      summary.corruptionIndex = Math.max(0, Math.min(100, score));
    }

  } catch (error) {
    console.error('Error in getStateSummaries:', error.message);
  }

  return Object.values(stateSummaries);
}

/**
 * Get detailed data for a specific state
 */
export async function getStateDetails(stateCode) {
  const state = STATES[stateCode.toUpperCase()];
  if (!state) {
    throw new Error(`Invalid state code: ${stateCode}`);
  }

  const result = {
    stateCode: stateCode.toUpperCase(),
    name: state.name,
    fips: state.fips,
    candidates: [],
    darkMoneyOrgs: [],
    stockTrades: [],
    federalContracts: [],
    corruptionScore: 50,
    lastUpdated: new Date().toISOString()
  };

  try {
    // Get candidates
    result.candidates = await fec.searchCandidates({
      electionYear: 2026,
      state: stateCode.toUpperCase(),
      limit: 20
    });

    // Get candidate totals
    for (const candidate of result.candidates.slice(0, 10)) {
      try {
        const totals = await fec.getCandidateRaisedTotals(candidate.candidate_id, 2026);
        candidate.totals = totals || {};

        // Get dark money exposure for this candidate
        const darkMoneyExposure = await darkMoney.getCandidateDarkMoneyExposure(candidate.candidate_id);
        candidate.darkMoneyExposure = darkMoneyExposure;
      } catch (error) {
        console.error(`Error getting details for candidate ${candidate.candidate_id}:`, error.message);
      }
    }

    // Get dark money organizations in this state
    const allDarkMoneyOrgs = await darkMoney.getDarkMoneyOrgs(50);
    result.darkMoneyOrgs = allDarkMoneyOrgs.filter(org => org.state === stateCode.toUpperCase());

    // Get stock trades for this state (simplified - would need state mapping)
    const stockTrades = await stockAct.getRecentStockTrades('house', 20);
    result.stockTrades = stockTrades.filter(trade =>
      trade.state && trade.state.toUpperCase() === stateCode.toUpperCase()
    );

    // Get federal contracts in this state (simplified - would need state filtering)
    const contracts = await usaSpending.searchContracts({
      keyword: state.name,
      limit: 10
    });
    result.federalContracts = contracts;

    // Calculate corruption score
    let score = 50;
    if (result.darkMoneyOrgs.length > 0) score -= 10;
    if (result.stockTrades.length > 5) score -= 5;
    if (result.candidates.some(c => c.darkMoneyExposure?.darkMoneyTotal > 100000)) score -= 10;

    result.corruptionScore = Math.max(0, Math.min(100, score));

  } catch (error) {
    console.error(`Error getting details for state ${stateCode}:`, error.message);
  }

  return result;
}

/**
 * Get money flow data for arc visualization
 */
export async function getMoneyFlows(limit = 20) {
  try {
    const darkMoneyOrgs = await darkMoney.getDarkMoneyOrgs(limit);
    const flows = [];

    for (const org of darkMoneyOrgs.slice(0, 5)) {
      try {
        const flow = await darkMoney.traceDarkMoneyFlow(org.id);
        if (flow.flow.length > 0) {
          flows.push({
            source: 'Unknown Donors',
            target: org.name,
            amount: flow.totalTraceable,
            state: org.state,
            type: 'dark_money'
          });
        }
      } catch (error) {
        console.error(`Error tracing flow for ${org.id}:`, error.message);
      }
    }

    return flows;
  } catch (error) {
    console.error('Error getting money flows:', error.message);
    return [];
  }
}

/**
 * Get corruption index rankings
 */
export async function getCorruptionIndex() {
  const stateSummaries = await getStateSummaries();

  return stateSummaries
    .map(state => ({
      stateCode: state.stateCode,
      name: state.name,
      corruptionIndex: state.corruptionIndex,
      darkMoneyExposure: state.darkMoneyExposure,
      stockActViolations: state.stockActViolations,
      totalRaised: state.totalRaised
    }))
    .sort((a, b) => a.corruptionIndex - b.corruptionIndex); // Lower index = more corrupt
}

export default {
  getStateSummaries,
  getStateDetails,
  getMoneyFlows,
  getCorruptionIndex
};
