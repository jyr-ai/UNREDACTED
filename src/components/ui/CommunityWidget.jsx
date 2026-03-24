import { useState, useEffect } from 'react';
import { useLocalStorage } from '../../hooks/useLocalStorage.js';

const DISCUSSION_URL = 'https://github.com/policybot-io/UNREDACTED/discussions';

export default function CommunityWidget({ theme }) {
  const [dismissed, setDismissed] = useLocalStorage('unredacted-community-dismissed', false);
  const [visible, setVisible] = useState(false);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    // Show after a short delay if not dismissed
    if (!dismissed) {
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [dismissed]);

  const handleClose = () => {
    setHiding(true);
    setTimeout(() => {
      setVisible(false);
      setHiding(false);
    }, 300);
  };

  const handleDismiss = () => {
    setDismissed(true);
    handleClose();
  };

  if (!visible) return null;

  const t = theme;
  const ORANGE = '#FF8000';
  const WHITE = '#FFFFFF';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 9999,
        transition: 'transform 0.3s ease, opacity 0.3s ease',
        transform: hiding ? 'translateY(20px) scale(0.95)' : 'translateY(0) scale(1)',
        opacity: hiding ? 0 : 1,
        pointerEvents: hiding ? 'none' : 'auto',
      }}
    >
      <div
        style={{
          background: t.card,
          border: `1px solid ${t.border}`,
          borderTop: `3px solid ${ORANGE}`,
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
          maxWidth: 320,
          overflow: 'hidden',
          fontFamily: "'Roboto', sans-serif",
        }}
      >
        {/* Main pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            background: t.cardB,
            borderBottom: `1px solid ${t.border}`,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: ORANGE,
              flexShrink: 0,
              animation: 'pulse 2s infinite',
            }}
          />
          <span style={{ fontSize: 11, color: t.hi, flex: 1 }}>
            Join the conversation
          </span>
          <a
            href={DISCUSSION_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: ORANGE,
              color: WHITE,
              border: 'none',
              padding: '6px 12px',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.5,
              textDecoration: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#E67300')}
            onMouseLeave={(e) => (e.currentTarget.style.background = ORANGE)}
          >
            Open Discussion
          </a>
          <button
            onClick={handleClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              color: t.mid,
              fontSize: 18,
              lineHeight: 1,
              cursor: 'pointer',
              padding: '0 4px',
              marginLeft: 4,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = t.hi)}
            onMouseLeave={(e) => (e.currentTarget.style.color = t.mid)}
          >
            &times;
          </button>
        </div>

        {/* Dismiss button */}
        <div style={{ padding: '10px 16px 12px' }}>
          <button
            onClick={handleDismiss}
            style={{
              background: 'none',
              border: `1px solid ${t.border}`,
              color: t.low,
              fontSize: 9,
              padding: '4px 10px',
              cursor: 'pointer',
              width: '100%',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = t.hi;
              e.currentTarget.style.borderColor = t.mid;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = t.low;
              e.currentTarget.style.borderColor = t.border;
            }}
          >
            Don't show again
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0% { opacity: 0.6; box-shadow: 0 0 0 0 rgba(255, 128, 0, 0.7); }
          70% { opacity: 1; box-shadow: 0 0 0 6px rgba(255, 128, 0, 0); }
          100% { opacity: 0.6; box-shadow: 0 0 0 0 rgba(255, 128, 0, 0); }
        }
      `}</style>
    </div>
  );
}
