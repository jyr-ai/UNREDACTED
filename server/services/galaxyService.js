/**
 * server/services/galaxyService.js
 *
 * Builds Funding Flow Galaxy responses from money_flow_edges + funding_flow_patterns.
 * Returns { nodes, edges, sectors, patterns, meta } envelopes per the API contract.
 */
import { ensure } from '../lib/supabase.js'

const SECTOR_COLORS = {
  'Finance':               '#4A7FFF',
  'Technology':            '#00AADD',
  'Healthcare':            '#44CC88',
  'Energy':                '#FFB84D',
  'Legal':                 '#CC88FF',
  'Real Estate':           '#FF8C42',
  'Defense':               '#FF4466',
  'Media & Entertainment': '#FF66AA',
  'Education':             '#66CCFF',
  'Labor / Unions':        '#FFDD44',
  'Consulting':            '#88BBFF',
  'Government / Politics': '#FF8844',
  'Retired / Inactive':    '#666666',
  'Other':                 '#444444'
}

export function nodeId(type, id) {
  if (type === 'employer') return `emp:${id}`
  if (type === 'politician' || type === 'candidate') return `pol:${id}`
  return `cmt:${id}`
}

/**
 * Given raw money_flow_edges rows, build the galaxy envelope.
 * is501c4 / isSuperPac are looked up from the accompanying committees map.
 */
export function buildEnvelope({ edges, committees, cycle, source = 'supabase' }) {
  const nodesMap = new Map()
  const degreeMap = new Map()
  const sectorTotals = new Map()
  let maxAmount = 0

  function upsertNode(type, id, label, sector, tier) {
    const nid = nodeId(type, id)
    if (!nodesMap.has(nid)) {
      const committee = committees.get(id)
      const kind =
        type === 'employer' ? 'employer' :
        type === 'politician' || type === 'candidate' ? 'politician' :
        committee?.is_super_pac ? 'super_pac' :
        committee?.is_501c4 ? 'dark_money' :
        'trad_pac'
      nodesMap.set(nid, {
        id: nid, kind, label: label || id,
        sector: sector || null,
        amount: 0, degree: 0,
        is_501c4:   !!committee?.is_501c4,
        is_super_pac: !!committee?.is_super_pac,
        tier: Number(tier) || null
      })
    }
    return nid
  }

  const builtEdges = []
  for (const e of edges) {
    const s = upsertNode(e.source_type, e.source_id, e.source_label, e.source_sector, e.source_tier)
    const t = upsertNode(e.target_type, e.target_id, e.target_label, e.target_sector, e.target_tier)
    const amt = Number(e.amount) || 0
    const sn = nodesMap.get(s), tn = nodesMap.get(t)
    sn.amount += amt; tn.amount += amt
    degreeMap.set(s, (degreeMap.get(s) || 0) + 1)
    degreeMap.set(t, (degreeMap.get(t) || 0) + 1)
    if (amt > maxAmount) maxAmount = amt
    builtEdges.push({
      source: s, target: t, amount: amt,
      weight: 0,                                          // filled after maxAmount known
      tier_from: Number(e.source_tier) || null,
      tier_to:   Number(e.target_tier) || null
    })
    const sec = sn.sector || tn.sector
    if (sec) sectorTotals.set(sec, (sectorTotals.get(sec) || 0) + amt)
  }

  for (const edge of builtEdges) edge.weight = maxAmount > 0 ? edge.amount / maxAmount : 0
  for (const node of nodesMap.values()) node.degree = degreeMap.get(node.id) || 0

  const sectors = Array.from(sectorTotals.entries())
    .map(([name, total_amount]) => ({
      name,
      color: SECTOR_COLORS[name] || '#444444',
      node_count: Array.from(nodesMap.values()).filter(n => n.sector === name).length,
      total_amount
    }))
    .sort((a, b) => b.total_amount - a.total_amount)

  return {
    nodes: Array.from(nodesMap.values()),
    edges: builtEdges,
    sectors,
    patterns: [],                                         // callers attach patterns when applicable
    meta: {
      cycle,
      generated_at: new Date().toISOString(),
      node_count: nodesMap.size,
      edge_count: builtEdges.length,
      source
    }
  }
}

/**
 * Fetch committee metadata for a set of committee IDs in one query.
 */
