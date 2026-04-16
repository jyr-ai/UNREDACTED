// FEC Schedule E — Independent Expenditures (IEs) → independent_expenditures + R2 Parquet.
//
// Stories unlocked:
//   F. Attack-ad coordination — same media-buy vendors / timing across multiple SuperPACs
//      signals coordination that is nominally prohibited.
//
// URL: https://www.fec.gov/files/bulk-downloads/{cycle}/independent_expenditure{yy}.zip
// NOTE: Verify prefix on https://www.fec.gov/data/browse-data/?tab=bulk-data
//   Alternative prefix observed: 'indep_exp', 'ies' — update bulkUrl call below if 404.

import { IE, bulkUrl, bulkInnerFilename } from '../shared/fec-schemas.js'
import { downloadZip, extractZip, fileChecksum } from '../shared/downloader.js'
import { openFecView, parquetS3Path } from '../shared/duck.js'
import { upsertBatched } from '../shared/supabase.js'
import { startRun, finishRun } from '../shared/run-tracker.js'

export async function ingestIEs({ cycle, dryRun = false }) {
  const source = 'fec_ie'
  const url = bulkUrl('independent_expenditure', cycle)
  const innerName = bulkInnerFilename('independent_expenditure', cycle)
  console.log(`\n[${source}] cycle=${cycle} ${dryRun ? '(DRY RUN)' : ''}`)
  const runId = dryRun ? null : await startRun({ source, cycle, fileUrl: url })

  try {
    const zipPath = await downloadZip(url)
    const txtPath = extractZip(zipPath, innerName)
    const checksum = fileChecksum(zipPath)

    const view = await openFecView({ filePath: txtPath, ...IE, viewName: 'ie_raw' })
    const [{ count }] = await view.run(`SELECT COUNT(*) AS count FROM ie_raw`)
    console.log(`  [parsed] ${count} IE rows`)

    // ─── Cold: full Parquet to R2 ─────────────────────────────────────────────
    const parquetKey = `fec/ie/cycle=${cycle}/part-0001.parquet`
    if (!dryRun) {
      await view.exec(`
        COPY (SELECT *, ${cycle} AS _cycle FROM ie_raw)
        TO '${parquetS3Path(parquetKey)}'
        (FORMAT PARQUET, COMPRESSION 'ZSTD', OVERWRITE_OR_IGNORE);
      `)
      console.log(`  [r2] wrote ${parquetKey}`)
    }

    // ─── Hot tier: all IEs go to Supabase (file is small, <100 MB/cycle) ──────
    const fecDate = s => {
      if (!s || String(s).length !== 8) return null
      const ss = String(s)
      return `${ss.slice(4, 8)}-${ss.slice(0, 2)}-${ss.slice(2, 4)}`
    }

    const rows = await view.run(`
      SELECT
        SUB_ID          AS sub_id,
        CMTE_ID         AS committee_id,
        CAND_ID         AS candidate_id,
        S_O_IND         AS support_oppose,
        TRANSACTION_DT  AS date_str,
        TRANSACTION_AMT AS amount,
        PAYEE_NM        AS payee_name,
        CATG_DESC       AS purpose
      FROM ie_raw
      WHERE SUB_ID IS NOT NULL
    `)

    const ies = rows.map(r => ({
      sub_id:             Number(r.sub_id),
      committee_id:       r.committee_id  || null,
      candidate_id:       r.candidate_id  || null,
      support_oppose:     r.support_oppose || null,
      expenditure_date:   fecDate(r.date_str),
      expenditure_amount: Number(r.amount || 0),
      payee_name:         r.payee_name || null,
      purpose:            r.purpose    || null,
      cycle,
    }))

    view.close()

    let upsertedCount = 0
    if (!dryRun && ies.length) {
      const { upserted } = await upsertBatched('independent_expenditures', ies, {
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
