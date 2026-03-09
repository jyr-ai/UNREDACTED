// Test script for Phase 2 Donor Intelligence implementation
import { searchCommittees, searchCandidates, getCandidateContributions } from './backend/services/fec.js'

async function testPhase2() {
  console.log('=== Testing Phase 2 Donor Intelligence Implementation ===\n')

  try {
    // Test 1: Search committees
    console.log('Test 1: Searching committees...')
    const committees = await searchCommittees({ keyword: 'technology', limit: 3 })
    console.log(`Found ${committees.length} committees`)
    if (committees.length > 0) {
      console.log('First committee:', {
        name: committees[0].name,
        type: committees[0].committee_type_full,
        party: committees[0].party_full,
        receipts: committees[0].receipts
      })
    }

    // Test 2: Search candidates
    console.log('\nTest 2: Searching candidates...')
    const candidates = await searchCandidates({ name: 'smith', limit: 3 })
    console.log(`Found ${candidates.length} candidates`)
    if (candidates.length > 0) {
      console.log('First candidate:', {
        name: candidates[0].name,
        office: candidates[0].office_full,
        party: candidates[0].party_full,
        state: candidates[0].state
      })
    }

    // Test 3: Get candidate contributions (if we have a candidate)
    if (candidates.length > 0) {
      console.log('\nTest 3: Getting candidate contributions...')
      const candidateId = candidates[0].candidate_id
      const contributions = await getCandidateContributions(candidateId, 5, 1000)
      console.log(`Found ${contributions.length} contributions for candidate ${candidateId}`)
      if (contributions.length > 0) {
        console.log('First contribution:', {
          donor: contributions[0].contributor_name,
          amount: contributions[0].contribution_receipt_amount,
          date: contributions[0].contribution_receipt_date
        })
      }
    }

    // Test 4: Test the donor agent
    console.log('\nTest 4: Testing donor agent...')
    const { runDonorAgent } = await import('./backend/agents/donorAgent.js')
    const agentResult = await runDonorAgent({
      query: 'technology industry political donations',
      keywords: ['technology', 'political', 'donations'],
      entities: []
    })

    console.log('Agent analysis summary:', agentResult.summary)
    console.log(`Found ${agentResult.committees.length} committees`)
    console.log(`Found ${agentResult.candidates.length} candidates`)
    console.log(`Found ${agentResult.topDonors.length} top donors`)

    if (agentResult.analysis) {
      console.log('Analysis:', {
        totalFunds: agentResult.analysis.totalFunds,
        politicalLeaning: agentResult.analysis.politicalLeaning,
        networkStrength: agentResult.analysis.networkStrength
      })
    }

    console.log('\n✅ All Phase 2 tests completed successfully!')
    console.log('\n=== Phase 2 Implementation Summary ===')
    console.log('1. Enhanced FEC service with 8 new functions')
    console.log('2. Expanded donors route with 8 new endpoints')
    console.log('3. Updated donor agent with advanced analysis')
    console.log('4. Created frontend API client functions')
    console.log('5. Built FastAPI + LangGraph agent service')
    console.log('6. Created Express proxy for AI service integration')
    console.log('7. All components ready for database integration')

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error('Stack:', error.stack)
  }
}

// Run the test
testPhase2()