async function loadCommittees(db, committeeIds) {
  if (!committeeIds.length) return new Map()
  const { data, error } = await db
    .from('pac_committees')
    .select('committee_id, name, is_501c4, is_super_pac, connected_org_name')
    .in('committee_id', committeeIds)
  if (error) throw error
  const map = new Map()
  for (const c of data || []) map.set(c.committee_id, c)
  return map
}

function collectCommitteeIds(edges) {
  const ids = new Set()
  for (const e of edges) {
    if (e.source_type !== 'employer' && e.source_type !== 'politician' && e.source_type !== 'candidate') ids.add(e.source_id)
    if (e.target_type !== 'employer' && e.target_type !== 'politician' && e.target_type !== 'candidate') ids.add(e.target_id)
  }
  return Array.from(ids)
}

async function loadPatterns(db, cycle) {
  const { data, error } = await db
    .from('funding_flow_patterns')
    .select('id, pattern_type, title, narrative, explanation, sector, severity_score, node_ids, generated_at')
    .eq('cycle', cycle)
    .eq('visible', true)
    .order('generated_at', { ascending: false })
    .limit(30)
  if (error) throw error
  return data ?? []
}

/**
 * Universe mode — top N nodes across the whole cycle.
 */
export async function getUniverse({ cycle = '2024', nodeCap = 500 } = {}) {
  const db = ensure()
  const { data: edges, error } = await db
    .from('money_flow_edges')
    .select('source_id, source_type, source_tier, source_label, target_id, target_type, target_tier, target_label, amount, txn_count, cycle')
    .eq('cycle', cycle)
    .gt('amount', 0)
    .order('amount', { ascending: false })
    .limit(nodeCap * 3)                                   // each edge = 2 nodes; oversample to hit node cap after dedup
  if (error) throw error

  const committees = await loadCommittees(db, collectCommitteeIds(edges || []))
  const envelope = buildEnvelope({ edges: edges || [], committees, cycle })

  if (envelope.nodes.length > nodeCap) {
    const topNodeIds = new Set(
      [...envelope.nodes].sort((a, b) => b.amount - a.amount).slice(0, nodeCap).map(n => n.id)
    )
    envelope.nodes = envelope.nodes.filter(n => topNodeIds.has(n.id))
    envelope.edges = envelope.edges.filter(e => topNodeIds.has(e.source) && topNodeIds.has(e.target))
    envelope.meta.node_count = envelope.nodes.length
    envelope.meta.edge_count = envelope.edges.length
  }

  if (process.env.GALAXY_AI_ENABLED === 'true') {
    envelope.patterns = await loadPatterns(db, cycle)
  }
  return envelope
}

/**
 * Sector mode — all edges where either end's sector matches.
 */
export async function getSector({ cycle = '2024', sector, nodeCap = 80 } = {}) {
  if (!sector) throw new Error('sector is required')
  const db = ensure()

  // Sector filter: employer sector OR committee sector
  const { data: edges, error } = await db
    .from('money_flow_edges')
    .select('source_id, source_type, source_tier, source_label, source_sector, target_id, target_type, target_tier, target_label, target_sector, amount, txn_count, cycle')
    .eq('cycle', cycle)
    .or(`source_sector.eq.${sector},target_sector.eq.${sector}`)
    .gt('amount', 0)
    .order('amount', { ascending: false })
    .limit(nodeCap * 3)
  if (error) throw error

  const committees = await loadCommittees(db, collectCommitteeIds(edges || []))
  const envelope = buildEnvelope({ edges: edges || [], committees, cycle })

  if (envelope.nodes.length > nodeCap) {
    const topNodeIds = new Set(
      [...envelope.nodes].sort((a, b) => b.amount - a.amount).slice(0, nodeCap).map(n => n.id)
    )
    envelope.nodes = envelope.nodes.filter(n => topNodeIds.has(n.id))
    envelope.edges = envelope.edges.filter(e => topNodeIds.has(e.source) && topNodeIds.has(e.target))
    envelope.meta.node_count = envelope.nodes.length
    envelope.meta.edge_count = envelope.edges.length
  }
  envelope.meta.scope = { mode: 'sector', sector }
  return envelope
}

/**
 * Employer mode — network around a single employer.
 * Walks 2 hops: employer → committees → politicians.
 */
