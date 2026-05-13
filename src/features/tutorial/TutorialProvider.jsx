import { createContext, useContext, useState, useEffect } from 'react';
import { useFirstVisit } from './hooks/useFirstVisit.js';
import { STEPS } from './steps.js';

const TutorialCtx = createContext(null);

export function useTutorial() {
  const ctx = useContext(TutorialCtx);
  if (!ctx) throw new Error('useTutorial must be used inside TutorialProvider');
  return ctx;
}

export default function TutorialProvider({ children }) {
  const { isFirstVisit, markSeen } = useFirstVisit();
  const [phase, setPhase] = useState('boot');
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    setPhase(isFirstVisit() ? 'welcome' : 'done');
  }, []);

  function startTour() {
    setCurrentStep(0);
    setPhase('tour-running');
  }

  function dismissWelcome() {
    markSeen();
    setPhase('done');
  }

  function skipTour() {
    markSeen();
    setPhase('done');
  }

  function advance() {
    setCurrentStep(s => {
      const next = s + 1;
      if (next >= STEPS.length) {
        markSeen();
        setPhase('done');
        return s;
      }
      return next;
    });
  }

  function back() {
    setCurrentStep(s => Math.max(0, s - 1));
  }

  return (
    <TutorialCtx.Provider value={{ phase, currentStep, startTour, dismissWelcome, skipTour, advance, back }}>
      {children}
    </TutorialCtx.Provider>
  );
}
