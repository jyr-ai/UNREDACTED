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

const _cycleArg = process.argv.includes('--cycle')
  ? process.argv[process.argv.indexOf('--cycle') + 1]
  : null
if (_cycleArg !== null && (typeof _cycleArg === 'undefined' || _cycleArg.startsWith('--'))) {
  throw new Error('--cycle requires a value, e.g. --cycle 2024')
}
const CYCLE = _cycleArg || process.env.PATTERN_CYCLE || '2024'

const TOP_N_EDGES = 400
const DEDUP_WINDOW_DAYS = 14
const MODEL = 'claude-sonnet-4-6'

const CANONICAL_SECTORS = new Set([
  'Finance', 'Technology', 'Healthcare', 'Energy', 'Legal', 'Real Estate',
  'Defense', 'Media & Entertainment', 'Education', 'Labor / Unions',
  'Consulting', 'Government / Politics', 'Retired / Inactive', 'Other'
])

const SECTOR_NORMALIZE = {
  'finance & investment': 'Finance', 'financial': 'Finance', 'banking': 'Finance',
  'technology & crypto': 'Technology', 'tech': 'Technology', 'crypto': 'Technology',
  'aerospace & defense': 'Defense', 'aerospace': 'Defense', 'military': 'Defense',
  'political operations': 'Government / Politics', 'politics': 'Government / Politics',
  'manufacturing & distribution': 'Other', 'manufacturing': 'Other',
  'gambling & hospitality': 'Other', 'gambling': 'Other', 'hospitality': 'Other',
  'media': 'Media & Entertainment', 'entertainment': 'Media & Entertainment',
  'labor': 'Labor / Unions', 'unions': 'Labor / Unions',
  'health': 'Healthcare', 'pharma': 'Healthcare',
  'real estate': 'Real Estate', 'realty': 'Real Estate',
  'law': 'Legal', 'legal services': 'Legal',
  'retired': 'Retired / Inactive', 'inactive': 'Retired / Inactive',
  'government': 'Government / Politics', 'oil': 'Energy', 'oil & gas': 'Energy',
}

function normalizeSector(s) {
  if (!s) return 'Other'
  if (CANONICAL_SECTORS.has(s)) return s
  return SECTOR_NORMALIZE[s.toLowerCase().trim()] || 'Other'
}
const MAX_TOKENS = 8000

const TOOL_SCHEMA = {
  name: 'extract_funding_patterns',
  description: 'Extract non-obvious money flow patterns from campaign-finance edge data.',
  input_schema: {
    type: 'object',
    properties: {
      patterns: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'narrative', 'explanation', 'pattern_type', 'node_ids', 'severity_score', 'sector'],
          properties: {
            title:          { type: 'string', maxLength: 90 },
            narrative:      { type: 'string', maxLength: 280 },
            explanation:    { type: 'string', maxLength: 800 },
            pattern_type:   { type: 'string', enum: ['sector_concentration', 'dark_money_pathway', 'committee_alignment', 'sudden_surge'] },
            sector:         { type: 'string' },
            node_ids:       { type: 'array', minItems: 3, items: { type: 'string' } },
            severity_score: { type: 'integer', minimum: 0, maximum: 10 }
          }
        }
      }
    },
    required: ['patterns']
  }
}

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

function nodeId(type, id) {
  if (type === 'employer') return `emp:${id}`
  if (type === 'candidate') return `pol:${id}`
  if (type === 'committee') return `cmt:${id}`
  console.warn(`[patterns] nodeId: unexpected type "${type}" for id "${id}"`)
  return `unk:${id}`
}

function formatEdgesForPrompt(edges) {
  const rows = edges.map(e => {
    const src = nodeId(e.source_type, e.source_id)
    const tgt = nodeId(e.target_type, e.target_id)
    const amt = Math.round(Number(e.amount) || 0).toLocaleString()
    return `${src} | ${e.source_label || '?'} → ${tgt} | ${e.target_label || '?'} | $${amt} | ${e.txn_count || 0} txns`
  })
  return rows.join('\n')
}

