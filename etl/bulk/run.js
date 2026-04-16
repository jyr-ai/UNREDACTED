#!/usr/bin/env node
// Bulk ingest CLI.
// Examples:
//   node etl/bulk/run.js --source fec-candidates --cycle 2024
//   node etl/bulk/run.js --all --cycle 2024 --cycle 2026
//   node etl/bulk/run.js --source fec-candidates --cycle 2024 --dry-run

import { ingestCandidates } from './fec/ingest-candidates.js'
import { ingestCommittees } from './fec/ingest-committees.js'
import { ingestLinks }      from './fec/ingest-links.js'
import { ingestAllCandidateTotals, ingestHSCandidateTotals, ingestPacTotals } from './fec/ingest-totals.js'
import { ingestPas2 }       from './fec/ingest-pas2.js'
import { ingestOth }        from './fec/ingest-oth.js'

const SOURCES = {
  'fec-candidates':  ingestCandidates,
  'fec-committees':  ingestCommittees,
  'fec-links':       ingestLinks,
  'fec-totals-all':  ingestAllCandidateTotals,
  'fec-totals-hs':   ingestHSCandidateTotals,
  'fec-totals-pac':  ingestPacTotals,
  'fec-pas2':        ingestPas2,
  'fec-oth':         ingestOth,
}

// Phase 1 order: small → large. Committees before candidates avoids FK races
// when candidate_committee_links upserts, but pac_committees has no FK to politicians so order is flexible.
const PHASE_1_ORDER = [
  'fec-candidates', 'fec-committees', 'fec-links',
  'fec-totals-all', 'fec-totals-hs', 'fec-totals-pac',
  'fec-pas2', 'fec-oth',
]

function parseArgs(argv) {
  const args = { sources: [], cycles: [], all: false, dryRun: false, hotMinAmount: 0 }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--source')           args.sources.push(argv[++i])
    else if (a === '--cycle')       args.cycles.push(Number(argv[++i]))
    else if (a === '--all')         args.all = true
    else if (a === '--dry-run')     args.dryRun = true
    else if (a === '--hot-min-amount') args.hotMinAmount = Number(argv[++i])
    else if (a === '--help' || a === '-h') {
      console.log(`Usage:
  node etl/bulk/run.js --source <name> --cycle <YYYY> [--dry-run]
  node etl/bulk/run.js --all --cycle 2024 --cycle 2026

Sources: ${Object.keys(SOURCES).join(', ')}
Options:
  --dry-run            Parse + preview counts, skip R2 + Supabase writes.
  --hot-min-amount N   Minimum $ for a contribution row to enter Supabase hot
                       tier (default 0). Parquet always gets every row.
`)
      process.exit(0)
    }
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv)
  if (!args.cycles.length) {
    console.error('Must specify at least one --cycle YYYY')
    process.exit(1)
  }
  const sources = args.all ? PHASE_1_ORDER : args.sources
  if (!sources.length) {
    console.error('Must specify --source <name> or --all')
    process.exit(1)
  }

  const results = []
  for (const cycle of args.cycles) {
    for (const name of sources) {
      const fn = SOURCES[name]
      if (!fn) {
        console.error(`Unknown source: ${name}`)
        process.exit(1)
      }
      try {
        const res = await fn({ cycle, dryRun: args.dryRun, hotMinAmount: args.hotMinAmount })
        results.push(res)
      } catch (err) {
        console.error(`[${name}/${cycle}] FAILED: ${err.message}`)
        console.error(err.stack)
        results.push({ source: name, cycle, error: err.message })
      }
    }
  }

  console.log('\n─── Summary ─────────────────────────────────')
  for (const r of results) {
    if (r.error) {
      console.log(`  ❌ ${r.source} cycle=${r.cycle}: ${r.error}`)
    } else {
      console.log(`  ✅ ${r.source} cycle=${r.cycle}: read=${r.rowsRead} hot=${r.rowsUpserted}`)
    }
  }

  const hasErrors = results.some(r => r.error)
  process.exit(hasErrors ? 1 : 0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
