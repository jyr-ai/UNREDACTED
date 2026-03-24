/**
 * DataFreshnessTracker — singleton that tracks when each data source was last
 * successfully loaded and emits a status for each.
 *
 * Statuses: 'fresh' | 'stale' | 'very_stale' | 'no_data' | 'error'
 * Thresholds:
 *   fresh:      < 15 min
 *   stale:      < 2 hours
 *   very_stale: < 6 hours
 *   no_data:    never loaded (or > 6 hours)
 *   error:      last attempt threw
 */

const THRESHOLDS = {
  fresh:      15  * 60 * 1000,   // 15 min
  stale:       2  * 60 * 60 * 1000,   // 2 h
  very_stale:  6  * 60 * 60 * 1000,   // 6 h
}

class DataFreshnessTracker {
  constructor() {
    /** @type {Map<string, { lastUpdate: number|null, status: string, count: number }>} */
    this._sources = new Map()
  }

  /**
   * Call this when a data source is successfully loaded.
   * @param {string} key   e.g. 'fec:contributions:v1'
   * @param {number} count Number of records loaded
   */
  mark(key, count = 0) {
    this._sources.set(key, {
      lastUpdate: Date.now(),
      status: 'fresh',
      count,
      error: null,
    })
  }

  /**
   * Call this when a data source load fails.
   * @param {string} key
   * @param {Error|string} err
   */
  markError(key, err = '') {
    const existing = this._sources.get(key)
    this._sources.set(key, {
      lastUpdate: existing?.lastUpdate ?? null,
      status: 'error',
      count: existing?.count ?? 0,
      error: err?.message ?? String(err),
    })
  }

  /**
   * Get current status for a key (recalculates age-based status).
   * @param {string} key
   */
  getStatus(key) {
    const entry = this._sources.get(key)
    if (!entry || entry.lastUpdate === null) return 'no_data'
    if (entry.status === 'error') return 'error'
    const age = Date.now() - entry.lastUpdate
    if (age < THRESHOLDS.fresh)      return 'fresh'
    if (age < THRESHOLDS.stale)      return 'stale'
    if (age < THRESHOLDS.very_stale) return 'very_stale'
    return 'no_data'
  }

  /**
   * Get full snapshot of all tracked sources.
   */
  getSnapshot() {
    const out = {}
    for (const [key] of this._sources) {
      const entry = this._sources.get(key)
      out[key] = {
        ...entry,
        currentStatus: this.getStatus(key),
        ageMinutes: entry?.lastUpdate
          ? Math.round((Date.now() - entry.lastUpdate) / 60000)
          : null,
      }
    }
    return out
  }

  /** Returns true if every tracked key is at least 'stale' (not error/no_data). */
  isHealthy() {
    for (const [key] of this._sources) {
      const s = this.getStatus(key)
      if (s === 'no_data' || s === 'error') return false
    }
    return this._sources.size > 0
  }
}

// Export singleton
const tracker = new DataFreshnessTracker()
export default tracker