function formatRecentsForPrompt(recents) {
  if (!recents.length) return '(none — first run of the window)'
  return recents.map(r => `- [${r.pattern_type}] ${r.title} (sector: ${r.sector || 'n/a'})`).join('\n')
}

async function callClaude({ systemPrompt, edges, recents, cycle }) {
  const userPrompt = [
    `# Cycle`,
    cycle,
    ``,
    `# Recent patterns (last ${DEDUP_WINDOW_DAYS}d — do not duplicate)`,
    formatRecentsForPrompt(recents),
    ``,
    `# Top money flow edges (descending by amount)`,
    `Columns: source_id | source_label | → | target_id | target_label | amount | txn_count`,
    ``,
    formatEdgesForPrompt(edges),
    ``,
    `# Task`,
    `Analyze the edges above. Extract patterns matching the types defined in your system prompt. Call extract_funding_patterns with your final output.`
  ].join('\n')

  let res
  try {
    res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' }   // prompt-cache breakpoint: system block stable across weekly runs
        }
      ],
      tools: [TOOL_SCHEMA],
      tool_choice: { type: 'tool', name: TOOL_SCHEMA.name },
      messages: [{ role: 'user', content: userPrompt }]
    })
  } catch (e) {
    if (e?.status) {
      console.error(`[patterns] Claude API error status=${e.status}: ${e.message}`)
    }
    throw e
  }

  const toolUse = res.content.find(b => b.type === 'tool_use' && b.name === TOOL_SCHEMA.name)
  if (!toolUse) throw new Error('Claude did not return a tool_use block')
  return {
    patterns: toolUse.input?.patterns ?? [],
    usage: res.usage
  }
}

/**
 * Rejects patterns with: unknown node_ids, fewer than 3 nodes, invalid severity,
 * or sector mismatch. Returns { valid, rejected } arrays.
 */
function validatePatterns(patterns, edges) {
  const knownIds = new Set()
  edges.forEach(e => {
    knownIds.add(nodeId(e.source_type, e.source_id))
    knownIds.add(nodeId(e.target_type, e.target_id))
  })

  const valid = []
  const rejected = []
  for (const p of patterns) {
    const reasons = []
    if (!p.node_ids || p.node_ids.length < 3) reasons.push('too_few_nodes')
    const unknown = (p.node_ids || []).filter(id => !knownIds.has(id))
    if (unknown.length > 0) reasons.push(`unknown_nodes:${unknown.slice(0, 3).join(',')}`)
    if (typeof p.severity_score !== 'number' || p.severity_score < 0 || p.severity_score > 10 || !Number.isInteger(p.severity_score)) reasons.push('bad_severity')
    if (!p.pattern_type) reasons.push('missing_pattern_type')
    if (!p.sector) reasons.push('missing_sector')
    if (reasons.length) rejected.push({ pattern: p, reasons })
    else valid.push(p)
  }
  return { valid, rejected }
}

function normalizeTitle(s) {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim()
}

function levenshtein(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const v0 = new Array(b.length + 1).fill(0).map((_, i) => i)
  const v1 = new Array(b.length + 1).fill(0)
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost)
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j]
  }
  return v1[b.length]
}

function dedupAgainstRecents(patterns, recents) {
  const kept = []
  const dropped = []
  for (const p of patterns) {
    const np = normalizeTitle(p.title)
    const dup = recents.find(r => {
      const nr = normalizeTitle(r.title)
      if (nr === np) return true
      if (Math.abs(nr.length - np.length) > 5) return false
      return levenshtein(nr, np) <= 3
    })
    if (dup) dropped.push({ pattern: p, duplicateOf: dup.id })
    else kept.push(p)
  }
  return { kept, dropped }
}

function enrichPatterns(patterns, edges) {
  return patterns.map(p => {
    const ids = new Set(p.node_ids)
    const evidence = edges
      .filter(e => ids.has(nodeId(e.source_type, e.source_id)) || ids.has(nodeId(e.target_type, e.target_id)))
      .sort((a, b) => (b.amount || 0) - (a.amount || 0))
      .slice(0, 25)
      .map(e => ({
        source: nodeId(e.source_type, e.source_id),
        source_label: e.source_label,
        target: nodeId(e.target_type, e.target_id),
        target_label: e.target_label,
        amount: Number(e.amount) || 0
      }))
    return { ...p, evidence: { edges: evidence } }
  })
}

