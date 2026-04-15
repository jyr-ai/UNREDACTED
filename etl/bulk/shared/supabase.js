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
 * Batch-upsert rows into a Supabase table.
 * Returns { upserted, batches, skipped } — skipped = 0 or 1 (if Supabase disabled).
 */
export async function upsertBatched(table, rows, { onConflict, batchSize = 1000 } = {}) {
  if (!supabaseReady()) {
    console.log(`  [supabase] skipped (disabled) — would upsert ${rows.length} rows into ${table}`)
    return { upserted: 0, batches: 0, skipped: 1 }
  }
  const client = sb()
  let upserted = 0
  let batches = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await client.from(table).upsert(batch, { onConflict, ignoreDuplicates: false })
    if (error) {
      console.error(`  [supabase] batch ${batches} failed: ${error.message}`)
      throw new Error(`Supabase upsert into ${table} failed: ${error.message}`)
    }
    upserted += batch.length
    batches += 1
    if (batches % 10 === 0) console.log(`  [supabase] upserted ${upserted}/${rows.length} into ${table}`)
  }
  return { upserted, batches, skipped: 0 }
}
