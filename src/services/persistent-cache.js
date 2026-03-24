/**
 * Persistent cache — three-tier storage for returning users.
 *
 * Tier 1: IndexedDB  (best: survives full page refreshes, stores large JSON)
 * Tier 2: localStorage (fallback: smaller payload limit ~5MB)
 * Tier 3: in-memory Map (always works; cleared on tab close)
 *
 * Used by bootstrap.js to pre-seed the hydrationCache on second+ visits,
 * so users see map data instantly before network requests complete.
 *
 * Usage:
 *   await persistentCache.set('news:geo:v1', data, 30 * 60 * 1000) // 30min TTL
 *   const data = await persistentCache.get('news:geo:v1')
 */

const DB_NAME    = 'unredacted-cache'
const DB_VERSION = 1
const STORE_NAME = 'kv'
const PREFIX     = 'unr_cache_'

// ── In-memory fallback ────────────────────────────────────────────────────────
const memCache = new Map()

// ── IndexedDB helpers ─────────────────────────────────────────────────────────
let _db = null

async function openDB() {
  if (_db) return _db
  if (typeof indexedDB === 'undefined') return null
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'k' })
        }
      }
      req.onsuccess = (e) => { _db = e.target.result; resolve(_db) }
      req.onerror   = ()  => resolve(null)
    } catch { resolve(null) }
  })
}

async function idbGet(key) {
  const db = await openDB()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx  = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(key)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror   = () => resolve(null)
    } catch { resolve(null) }
  })
}

async function idbSet(key, entry) {
  const db = await openDB()
  if (!db) return false
  return new Promise((resolve) => {
    try {
      const tx  = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).put(entry)
      req.onsuccess = () => resolve(true)
      req.onerror   = () => resolve(false)
    } catch { resolve(false) }
  })
}

// ── localStorage helpers ──────────────────────────────────────────────────────
function lsGet(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function lsSet(key, entry) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(entry))
    return true
  } catch { return false }
}

// ── Public API ────────────────────────────────────────────────────────────────

const persistentCache = {
  /**
   * Set a value in all available storage tiers.
   * @param {string} key
   * @param {*}      value     JSON-serializable data
   * @param {number} ttlMs     Time-to-live in milliseconds (default: 30 min)
   */
  async set(key, value, ttlMs = 30 * 60 * 1000) {
    const entry = { k: key, v: value, exp: Date.now() + ttlMs }
    memCache.set(key, entry)
    const ok = await idbSet(key, entry)
    if (!ok) lsSet(key, entry)
  },

  /**
   * Get a value. Returns null if expired or not found.
   * @param {string} key
   */
  async get(key) {
    // 1. memory
    const memEntry = memCache.get(key)
    if (memEntry) {
      if (Date.now() < memEntry.exp) return memEntry.v
      memCache.delete(key)
    }

    // 2. IndexedDB
    let entry = await idbGet(key)
    if (!entry) entry = lsGet(key)
    if (!entry) return null
    if (Date.now() > entry.exp) return null

    // Backfill memory tier
    memCache.set(key, entry)
    return entry.v
  },

  /** Clear all entries from all tiers. */
  async clear() {
    memCache.clear()
    const db = await openDB()
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).clear()
    }
    try {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith(PREFIX)) localStorage.removeItem(k)
      }
    } catch {}
  },
}

export default persistentCache
