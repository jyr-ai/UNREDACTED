// server/lib/employerNormalizer.js
// Strips legal suffixes, normalizes punctuation/casing so employer variants
// ("Google", "Google Llc", "GOOGLE INC.") collapse to the same canonical key.

const SUFFIX_RE = /\b(llc|l\.l\.c|inc|incorporated|corp|corporation|co|ltd|limited|lp|l\.p|llp|pllc|pa|pc|na|n\.a|group|holdings|holding|international|intl)\b\.?/gi

export function normalizeEmployer(name) {
  if (!name || typeof name !== 'string') return ''
  return name
    .toLowerCase()
    .replace(/[.,&]/g, ' ')        // punctuation → space
    .replace(SUFFIX_RE, ' ')       // strip legal suffixes
    .replace(/\s+/g, ' ')          // collapse whitespace
    .trim()
}

/**
 * Merge employer rows that share the same normalized key.
 * Input rows must already have { employer_id, employer, total, txn_count }.
 * Returns merged rows with an added `raw_ids: string[]` field.
 * The display label (`employer`) and primary `employer_id` are taken from the
 * variant with the highest individual total (most "canonical" form).
 */
export function canonicalizeEmployers(rows) {
  const groups = new Map() // normalized key → group object

  for (const row of rows) {
    const key = normalizeEmployer(row.employer_id || row.employer)
    if (!key) continue

    const existing = groups.get(key)
    if (existing) {
      existing.total     += row.total
      existing.txn_count += row.txn_count
      existing.raw_ids.push(row.employer_id)
      // Prefer the variant with highest individual total as the display label
      if (row.total > existing._best_total) {
        existing._best_total = row.total
        existing.employer    = row.employer
        existing.employer_id = row.employer_id
      }
    } else {
      groups.set(key, {
        employer_id:  row.employer_id,
        employer:     row.employer,
        total:        row.total,
        txn_count:    row.txn_count,
        raw_ids:      [row.employer_id],
        _best_total:  row.total,
      })
    }
  }

  return [...groups.values()].map(({ _best_total, ...rest }) => rest)
}
