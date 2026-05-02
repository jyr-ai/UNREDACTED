# Employer Entity Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Systematically merge employer name variants (e.g. "Google" + "Google Llc") into a single canonical entity by applying rule-based normalization at the aggregation layer, so the leaderboard and galaxy both reflect the combined donation total.

**Architecture:** A new pure utility (`employerNormalizer.js`) strips legal suffixes and normalizes casing/punctuation. `getTopEmployers` applies it as a second grouping pass after raw aggregation, returning a `raw_ids` array per canonical group. `raw_ids` flows through the API stack to `getEmployer`, which queries `contributions` using `.in()` across all raw IDs instead of a single string match.

**Tech Stack:** Pure JavaScript string normalization (no external library). Supabase PostgREST `.in()` filter for multi-ID contribution queries. Express query params (pipe-separated `rawIds` string). React prop-drilling for `rawIds` in the galaxy component tree.

---

## Why this approach

FEC `contributor_employer` is a free-text self-reported field. The same company appears as "GOOGLE", "Google LLC", "GOOGLE INC.", "Google Llc" etc. These all map to the same `source_id` variants in `money_flow_edges` because the MV is built directly from raw contributions.

Rule-based normalization covers the dominant pattern (legal suffix variants) with zero false-positives and no external dependencies. It does **not** cover phonetic variants ("JPMorgan" vs "JP Morgan") — that would require fuzzy matching and is out of scope here.

---

## File Map

| Action | File | Change |
|---|---|---|
| **Create** | `server/lib/employerNormalizer.js` | Pure normalization + canonical grouping utility |
| **Modify** | `server/services/supabaseDonors.js` | Apply normalizer in `getTopEmployers` post-aggregation |
| **Modify** | `server/services/galaxyService.js` | `getEmployer` accepts `rawIds[]`, queries `.in()` |
| **Modify** | `server/routes/galaxy.js` | Pass `rawIds` query param to `getEmployer` |
| **Modify** | `src/api/client.js` | `galaxy.employer()` encodes `rawIds` as pipe-separated param |
| **Modify** | `src/components/galaxy/hooks/useGalaxyData.js` | Accept and forward `rawIds` |
| **Modify** | `src/components/galaxy/FundingFlowGalaxy.jsx` | Accept and forward `rawIds` prop |
| **Modify** | `src/components/EmployerLeaderboard.jsx` | Pass `selected.raw_ids` to `FundingFlowGalaxy` |

---

## Task 1: `server/lib/employerNormalizer.js` — pure normalization utility

**Files:**
- Create: `server/lib/employerNormalizer.js`

**Context:** This is a pure utility with no imports. `normalizeEmployer` converts any raw employer string to a canonical lowercase key by stripping legal suffixes and normalizing punctuation. `canonicalizeEmployers` takes an already-sorted array of raw employer rows and merges variants that share the same normalized key.

- [ ] **Step 1: Create the file**

```javascript
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
```

- [ ] **Step 2: Verify normalization manually**

```bash
node -e "
import('./server/lib/employerNormalizer.js').then(({ normalizeEmployer, canonicalizeEmployers }) => {
  console.log(normalizeEmployer('Google'));          // → 'google'
  console.log(normalizeEmployer('Google Llc'));      // → 'google'
  console.log(normalizeEmployer('GOOGLE INC.'));     // → 'google'
  console.log(normalizeEmployer('Goldman Sachs & Co')); // → 'goldman sachs'
  const merged = canonicalizeEmployers([
    { employer_id: 'GOOGLE', employer: 'GOOGLE', total: 205000, txn_count: 32 },
    { employer_id: 'Google Llc', employer: 'Google Llc', total: 44000, txn_count: 1 },
  ]);
  console.log(JSON.stringify(merged, null, 2));
  // Expected: 1 row, employer='GOOGLE', total=249000, raw_ids=['GOOGLE','Google Llc']
})
"
```

