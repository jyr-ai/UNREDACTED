import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../theme/index.js';
import { useTutorial } from './TutorialProvider.jsx';
import { useMobile } from '../../hooks/useMediaQuery.js';
import { STEPS } from './steps.js';
import { getSpotlightStyles } from './lib/spotlight.js';

const ORANGE = '#FF8000';
const MF = "'IBM Plex Mono', monospace";

export default function GuidedTour({ tab, setTab }) {
  const t = useTheme();
  const { phase, currentStep, advance, back, skipTour } = useTutorial();
  const isMobile = useMobile();
  const [styles, setStyles] = useState(null);
  const [showSkipStep, setShowSkipStep] = useState(false);
  const skipTimerRef = useRef(null);
  const roRef = useRef(null);

  const step = STEPS[currentStep];
  const isRunning = phase === 'tour-running' && !isMobile;

  const reposition = useCallback(() => {
    if (!step) return;
    const s = getSpotlightStyles(step.targetSelector, step.placement, window.innerWidth, window.innerHeight);
    setStyles(s);
  }, [step]);

  // Reposition on step change, resize, DOM mutations
  useEffect(() => {
    if (!isRunning) { setStyles(null); return; }
    reposition();
    // Small delay to let React finish rendering the target
    const timer = setTimeout(reposition, 80);
    roRef.current = new ResizeObserver(reposition);
    roRef.current.observe(document.body);
    window.addEventListener('resize', reposition);
    return () => {
      clearTimeout(timer);
      roRef.current?.disconnect();
      window.removeEventListener('resize', reposition);
    };
  }, [isRunning, reposition]);

  // Step 4: auto-advance when user clicks the money tab
  useEffect(() => {
    if (!isRunning || !step?.waitForUserAction) return;
    if (tab === 'money') advance();
  }, [tab, isRunning, step?.waitForUserAction, advance]);

  // Step 4: 30s timeout shows "skip step" link
  useEffect(() => {
    setShowSkipStep(false);
    clearTimeout(skipTimerRef.current);
    if (isRunning && step?.waitForUserAction) {
      skipTimerRef.current = setTimeout(() => setShowSkipStep(true), 30000);
    }
    return () => clearTimeout(skipTimerRef.current);
  }, [isRunning, currentStep, step?.waitForUserAction]);

  // Auto-switch to correct tab for non-user-action steps
  useEffect(() => {
    if (!isRunning || !step || step.waitForUserAction) return;
    if (step.requiresTab && tab !== step.requiresTab) {
      setTab(step.requiresTab);
    }
  }, [isRunning, currentStep, step, tab, setTab]);

  // Esc exits the tour
  useEffect(() => {
    if (!isRunning) return;
    const handler = (e) => { if (e.key === 'Escape') skipTour(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isRunning, skipTour]);

  if (!isRunning || !styles) return null;

  return createPortal(
    <>
      {/* Dimmed overlay with spotlight hole */}
      <div
        onClick={skipTour}
        style={{
          position: 'fixed', inset: 0, zIndex: 600,
          background: 'rgba(0,0,0,.75)',
          ...(styles.found ? { clipPath: styles.clipPath } : {}),
          transition: 'clip-path .2s ease',
        }}
      />

      {/* Callout card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          zIndex: 700,
          width: 280,
          background: t.card,
          border: `1px solid ${ORANGE}`,
          padding: '16px 18px',
          boxShadow: `0 8px 24px rgba(255,128,0,.25)`,
          ...styles.callout,
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <span style={{ fontFamily: MF, fontSize: 9, color: ORANGE, letterSpacing: 1 }}>
            STEP {currentStep + 1} / {STEPS.length}
          </span>
          <button
            onClick={skipTour}
            style={{ background: 'none', border: 'none', color: t.mid, fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 0 }}
          >
            ×
          </button>
        </div>

        {/* Title */}
        <div style={{ fontFamily: MF, fontSize: 13, color: t.hi, fontWeight: 600, marginBottom: 6 }}>
          {step.title}
        </div>

        {/* Body — swap copy for waitForUserAction step */}
        <div style={{ fontFamily: MF, fontSize: 12, color: t.mid, lineHeight: 1.55, marginBottom: 14 }}>
          {step.waitForUserAction ? 'Click the highlighted tab to continue.' : step.body}
        </div>

        {/* Skip-step link (appears after 30s on step 4) */}
        {showSkipStep && (
          <div style={{ marginBottom: 10 }}>
            <button
              onClick={advance}
              style={{ background: 'none', border: 'none', color: ORANGE, fontSize: 11, cursor: 'pointer', padding: 0, fontFamily: MF }}
            >
              skip step →
            </button>
          </div>
        )}

        {/* Nav buttons — hidden on waitForUserAction steps */}
        {!step.waitForUserAction && (
          <div style={{ display: 'flex', gap: 8 }}>
            {currentStep > 0 && (
              <button onClick={back} style={navBtn(t, false)}>← Back</button>
            )}
            <button onClick={advance} style={navBtn(t, true)}>
              {currentStep === STEPS.length - 1 ? 'Done ✓' : 'Next →'}
            </button>
          </div>
        )}
      </div>
    </>,
    document.body
  );
}

function navBtn(t, primary) {
  return {
    background: primary ? ORANGE : 'transparent',
    color: primary ? '#000' : t.mid,
    border: primary ? 'none' : `1px solid ${t.border}`,
    padding: '7px 14px',
    fontFamily: MF, fontSize: 10, letterSpacing: 0.5,
    cursor: 'pointer',
  };
}
