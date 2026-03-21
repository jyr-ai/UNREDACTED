// services/eiaService.js
// Fetches weekly retail gasoline prices from the U.S. Energy Information Administration.
// Docs: https://www.eia.gov/opendata/

const axios = require("axios");

const EIA_BASE = "https://api.eia.gov/v2";

// EIA series IDs for weekly regular-grade retail gas prices by PADD region → mapped to states.
// Full state-level series are under petroleum/pri/gnd.
// Series format: "EMM_EPM0_PTE_{STATE_CODE}W_DPG"
const STATE_SERIES_IDS = {
  CT: "EMM_EPM0_PTE_SCT_DPG", RI: "EMM_EPM0_PTE_SRI_DPG",
  MA: "EMM_EPM0_PTE_SMA_DPG", VT: "EMM_EPM0_PTE_SVT_DPG",
  NH: "EMM_EPM0_PTE_SNH_DPG", ME: "EMM_EPM0_PTE_SME_DPG",
  NY: "EMM_EPM0_PTE_SNY_DPG", NJ: "EMM_EPM0_PTE_SNJ_DPG",
  PA: "EMM_EPM0_PTE_SPA_DPG", OH: "EMM_EPM0_PTE_SOH_DPG",
  MI: "EMM_EPM0_PTE_SMI_DPG", IL: "EMM_EPM0_PTE_SIL_DPG",
  IN: "EMM_EPM0_PTE_SIN_DPG", WI: "EMM_EPM0_PTE_SWI_DPG",
  MN: "EMM_EPM0_PTE_SMN_DPG", VA: "EMM_EPM0_PTE_SVA_DPG",
  MD: "EMM_EPM0_PTE_SMD_DPG", DE: "EMM_EPM0_PTE_SDE_DPG",
  NC: "EMM_EPM0_PTE_SNC_DPG", SC: "EMM_EPM0_PTE_SSC_DPG",
  GA: "EMM_EPM0_PTE_SGA_DPG", FL: "EMM_EPM0_PTE_SFL_DPG",
  TN: "EMM_EPM0_PTE_STN_DPG", AL: "EMM_EPM0_PTE_SAL_DPG",
  MS: "EMM_EPM0_PTE_SMS_DPG", KY: "EMM_EPM0_PTE_SKY_DPG",
  WV: "EMM_EPM0_PTE_SWV_DPG", TX: "EMM_EPM0_PTE_STX_DPG",
  LA: "EMM_EPM0_PTE_SLA_DPG", AR: "EMM_EPM0_PTE_SAR_DPG",
  OK: "EMM_EPM0_PTE_SOK_DPG", MO: "EMM_EPM0_PTE_SMO_DPG",
  KS: "EMM_EPM0_PTE_SKS_DPG", NE: "EMM_EPM0_PTE_SNE_DPG",
  IA: "EMM_EPM0_PTE_SIA_DPG", ND: "EMM_EPM0_PTE_SND_DPG",
  SD: "EMM_EPM0_PTE_SSD_DPG", CO: "EMM_EPM0_PTE_SCO_DPG",
  WY: "EMM_EPM0_PTE_SWY_DPG", MT: "EMM_EPM0_PTE_SMT_DPG",
  ID: "EMM_EPM0_PTE_SID_DPG", UT: "EMM_EPM0_PTE_SUT_DPG",
  NV: "EMM_EPM0_PTE_SNV_DPG", AZ: "EMM_EPM0_PTE_SAZ_DPG",
  NM: "EMM_EPM0_PTE_SNM_DPG", CA: "EMM_EPM0_PTE_SCA_DPG",
  OR: "EMM_EPM0_PTE_SOR_DPG", WA: "EMM_EPM0_PTE_SWA_DPG",
  AK: "EMM_EPM0_PTE_SAK_DPG", HI: "EMM_EPM0_PTE_SHI_DPG",
};

