const usaSpending = require('./backend/services/usaSpending.js');

async function testUSASpending() {
  console.log('Testing USASpending API...');

  try {
    // Test 1: Search contracts by keyword
    console.log('\n=== Test 1: Search contracts for "defense" ===');
    const contracts = await usaSpending.searchContracts({ keyword: 'defense', limit: 3 });
    console.log(`Found ${contracts.length} contracts`);

    if (contracts.length > 0) {
      console.log('First contract:', {
        'Award ID': contracts[0]['Award ID'],
        'Recipient Name': contracts[0]['Recipient Name'],
        'Award Amount': contracts[0]['Award Amount'],
        'Awarding Agency': contracts[0]['Awarding Agency'],
        'Award Date': contracts[0]['Award Date']
      });
    }

    // Test 2: Get agency spending
    console.log('\n=== Test 2: Agency spending for current fiscal year ===');
    const agencies = await usaSpending.getAgencySpending();
    console.log(`Found ${agencies.length} agencies`);

    if (agencies.length > 0) {
      console.log('Top 3 agencies by spending:');
      agencies.slice(0, 3).forEach(agency => {
        console.log(`  ${agency.agency}: $${agency.totalAmount.toLocaleString()} (${agency.count} awards)`);
      });
    }

    console.log('\n✅ USASpending API tests completed successfully!');

  } catch (error) {
    console.error('❌ USASpending API test failed:', error.message);
  }
}

testUSASpending();
