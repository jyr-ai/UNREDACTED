const fec = require('./services/fec.js');

async function testFEC() {
  console.log('Testing FEC API for 2026 candidates...');

  try {
    // Test 1: Search for 2026 candidates in Texas
    console.log('\n=== Test 1: 2026 Texas candidates ===');
    const candidates = await fec.searchCandidates({electionYear: 2026, state: 'TX', limit: 5});
    console.log(`Found ${candidates.length} candidates`);

    if (candidates.length > 0) {
      console.log('First candidate:', {
        name: candidates[0].name,
        party: candidates[0].party_full,
        state: candidates[0].state,
        office: candidates[0].office_full,
        election_year: candidates[0].election_year,
        candidate_id: candidates[0].candidate_id
      });

      // Test 2: Get candidate totals
      console.log('\n=== Test 2: Candidate totals ===');
      const candidateId = candidates[0].candidate_id;
      const totals = await fec.getCandidateRaisedTotals(candidateId, 2026);
      console.log('Totals for', candidates[0].name, ':', {
        receipts: totals?.receipts || 0,
        cash_on_hand: totals?.cash_on_hand || 0,
        disbursements: totals?.disbursements || 0
      });
    }

    // Test 3: Search for 2026 candidates in California
    console.log('\n=== Test 3: 2026 California candidates ===');
    const caCandidates = await fec.searchCandidates({electionYear: 2026, state: 'CA', limit: 3});
    console.log(`Found ${caCandidates.length} CA candidates`);

    // Test 4: Get FEC status
    console.log('\n=== Test 4: FEC API Status ===');
    const status = fec.getFecStatus();
    console.log('FEC Status:', status);

    console.log('\n✅ FEC API tests completed successfully!');

  } catch (error) {
    console.error('❌ FEC API test failed:', error.message);
    if (error.isRateLimit) {
      console.error('Rate limit error - using DEMO_KEY? Check FEC_API_KEY in .env');
    }
  }
}

testFEC();