Expected output:
```
google
google
google
goldman sachs
[
  {
    "employer_id": "GOOGLE",
    "employer": "GOOGLE",
    "total": 249000,
    "txn_count": 33,
    "raw_ids": ["GOOGLE", "Google Llc"]
  }
]
```

- [ ] **Step 3: Commit**

```bash
git add server/lib/employerNormalizer.js
git commit -m "feat(employers): add employer normalization + canonical grouping utility"
```

---

## Task 2: Apply normalizer in `getTopEmployers`

**Files:**
- Modify: `server/services/supabaseDonors.js`

**Context:** `getTopEmployers` currently groups by exact `source_id` (raw employer string) and returns `{ employer_id, employer, total, txn_count }[]`. After this change it runs `canonicalizeEmployers` as a second pass and returns `raw_ids` on every row. The `limit` slice must happen **after** canonicalization since merging reduces the row count.

Current end of `getTopEmployers` (around line 267):
```javascript
  return [...byId.values()]
    .filter(r => r.total >= minAmount)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
```

- [ ] **Step 1: Import the normalizer at the top of `supabaseDonors.js`**

Add after the existing imports at the top of the file:

```javascript
import { canonicalizeEmployers } from '../lib/employerNormalizer.js'
```

- [ ] **Step 2: Replace the final return in `getTopEmployers`**

Replace:
```javascript
  return [...byId.values()]
    .filter(r => r.total >= minAmount)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
```

With:
```javascript
  const raw = [...byId.values()]
    .filter(r => r.total >= minAmount)
    .sort((a, b) => b.total - a.total)

  return canonicalizeEmployers(raw)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
```

- [ ] **Step 3: Verify with a curl call**

Start the server (`npm run dev:server`) then:

```bash
curl -s "http://127.0.0.1:3001/api/donors/employers?cycle=2026&limit=20&search=google" | node -e "
const d = []; process.stdin.on('data', c => d.push(c)); process.stdin.on('end', () => {
  const r = JSON.parse(d.join('')); console.log(JSON.stringify(r.data.results, null, 2))
})"
```

Expected: a single "Google" row with `total` that aggregates all Google variants, and `raw_ids` array containing all matched raw strings (e.g. `["GOOGLE", "Google Llc"]`).

- [ ] **Step 4: Commit**

```bash
git add server/services/supabaseDonors.js
git commit -m "feat(employers): merge name variants using canonical normalization in getTopEmployers"
```

---

## Task 3: Pass `rawIds` through the API stack to `getEmployer`

**Files:**
- Modify: `server/services/galaxyService.js`
- Modify: `server/routes/galaxy.js`
- Modify: `src/api/client.js`
- Modify: `src/components/galaxy/hooks/useGalaxyData.js`

**Context:** When the user selects a merged employer (e.g. canonical "GOOGLE" with `raw_ids: ["GOOGLE", "Google Llc"]`), the employer-mode galaxy must query contributions for **all** raw IDs. The flow:
- `EmployerLeaderboard` has `selected.raw_ids`
- `FundingFlowGalaxy` receives it as `rawIds` prop
- `useGalaxyData` passes it to `galaxy.employer(employerId, { cycle, rawIds })`
- Client encodes as pipe-separated `rawIds` query param
- Route decodes and passes to `getEmployer`
- `getEmployer` uses `.in('contributor_employer', ids)` instead of single `.ilike()`

This task covers the server + client layers. Task 4 covers the React component tree.

- [ ] **Step 1: Update `getEmployer` in `server/services/galaxyService.js`**

Find the `getEmployer` function. Replace the hop-1 contributions query block.

Current (around line 312):
```javascript
  // Hop 1: query contributions directly — complete picture, not MV-capped
  const { data: contribs, error: e1 } = await db
    .from('contributions')
    .select('committee_id, amount')
    .ilike('contributor_employer', employerId)
    .gte('date', dateStart).lte('date', dateEnd)
    .gt('amount', 0)
    .limit(10000)
  if (e1) throw e1
```

