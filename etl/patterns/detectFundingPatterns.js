#!/usr/bin/env node
/**
 * etl/patterns/detectFundingPatterns.js
 *
 * Standalone Node script: fetches top money_flow_edges, calls Claude Sonnet 4.6
 * via forced tool use to extract money-flow patterns, validates, and upserts
 * into funding_flow_patterns.
 *
 * Run manually:  node etl/patterns/detectFundingPatterns.js --cycle 2024
 * Run via cron:  hit /api/cron/detect-funding-patterns on Vercel
 */
import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const CYCLE = process.argv.includes('--cycle')
  ? process.argv[process.argv.indexOf('--cycle') + 1]
  : (process.env.PATTERN_CYCLE || '2024')

const TOP_N_EDGES = 400
const DEDUP_WINDOW_DAYS = 14
const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 5000

function env(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
const anthropic = new Anthropic({ apiKey: env('ANTHROPIC_API_KEY') })

async function fetchTopEdges(cycle) {
  const { data, error } = await supabase
    .from('money_flow_edges')
    .select('source_id, source_type, source_tier, source_label, target_id, target_type, target_tier, target_label, amount, txn_count, cycle')
    .eq('cycle', cycle)
    .gt('amount', 0)
    .order('amount', { ascending: false })
    .limit(TOP_N_EDGES)
  if (error) throw error
  return data ?? []
}

async function fetchRecentPatterns(cycle) {
  const since = new Date(Date.now() - DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('funding_flow_patterns')
    .select('id, title, pattern_type, sector, node_ids')
    .eq('cycle', cycle)
    .gte('generated_at', since)
    .order('generated_at', { ascending: false })
    .limit(30)
  if (error) throw error
  return data ?? []
}

async function main() {
  console.log(`[patterns] starting detection for cycle=${CYCLE}`)
  const edges = await fetchTopEdges(CYCLE)
  console.log(`[patterns] fetched ${edges.length} top edges`)
  if (edges.length < 20) {
    console.log('[patterns] insufficient data (<20 edges); skipping run')
    return { ok: true, skipped: true, reason: 'insufficient_data' }
  }
  let recents = []
  try {
    recents = await fetchRecentPatterns(CYCLE)
  } catch (e) {
    if (e && e.code === 'PGRST205') {
      console.warn('[patterns] funding_flow_patterns table not yet migrated — dedup skipped')
    } else {
      throw e
    }
  }
  console.log(`[patterns] fetched ${recents.length} recent patterns for dedup`)
  // Steps 2-5 added in Task 4
  return { ok: true, edges: edges.length, recents: recents.length }
}

const _argv1 = process.argv[1] ? `file:///${process.argv[1].replace(/\\/g, '/').replace(/^\//, '')}` : ''
if (import.meta.url === _argv1) {
  main()
    .then(r => { console.log('[patterns] done', JSON.stringify(r)); process.exit(0) })
    .catch(e => { console.error('[patterns] FATAL', e); process.exit(1) })
}

export { main, fetchTopEdges, fetchRecentPatterns }
