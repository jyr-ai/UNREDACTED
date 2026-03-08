import Groq from 'groq-sdk'
import { runPolicyAgent } from './policyAgent.js'
import { runSpendingAgent } from './spendingAgent.js'
import { runCorruptionAgent } from './corruptionAgent.js'
import { runDonorAgent } from './donorAgent.js'

// Lazy init — dotenv hasn't loaded yet at import time in ESM
let _groq
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  return _groq
}

export async function orchestrate(userQuery) {
  // Step 1: Decompose the query
  const decomposition = await getGroq().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    response_format: { type: 'json_object' },
    max_tokens: 500,
    messages: [
      {
        role: 'system',
        content: `You are the orchestrator for R•CEIPTS, a corruption intelligence platform.
Given a user query, decompose it into tasks for sub-agents.
Respond ONLY with valid JSON:
{
  "intent": "brief description of what user wants",
  "policyTask": "what to fetch from Federal Register/GovInfo (or null)",
  "spendingTask": "what to fetch from USASpending (or null)",
  "donorTask": "what campaign finance / PAC data to look up (or null)",
  "corruptionFocus": "what pattern/anomaly to look for (or null)",
  "entities": ["list", "of", "key", "entities", "mentioned"],
  "keywords": ["search", "terms"]
}`,
      },
      { role: 'user', content: userQuery },
    ],
  })
  const plan = JSON.parse(decomposition.choices[0].message.content)

  // Step 2: Run all sub-agents in parallel
  const [policyResults, spendingResults, donorResults] = await Promise.all([
    plan.policyTask ? runPolicyAgent(plan) : Promise.resolve([]),
    plan.spendingTask ? runSpendingAgent(plan) : Promise.resolve({ contracts: [], grants: [] }),
    plan.donorTask ? runDonorAgent(plan) : Promise.resolve({ committees: [], candidates: [] }),
  ])

  // Step 3: Run corruption analysis with all data sources
  const corruptionResults = await runCorruptionAgent({
    plan,
    policyResults,
    spendingResults,
    donorResults,
    originalQuery: userQuery,
  })

  return {
    plan,
    policyResults,
    spendingResults,
    donorResults,
    ...corruptionResults,
  }
}
