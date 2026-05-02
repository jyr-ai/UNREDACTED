import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } from 'd3'

/**
 * Custom force: pulls each node toward its cluster centroid.
 * Strength defaults to 0.08; scaled by alpha each tick.
 */
export function clusterForce(getCentroid, strength = 0.08) {
  let nodes
  function force(alpha) {
    const k = strength * alpha
    for (const n of nodes) {
      const c = getCentroid(n)
      if (!c) continue
      n.vx += (c.x - n.x) * k
      n.vy += (c.y - n.y) * k
    }
  }
  force.initialize = _nodes => { nodes = _nodes }
  return force
}

/**
 * Compute node radius for D3 collision.
 */
export function nodeRadius(n) {
  const deg = n.degree || 0
  if (n.kind === 'employer')   return Math.max(12, Math.min(22, 9 + deg * 1.2))
  if (n.kind === 'politician') return Math.max(4,  Math.min(8,  3 + deg * 0.3))
  return Math.max(9,  Math.min(14, 7 + deg * 0.6))    // trad_pac, dark_money, super_pac
}

export function buildSimulation({ nodes, links, centroids, width, height }) {
  const getCentroid = n => centroids.get(n.cluster) || centroids.get('__default__')

  const sim = forceSimulation(nodes)
    .force('link', forceLink(links).id(n => n.id).distance(l => 60 + (1 - (l.weight || 0)) * 80).strength(l => 0.15 + (l.weight || 0) * 0.4))
    .force('charge', forceManyBody().strength(-80))
    .force('collide', forceCollide().radius(n => nodeRadius(n) + 2).strength(0.9))
    .force('cluster', clusterForce(getCentroid, 0.08))
    .force('x', forceX(width / 2).strength(0.02))
    .force('y', forceY(height / 2).strength(0.02))
    .alpha(1)
    .alphaDecay(0.028)

  // Run headless for 180 iterations to pre-stabilize
  for (let i = 0; i < 180; i++) sim.tick()
  return sim
}
