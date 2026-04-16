// FEC Electioneering Communications → electioneering_comms + R2 Parquet.
//
// Story unlocked: disguised-issue-ad exposure — corp/union "issue ads" that
// mention candidates near elections without explicitly saying "vote for/against."
// These circumvent normal disclosure rules.
//
// URL: https://www.fec.gov/files/bulk-downloads/{YYYY}/ElectioneeringComm_{YYYY}.csv
// Direct CSV download — no ZIP extraction needed.

import { ELECTIONEERING } from '../shared/fec-schemas.js'
import { downloadFile, fileChecksum } from '../shared/downloader.js'
import { openFecView, parquetS3Path } from '../shared/duck.js'
import { upsertBatched } from '../shared/supabase.js'
import { startRun, finishRun } from '../shared/run-tracker.js'

export async function ingestElectioneering({ cycle, dryRun = false }) {
  const source = 'fec_electioneering'
  const url = `https://www.fec.gov/files/bulk-downloads/${cycle}/ElectioneeringComm_${cycle}.csv`
  console.log(`\n[${source}] cycle=${cycle} ${dryRun ? '(DRY RUN)' : ''}`)
  const runId = dryRun ? null : await startRun({ source, cycle, fileUrl: url })

  try {
    const txtPath = await downloadFile(url)
    if (!txtPath) {
      await finishRun(runId, { status: 'ok', rowsRead: 0, rowsParquet: 0, rowsUpserted: 0 })
      console.log(`[${source}] skipped — file not available for cycle ${cycle}`)
      return { source, cycle, rowsRead: 0, rowsUpserted: 0 }
    }
    const checksum = fileChecksum(txtPath)

    const view = await openFecView({ filePath: txtPath, ...ELECTIONEERING, viewName: 'ec_raw' })
    const [{ count }] = await view.run(`SELECT COUNT(*) AS count FROM ec_raw`)
    console.log(`  [parsed] ${count} electioneering rows`)

    // ─── Cold: full Parquet to R2 ─────────────────────────────────────────────
    const parquetKey = `fec/electioneering/cycle=${cycle}/part-0001.parquet`
    if (!dryRun) {
      await view.exec(`
        COPY (SELECT *, ${cycle} AS _cycle FROM ec_raw)
        TO '${parquetS3Path(parquetKey)}'
        (FORMAT PARQUET, COMPRESSION 'ZSTD', OVERWRITE_OR_IGNORE);
      `)
      console.log(`  [r2] wrote ${parquetKey}`)
    }

    // ─── Hot tier: all rows (small file, <50 MB/cycle) ────────────────────────
    const fecDate = s => {
      if (!s || String(s).length !== 8) return null
      const ss = String(s)
      return `${ss.slice(4, 8)}-${ss.slice(0, 2)}-${ss.slice(2, 4)}`
    }

    const rows = await view.run(`
      SELECT
        SUB_ID         AS sub_id,
        CMTE_ID        AS committee_id,
        CAND_ID        AS candidate_mentioned,
        RECEIPT_DT     AS date_str,
        AMT_OF_COMM    AS amount,
        PAYEE_NM       AS payee_name,
        PURPOSE        AS purpose,
        FEC_ELECTION_YR AS election_yr
      FROM ec_raw
      WHERE SUB_ID IS NOT NULL
    `)

    const ecs = rows.map(r => ({
      sub_id:             Number(r.sub_id),
      committee_id:       r.committee_id       || null,
      candidate_mentioned:r.candidate_mentioned|| null,
      comm_date:          fecDate(r.date_str),
      amount:             Number(r.amount || 0),
      payee_name:         r.payee_name || null,
      purpose:            r.purpose    || null,
      cycle:              r.election_yr ? Number(r.election_yr) : cycle,
    }))

    view.close()

    let upsertedCount = 0
    if (!dryRun && ecs.length) {
      const { upserted } = await upsertBatched('electioneering_comms', ecs, {
        onConflict: 'sub_id',
      })
      upsertedCount = upserted
    }

    await finishRun(runId, {
      status: 'ok', rowsRead: Number(count), rowsParquet: Number(count),
      rowsUpserted: upsertedCount, checksum,
    })
    console.log(`[${source}] done: read=${count} parquet=${count} hot=${upsertedCount}`)
    return { source, cycle, rowsRead: Number(count), rowsUpserted: upsertedCount }
  } catch (err) {
    await finishRun(runId, { status: 'error', error: err.message })
    throw err
  }
}
