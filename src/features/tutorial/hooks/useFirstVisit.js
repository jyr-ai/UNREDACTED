const FLAG_KEY = 'unr_tour_seen';
export const FLAG_VERSION = 'v1';

export function useFirstVisit() {
  function isFirstVisit() {
    try {
      return localStorage.getItem(FLAG_KEY) !== FLAG_VERSION;
    } catch {
      return true;
    }
  }

  function markSeen() {
    try {
      localStorage.setItem(FLAG_KEY, FLAG_VERSION);
    } catch {
      // silent — private mode / restricted webview
    }
  }

  function reset() {
    try {
      localStorage.removeItem(FLAG_KEY);
    } catch { /* silent */ }
  }

  return { isFirstVisit, markSeen, reset };
}
