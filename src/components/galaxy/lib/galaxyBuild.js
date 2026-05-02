/**
 * Pure functions: API envelope → D3 graph inputs.
 * No React, no DOM, no side effects. Easy to reason about in isolation.
 */

/**
 * Lays out per-sector centroids in a ring around the viewport center.
 */
export function computeCentroids(sectors, { width, height, radius } = {}) {
  const cx = (width ?? 800) / 2
  const cy = (height ?? 560) / 2
  const r  = radius ?? Math.min(cx, cy) * 0.65
  const n = Math.max(1, sectors.length)
  const map = new Map()
  sectors.forEach((s, i) => {
    const theta = (i / n) * Math.PI * 2 - Math.PI / 2
    map.set(s.name, { x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) })
  })
  map.set('__default__', { x: cx, y: cy })
  return map
}

/**
 * Assigns each node to a sector cluster by looking up node.sector or
 * falling back to __default__.
 */
export function assignClusters(nodes, centroids) {
  return nodes.map(n => ({
    ...n,
    cluster: n.sector && centroids.has(n.sector) ? n.sector : '__default__'
  }))
}

/**
 * Marks edges as "bridge" when source and target clusters differ.
 * D3's forceLink mutates source/target into node objects, so we keep
 * original string ids in `sourceId`/`targetId`.
 */
export function annotateEdges(edges, nodeById) {
  return edges.map(e => {
    const s = nodeById.get(e.source)
    const t = nodeById.get(e.target)
    const sameCluster = s?.cluster && t?.cluster && s.cluster === t.cluster
    return {
      sourceId: e.source,
      targetId: e.target,
      source: e.source,
      target: e.target,
      amount: e.amount,
      weight: e.weight,
      tier_from: e.tier_from,
      tier_to: e.tier_to,
      isBridge: !sameCluster
    }
  })
}

/**
 * Marks nodes that belong to a pattern's node_ids set so the galaxy can
 * highlight them on hover of a pattern flare.
 */
export function indexPatterns(patterns) {
  const nodeToPatterns = new Map()
  for (const p of patterns || []) {
    for (const nid of p.node_ids || []) {
      if (!nodeToPatterns.has(nid)) nodeToPatterns.set(nid, [])
      nodeToPatterns.get(nid).push(p.id)
    }
  }
  return nodeToPatterns
}

/**
 * One-call transform used by useGalaxyData.
 */
export function buildGraph(envelope, { width, height } = {}) {
  if (!envelope) return null
  const centroids = computeCentroids(envelope.sectors || [], { width, height })
  const nodes = assignClusters(envelope.nodes || [], centroids)
  const nodeById = new Map(nodes.map(n => [n.id, n]))
  const links = annotateEdges(envelope.edges || [], nodeById)
  const nodePatterns = indexPatterns(envelope.patterns || [])
  return { nodes, links, centroids, patterns: envelope.patterns || [], nodePatterns, sectors: envelope.sectors || [], meta: envelope.meta }
}