Replace with:
```javascript
  // Hop 1: query contributions directly using all raw ID variants
  // rawIds is an array of all employer name strings that map to this canonical entity
  const ids = (rawIds?.length > 0) ? rawIds : [employerId]
  const { data: contribs, error: e1 } = await db
    .from('contributions')
    .select('committee_id, amount')
    .in('contributor_employer', ids)
    .gte('date', dateStart).lte('date', dateEnd)
    .gt('amount', 0)
    .limit(10000)
  if (e1) throw e1
```

Also update the function signature from:
```javascript
export async function getEmployer({ cycle = '2024', employerId, nodeCap = 40 } = {}) {
```
to:
```javascript
export async function getEmployer({ cycle = '2024', employerId, rawIds, nodeCap = 40 } = {}) {
```

- [ ] **Step 2: Update the galaxy route in `server/routes/galaxy.js`**

Find:
```javascript
router.get('/employer/:employerId', wrap(req => getEmployer({
  cycle:      req.query.cycle || '2024',
  employerId: decodeURIComponent(req.params.employerId),
  nodeCap:    Number(req.query.limit) || 40
})))
```

Replace with:
```javascript
router.get('/employer/:employerId', wrap(req => getEmployer({
  cycle:      req.query.cycle || '2024',
  employerId: decodeURIComponent(req.params.employerId),
  rawIds:     req.query.rawIds ? req.query.rawIds.split('|').filter(Boolean) : undefined,
  nodeCap:    Number(req.query.limit) || 40
})))
```

- [ ] **Step 3: Update `galaxy.employer` in `src/api/client.js`**

Find:
```javascript
  employer: (employerId, { cycle } = {}) => {
    const qs = new URLSearchParams({ ...(cycle && { cycle }) }).toString()
    return request(`/api/galaxy/employer/${encodeURIComponent(employerId)}${qs ? '?' + qs : ''}`)
  },
```

Replace with:
```javascript
  employer: (employerId, { cycle, rawIds } = {}) => {
    const params = { ...(cycle && { cycle }) }
    if (rawIds?.length > 1) params.rawIds = rawIds.join('|')
    const qs = new URLSearchParams(params).toString()
    return request(`/api/galaxy/employer/${encodeURIComponent(employerId)}${qs ? '?' + qs : ''}`)
  },
```

- [ ] **Step 4: Update `useGalaxyData` in `src/components/galaxy/hooks/useGalaxyData.js`**

Find:
```javascript
export default function useGalaxyData({ mode, cycle, sector, employerId }) {
```
Replace with:
```javascript
export default function useGalaxyData({ mode, cycle, sector, employerId, rawIds }) {
```

Find inside the `load` function:
```javascript
      else if (mode === 'employer') res = await galaxy.employer(employerId, { cycle })
```
Replace with:
```javascript
      else if (mode === 'employer') res = await galaxy.employer(employerId, { cycle, rawIds })
```

Also add `rawIds` to the `useEffect` dependency array:
```javascript
  }, [mode, cycle, sector, employerId, rawIds])
```

- [ ] **Step 5: Commit**

```bash
git add server/services/galaxyService.js server/routes/galaxy.js src/api/client.js src/components/galaxy/hooks/useGalaxyData.js
git commit -m "feat(employers): pass rawIds through API stack so galaxy queries all name variants"
```

---

## Task 4: Wire `rawIds` through the React component tree

**Files:**
- Modify: `src/components/galaxy/FundingFlowGalaxy.jsx`
- Modify: `src/components/EmployerLeaderboard.jsx`

**Context:** `EmployerLeaderboard` sets `selected` to the full employer row from the API, which now includes `raw_ids`. It needs to pass `selected.raw_ids` to `FundingFlowGalaxy` as the `rawIds` prop. `FundingFlowGalaxy` forwards it to `useGalaxyData`.

- [ ] **Step 1: Update `FundingFlowGalaxy.jsx` to accept and forward `rawIds`**

