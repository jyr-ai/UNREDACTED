// Explore more Fiscal Data endpoints relevant to UNREDACTED
const endpoints = [
  {
    name: "Federal Spending by Agency (MTS Table 5) - with filtering for Defense",
    url: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/mts/mts_table_5?filter=classification_desc:eq:Department of Defense-Military Programs&page[size]=5&sort=-record_date&format=json"
  },
  {
    name: "Federal Revenue by Source (MTS Table 4) - Income Taxes",
    url: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/mts/mts_table_4?filter=classification_desc:eq:Individual Income Taxes&page[size]=5&sort=-record_date&format=json"
  },
  {
    name: "Treasury Securities (MSPD Table 3 - Held by Public)",
    url: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/debt/mspd/mspd_table_3?page[size]=3&sort=-record_date&format=json"
  },
  {
    name: "Federal Deficit/Surplus (MTS Table 1)",
    url: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/mts/mts_table_1?page[size]=5&sort=-record_date&format=json"
  },
  {
    name: "Interest on Federal Debt (MTS Table 3)",
    url: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/mts/mts_table_3?page[size]=3&sort=-record_date&format=json"
  },
  {
    name: "Average Interest Rates on Treasury Securities",
    url: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/avg_interest_rates?page[size]=5&sort=-record_date&format=json"
  },
  {
    name: "Federal Spending Summary Table 5 - All Agencies latest month",
    url: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/mts/mts_table_5?filter=record_date:eq:2025-12-31,sequence_level_nbr:eq:1&fields=record_date,classification_desc,current_fytd_net_outly_amt,prior_fytd_net_outly_amt&page[size]=30&sort=-current_fytd_net_outly_amt&format=json"
  },
];

async function explore() {
  for (const ep of endpoints) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`ENDPOINT: ${ep.name}`);
    console.log("=".repeat(80));
    try {
      const res = await fetch(ep.url);
      if (!res.ok) {
        console.log(`HTTP ${res.status} - ${res.statusText}`);
        const text = await res.text();
        console.log(text.slice(0, 300));
        continue;
      }
      const data = await res.json();
      console.log(`Total records: ${data.meta?.total_count || 'unknown'}`);
      console.log(`Fields: ${data.meta?.labels ? Object.keys(data.meta.labels).join(', ') : 'unknown'}`);
      if (data.data && data.data.length > 0) {
        console.log(`\nFirst ${Math.min(data.data.length, 3)} records:`);
        data.data.slice(0, 3).forEach((d, i) => {
          console.log(`\n  Record ${i + 1}:`, JSON.stringify(d, null, 4));
        });
      }
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
    }
  }
}

explore();
