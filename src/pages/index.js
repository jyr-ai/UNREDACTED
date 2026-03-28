/**
 * Page barrel — lazy-loadable page components.
 *
 * Each page is a self-contained module that:
 *   - owns its own data-fetching (useApiData hook)
 *   - reads theme via useTheme()
 *   - renders Band / Card / Chart primitives from src/components/
 *
 * Pages still to extract from App.jsx:
 *   Overview      → src/pages/Overview.jsx
 *   DonorIntel    → src/pages/DonorIntel.jsx
 *   PolicyIntel   → src/pages/PolicyIntel.jsx
 *   DonorWeb      → src/pages/DonorWeb.jsx
 *   SpendingAudit → src/pages/SpendingAudit.jsx
 *   Corporate     → src/pages/Corporate.jsx
 *
 * Pages already extracted to src/components/:
 *   AccountabilityIndex  ✓
 *   StockActMonitor      ✓
 *   DarkMoneyTracker     ✓
 *   CompanyProfile       ✓
 *   Settings             ✓
 */

export { default as CorruptionWatch } from "./CorruptionWatch.jsx";
export { default as CampaignWatch } from "./CampaignWatch.jsx";
export { default as MapPage } from "./MapPage.jsx";

// Uncomment each line as the file is extracted from App.jsx:
// export { default as Overview      } from "./Overview.jsx";
// export { default as DonorIntel    } from "./DonorIntel.jsx";
// export { default as PolicyIntel   } from "./PolicyIntel.jsx";
// export { default as DonorWeb      } from "./DonorWeb.jsx";
// export { default as SpendingAudit } from "./SpendingAudit.jsx";
// export { default as Corporate     } from "./Corporate.jsx";