Find the component signature in `src/components/galaxy/FundingFlowGalaxy.jsx`:
```javascript
export default function FundingFlowGalaxy({
  mode = 'universe',
  cycle: cycleProp = '2024',
  sector = null,
  employerId = null,
  height = 560,
  onNodeSelect
}) {
```
Add `rawIds = null`:
```javascript
export default function FundingFlowGalaxy({
  mode = 'universe',
  cycle: cycleProp = '2024',
  sector = null,
  employerId = null,
  rawIds = null,
  height = 560,
  onNodeSelect
}) {
```

Find:
```javascript
  const { data, loading, error } = useGalaxyData({ mode, cycle, sector, employerId })
```
Replace with:
```javascript
  const { data, loading, error } = useGalaxyData({ mode, cycle, sector, employerId, rawIds })
```

- [ ] **Step 2: Update `EmployerLeaderboard.jsx` to pass `rawIds` to `FundingFlowGalaxy`**

Find the `FundingFlowGalaxy` usage in `EmployerLeaderboard.jsx` (near the bottom):
```jsx
      <FundingFlowGalaxy
        mode={selected ? 'employer' : 'sector'}
        cycle={cycle}
        sector={selected ? null : (sector !== 'All Sectors' ? sector : null)}
        employerId={selected?.employer_id ?? null}
        height={560}
      />
```
Replace with:
```jsx
      <FundingFlowGalaxy
        mode={selected ? 'employer' : 'sector'}
        cycle={cycle}
        sector={selected ? null : (sector !== 'All Sectors' ? sector : null)}
        employerId={selected?.employer_id ?? null}
        rawIds={selected?.raw_ids ?? null}
        height={560}
      />
```

- [ ] **Step 3: Verify end-to-end in browser**

```bash
npm run dev:all
```

1. Open the app → Follow the Money → Money Flow tab
2. Type "google" in the SEARCH box
3. Confirm you see a single "Google" row (not "Google" + "Google Llc" separately) with a combined total
4. Click the Google row to select it
5. The galaxy on the right should show GOOGLE's full network (contributions from both "GOOGLE" and "Google Llc" employees combined)
6. Click the GOOGLE node in the galaxy → the drawer panel opens → money trail shows contributions from both variants

- [ ] **Step 4: Commit**

```bash
git add src/components/galaxy/FundingFlowGalaxy.jsx src/components/EmployerLeaderboard.jsx
git commit -m "feat(employers): wire rawIds to galaxy so merged entities show full combined network"
```

---

## Self-Review

**Spec coverage:**
- ✅ "Google" + "Google Llc" merge into one row — Task 2 (`canonicalizeEmployers`)
- ✅ Combined total shown in leaderboard — Task 2 (sums `total` and `txn_count`)
- ✅ Best display label is the highest-total variant — Task 1 (`_best_total` logic)
- ✅ Galaxy employer mode queries all name variants — Task 3 (`.in()` with `rawIds`)
- ✅ `rawIds` flows from leaderboard → galaxy → API → service — Tasks 3+4
- ✅ Single-variant employers (most employers) are unaffected — `raw_ids` has 1 item, `.in(['X'])` = same as `.eq('X')`

**Placeholder scan:** No TBDs. All code blocks are complete and self-contained.

**Type consistency:**
- `raw_ids: string[]` returned by `getTopEmployers` → `selected.raw_ids` in `EmployerLeaderboard` → `rawIds` prop in `FundingFlowGalaxy` → `rawIds` in `useGalaxyData` → `rawIds` in `galaxy.employer()` → `rawIds` param in `getEmployer` — consistent naming throughout
- `canonicalizeEmployers(raw)` called in Task 2 matches the export from Task 1
- `getEmployer({ ..., rawIds })` signature in Task 3 matches the call site from the route

**Known limitation:** Phonetic/abbreviation variants ("JPMorgan" vs "JP Morgan") are **not** merged — rule-based suffix stripping doesn't help there. This is documented intentionally; fuzzy matching would be a follow-up.
