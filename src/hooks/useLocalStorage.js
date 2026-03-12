/**
 * useLocalStorage — synced state persisted in localStorage.
 * Usage: const [dark, setDark] = useLocalStorage("theme_dark", true)
 */
import { useState, useEffect } from "react";

export function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage quota exceeded or private mode — ignore
    }
  }, [key, value]);

  return [value, setValue];
}
