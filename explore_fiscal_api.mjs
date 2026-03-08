// Quick exploration of the Fiscal Data Treasury API
const endpoints = [
  {
    name: "Debt to the Penny (National Debt)",
    url: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/debt_to_penny?page[size]=3&sort=-record_date&format=json"
  },
  {
    name: "Monthly Treasury Statement - Receipts by Source",
    url: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/mts/mts_table_4?page[size]=3&sort=-record_date&format=json"
  },
  {
    name: "Federal Spending by Category (Monthly Treasury Statement Table 5)",
    url: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/mts/mts_table_5?page[size]=3&sort=-record_date&format=json"
  },
  {
    name: "Treasury Reporting Rates of Exchange",
    url: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/rates_of_exchange?page[size]=3&sort=-record_date&format=json"
  },
  {
    name: "Daily Treasury Statement - Operating Cash Balance",
    url: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance?page[size]=3&sort=-record_date&format=json"
  },
  {
    name: "Statement of Net Cost by Agency",
    url: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/statement_net_cost?page[size]=3&sort=-record_date&format=json"
  },
  {
    name: "Revenue Collections by Agency",
    url: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/revenue/rcm/collection?page[size]=3&sort=-record_date&format=json"
  },
  {
    name: "120 Day Delinquent Debt Referral Compliance",
    url: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/debt/tror/120_day_delinquent_debt_referral_compliance?page[size]=3&sort=-record_date&format=json"
  },
  {
    name: "Savings Bonds - Value",
    url: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/savings_bonds_report?page[size]=3&sort=-record_date&format=json"
  },
  {
    name: "Top Federal Spending Categories (Budget Category)",
    url: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/mts/mts_table_5?fields=record_date,current_month_gross_outly_amt,classification_desc,sub_classification_desc&page[size]=10&sort=-record_date&format=json"
  }
];

async function explore() {
  for (const ep of endpoints) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`ENDPOINT: ${ep.name}`);
    console.log(`URL: ${ep.url}`);
    console.log("=".repeat(80));
    try {
      const res = await fetch(ep.url);
      if (!res.ok) {
        console.log(`HTTP ${res.status} - ${res.statusText}`);
        const text = await res.text();
        console.log(text.slice(0, 200));
        continue;
      }
      const data = await res.json();
      console.log(`Total records available: ${data.meta?.total_count || 'unknown'}`);
      console.log(`Fields: ${data.meta?.labels ? Object.keys(data.meta.labels).join(', ') : 'unknown'}`);
      if (data.data && data.data.length > 0) {
        console.log(`\nSample record:`);
        console.log(JSON.stringify(data.data[0], null, 2));
      }
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
    }
  }
}

explore();
