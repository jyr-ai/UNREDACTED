/**
 * Corruption Dialog Component
 * Draggable floating dialog showing detailed corruption profile for a state
 */

import React, { useState, useEffect, useRef } from 'react';
import { useApiData } from '../hooks/useApiData';
import { campaignWatch as cwApi } from '../api/client';

// Format an introduced date nicely: "Mar 15, 2025"
const fmtDate = dateStr => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return dateStr; }
};

// Truncate text to maxLen chars
const truncate = (str, maxLen = 80) =>
  str && str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str || '';

// Bill status badge colour — based on latest action text keywords
const billStatusColor = (theme, actionText = '') => {
  const t = actionText.toLowerCase();
  if (t.includes('became law') || t.includes('signed by president')) return theme.ok || '#22c55e';
  if (t.includes('passed') || t.includes('agreed to')) return theme.blue || '#4A7FFF';
  if (t.includes('committee') || t.includes('referred')) return theme.accent || '#f97316';
  if (t.includes('failed') || t.includes('vetoed')) return theme.warn || '#ef4444';
  return theme.mid || '#888';
};

const CorruptionDialog = ({ stateCode, stateName, position, onClose, theme }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [currentPosition, setCurrentPosition] = useState(position);
  const dialogRef = useRef(null);

  // Fetch detailed state corruption data — pass a function, not a URL string
  const { data: corruptionData, loading: corruptionLoading, error: corruptionError } = useApiData(
    stateCode ? () => cwApi.corruptionProfile(stateCode) : null,
    [stateCode]
  );

  // Fetch AI analysis — pass a function, not a URL string
  const { data: aiAnalysis, loading: aiLoading } = useApiData(
    stateCode ? () => cwApi.aiAnalysis(stateCode) : null,
    [stateCode]
  );

  // Fetch legislation — bills sponsored by state delegation
  const { data: legislationData, loading: legislationLoading } = useApiData(
    stateCode ? () => cwApi.legislation(stateCode, 8) : null,
    [stateCode]
  );

  const bills = (legislationData?.data?.bills || []).slice(0, 5);

  // Handle drag start
  const handleDragStart = (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
      return; // Don't drag if clicking a button
    }

    setIsDragging(true);
    const rect = dialogRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });

    e.preventDefault();
  };

  // Handle drag move
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;

      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Keep dialog within viewport
      const maxX = window.innerWidth - 400;
      const maxY = window.innerHeight - 600;

      setCurrentPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, dragOffset]);

  // Update position when prop changes
  useEffect(() => {
    setCurrentPosition(position);
  }, [position]);

  // Get corruption score color
  const getCorruptionColor = (score) => {
    if (score < 30) return theme.warn; // Red - high corruption
    if (score < 50) return theme.accent; // Orange
    if (score < 70) return theme.ok; // Yellow
    return theme.blue; // Green - low corruption
  };

  // Get corruption level text
  const getCorruptionLevel = (score) => {
    if (score < 30) return 'CRITICAL';
    if (score < 50) return 'HIGH';
    if (score < 70) return 'MEDIUM';
    return 'LOW';
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount) return '$0';
    if (amount >= 1000000000) return `$${(amount / 1000000000).toFixed(1)}B`;
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
    return `$${amount}`;
  };

  // Real data from API — with safe fallbacks
  const profile = corruptionData?.data || {}
  const liveData = {
    corruptionIndex: profile.corruptionIndex ?? 55,
    fundraising: {
      total:        profile.fundraising?.total ?? 0,
      candidates:   profile.fundraising?.candidateCount ?? 0,
      topCandidates: (profile.fundraising?.topCandidates ?? []).slice(0, 2).map(c => ({
        name:   c.name ? `${c.name.split(',')[0]} (${(c.party || '?')[0]})` : 'Unknown',
        amount: c.raised ?? 0,
      })),
    },
    darkMoney: {
      total:  profile.darkMoney?.total ?? 0,
      orgs:   profile.darkMoney?.orgCount ?? 0,
      topOrg: profile.darkMoney?.topOrg ?? null,
    },
    federalContracts: {
      total:        profile.federalContracts?.total ?? 0,
      topCompanies: (profile.federalContracts?.topContracts ?? []).map(c => ({
        name:   c.recipient ?? 'Unknown',
        amount: c.amount ?? 0,
      })),
    },
    stockActFlags: {
      count:   profile.stockActFlags?.count ?? 0,
      members: profile.stockActFlags?.members ?? 0,
    },
  };

  const aiAnalysisText = aiAnalysis?.data?.analysis
    || (corruptionLoading || aiLoading
      ? null
      : `${stateName} corruption data loaded. AI analysis unavailable — check AI service connection.`)

  return (
    <div
      ref={dialogRef}
      style={{
        position: 'fixed',
        left: `${currentPosition.x}px`,
        top: `${currentPosition.y}px`,
        width: '380px',
        background: theme.card,
        border: `2px solid ${theme.border}`,
        borderRadius: '8px',
        boxShadow: `0 10px 30px rgba(0, 0, 0, 0.3)`,
        zIndex: 1000,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        overflow: 'hidden'
      }}
      onMouseDown={handleDragStart}
    >
      {/* Dialog header */}
      <div style={{
        background: theme.cardB,
        borderBottom: `1px solid ${theme.border}`,
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'grab'
      }}>
        <div>
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '16px',
            color: theme.hi,
            fontWeight: 'bold'
          }}>
            {stateName} — Political Corporate Greed Index
          </div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '9px',
            color: theme.mid,
            letterSpacing: '1px',
            marginTop: '2px'
          }}>
            REAL-TIME ACCOUNTABILITY DATA
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: theme.mid,
            fontSize: '18px',
            cursor: 'pointer',
            padding: '0 4px',
            borderRadius: '4px',
            lineHeight: '1'
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          ✕
        </button>
      </div>

      {/* Dialog content */}
      <div style={{
        padding: '16px',
        maxHeight: '500px',
        overflowY: 'auto'
      }}>
        {/* Loading state */}
        {corruptionLoading && (
          <div style={{ textAlign: 'center', padding: '20px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: theme.mid }}>
            Loading corruption data…
          </div>
        )}

        {/* Corruption Index */}
        {!corruptionLoading && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px'
          }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: theme.accent, letterSpacing: '2px' }}>
              🔴 CORRUPTION INDEX
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '10px',
              color: getCorruptionColor(liveData.corruptionIndex),
              border: `1px solid ${getCorruptionColor(liveData.corruptionIndex)}44`,
              padding: '2px 8px',
              borderRadius: '12px',
              background: getCorruptionColor(liveData.corruptionIndex) + '12'
            }}>
              {getCorruptionLevel(liveData.corruptionIndex)}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '60px', height: '60px', borderRadius: '50%',
              border: `3px solid ${getCorruptionColor(liveData.corruptionIndex)}`,
              background: getCorruptionColor(liveData.corruptionIndex) + '18',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '18px',
              color: getCorruptionColor(liveData.corruptionIndex), fontWeight: 'bold',
              boxShadow: `0 0 15px ${getCorruptionColor(liveData.corruptionIndex)}28`
            }}>
              {liveData.corruptionIndex}
            </div>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: theme.mid, marginBottom: '4px' }}>
                SCORE: {liveData.corruptionIndex}/100
              </div>
              <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '12px', fontStyle: 'italic', color: theme.mid, lineHeight: '1.4' }}>
                {liveData.corruptionIndex < 50
                  ? 'High corruption risk: Strong correlation between donor industries and legislative outcomes.'
                  : 'Moderate corruption risk: Some influence patterns detected.'}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Fundraising */}
        {!corruptionLoading && (
        <Section
          title="💰 FUNDRAISING"
          theme={theme}
          items={[
            `Total: ${formatCurrency(liveData.fundraising.total)} · ${liveData.fundraising.candidates} candidates`,
            ...(liveData.fundraising.topCandidates.length > 0
              ? liveData.fundraising.topCandidates.map(c => `${c.name}  ${formatCurrency(c.amount)}`)
              : ['No candidate data available']),
          ]}
        />
        )}

        {/* Dark Money */}
        {!corruptionLoading && (
        <Section
          title="🕳️ DARK MONEY"
          theme={theme}
          items={[
            `${formatCurrency(liveData.darkMoney.total)} undisclosed · ${liveData.darkMoney.orgs} orgs`,
            ...(liveData.darkMoney.topOrg
              ? [`${liveData.darkMoney.topOrg.name}: ${formatCurrency(liveData.darkMoney.topOrg.amount)}`]
              : ['No major dark money org identified']),
          ]}
        />
        )}

        {/* Federal Contracts */}
        {!corruptionLoading && (
        <Section
          title="📋 FEDERAL CONTRACTS"
          theme={theme}
          items={[
            `Total awarded: ${formatCurrency(liveData.federalContracts.total)}`,
            ...(liveData.federalContracts.topCompanies.length > 0
              ? liveData.federalContracts.topCompanies.slice(0, 2).map(c => `${c.name}: ${formatCurrency(c.amount)}`)
              : ['No contract data available']),
          ]}
        />
        )}

        {/* STOCK Act Flags */}
        {!corruptionLoading && (
        <Section
          title="⚖️ STOCK ACT FLAGS"
          theme={theme}
          items={[
            liveData.stockActFlags.count > 0
              ? `${liveData.stockActFlags.count} flagged trades · ${liveData.stockActFlags.members} members`
              : 'No STOCK Act violations flagged'
          ]}
        />
        )}

        {/* Legislation */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: theme.accent,
            letterSpacing: '1px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <span>📜</span>
            <span>RECENT LEGISLATION</span>
            {legislationLoading && <span style={{ color: theme.mid, fontSize: '9px' }}>loading…</span>}
          </div>

          {legislationLoading ? (
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: theme.mid, paddingLeft: 12 }}>
              Fetching bills from Congress.gov…
            </div>
          ) : bills.length === 0 ? (
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: theme.low, paddingLeft: 12 }}>
              No recent bills found for {stateName}.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {bills.map((bill, i) => {
                const statusColor = billStatusColor(theme, bill.latestAction || '');
                const billUrl = bill.url || `https://www.congress.gov/search?q=%7B%22source%22%3A%22legislation%22%7D`;
                return (
                  <div key={i} style={{
                    padding: '8px 10px',
                    background: theme.cardB,
                    border: `1px solid ${theme.border}`,
                    borderLeft: `3px solid ${statusColor}`,
                    borderRadius: 3,
                  }}>
                    {/* Bill title */}
                    <a
                      href={billUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onMouseDown={e => e.stopPropagation()}
                      style={{
                        display: 'block',
                        fontFamily: "'IBM Plex Mono',monospace",
                        fontSize: 10,
                        color: theme.hi,
                        textDecoration: 'none',
                        lineHeight: 1.4,
                        marginBottom: 4,
                      }}
                    >
                      {truncate(bill.title, 78)}
                    </a>

                    {/* Meta row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {/* Bill ID badge */}
                        {bill.type && bill.number && (
                          <span style={{
                            fontFamily: "'IBM Plex Mono',monospace", fontSize: 8,
                            color: theme.accent, border: `1px solid ${theme.border}`,
                            padding: '1px 5px', borderRadius: 3, letterSpacing: '0.5px',
                          }}>
                            {bill.type}{bill.number}
                          </span>
                        )}
                        {/* Sponsor */}
                        {bill.sponsor && (
                          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: theme.low }}>
                            {bill.sponsor.split(',')[0]}
                            {bill.sponsorParty ? ` (${bill.sponsorParty[0]})` : ''}
                          </span>
                        )}
                      </div>

                      {/* Date */}
                      {bill.introducedDate && (
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: theme.low }}>
                          {fmtDate(bill.introducedDate)}
                        </span>
                      )}
                    </div>

                    {/* Latest action */}
                    {bill.latestAction && (
                      <div style={{
                        fontFamily: "'IBM Plex Mono',monospace", fontSize: 8,
                        color: statusColor, marginTop: 4,
                        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                      }}>
                        ↳ {truncate(bill.latestAction, 70)}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Link to all legislation */}
              <a
                href={`https://www.congress.gov/search?q=%7B%22source%22%3A%22legislation%22%2C%22state%22%3A%22${stateCode}%22%7D`}
                target="_blank"
                rel="noopener noreferrer"
                onMouseDown={e => e.stopPropagation()}
                style={{
                  fontFamily: "'IBM Plex Mono',monospace",
                  fontSize: 9,
                  color: theme.blue || '#4A7FFF',
                  textDecoration: 'none',
                  paddingLeft: 2,
                  letterSpacing: '0.5px',
                }}
              >
                → View all {stateName} legislation on Congress.gov ↗
              </a>
            </div>
          )}
        </div>

        {/* AI Analysis */}
        <div style={{
          marginTop: '20px',
          padding: '14px',
          background: theme.cardB,
          borderRadius: '6px',
          border: `1px solid ${theme.border}`
        }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: theme.blue,
            letterSpacing: '1px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <span>🤖</span><span>AI ANALYSIS</span>
            {aiLoading && <span style={{ color: theme.mid }}>— generating…</span>}
          </div>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '12px', fontStyle: 'italic', color: theme.mid, lineHeight: '1.6' }}>
            {aiLoading
              ? 'Analyzing corruption patterns…'
              : (aiAnalysisText || 'Analysis unavailable.')}
          </div>
          <div style={{
            marginTop: '10px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: theme.low,
            borderTop: `1px solid ${theme.border}`, paddingTop: '8px'
          }}>
            {aiAnalysis?.data?.dataSource || 'FEC · USASpending.gov · DeepSeek AI'}
            {aiAnalysis?.data?.fallback && ' (AI fallback — narrative generated from data)'}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: `1px solid ${theme.border}`,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '8px',
          color: theme.low,
          textAlign: 'center'
        }}>
          Data sources: FEC · USASpending.gov · Congress.gov · OpenSecrets · DOJ
          <div style={{ marginTop: '4px' }}>
            Last updated: {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper component for sections
const Section = ({ title, items, theme }) => (
  <div style={{ marginBottom: '16px' }}>
    <div style={{
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: '10px',
      color: theme.accent,
      letterSpacing: '1px',
      marginBottom: '8px'
    }}>
      {title}
    </div>
    {items.map((item, index) => (
      <div
        key={index}
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '11px',
          color: theme.mid,
          marginBottom: '4px',
          paddingLeft: '12px',
          position: 'relative'
        }}
      >
        <span style={{
          position: 'absolute',
          left: 0,
          top: '6px',
          width: '4px',
          height: '4px',
          borderRadius: '50%',
          background: theme.accent
        }} />
        {item}
      </div>
    ))}
  </div>
);

export default CorruptionDialog;