async function upsertPatterns(patterns, cycle) {
  if (!patterns.length) return { inserted: 0 }
  const rows = patterns.map(p => ({
    pattern_type:   p.pattern_type,
    title:          p.title,
    narrative:      p.narrative,
    explanation:    p.explanation,
    sector:         p.sector,
    node_ids:       p.node_ids,
    evidence:       p.evidence,
    cycle,
    severity_score: p.severity_score,
    generated_by:   MODEL,
    visible:        true
  }))
  const { data, error } = await supabase
    .from('funding_flow_patterns')
    .insert(rows)
    .select('id')
  if (error) throw error
  return { inserted: data?.length ?? 0 }
}

async function writeLog(summary) {
  const today = new Date().toISOString().slice(0, 10)
  const logPath = path.join(__dirname, 'logs', `${today}.json`)
  await fs.writeFile(logPath, JSON.stringify(summary, null, 2) + '\n', 'utf8')
  console.log(`[patterns] wrote log to ${logPath}`)
}

async function main() {
  const startedAt = new Date().toISOString()
  console.log(`[patterns] starting detection for cycle=${CYCLE} at ${startedAt}`)

  const edges = await fetchTopEdges(CYCLE)
  console.log(`[patterns] fetched ${edges.length} top edges`)
  if (edges.length < 20) {
    const summary = { ok: true, skipped: true, reason: 'insufficient_data', edges: edges.length }
    await writeLog({ startedAt, finishedAt: new Date().toISOString(), ...summary })
    return summary
  }

  let recents = []
  try {
    recents = await fetchRecentPatterns(CYCLE)
  } catch (err) {
    if (err?.code === 'PGRST205') {
      console.warn('[patterns] funding_flow_patterns table not yet migrated — dedup skipped')
    } else {
      throw err
    }
  }
  const systemPrompt = await fs.readFile(path.join(__dirname, 'prompts', 'system.md'), 'utf8')

  console.log('[patterns] calling Claude…')
  const { patterns: rawPatterns, usage } = await callClaude({ systemPrompt, edges, recents, cycle: CYCLE })
  console.log(`[patterns] got ${rawPatterns.length} candidate patterns (in: ${usage.input_tokens}, cached: ${usage.cache_read_input_tokens || 0}, out: ${usage.output_tokens})`)

  // Normalize Claude's free-form sector labels to canonical classifier names
  const patterns = rawPatterns.map(p => ({ ...p, sector: normalizeSector(p.sector) }))

  const { valid, rejected } = validatePatterns(patterns, edges)
  const { kept, dropped } = dedupAgainstRecents(valid, recents)
  const enriched = enrichPatterns(kept, edges)

  let inserted = 0
  try {
    const result = await upsertPatterns(enriched, CYCLE)
    inserted = result.inserted
  } catch (err) {
    if (err?.code === 'PGRST205' || err?.message?.includes('does not exist')) {
      console.warn('[patterns] funding_flow_patterns table not yet migrated — upsert skipped')
    } else {
      throw err
    }
  }

  const summary = {
    ok: true,
    startedAt,
    finishedAt: new Date().toISOString(),
    cycle: CYCLE,
    edges: edges.length,
    recents: recents.length,
    candidates: patterns.length,
    validated: valid.length,
    rejected: rejected.length,
    deduped: dropped.length,
    inserted,
    usage
  }
  await writeLog(summary)
  console.log('[patterns] summary:', JSON.stringify(summary, null, 2))
  return summary
}

const _argv1 = process.argv[1] ? `file:///${process.argv[1].replace(/\\/g, '/').replace(/^\//, '')}` : ''
if (import.meta.url === _argv1) {
  main()
    .then(r => { console.log('[patterns] done', JSON.stringify(r)); process.exit(0) })
    .catch(e => { console.error('[patterns] FATAL', e); process.exit(1) })
}

export { main, fetchTopEdges, fetchRecentPatterns }
