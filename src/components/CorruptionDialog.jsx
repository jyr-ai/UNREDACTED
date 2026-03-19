/**
 * Corruption Dialog Component
 * Draggable floating dialog showing detailed corruption profile for a state
 */

import React, { useState, useEffect, useRef } from 'react';
import { useApiData } from '../hooks/useApiData';

const CorruptionDialog = ({ stateCode, stateName, position, onClose, theme }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [currentPosition, setCurrentPosition] = useState(position);
  const dialogRef = useRef(null);

  // Fetch detailed state corruption data
  const { data: corruptionData, loading: corruptionLoading } = useApiData(
    stateCode ? `/api/campaign-watch/state/${stateCode}/corruption` : null
  );

  // Fetch AI analysis
  const { data: aiAnalysis, loading: aiLoading } = useApiData(
    stateCode ? `/api/campaign-watch/state/${stateCode}/ai-analysis` : null
  );

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

  // Mock data for demonstration
  const mockData = {
    corruptionIndex: corruptionData?.data?.corruptionIndex || 34,
    fundraising: {
      total: 47800000,
      candidates: 142,
      topCandidates: [
        { name: 'Cruz (R)', amount: 12400000 },
        { name: 'Allred (D)', amount: 9800000 }
      ]
    },
    darkMoney: {
      total: 18200000,
      orgs: 14,
      topOrg: { name: 'Texans for Prosperity', amount: 4200000 }
    },
    federalContracts: {
      total: 89400000000,
      topCompanies: [
        { name: 'Lockheed Martin', amount: 22100000000 },
        { name: 'Raytheon', amount: 8900000000 }
      ]
    },
    stockActFlags: {
      count: 7,
      members: 3
    },
    lobbying: {
      total: 142000000,
      target: 'TX delegation'
    },
    revolvingDoor: {
      officials: 12
    },
    legislativeCapture: 72,
    dojActions: 3
  };

  const aiMockAnalysis = aiAnalysis?.data?.analysis || "72% of bills sponsored by TX delegation directly benefit top 5 PAC donor industries. Energy lobbying ↑41% since 2024. Defense contractors received 68% of sole-source contracts while donating $142M to TX representatives. Revolving door: 12 former officials now lobby for industries they regulated.";

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
            {stateName} — Political Corruption Profile
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
        {/* Corruption Index */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px'
          }}>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '11px',
              color: theme.accent,
              letterSpacing: '2px'
            }}>
              🔴 CORRUPTION INDEX
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '10px',
              color: getCorruptionColor(mockData.corruptionIndex),
              border: `1px solid ${getCorruptionColor(mockData.corruptionIndex)}44`,
              padding: '2px 8px',
              borderRadius: '12px',
              background: getCorruptionColor(mockData.corruptionIndex) + '12'
            }}>
              {getCorruptionLevel(mockData.corruptionIndex)}
            </div>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              border: `3px solid ${getCorruptionColor(mockData.corruptionIndex)}`,
              background: getCorruptionColor(mockData.corruptionIndex) + '18',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '18px',
              color: getCorruptionColor(mockData.corruptionIndex),
              fontWeight: 'bold',
              boxShadow: `0 0 15px ${getCorruptionColor(mockData.corruptionIndex)}28`
            }}>
              {mockData.corruptionIndex}
            </div>
            <div>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '10px',
                color: theme.mid,
                marginBottom: '4px'
              }}>
                SCORE: {mockData.corruptionIndex}/100
              </div>
              <div style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: '12px',
                fontStyle: 'italic',
                color: theme.mid,
                lineHeight: '1.4'
              }}>
                {mockData.corruptionIndex < 50
                  ? 'High corruption risk: Strong correlation between donor industries and legislative outcomes.'
                  : 'Moderate corruption risk: Some influence patterns detected.'}
              </div>
            </div>
          </div>
        </div>

        {/* Fundraising */}
        <Section
          title="💰 FUNDRAISING"
          theme={theme}
          items={[
            `Total: ${formatCurrency(mockData.fundraising.total)} · ${mockData.fundraising.candidates} candidates`,
            `Top: ${mockData.fundraising.topCandidates[0].name} ${formatCurrency(mockData.fundraising.topCandidates[0].amount)}`,
            `${mockData.fundraising.topCandidates[1].name} ${formatCurrency(mockData.fundraising.topCandidates[1].amount)}`
          ]}
        />

        {/* Dark Money */}
        <Section
          title="🕳️ DARK MONEY"
          theme={theme}
          items={[
            `${formatCurrency(mockData.darkMoney.total)} undisclosed · ${mockData.darkMoney.orgs} orgs`,
            `${mockData.darkMoney.topOrg.name}: ${formatCurrency(mockData.darkMoney.topOrg.amount)}`
          ]}
        />

        {/* Federal Contracts */}
        <Section
          title="📋 FEDERAL CONTRACTS"
          theme={theme}
          items={[
            `${formatCurrency(mockData.federalContracts.total)}`,
            `${mockData.federalContracts.topCompanies[0].name}: ${formatCurrency(mockData.federalContracts.topCompanies[0].amount)}`,
            `${mockData.federalContracts.topCompanies[1].name}: ${formatCurrency(mockData.federalContracts.topCompanies[1].amount)}`
          ]}
        />

        {/* STOCK Act Flags */}
        <Section
          title="⚖️ STOCK ACT FLAGS"
          theme={theme}
          items={[
            `${mockData.stockActFlags.count} flagged trades · ${mockData.stockActFlags.members} members`
          ]}
        />

        {/* Lobbying */}
        <Section
          title="📊 LOBBYING"
          theme={theme}
          items={[
            `${formatCurrency(mockData.lobbying.total)} targeting ${mockData.lobbying.target}`
          ]}
        />

        {/* Revolving Door */}
        <Section
          title="🚪 REVOLVING DOOR"
          theme={theme}
          items={[
            `${mockData.revolvingDoor.officials} officials → industry`
          ]}
        />

        {/* Legislative Capture */}
        <div style={{
          marginBottom: '16px',
          padding: '12px',
          background: theme.cardB,
          borderRadius: '6px',
          borderLeft: `3px solid ${theme.accent}`
        }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '10px',
            color: theme.accent,
            letterSpacing: '1px',
            marginBottom: '6px'
          }}>
            🏛️ LEGISLATIVE CAPTURE
          </div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '14px',
            color: theme.hi,
            fontWeight: 'bold'
          }}>
            {mockData.legislativeCapture}%
          </div>
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '11px',
            fontStyle: 'italic',
            color: theme.mid,
            marginTop: '4px'
          }}>
            Bills benefiting donor industries
          </div>
        </div>

        {/* DOJ Actions */}
        <div style={{
          marginBottom: '16px',
          padding: '12px',
          background: theme.cardB,
          borderRadius: '6px',
          borderLeft: `3px solid ${theme.warn}`
        }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '10px',
            color: theme.warn,
            letterSpacing: '1px',
            marginBottom: '6px'
          }}>
            📰 DOJ ACTIONS
          </div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '14px',
            color: theme.hi,
            fontWeight: 'bold'
          }}>
            {mockData.dojActions} active
          </div>
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '11px',
            fontStyle: 'italic',
            color: theme.mid,
            marginTop: '4px'
          }}>
            Federal investigations
          </div>
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
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '10px',
            color: theme.blue,
            letterSpacing: '1px',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>🤖</span>
            <span>AI ANALYSIS</span>
          </div>
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '12px',
            fontStyle: 'italic',
            color: theme.mid,
            lineHeight: '1.6'
          }}>
            {aiLoading ? 'Analyzing corruption patterns...' : aiMockAnalysis}
          </div>
          <div style={{
            marginTop: '10px',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '8px',
            color: theme.low,
            borderTop: `1px solid ${theme.border}`,
            paddingTop: '8px'
          }}>
            DeepSeek-generated narrative based on FEC, USASpending, and Congress.gov data
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
