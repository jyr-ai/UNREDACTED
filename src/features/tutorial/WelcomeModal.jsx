import { useEffect } from 'react';
import { useTheme } from '../../theme/index.js';
import { useTutorial } from './TutorialProvider.jsx';
import { useMobile } from '../../hooks/useMediaQuery.js';

const ORANGE = '#FF8000';
const MF = "'Roboto', sans-serif";

export default function WelcomeModal() {
  const t = useTheme();
  const { phase, dismissWelcome, startTour } = useTutorial();
  const isMobile = useMobile();

  useEffect(() => {
    if (phase !== 'welcome') return;
    const handler = (e) => { if (e.key === 'Escape') dismissWelcome(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [phase, dismissWelcome]);

  if (phase !== 'welcome') return null;

  return (
    <div
      onClick={dismissWelcome}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: t.card,
          border: `1px solid ${ORANGE}`,
          padding: '28px 32px',
          maxWidth: 440, width: '100%',
          boxShadow: `0 12px 40px rgba(255,128,0,.2)`,
        }}
      >
        <div style={{ fontFamily: MF, fontSize: 10, color: ORANGE, letterSpacing: 2, marginBottom: 12 }}>
          WELCOME TO UN*REDACTED
        </div>
        <p style={{ fontFamily: MF, fontSize: 14, color: t.hi, lineHeight: 1.6, margin: '0 0 24px' }}>
          Unredacted tracks money relationships amongst US politics, corporations, and power.
          Take a 60-second tour, or skip in.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          {!isMobile && (
            <button
              onClick={startTour}
              style={{
                background: ORANGE, color: '#000',
                border: 'none', padding: '10px 20px',
                fontFamily: MF, fontSize: 11, letterSpacing: 0.5,
                cursor: 'pointer', fontWeight: 700,
              }}
            >
              Take the tour →
            </button>
          )}
          <button
            onClick={dismissWelcome}
            style={{
              background: 'transparent',
              color: t.mid, border: `1px solid ${t.border}`,
              padding: '10px 20px',
              fontFamily: MF, fontSize: 11, letterSpacing: 0.5,
              cursor: 'pointer',
            }}
          >
            {isMobile ? 'Got it' : 'Skip in'}
          </button>
        </div>
      </div>
    </div>
  );
}
