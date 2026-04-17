import { createClient } from '@supabase/supabase-js'
import { env, supabaseReady } from './env.js'

let _client = null
export function sb() {
  if (!supabaseReady()) return null
  if (_client) return _client
  _client = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
    auth: { persistSession: false },
  })
  return _client
}

/**
 * Deduplicate a batch by the onConflict key(s) so Postgres never sees two rows
 * with the same PK in one upsert — that causes "ON CONFLICT DO UPDATE command
 * cannot affect row a second time".  Last row wins on collision.
 */
function dedupBatch(rows, onConflict) {
  if (!onConflict) return rows
  const keys = onConflict.split(',').map(k => k.trim())
  const seen = new Map()
  for (const row of rows) {
    const key = keys.map(k => row[k]).join('\x00')
    seen.set(key, row)
  }
  return [...seen.values()]
}

/**
 * Batch-upsert rows into a Supabase table.
 * Returns { upserted, batches, skipped } — skipped = 0 or 1 (if Supabase disabled).
 *
 * batchSize default is 250 (down from 1000) to stay within Supabase Free tier's
 * statement_timeout on large tables like contributions (~1M+ rows).
 */
export async function upsertBatched(table, rows, { onConflict, batchSize = 250 } = {}) {
  if (!supabaseReady()) {
    console.log(`  [supabase] skipped (disabled) — would upsert ${rows.length} rows into ${table}`)
    return { upserted: 0, batches: 0, skipped: 1 }
  }
  const client = sb()
  let upserted = 0
  let batches = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = dedupBatch(rows.slice(i, i + batchSize), onConflict)
    const { error } = await client.from(table).upsert(batch, { onConflict, ignoreDuplicates: false })
    if (error) {
      console.error(`  [supabase] batch ${batches} failed: ${error.message}`)
      throw new Error(`Supabase upsert into ${table} failed: ${error.message}`)
    }
    upserted += batch.length
    batches += 1
    if (batches % 20 === 0) console.log(`  [supabase] upserted ${upserted}/${rows.length} into ${table}`)
  }
  return { upserted, batches, skipped: 0 }
}
