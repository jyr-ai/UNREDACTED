/**
 * useApiData — generic fetch hook with loading/error/data state.
 * Usage: const { data, loading, error, reload } = useApiData(fetchFn, [...deps])
 */
import { useState, useEffect, useCallback, useRef } from "react";

export function useApiData(fetchFn, deps = [], options = {}) {
  const { defaultValue = null, transform = (x) => x } = options;
  const [data, setData]     = useState(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const mountedRef           = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw    = await fetchFn();
      const result = transform(raw);
      if (mountedRef.current) setData(result);
    } catch (e) {
      if (mountedRef.current) setError(e.message || "Unknown error");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  return { data, loading, error, reload: load };
}