export async function getEmployer({ cycle = '2024', employerId, nodeCap = 40 } = {}) {
  if (!employerId) throw new Error('employerId is required')
  const db = ensure()

  // Hop 1: employer → committee
  const { data: hop1, error: e1 } = await db
    .from('money_flow_edges')
    .select('source_id, source_type, source_tier, source_label, target_id, target_type, target_tier, target_label, amount, txn_count, cycle')
    .eq('cycle', cycle)
    .eq('source_type', 'employer')
    .eq('source_id', employerId)
    .gt('amount', 0)
    .order('amount', { ascending: false })
    .limit(50)
  if (e1) throw e1
  const committeeIds = Array.from(new Set((hop1 || []).map(e => e.target_id)))

  // Hop 2: committee → politician (only for committees the employer touches)
  let hop2 = []
  if (committeeIds.length) {
    const { data, error } = await db
      .from('money_flow_edges')
      .select('source_id, source_type, source_tier, source_label, target_id, target_type, target_tier, target_label, amount, txn_count, cycle')
      .eq('cycle', cycle)
      .in('source_id', committeeIds)
      .gt('amount', 0)
      .order('amount', { ascending: false })
      .limit(100)
    if (error) throw error
    hop2 = data || []
  }

  const edges = [...(hop1 || []), ...hop2]
  const committees = await loadCommittees(db, collectCommitteeIds(edges))
  const envelope = buildEnvelope({ edges, committees, cycle })

  if (envelope.nodes.length > nodeCap) {
    // Keep the employer + its committees + top politicians; trim the rest
    const keep = new Set()
    keep.add(nodeId('employer', employerId))
    for (const id of committeeIds) keep.add(nodeId('committee', id))
    const sortedPols = envelope.nodes
      .filter(n => n.kind === 'politician')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, nodeCap - keep.size)
    for (const p of sortedPols) keep.add(p.id)
    envelope.nodes = envelope.nodes.filter(n => keep.has(n.id))
    envelope.edges = envelope.edges.filter(e => keep.has(e.source) && keep.has(e.target))
    envelope.meta.node_count = envelope.nodes.length
    envelope.meta.edge_count = envelope.edges.length
  }
  envelope.meta.scope = { mode: 'employer', employerId }
  return envelope
}

/**
 * Pattern detail mode — returns the pattern + its fully expanded evidence
 * nodes/edges by looking up each node_id in money_flow_edges.
 */
export async function getPatternDetail({ patternId } = {}) {
  if (!patternId) throw new Error('patternId is required')
  const db = ensure()

  const { data: pattern, error: pe } = await db
    .from('funding_flow_patterns')
    .select('*')
    .eq('id', patternId)
    .eq('visible', true)
    .maybeSingle()
  if (pe) throw pe
  if (!pattern) return null

  // Parse node_ids into {type,id} then fetch matching edges
  const parsed = (pattern.node_ids || []).map(nid => {
    const [prefix, rawId] = nid.split(':', 2)
    const type = prefix === 'emp' ? 'employer' : prefix === 'pol' ? 'candidate' : 'committee'
    return { type, id: rawId, nid }
  })
  const employerIds   = parsed.filter(p => p.type === 'employer').map(p => p.id)
  const committeeIds  = parsed.filter(p => p.type === 'committee').map(p => p.id)
  const politicianIds = parsed.filter(p => p.type === 'candidate').map(p => p.id)

  // Union query: edges touching any of the involved IDs (limited for safety)
  const orFilters = [
    employerIds.length   ? `and(source_type.eq.employer,source_id.in.(${employerIds.map(x => `"${x}"`).join(',')}))` : null,
    committeeIds.length  ? `source_id.in.(${committeeIds.map(x => `"${x}"`).join(',')})` : null,
    committeeIds.length  ? `target_id.in.(${committeeIds.map(x => `"${x}"`).join(',')})` : null,
    politicianIds.length ? `and(target_type.in.("candidate","politician"),target_id.in.(${politicianIds.map(x => `"${x}"`).join(',')}))` : null
  ].filter(Boolean)

  if (!orFilters.length) return { pattern, evidence: { nodes: [], edges: [] } }

  const { data: edges, error: ee } = await db
    .from('money_flow_edges')
    .select('source_id, source_type, source_tier, source_label, source_sector, target_id, target_type, target_tier, target_label, target_sector, amount, cycle')
    .eq('cycle', pattern.cycle)
    .or(orFilters.join(','))
    .gt('amount', 0)
    .order('amount', { ascending: false })
    .limit(200)
  if (ee) throw ee

  const committees = await loadCommittees(db, collectCommitteeIds(edges || []))
  const envelope = buildEnvelope({ edges: edges || [], committees, cycle: pattern.cycle })
  return { pattern, evidence: { nodes: envelope.nodes, edges: envelope.edges } }
}
