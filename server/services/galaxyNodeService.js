import { ensure } from '../lib/supabase.js'
import { classifySector } from '../lib/sectorClassifier.js'

function parseNodeId(nodeId) {
  const i = nodeId.indexOf(':')
  if (i === -1) throw new Error(`Invalid node ID — expected 'prefix:rawId', got: ${nodeId}`)
  const kind = nodeId.slice(0, i)
  const rawId = nodeId.slice(i + 1)
  if (!['emp', 'cmt', 'pol'].includes(kind)) throw new Error(`Invalid node prefix: ${kind}`)
  if (kind !== 'emp' && !/^[A-Z0-9]{1,30}$/i.test(rawId)) throw new Error(`Invalid rawId for ${kind}: ${rawId}`)
  return { kind, rawId }
}

function cycleRange(cycle) {
  const y = parseInt(cycle)
  return { start: `${y - 1}-01-01`, end: `${y}-12-31`, year: y }
}

export async function getNodeDetail({ nodeId, cycle = '2024' }) {
  const db = ensure()
  const { kind, rawId } = parseNodeId(nodeId)

  // ── 1. 1-hop subgraph ────────────────────────────────────────────────────
  const { data: edgeRows, error: edgeErr } = await db
    .from('money_flow_edges')
    .select('source_type,source_id,source_label,target_type,target_id,target_label,amount,txn_count,source_tier,target_tier')
    .or(`source_id.eq.${rawId},target_id.eq.${rawId}`)
    .eq('cycle', parseInt(cycle))
    .order('amount', { ascending: false })
    .limit(50)
  if (edgeErr) throw edgeErr
  const edges = edgeRows || []

  // ── 2. Collect IDs for label joins ───────────────────────────────────────
  const committeeIds = new Set()
  const candidateIds = new Set()
  for (const e of edges) {
    if (e.source_type !== 'employer' && e.source_type !== 'candidate' && e.source_type !== 'politician') committeeIds.add(e.source_id)
    if (e.target_type !== 'employer' && e.target_type !== 'candidate' && e.target_type !== 'politician') committeeIds.add(e.target_id)
    if (e.source_type === 'candidate') candidateIds.add(e.source_id)
    if (e.target_type === 'candidate') candidateIds.add(e.target_id)
  }

  // ── 3. Parallel label lookups ────────────────────────────────────────────
  const [cmtRes, polRes] = await Promise.all([
    committeeIds.size
      ? db.from('pac_committees').select('committee_id,name,is_super_pac,is_501c4').in('committee_id', [...committeeIds])
      : { data: [] },
    candidateIds.size
      ? db.from('politicians').select('fec_candidate_id,name,party,state,chamber,bioguide_id').in('fec_candidate_id', [...candidateIds])
      : { data: [] },
  ])
  const cmtMap = new Map((cmtRes.data || []).map(c => [c.committee_id, c]))
  const polMap = new Map((polRes.data || []).map(p => [p.fec_candidate_id, p]))

  // ── 4. Build nodes + edges ───────────────────────────────────────────────
  const nodesMap = new Map()

  function upsertNode(type, id, rawLabel) {
    const prefix = type === 'employer' ? 'emp' : type === 'candidate' ? 'pol' : 'cmt'
    const nid = `${prefix}:${id}`
    if (!nodesMap.has(nid)) {
      const pol = polMap.get(id)
      const cmt = cmtMap.get(id)
      const label = type === 'candidate' ? (pol?.name || rawLabel || id)
                  : type !== 'employer'  ? (cmt?.name || rawLabel || id)
                  : (rawLabel || id)
      nodesMap.set(nid, {
        id: nid,
        kind: type === 'employer' ? 'employer'
            : type === 'candidate' ? 'politician'
            : cmt?.is_super_pac ? 'super_pac'
            : cmt?.is_501c4   ? 'dark_money'
            : 'trad_pac',
        label,
        sector: type === 'employer' ? classifySector(label) : null,
        party:       pol?.party      || null,
        state:       pol?.state      || null,
        chamber:     pol?.chamber    || null,
        bioguide_id: pol?.bioguide_id || null,
        is_super_pac: !!cmt?.is_super_pac,
        is_501c4:     !!cmt?.is_501c4,
        amount: 0, degree: 0,
      })
    }
    return nid
  }

  const builtEdges = []
  for (const e of edges) {
    const sId = upsertNode(e.source_type, e.source_id, e.source_label)
    const tId = upsertNode(e.target_type, e.target_id, e.target_label)
    const amt = Number(e.amount) || 0
    const sn = nodesMap.get(sId), tn = nodesMap.get(tId)
    sn.amount += amt; sn.degree++; tn.degree++
    builtEdges.push({ source: sId, target: tId, amount: amt, weight: 0 })
  }
  const maxAmt = Math.max(...builtEdges.map(e => e.amount), 1)
  for (const e of builtEdges) e.weight = e.amount / maxAmt

  // Ensure focal node exists even if it has no edges in MV
  if (!nodesMap.has(nodeId)) {
    const typeMap = { emp: 'employer', cmt: 'trad_pac', pol: 'candidate' }
    upsertNode(typeMap[kind] || 'trad_pac', rawId, rawId)
  }
  const focalNode = nodesMap.get(nodeId)

  // ── 5. Timeline ──────────────────────────────────────────────────────────
  const { start, end, year } = cycleRange(cycle)
  const timeline = []

  if (kind === 'emp') {
    const { data: receipts, error: empErr } = await db
      .from('contributions')
      .select('contributor_employer,committee_id,amount,date')
      .ilike('contributor_employer', rawId)
      .gte('date', start).lte('date', end)
      .order('date', { ascending: true }).limit(50)
    if (empErr) throw empErr
    for (const r of receipts || []) {
      timeline.push({
        date: r.date, kind: 'receipt',
        from_label: r.contributor_employer || rawId,
        from_id: nodeId,
        to_label: cmtMap.get(r.committee_id)?.name || r.committee_id,
        to_id: `cmt:${r.committee_id}`,
        amount: Number(r.amount),
      })
    }
  } else if (kind === 'cmt') {
    const [{ data: receipts, error: rcptErr }, { data: transfers, error: trfErr }] = await Promise.all([
      db.from('contributions').select('contributor_employer,committee_id,amount,date')
        .eq('committee_id', rawId).gte('date', start).lte('date', end)
        .order('date', { ascending: true }).limit(25),
      db.from('committee_transfers').select('from_committee_id,to_committee_id,transfer_amount,transfer_date')
        .or(`from_committee_id.eq.${rawId},to_committee_id.eq.${rawId}`)
        .eq('cycle', year).order('transfer_date', { ascending: true }).limit(25),
    ])
    if (rcptErr) throw rcptErr
    if (trfErr) throw trfErr
    // Second-pass: resolve committee IDs in transfers not in cmtMap
    const cmtUnresolved = new Set()
    for (const t of transfers || []) {
      if (!cmtMap.has(t.from_committee_id)) cmtUnresolved.add(t.from_committee_id)
      if (!cmtMap.has(t.to_committee_id))   cmtUnresolved.add(t.to_committee_id)
    }
    if (cmtUnresolved.size) {
      const { data: extraCmts } = await db
        .from('pac_committees').select('committee_id,name,is_super_pac,is_501c4')
        .in('committee_id', [...cmtUnresolved])
      for (const c of extraCmts || []) cmtMap.set(c.committee_id, c)
    }
    for (const r of receipts || []) {
      timeline.push({
        date: r.date, kind: 'receipt',
        from_label: r.contributor_employer || 'Unknown',
        from_id: `emp:${(r.contributor_employer || 'unknown').toLowerCase()}`,
        to_label: cmtMap.get(rawId)?.name || rawId,
        to_id: nodeId,
        amount: Number(r.amount),
      })
    }
    for (const t of transfers || []) {
      if (!t.transfer_date) continue
      timeline.push({
        date: t.transfer_date, kind: 'transfer',
        from_label: cmtMap.get(t.from_committee_id)?.name || t.from_committee_id,
        from_id: `cmt:${t.from_committee_id}`,
        to_label: cmtMap.get(t.to_committee_id)?.name || t.to_committee_id,
        to_id: `cmt:${t.to_committee_id}`,
        amount: Number(t.transfer_amount),
      })
    }
  } else if (kind === 'pol') {
    const cmtIds = [...nodesMap.values()]
      .filter(n => n.kind !== 'politician' && n.kind !== 'employer')
      .map(n => n.id.slice(4))   // strip 'cmt:'
    if (cmtIds.length) {
      const { data: transfers, error: polTrfErr } = await db
        .from('committee_transfers').select('from_committee_id,to_committee_id,transfer_amount,transfer_date')
        .or(`from_committee_id.in.(${cmtIds.join(',')}),to_committee_id.in.(${cmtIds.join(',')})`)
        .eq('cycle', year).order('transfer_date', { ascending: true }).limit(50)
      if (polTrfErr) throw polTrfErr

      // Collect committee IDs from transfer rows that aren't already in cmtMap (second-pass resolution)
      const unresolvedIds = new Set()
      for (const t of transfers || []) {
        if (!cmtMap.has(t.from_committee_id)) unresolvedIds.add(t.from_committee_id)
        if (!cmtMap.has(t.to_committee_id))   unresolvedIds.add(t.to_committee_id)
      }
      if (unresolvedIds.size) {
        const { data: extraCmts } = await db
          .from('pac_committees').select('committee_id,name,is_super_pac,is_501c4')
          .in('committee_id', [...unresolvedIds])
        for (const c of extraCmts || []) cmtMap.set(c.committee_id, c)
      }

      for (const t of transfers || []) {
        if (!t.transfer_date) continue
        timeline.push({
          date: t.transfer_date, kind: 'transfer',
          from_label: cmtMap.get(t.from_committee_id)?.name || t.from_committee_id,
          from_id: `cmt:${t.from_committee_id}`,
          to_label: cmtMap.get(t.to_committee_id)?.name || t.to_committee_id,
          to_id: `cmt:${t.to_committee_id}`,
          amount: Number(t.transfer_amount),
        })
      }
    }
  }

  timeline.sort((a, b) => new Date(a.date) - new Date(b.date))

  // ── 6. Patterns ──────────────────────────────────────────────────────────
  const { data: patternRows, error: patErr } = await db
    .from('funding_flow_patterns')
    .select('id,pattern_type,title,narrative,explanation,sector,severity_score,generated_at')
    .contains('node_ids', [nodeId])
    .eq('visible', true)
    .order('severity_score', { ascending: false })
  if (patErr) throw patErr

  return {
    node:     focalNode,
    nodes:    [...nodesMap.values()],
    edges:    builtEdges,
    timeline,
    patterns: patternRows || [],
  }
}
