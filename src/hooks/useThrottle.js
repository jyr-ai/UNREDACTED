/**
 * useThrottle — throttle a rapidly-changing value (e.g. resize, scroll).
 * Usage: const throttledWidth = useThrottle(width, 100)
 */
import { useState, useEffect, useRef } from "react";

export function useThrottle(value, limitMs = 200) {
  const [throttled, setThrottled] = useState(value);
  const lastRan = useRef(Date.now());

  useEffect(() => {
    const remaining = limitMs - (Date.now() - lastRan.current);
    if (remaining <= 0) {
      lastRan.current = Date.now();
      setThrottled(value);
    } else {
      const id = setTimeout(() => {
        lastRan.current = Date.now();
        setThrottled(value);
      }, remaining);
      return () => clearTimeout(id);
    }
  }, [value, limitMs]);

  return throttled;
}
