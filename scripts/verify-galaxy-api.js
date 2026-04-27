#!/usr/bin/env node
/**
 * scripts/verify-galaxy-api.js
 *
 * Hits each /api/galaxy endpoint and asserts response shape matches the
 * spec (docs/superpowers/specs/2026-04-27-funding-flow-galaxy-design.md §7).
 *
 * Requires: server running (npm run dev:server) with GALAXY_ENABLED=true.
 * Usage: node scripts/verify-galaxy-api.js [baseUrl]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:3001'
let failures = 0
let passes = 0

function assert(cond, msg) {
  if (cond) { passes++; return }
  failures++
  console.error('  ✗', msg)
}

async function getJson(p) {
  const r = await fetch(`${BASE}${p}`)
  const body = await r.json().catch(() => ({}))
  return { status: r.status, body }
}

function assertEnvelope(env) {
  assert(Array.isArray(env.nodes), 'nodes is array')
  assert(Array.isArray(env.edges), 'edges is array')
  assert(Array.isArray(env.sectors), 'sectors is array')
  assert(Array.isArray(env.patterns), 'patterns is array')
  assert(env.meta && typeof env.meta.cycle === 'string', 'meta.cycle is string')
  assert(typeof env.meta.node_count === 'number', 'meta.node_count is number')
  assert(typeof env.meta.edge_count === 'number', 'meta.edge_count is number')
  for (const n of env.nodes.slice(0, 5)) {
    assert(typeof n.id === 'string' && /^(emp|cmt|pol):/.test(n.id), `node id prefixed: ${n.id}`)
    assert(['employer', 'trad_pac', 'dark_money', 'super_pac', 'politician'].includes(n.kind), `node kind valid: ${n.kind}`)
    assert(typeof n.label === 'string', 'node.label string')
    assert(typeof n.amount === 'number' && n.amount >= 0, 'node.amount number≥0')
    assert(typeof n.degree === 'number', 'node.degree number')
  }
  for (const e of env.edges.slice(0, 5)) {
    assert(typeof e.source === 'string', 'edge.source string')
    assert(typeof e.target === 'string', 'edge.target string')
    assert(typeof e.amount === 'number', 'edge.amount number')
    assert(typeof e.weight === 'number' && e.weight >= 0 && e.weight <= 1, 'edge.weight 0..1')
  }
}

async function main() {
  console.log(`[verify] base=${BASE}`)

  console.log('\n[GET /api/galaxy/universe?cycle=2024]')
  const u = await getJson('/api/galaxy/universe?cycle=2024')
  assert(u.status === 200, `universe status 200 (got ${u.status})`)
  if (u.status === 200) assertEnvelope(u.body)
  assert(u.body.meta?.node_count <= 500, 'universe nodes ≤ 500')

  const firstSector = u.body?.sectors?.[0]?.name
  if (firstSector) {
    console.log(`\n[GET /api/galaxy/sector/${firstSector}?cycle=2024]`)
    const s = await getJson(`/api/galaxy/sector/${encodeURIComponent(firstSector)}?cycle=2024`)
    assert(s.status === 200, `sector status 200 (got ${s.status})`)
    if (s.status === 200) assertEnvelope(s.body)
    assert(s.body.meta?.node_count <= 80, 'sector nodes ≤ 80')
  } else {
    console.warn('  (skip) no sectors returned by /universe')
  }

  const firstEmployer = u.body?.nodes?.find(n => n.kind === 'employer')
  if (firstEmployer) {
    const empId = firstEmployer.id.replace(/^emp:/, '')
    console.log(`\n[GET /api/galaxy/employer/${empId}?cycle=2024]`)
    const e = await getJson(`/api/galaxy/employer/${encodeURIComponent(empId)}?cycle=2024`)
    assert(e.status === 200, `employer status 200 (got ${e.status})`)
    if (e.status === 200) assertEnvelope(e.body)
    assert(e.body.meta?.node_count <= 40, 'employer nodes ≤ 40')
  } else {
    console.warn('  (skip) no employer node found in /universe')
  }

  const firstPattern = u.body?.patterns?.[0]
  if (firstPattern?.id) {
    console.log(`\n[GET /api/galaxy/patterns/${firstPattern.id}]`)
    const p = await getJson(`/api/galaxy/patterns/${firstPattern.id}`)
    assert(p.status === 200, `pattern status 200 (got ${p.status})`)
    assert(p.body?.pattern?.id === firstPattern.id, 'pattern id matches')
    assert(Array.isArray(p.body?.evidence?.nodes), 'evidence.nodes is array')
    assert(Array.isArray(p.body?.evidence?.edges), 'evidence.edges is array')
  } else {
    console.warn('  (skip) no patterns returned — GALAXY_AI_ENABLED=true and cron may not have run yet')
  }

  console.log(`\n[verify] ${passes} passed · ${failures} failed`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch(e => { console.error('[verify] FATAL', e); process.exit(2) })
