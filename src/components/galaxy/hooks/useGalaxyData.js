import { useEffect, useRef, useState } from 'react'
import { galaxy } from '../../../api/client.js'

/**
 * Fetches the correct galaxy envelope for (mode, cycle, scope).
 * Cancellation-safe; returns { data, loading, error, refetch }.
 */
export default function useGalaxyData({ mode, cycle, sector, employerId, rawIds, corpId }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const reqId = useRef(0)

  async function load() {
    const id = ++reqId.current
    setLoading(true); setError(null)
    try {
      let res
      if (mode === 'universe')      res = await galaxy.universe({ cycle })
      else if (mode === 'sector')   res = await galaxy.sector(sector, { cycle })
      else if (mode === 'employer')     res = await galaxy.employer(employerId, { cycle, rawIds })
      else if (mode === 'corporation')  res = await galaxy.corporation(corpId, { cycle })
      else throw new Error(`unknown galaxy mode: ${mode}`)
      if (id !== reqId.current) return                 // stale response
      setData(res || null)
    } catch (e) {
      if (id !== reqId.current) return
      setError(e.message || String(e))
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }

  useEffect(() => {
    if (mode === 'sector'      && !sector)    return
    if (mode === 'employer'    && !employerId) return
    if (mode === 'corporation' && !corpId)     return
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, cycle, sector, employerId, rawIds?.join('|'), corpId])

  return { data, loading, error, refetch: load }
}