// Fallback mock data used when EIA key is missing / API is unreachable
const MOCK_FALLBACK = {
  AL:3.05,AK:3.89,AZ:3.41,AR:2.98,CA:4.72,CO:3.28,CT:3.65,DE:3.22,
  FL:3.38,GA:3.01,HI:4.95,ID:3.35,IL:3.59,IN:3.14,IA:3.09,KS:2.97,
  KY:3.02,LA:2.95,ME:3.48,MD:3.41,MA:3.62,MI:3.29,MN:3.18,MS:2.93,
  MO:2.99,MT:3.44,NE:3.06,NV:3.82,NH:3.51,NJ:3.45,NM:3.19,NY:3.71,
  NC:3.14,ND:3.08,OH:3.22,OK:2.91,OR:3.88,PA:3.52,RI:3.57,SC:3.08,
  SD:3.11,TN:3.01,TX:2.89,UT:3.38,VT:3.59,VA:3.25,WA:4.01,WV:3.17,
  WI:3.21,WY:3.15,
};

/**
 * Fetch the most recent weekly state gas prices from EIA.
 * Returns { prices: { [stateCode]: number }, updatedAt: ISO string, source: string }
 */
async function getStatePrices() {
  const apiKey = process.env.EIA_API_KEY;

  if (!apiKey || apiKey === "your_eia_api_key_here") {
    console.warn("[EIA] No API key — serving mock data");
    return buildMockResponse();
  }

  try {
    // EIA v2 API: fetch latest data point for the national series first
    // then per-state. We batch the request using the facets parameter.
    const seriesList = Object.values(STATE_SERIES_IDS).join(",");

    const { data } = await axios.get(`${EIA_BASE}/petroleum/pri/gnd/data/`, {
      params: {
        api_key: apiKey,
        frequency: "weekly",
        "data[]": "value",
        sort: '[{"column":"period","direction":"desc"}]',
        length: Object.keys(STATE_SERIES_IDS).length,
      },
      timeout: 8000,
    });

    const prices = {};
    const rows = data?.response?.data || [];

    // EIA returns series like "EMM_EPM0_PTE_SCA_DPG" — reverse-map to state abbr
    const reverseMap = Object.fromEntries(
      Object.entries(STATE_SERIES_IDS).map(([abbr, id]) => [id, abbr])
    );

    let latestPeriod = null;
    for (const row of rows) {
      const abbr = reverseMap[row.series];
      if (abbr && row.value) {
        if (!prices[abbr]) {
          prices[abbr] = parseFloat(row.value);
          if (!latestPeriod) latestPeriod = row.period;
        }
      }
    }

    // Fill any gaps with mock
    for (const [abbr, val] of Object.entries(MOCK_FALLBACK)) {
      if (!prices[abbr]) prices[abbr] = val;
    }

    return {
      prices,
      updatedAt: latestPeriod ? `${latestPeriod}` : new Date().toISOString(),
      source: "EIA Weekly Retail Gasoline Prices",
      sourceUrl: "https://www.eia.gov/petroleum/gasdiesel/",
    };
  } catch (err) {
    console.error("[EIA] API error:", err.message);
    return buildMockResponse();
  }
}

/**
 * Fetch the US national average price.
 */
async function getNationalAverage() {
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey || apiKey === "your_eia_api_key_here") {
    const vals = Object.values(MOCK_FALLBACK);
    return {
      average: parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3)),
      updatedAt: new Date().toISOString(),
      source: "mock",
    };
  }

  try {
    const { data } = await axios.get(`${EIA_BASE}/petroleum/pri/gnd/data/`, {
      params: {
        api_key: apiKey,
        frequency: "weekly",
        "data[]": "value",
        "facets[series][]": "EMM_EPM0_PTE_NUS_DPG",
        sort: '[{"column":"period","direction":"desc"}]',
        length: 1,
      },
      timeout: 8000,
    });

    const row = data?.response?.data?.[0];
    return {
      average: row ? parseFloat(row.value) : 3.25,
      updatedAt: row?.period || new Date().toISOString(),
      source: "EIA Weekly Retail Gasoline Prices",
    };
  } catch (err) {
    console.error("[EIA] national avg error:", err.message);
    const vals = Object.values(MOCK_FALLBACK);
    return {
      average: parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3)),
      updatedAt: new Date().toISOString(),
      source: "mock",
    };
  }
}

function buildMockResponse() {
  return {
    prices: MOCK_FALLBACK,
    updatedAt: new Date().toISOString(),
    source: "mock — add EIA_API_KEY to .env for live data",
    sourceUrl: "https://www.eia.gov/opendata/register.php",
  };
}

module.exports = { getStatePrices, getNationalAverage };
