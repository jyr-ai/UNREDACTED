import { useCallback, useEffect, useState } from 'react'

const KEY = 'unredacted:galaxy-surface'

function readInitial() {
  if (typeof window === 'undefined') return 'dark'
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch { /* no-op */ }
  // First-ever load: honor OS preference if present
  try {
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  } catch { /* no-op */ }
  return 'dark'
}

export default function useGalaxySurface() {
  const [surface, setSurface] = useState(readInitial)

  useEffect(() => {
    try { localStorage.setItem(KEY, surface) } catch { /* no-op */ }
  }, [surface])

  const toggle = useCallback(() => {
    setSurface(s => s === 'dark' ? 'light' : 'dark')
  }, [])

  return [surface, toggle]
}
