import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../theme/index.js';
import { useTutorial } from './TutorialProvider.jsx';
import { useMobile } from '../../hooks/useMediaQuery.js';
import { STEPS } from './steps.js';
import { getSpotlightStyles } from './lib/spotlight.js';

const ORANGE = '#FF8000';
const MF = "'Roboto', sans-serif";
const DIM = 'rgba(0,0,0,.72)';

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
    // Run immediately so the callout is on screen with no flicker
    reposition();
    // Run again after the target's tab has had a chance to mount
    const t1 = setTimeout(reposition, 80);
    const t2 = setTimeout(reposition, 250);
    const t3 = setTimeout(reposition, 600);
    roRef.current = new ResizeObserver(reposition);
    roRef.current.observe(document.body);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      roRef.current?.disconnect();
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [isRunning, reposition]);

  // Scroll the target into view on step change so the user doesn't have to.
  // Run after the requiresTab switch has had a moment to render the target.
  useEffect(() => {
    if (!isRunning || !step?.targetSelector) return;
    let cancelled = false;
    const tryScroll = (attempt = 0) => {
      if (cancelled) return;
      const el = document.querySelector(step.targetSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        const vpH = window.innerHeight;
        // Only scroll if the element isn't already comfortably in view.
        const fullyVisible = rect.top >= 40 && rect.bottom <= vpH - 40;
        if (!fullyVisible) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        // Reposition once the smooth scroll has settled
        setTimeout(reposition, 450);
      } else if (attempt < 6) {
        setTimeout(() => tryScroll(attempt + 1), 100);
      }
    };
    // Wait one frame for any tab switch to commit
    const id = setTimeout(tryScroll, 50);
    return () => { cancelled = true; clearTimeout(id); };
  }, [isRunning, currentStep, step?.targetSelector, reposition]);

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

  // CRITICAL: render even before styles are computed — once isRunning is true
  // the callout must always be on screen. styles fills in via effect below.
  if (!isRunning || !step) return null;

  const hole = styles?.hole || null;
  const callout = styles?.callout || { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 280 };
  const vpW = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vpH = typeof window !== 'undefined' ? window.innerHeight : 800;

  return createPortal(
    <>
      {/* 4-rectangle dim overlay around the spotlight hole.
          When no hole, render a single full-screen dim div. */}
      {hole ? (
        <>
          {/* TOP */}
          <div onClick={skipTour} style={dimRect(0, 0, vpW, hole.top)} />
          {/* LEFT */}
          <div onClick={skipTour} style={dimRect(0, hole.top, hole.left, hole.height)} />
          {/* RIGHT */}
          <div onClick={skipTour} style={dimRect(hole.left + hole.width, hole.top, vpW - (hole.left + hole.width), hole.height)} />
          {/* BOTTOM */}
          <div onClick={skipTour} style={dimRect(0, hole.top + hole.height, vpW, vpH - (hole.top + hole.height))} />
          {/* Glow ring around the spotlight (no fill — just a colored border) */}
          <div
            style={{
              position: 'fixed',
              top: hole.top, left: hole.left, width: hole.width, height: hole.height,
              border: `2px solid ${ORANGE}`,
              boxShadow: `0 0 0 2px rgba(255,128,0,.25), 0 0 32px rgba(255,128,0,.4)`,
              pointerEvents: 'none',
              zIndex: 600,
              transition: 'all .2s ease',
            }}
          />
        </>
      ) : (
        <div onClick={skipTour} style={{ position: 'fixed', inset: 0, zIndex: 600, background: DIM }} />
      )}

      {/* Callout card — ALWAYS rendered when tour is running */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          zIndex: 700,
          background: t.card,
          border: `1px solid ${ORANGE}`,
          padding: '16px 18px',
          boxShadow: `0 8px 24px rgba(255,128,0,.25)`,
          ...callout,
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <span style={{ fontFamily: MF, fontSize: 9, color: ORANGE, letterSpacing: 1 }}>
            STEP {currentStep + 1} / {STEPS.length}
          </span>
          <button
            onClick={skipTour}
            aria-label="Close tour"
            style={{ background: 'none', border: 'none', color: t.mid, fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 0 }}
          >
            ×
          </button>
        </div>

        {/* Title */}
        <div style={{ fontFamily: MF, fontSize: 13, color: t.hi, fontWeight: 600, marginBottom: 6 }}>
          {step.title}
        </div>

        {/* Body */}
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

function dimRect(left, top, width, height) {
  return {
    position: 'fixed',
    top, left,
    width: Math.max(0, width),
    height: Math.max(0, height),
    background: DIM,
    zIndex: 600,
    cursor: 'pointer',
  };
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
