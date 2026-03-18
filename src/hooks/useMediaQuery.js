/**
 * useMediaQuery — Reactive media-query hook.
 * Returns true when the given CSS media query matches the current viewport.
 * Automatically updates on window resize / device orientation change.
 *
 * Usage:
 *   const isMobile = useMediaQuery('(max-width: 640px)');
 *   const isTablet = useMediaQuery('(max-width: 1024px)');
 */
import { useState, useEffect } from 'react';

export function useMediaQuery(query) {
  const getMatches = () => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  };

  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);

    // Modern browsers
    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    // Safari < 14 fallback
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, [query]);

  return matches;
}

// ── Convenience aliases ──────────────────────────────────────────────────────
// isMobile  = phones  (≤ 640px)
// isTablet  = tablets (641–1024px)
// isDesktop = laptops / desktops (> 1024px)
export function useMobile()  { return useMediaQuery('(max-width: 640px)');  }
export function useTablet()  { return useMediaQuery('(max-width: 1024px)'); }
export function useDesktop() { return useMediaQuery('(min-width: 1025px)'); }

export default useMediaQuery;
