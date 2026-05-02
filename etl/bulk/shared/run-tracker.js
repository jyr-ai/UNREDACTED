import { sb } from './supabase.js'
import { supabaseReady } from './env.js'

export async function startRun({ source, cycle, fileUrl }) {
  if (!supabaseReady()) return null
  const { data, error } = await sb()
    .from('bulk_ingest_runs')
    .insert({
      source,
      cycle_or_period: String(cycle ?? ''),
      file_url: fileUrl,
      status: 'running',
    })
    .select('id')
    .single()
  if (error) {
    console.warn(`  [tracker] could not log run start: ${error.message}`)
    return null
  }
  return data?.id || null
}

export async function finishRun(runId, { status, rowsRead, rowsUpserted, rowsParquet, checksum, error }) {
  if (!supabaseReady() || !runId) return
  const { error: err } = await sb()
    .from('bulk_ingest_runs')
    .update({
      status,
      rows_read: rowsRead ?? 0,
      rows_upserted: rowsUpserted ?? 0,
      rows_parquet: rowsParquet ?? 0,
      file_checksum: checksum,
      error: error || null,
      finished_at: new Date().toISOString(),
    })
    .eq('id', runId)
  if (err) console.warn(`  [tracker] could not log run finish: ${err.message}`)
}
