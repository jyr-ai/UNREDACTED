import { useState, useEffect } from "react";
import { useTheme } from "../theme/index.js";
import { FONT_MONO as MF, FONT_SERIF as SF } from "../theme/tokens.js";
import { useMobile } from "../hooks/useMediaQuery.js";


const API_URL = "/api/conflict";
const POLL_INTERVAL = 30 * 60 * 1000; // 30 minutes


function formatNumber(num) {
  if (num === null || num === undefined) return "—";
  return num.toLocaleString();
}


function formatSpending(value) {
  if (value === null || value === undefined) return "—";
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}bn`;
  }
  return `$${value}m`;
}


export default function WarStats() {
  const t = useTheme();
  const isMobile = useMobile();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);


  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const json = await response.json();
      setData(json.damage);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch war stats:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchData();

    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);


  const pad = { padding: isMobile ? '12px 10px' : '18px 14px' };
  const numSz = isMobile ? 22 : 28;

  if (loading && !data) {
    return (
      <div style={pad}>
        <div style={{ fontFamily: SF, fontSize: numSz, color: t.kpiNum, lineHeight: 1, marginBottom: 4 }}>—</div>
        <div style={{ fontFamily: MF, fontSize: 9.5, color: t.hi, marginBottom: 2 }}>US-Iran War spending</div>
        <div style={{ fontFamily: MF, fontSize: 8, color: t.low }}>Loading…</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={pad}>
        <div style={{ fontFamily: SF, fontSize: numSz, color: t.kpiNum, lineHeight: 1, marginBottom: 4 }}>—</div>
        <div style={{ fontFamily: MF, fontSize: 9.5, color: t.hi, marginBottom: 2 }}>US-Iran War spending</div>
        <div style={{ fontFamily: MF, fontSize: 8, color: t.low }}>Unavailable</div>
      </div>
    );
  }

  const { strikes, deaths, spending: spendingData } = data || {};

  return (
    <div style={pad}>
      <div style={{ fontFamily: SF, fontSize: numSz, color: t.kpiNum, lineHeight: 1, marginBottom: 4 }}>
        {formatSpending(spendingData?.value)}
      </div>
      <div style={{ fontFamily: MF, fontSize: 9.5, color: t.hi, marginBottom: 2 }}>
        US-Iran War spending
      </div>
      <div style={{ fontFamily: MF, fontSize: 8, color: t.low }}>
        Strikes: {formatNumber(strikes?.value)} · Deaths: {formatNumber(deaths?.value)}
      </div>
    </div>
  );
}
