const campaignWatch = require('./backend/services/campaignWatch.js');

async function testCampaignWatch() {
  console.log('Testing Campaign Watch API...');

  try {
    // Test 1: Get state summaries
    console.log('\n=== Test 1: Get state summaries ===');
    const states = await campaignWatch.getStateSummaries();
    console.log(`Found ${states.length} states`);

    if (states.length > 0) {
      console.log('First 3 states:');
      states.slice(0, 3).forEach(state => {
        console.log(`  ${state.stateCode} (${state.name}):`);
        console.log(`    Candidates: ${state.candidateCount}`);
        console.log(`    Total raised: $${state.totalRaised.toLocaleString()}`);
        console.log(`    Corruption index: ${state.corruptionIndex}`);
        console.log(`    Dark money exposure: $${state.darkMoneyExposure.toLocaleString()}`);
      });
    }

    // Test 2: Get Texas details
    console.log('\n=== Test 2: Get Texas details ===');
    const texas = await campaignWatch.getStateDetails('TX');
    console.log(`Texas data loaded:`);
    console.log(`  Candidates: ${texas.candidates.length}`);
    console.log(`  Dark money orgs: ${texas.darkMoneyOrgs.length}`);
    console.log(`  Stock trades: ${texas.stockTrades.length}`);
    console.log(`  Federal contracts: ${texas.federalContracts.length}`);
    console.log(`  Corruption score: ${texas.corruptionScore}`);

    if (texas.candidates.length > 0) {
      console.log('  First candidate:', {
        name: texas.candidates[0].name,
        party: texas.candidates[0].party_full,
        office: texas.candidates[0].office_full
      });
    }

    // Test 3: Get money flows
    console.log('\n=== Test 3: Get money flows ===');
    const flows = await campaignWatch.getMoneyFlows(5);
    console.log(`Found ${flows.length} money flows`);

    if (flows.length > 0) {
      console.log('First flow:', flows[0]);
    }

    // Test 4: Get corruption index
    console.log('\n=== Test 4: Get corruption index ===');
    const corruptionIndex = await campaignWatch.getCorruptionIndex();
    console.log(`Corruption rankings (top 5 most corrupt):`);
    corruptionIndex.slice(0, 5).forEach((state, index) => {
      console.log(`  ${index + 1}. ${state.stateCode} (${state.name}): ${state.corruptionIndex}`);
    });

    console.log('\n✅ Campaign Watch API tests completed successfully!');

  } catch (error) {
    console.error('❌ Campaign Watch API test failed:', error.message);
    console.error(error.stack);
  }
}

testCampaignWatch();
