import { useState, useEffect } from 'react'
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, CircularProgress, Alert,
  TextField, InputAdornment, MenuItem, Select, FormControl, InputLabel,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { useTheme } from '@mui/material/styles'

// Story F: Attack-ad coordination — independent expenditures from committees
// supporting or opposing candidates. Real data from Supabase (fec_ie ingest).
// Journalists: look for same payee_name (media buyer / ad vendor) appearing
// across multiple SuperPACs near the same election — coordination signal.

const API_BASE = import.meta.env.VITE_API_URL || ''

async function fetchIEs({ candidateId, committeeId, cycle, limit = 100 } = {}) {
  const params = new URLSearchParams({ limit })
  if (candidateId) params.set('candidate_id', candidateId)
  if (committeeId) params.set('committee_id', committeeId)
  if (cycle)       params.set('cycle', cycle)
  const res = await fetch(`${API_BASE}/api/spending/independent-expenditures?${params}`)
  if (!res.ok) throw new Error(`IE fetch failed: ${res.status}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'Unknown error')
  return json.data || []
}

function SupportChip({ value }) {
  if (!value) return null
  const isSupport = value.toUpperCase().startsWith('S')
  return (
    <Chip
      label={isSupport ? 'Support' : 'Oppose'}
      size="small"
      color={isSupport ? 'success' : 'error'}
      variant="outlined"
    />
  )
}

function fmtMoney(n) {
  if (!n && n !== 0) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function IndependentExpenditures({ candidateId, committeeId, cycle: propCycle }) {
  const t = useTheme()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [cycle, setCycle] = useState(propCycle || 2026)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchIEs({ candidateId, committeeId, cycle })
      .then(data => { setRows(data); setLoading(false) })
      .catch(err  => { setError(err.message); setLoading(false) })
  }, [candidateId, committeeId, cycle])

  const filtered = rows.filter(r => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (r.committee_id || '').toLowerCase().includes(s) ||
      (r.candidate_id || '').toLowerCase().includes(s) ||
      (r.payee_name   || '').toLowerCase().includes(s) ||
      (r.purpose      || '').toLowerCase().includes(s)
    )
  })

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Independent Expenditures
        </Typography>
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel>Cycle</InputLabel>
          <Select value={cycle} label="Cycle" onChange={e => setCycle(e.target.value)}>
            <MenuItem value={2026}>2026</MenuItem>
            <MenuItem value={2024}>2024</MenuItem>
            <MenuItem value={2022}>2022</MenuItem>
          </Select>
        </FormControl>
        <TextField
          size="small"
          placeholder="Search payee, candidate, purpose…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ minWidth: 260 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
      </Box>

      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}
      {error   && <Alert severity="warning" sx={{ mb: 2 }}>
        {error.includes('Failed') || error.includes('fetch') ? (
          <>Data not yet available — run <code>fec-ies</code> ingest for cycle {cycle}.</>
        ) : error}
      </Alert>}

      {!loading && !error && filtered.length === 0 && (
        <Alert severity="info">No independent expenditure records found for this filter.</Alert>
      )}

      {!loading && filtered.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: t.palette.action.hover }}>
                <TableCell><strong>Committee</strong></TableCell>
                <TableCell><strong>Candidate</strong></TableCell>
                <TableCell><strong>S/O</strong></TableCell>
                <TableCell><strong>Amount</strong></TableCell>
                <TableCell><strong>Payee</strong></TableCell>
                <TableCell><strong>Purpose</strong></TableCell>
                <TableCell><strong>Date</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.slice(0, 200).map(r => (
                <TableRow key={r.sub_id} hover>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{r.committee_id}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{r.candidate_id || '—'}</TableCell>
                  <TableCell><SupportChip value={r.support_oppose} /></TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{fmtMoney(r.expenditure_amount)}</TableCell>
                  <TableCell>{r.payee_name || '—'}</TableCell>
                  <TableCell sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.purpose || '—'}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.expenditure_date || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {filtered.length > 200 && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Showing top 200 of {filtered.length} records. Use candidate/committee filters to narrow.
        </Typography>
      )}
    </Box>
  )
}
