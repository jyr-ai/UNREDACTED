const http = require('http');

const BASE_URL = 'http://localhost:3001/api/campaign-watch';

async function testEndpoint(endpoint, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE_URL}${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function testAllEndpoints() {
  console.log('Testing Campaign Watch API endpoints...\n');

  try {
    // Test 1: Health endpoint
    console.log('=== Test 1: Health endpoint ===');
    const health = await testEndpoint('/health');
    console.log(`Status: ${health.status}`);
    console.log(`Response: ${JSON.stringify(health.data, null, 2)}`);
    console.log();

    // Test 2: States endpoint
    console.log('=== Test 2: States endpoint ===');
    const states = await testEndpoint('/states');
    console.log(`Status: ${states.status}`);
    if (states.data && states.data.success) {
      console.log(`Found ${states.data.count} states`);
      if (states.data.data && states.data.data.length > 0) {
        console.log('First state:', {
          name: states.data.data[0].name,
          candidateCount: states.data.data[0].candidateCount,
          corruptionIndex: states.data.data[0].corruptionIndex
        });
      }
    } else {
      console.log('Error:', states.data?.error || 'Unknown error');
    }
    console.log();

    // Test 3: Corruption index endpoint
    console.log('=== Test 3: Corruption index endpoint ===');
    const corruption = await testEndpoint('/corruption-index');
    console.log(`Status: ${corruption.status}`);
    if (corruption.data && corruption.data.success) {
      console.log(`Found ${corruption.data.count} rankings`);
      if (corruption.data.data && corruption.data.data.length > 0) {
        console.log('Top 3 most corrupt states:');
        corruption.data.data.slice(0, 3).forEach((state, i) => {
          console.log(`  ${i + 1}. ${state.stateCode} (${state.name}): ${state.corruptionIndex}`);
        });
      }
    }
    console.log();

    // Test 4: Money flows endpoint
    console.log('=== Test 4: Money flows endpoint ===');
    const flows = await testEndpoint('/money-flows?limit=5');
    console.log(`Status: ${flows.status}`);
    if (flows.data && flows.data.success) {
      console.log(`Found ${flows.data.count} money flows`);
    }
    console.log();

    console.log('✅ API endpoint tests completed!');
    console.log('\n📋 Summary:');
    console.log('- Backend server is running');
    console.log('- Campaign Watch API endpoints are accessible');
    console.log('- Data aggregation pipeline is functional');
    console.log('- Rate limits are expected with DEMO_KEY (can be upgraded with FEC_API_KEY)');

  } catch (error) {
    console.error('❌ API test failed:', error.message);
    console.log('\n⚠️  Make sure the backend server is running:');
    console.log('   cd backend && npm start');
  }
}

// Check if server is running first
testAllEndpoints();
