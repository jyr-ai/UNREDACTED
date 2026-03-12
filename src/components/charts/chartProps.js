// Axis props factory (needs theme at call site)
export function axisProps(t) {
  return { axisLine: { stroke: t.border }, tickLine: false, tick: { fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 9.5, fill: t.mid } };
}

export function gridProps(t) {
  return { stroke: t.grid, vertical: false };
}
