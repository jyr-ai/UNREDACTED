import { useState, useEffect } from "react";
import { useTheme } from "../theme/index.js";
import { ORANGE, FONT_MONO as MF, FONT_SERIF as SF } from "../theme/tokens.js";


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


  if (loading && !data) {
    return (
      <div style={{ padding: "18px 20px" }}>
        <div style={{ fontFamily: SF, fontSize: 34, color: t.kpiNum, lineHeight: 1, marginBottom: 5 }}>—</div>
        <div style={{ fontFamily: MF, fontSize: 10.5, color: t.hi, marginBottom: 3 }}>Loading war statistics</div>
        <div style={{ fontFamily: MF, fontSize: 9, color: t.low }}>Fetching from conflict API</div>
      </div>
    );
  }


  if (error && !data) {
    return (
      <div style={{ padding: "18px 20px" }}>
        <div style={{ fontFamily: SF, fontSize: 34, color: t.kpiNum, lineHeight: 1, marginBottom: 5 }}>—</div>
        <div style={{ fontFamily: MF, fontSize: 10.5, color: t.hi, marginBottom: 3 }}>Error loading data</div>
        <div style={{ fontFamily: MF, fontSize: 9, color: t.low }}>Check connection</div>
      </div>
    );
  }


  const { strikes, deaths, spending: spendingData } = data || {};


  return (
    <div style={{ padding: "18px 20px" }}>
      <div style={{ fontFamily: SF, fontSize: 34, color: t.kpiNum, lineHeight: 1, marginBottom: 5 }}>
        {formatSpending(spendingData?.value)}
      </div>
      <div style={{ fontFamily: MF, fontSize: 10.5, color: t.hi, marginBottom: 3 }}>
        Tax Spending on US‑Israel / Iran War
      </div>
      <div style={{ fontFamily: MF, fontSize: 9, color: t.low, marginBottom: 8 }}>
        <div>Strikes: {formatNumber(strikes?.value)}</div>
        <div>Deaths: {formatNumber(deaths?.value)}</div>
      </div>
    </div>
  );
}
