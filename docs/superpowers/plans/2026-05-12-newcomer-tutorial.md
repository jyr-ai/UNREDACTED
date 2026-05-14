# Newcomer Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a hybrid three-layer onboarding system — welcome modal, 9-step guided overlay tour (desktop only), and persistent `i` coach marks — so new users understand the app without blocking power users.

**Architecture:** A `TutorialProvider` (React context + 4-state machine + localStorage) is mounted in `main.jsx` and drives two portal components (`WelcomeModal`, `GuidedTour`) rendered inside `App.jsx`. A reusable `CoachMark` component is dropped inline next to panel headings across the app. A new `SettingsMenu` dropdown replaces the existing `⚙ Settings` button and exposes both "Configure" (existing Settings page) and "Take a tour" (replay).

**Tech Stack:** React 18, existing `useTheme()` / `useMobile()` hooks, `createPortal`, `ResizeObserver`, `localStorage`, inline styles (no new CSS libraries).

**Spec:** `docs/superpowers/specs/2026-05-12-newcomer-tutorial-design.md`

---

## File Map

### New files

| File | Responsibility |
|---|---|
| `src/features/tutorial/TutorialProvider.jsx` | Context, 4-state machine (`boot→welcome→tour-running→done`), localStorage gate. Exports `TutorialProvider` (default) and `useTutorial` (named). |
| `src/features/tutorial/WelcomeModal.jsx` | Layer 1. First-visit modal. Offers tour on desktop, just "Got it" on mobile. |
| `src/features/tutorial/GuidedTour.jsx` | Layer 2. Spotlight overlay + callout. Desktop/tablet only. Receives `tab` + `setTab` as props. |
| `src/features/tutorial/CoachMark.jsx` | Layer 3. Inline `i` glyph + popover. Completely independent of tour state. |
| `src/features/tutorial/steps.js` | Array of 9 step definition objects. |
| `src/features/tutorial/coachMarks.js` | Object keyed by id → `{ title, body }`. |
| `src/features/tutorial/hooks/useFirstVisit.js` | Reads/writes `unr_tour_seen=v1` in localStorage with try/catch. |
| `src/features/tutorial/lib/spotlight.js` | `getSpotlightStyles(selector, placement, vpW, vpH)` — clip-path + callout position. |
| `src/components/layout/SettingsMenu.jsx` | Dropdown on desktop, inline rows on mobile. Props: `onConfigure`, `onTakeTour`. |

### Modified files

| File | Change |
|---|---|
| `src/main.jsx` | Wrap `<App/>` in `<TutorialProvider>` |
| `src/App.jsx` | Import + render `<WelcomeModal/>` and `<GuidedTour tab={tab} setTab={setTab}/>` as portals; replace `⚙ Settings` button (line ~1628) with `<SettingsMenu>`; add `data-tour` on tab buttons + AI button |
| `src/components/layout/Ticker.jsx` | Add `data-tour="ticker"` to outer wrapper |
| `src/pages/CampaignWatch.jsx` | Add `data-tour="monitor-map"` to map wrapper; `data-tour="monitor-feeds"` to panels wrapper |
| `src/pages/FollowTheMoney.jsx` | Add `data-tour` to PageSidebar items; add `<CoachMark>` next to sub-tab labels; subscribe to tour context to auto-switch sub-tab |

---

## Task 1: SettingsMenu component + wire into App.jsx (Configure only)

**Files:**
- Create: `src/components/layout/SettingsMenu.jsx`
- Modify: `src/App.jsx` lines ~1628–1635 (desktop ⚙ button) and ~1538–1545 (mobile drawer ⚙ row)

- [ ] **Step 1: Create `src/components/layout/SettingsMenu.jsx`**

```jsx
import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../theme/index.js';
import { useMobile } from '../../hooks/useMediaQuery.js';

const ORANGE = '#FF8000';
const MF = "'Roboto', sans-serif";

export default function SettingsMenu({ onConfigure, onTakeTour }) {
  const t = useTheme();
  const isMobile = useMobile();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  if (isMobile) {
    return (
      <>
        <button onClick={() => { onTakeTour?.(); }} style={mobileRowStyle(t)}>
          <span style={{ color: ORANGE, fontSize: 12, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>i</span>
          Take a tour
        </button>
        <button onClick={() => { onConfigure(); }} style={mobileRowStyle(t)}>
          <span style={{ color: ORANGE }}>⚙</span>
          Configure
        </button>
      </>
    );
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'transparent', border: 'none',
          borderBottom: `3px solid ${open ? ORANGE : 'transparent'}`,
          padding: '12px 10px',
          fontFamily: MF, fontSize: 10.5, letterSpacing: 0.5,
          color: open ? ORANGE : t.mid,
          cursor: 'pointer', whiteSpace: 'nowrap',
          transition: 'color .14s, border-color .14s',
        }}
      >
        ⚙ Settings {open ? '▴' : '▾'}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 2,
          background: t.navBg, border: `1px solid ${ORANGE}`,
          minWidth: 210, zIndex: 300,
          boxShadow: `0 6px 20px rgba(255,128,0,.2)`,
        }}>
          <button onClick={() => { onTakeTour?.(); setOpen(false); }} style={dropdownItemStyle(t)}>
            <span style={{ color: ORANGE, fontSize: 13, fontStyle: 'italic', fontFamily: 'Georgia, serif', flexShrink: 0 }}>i</span>
            <div>
              <div style={{ color: t.hi, fontSize: 11, fontFamily: MF }}>Take a tour</div>
              <div style={{ color: t.mid, fontSize: 9, fontFamily: MF, marginTop: 1 }}>Replay the newcomer walkthrough</div>
            </div>
          </button>
          <button onClick={() => { onConfigure(); setOpen(false); }} style={{ ...dropdownItemStyle(t), borderBottom: 'none' }}>
            <span style={{ color: ORANGE, flexShrink: 0 }}>⚙</span>
            <div>
              <div style={{ color: t.hi, fontSize: 11, fontFamily: MF }}>Configure</div>
              <div style={{ color: t.mid, fontSize: 9, fontFamily: MF, marginTop: 1 }}>Theme &amp; API keys</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

function dropdownItemStyle(t) {
  return {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    width: '100%', textAlign: 'left',
    background: 'none', border: 'none',
    borderBottom: `1px solid ${t.border}`,
    padding: '10px 14px',
    cursor: 'pointer',
  };
}

function mobileRowStyle(t) {
  return {
    width: '100%', textAlign: 'left',
    background: 'none', border: 'none',
    borderLeft: '3px solid transparent',
    padding: '13px 16px',
    fontFamily: "'Roboto', sans-serif", fontSize: 24,
    color: t.mid, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 10,
  };
}
```

- [ ] **Step 2: Replace the desktop `⚙ Settings` button in `src/App.jsx`**

In `src/App.jsx`, add this import near the top with the other layout imports:
```jsx
import SettingsMenu from "./components/layout/SettingsMenu.jsx";
```

Find the desktop nav settings button (around line 1628). Replace:
```jsx
              <div style={{ width:1, height:22, background:theme.border, flexShrink:0 }}/>
              <button onClick={() => { setTab(t => { const next=t==="settings"?"overview":"settings"; track("tab_view",{tab:next}); return next; }); }} style={{
                display:"flex", alignItems:"center", gap:6, background:"transparent", border:"none",
                borderBottom:`3px solid ${tab==="settings"?ORANGE:"transparent"}`, padding:"12px 10px",
                fontFamily:MF, fontSize:10.5, letterSpacing:0.5, color:tab==="settings"?ORANGE:theme.mid,
                transition:"color .14s, border-color .14s", whiteSpace:"nowrap",
              }}>
                ⚙ Settings
              </button>
```
With:
```jsx
              <div style={{ width:1, height:22, background:theme.border, flexShrink:0 }}/>
              <SettingsMenu
                onConfigure={() => { setTab("settings"); track("tab_view", { tab: "settings" }); }}
                onTakeTour={null}
              />
```

- [ ] **Step 3: Replace the mobile drawer `⚙ Settings` row in `src/App.jsx`**

Find the mobile drawer settings button (around line 1538). Replace:
```jsx
                  <button onClick={() => { setTab(t=>t==="settings"?"monitor":"settings"); setMenuOpen(false); }} style={{
                    width:"100%", textAlign:"left", background: tab==="settings" ? ORANGE+"18" : "none",
                    border:"none", borderLeft:`3px solid ${tab==="settings"?ORANGE:"transparent"}`,
                    padding:"13px 16px", fontFamily:MF, fontSize:24, color: tab==="settings"?ORANGE:theme.mid,
                  }}>
                    ⚙ Settings
                  </button>
```
With:
```jsx
                  <SettingsMenu
                    onConfigure={() => { setTab("settings"); setMenuOpen(false); track("tab_view", { tab: "settings" }); }}
                    onTakeTour={null}
                  />
```

- [ ] **Step 4: Manual verify**

Run `npm run dev:all`. Open the app on desktop — click `⚙ Settings ▾` and confirm the dropdown shows two items. Click "Configure" → Settings page opens. Click "Take a tour" → nothing happens (it's null for now — that's expected). On mobile viewport (DevTools), open the drawer and confirm two inline rows appear. Dismiss works.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/SettingsMenu.jsx src/App.jsx
git commit -m "feat(tutorial): add SettingsMenu dropdown (Configure only)"
```

---

## Task 2: Tutorial scaffolding — provider, state machine, step definitions

**Files:**
- Create: `src/features/tutorial/hooks/useFirstVisit.js`
- Create: `src/features/tutorial/steps.js`
- Create: `src/features/tutorial/TutorialProvider.jsx`
- Modify: `src/main.jsx`

- [ ] **Step 1: Create `src/features/tutorial/hooks/useFirstVisit.js`**

```js
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
```

- [ ] **Step 2: Create `src/features/tutorial/steps.js`**

```js
export const STEPS = [
  {
    id: 'what-is-unredacted',
    targetSelector: '[data-tour="ticker"]',
    title: 'What is UN*REDACTED?',
    body: 'Unredacted tracks money relationships amongst US politics, corporations, and power. Every figure here comes from public federal disclosures.',
    placement: 'center',
    requiresTab: 'monitor',
    waitForUserAction: false,
    authGated: false,
  },
  {
    id: 'monitor-map',
    targetSelector: '[data-tour="monitor-map"]',
    title: 'The live map',
    body: 'Click any state to see its congressional delegation, live news, and active federal contracts.',
    placement: 'right',
    requiresTab: 'monitor',
    waitForUserAction: false,
    authGated: false,
  },
  {
    id: 'monitor-feeds',
    targetSelector: '[data-tour="monitor-feeds"]',
    title: 'Live news & feed',
    body: 'Stories and filings surfacing in real time. The feed updates as new FEC data and news hits.',
    placement: 'bottom',
    requiresTab: 'monitor',
    waitForUserAction: false,
    authGated: false,
  },
  {
    id: 'switch-to-galaxy',
    targetSelector: '[data-tour="tab-money"]',
    title: 'Explore Money Galaxy',
    body: 'Click this tab to follow the money — donations, PACs, dark money, and corporate networks.',
    placement: 'top',
    requiresTab: 'monitor',
    waitForUserAction: true,
    authGated: false,
  },
  {
    id: 'donor-intel',
    targetSelector: '[data-tour="subtab-intel"]',
    title: 'Donor Intelligence',
    body: 'Deep-dive profiles on individual donors: contribution history, employer, PAC affiliations, and sector breakdown.',
    placement: 'right',
    requiresTab: 'money',
    waitForUserAction: false,
    authGated: false,
  },
  {
    id: 'money-flow',
    targetSelector: '[data-tour="subtab-flow"]',
    title: 'Money Flow',
    body: 'A Sankey diagram tracing donations from employer → PAC → candidate across a full election cycle.',
    placement: 'right',
    requiresTab: 'money',
    waitForUserAction: false,
    authGated: false,
  },
  {
    id: 'dark-money',
    targetSelector: '[data-tour="subtab-darkmoney"]',
    title: 'Dark Money',
    body: '501(c)(4) organisations spend on elections without disclosing donors — the least transparent slice of campaign finance.',
    placement: 'right',
    requiresTab: 'money',
    waitForUserAction: false,
    authGated: false,
  },
  {
    id: 'corp-pacs',
    targetSelector: '[data-tour="subtab-corpacs"]',
    title: 'Corporate PACs',
    body: 'A force-directed network showing corporations, their PACs, and recipient politicians. Click any node to explore.',
    placement: 'right',
    requiresTab: 'money',
    waitForUserAction: false,
    authGated: false,
  },
  {
    id: 'ai-analyst',
    targetSelector: '[data-tour="ai-button"]',
    title: 'The AI Analyst',
    body: 'Ask any question. Four specialist agents (Policy, Spending, Donor, Corruption) route your query and synthesize findings from real federal data.',
    placement: 'left',
    requiresTab: null,
    waitForUserAction: false,
    authGated: false,
  },
];
```

- [ ] **Step 3: Create `src/features/tutorial/TutorialProvider.jsx`**

```jsx
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
```

- [ ] **Step 4: Wrap `<App/>` in `src/main.jsx`**

Replace the entire file with:
```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import TutorialProvider from './features/tutorial/TutorialProvider.jsx'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TutorialProvider>
      <App />
    </TutorialProvider>
    <Analytics />
    <SpeedInsights />
  </StrictMode>,
)
```

- [ ] **Step 5: Manual verify**

Run `npm run dev:all`. Open browser console and run:
```js
localStorage.removeItem('unr_tour_seen'); location.reload();
```
No visible change yet (no UI components rendered), but there should be no console errors. Then run:
```js
localStorage.setItem('unr_tour_seen', 'v1'); location.reload();
```
Also no visible change and no errors. Provider is working silently.

- [ ] **Step 6: Commit**

```bash
git add src/features/tutorial/hooks/useFirstVisit.js src/features/tutorial/steps.js src/features/tutorial/TutorialProvider.jsx src/main.jsx
git commit -m "feat(tutorial): add TutorialProvider, state machine, and step definitions"
```

---

## Task 3: Welcome modal

**Files:**
- Create: `src/features/tutorial/WelcomeModal.jsx`
- Modify: `src/App.jsx` — import + render `<WelcomeModal/>`

- [ ] **Step 1: Create `src/features/tutorial/WelcomeModal.jsx`**

```jsx
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
```

- [ ] **Step 2: Render `<WelcomeModal/>` in `src/App.jsx`**

Add the import near the top with the other feature imports:
```jsx
import WelcomeModal from "./features/tutorial/WelcomeModal.jsx";
```

Inside the `return (` block, directly after `<Auth isOpen={showAuth} .../>` (around line 1394), add:
```jsx
      {/* Tutorial layer 1 — welcome modal */}
      <WelcomeModal />
```

- [ ] **Step 3: Manual verify**

Run `npm run dev:all`. In the browser console:
```js
localStorage.removeItem('unr_tour_seen'); location.reload();
```
The welcome modal should appear. Click "Skip in" — modal disappears. Reload — modal does NOT appear again (flag is set). In console:
```js
localStorage.removeItem('unr_tour_seen'); location.reload();
```
Press Esc — modal dismisses. Click the dark backdrop — modal dismisses. On mobile viewport (DevTools), confirm the "Take the tour →" button is absent and only "Got it" appears.

- [ ] **Step 4: Commit**

```bash
git add src/features/tutorial/WelcomeModal.jsx src/App.jsx
git commit -m "feat(tutorial): add welcome modal (layer 1)"
```

---

## Task 4: Spotlight engine

**Files:**
- Create: `src/features/tutorial/lib/spotlight.js`

- [ ] **Step 1: Create `src/features/tutorial/lib/spotlight.js`**

```js
const PAD = 8;
const CALLOUT_WIDTH = 280;

export function getSpotlightStyles(targetSelector, placement, vpW, vpH) {
  const el = document.querySelector(targetSelector);

  if (!el) {
    return {
      found: false,
      clipPath: null,
      callout: { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
    };
  }

  const rect = el.getBoundingClientRect();
  const top = rect.top - PAD;
  const left = rect.left - PAD;
  const w = rect.width + PAD * 2;
  const h = rect.height + PAD * 2;
  const bottom = top + h;
  const right = left + w;

  // Polygon with a rectangular hole cut out of the overlay
  const clipPath = [
    `0px 0px`,
    `0px ${vpH}px`,
    `${left}px ${vpH}px`,
    `${left}px ${top}px`,
    `${right}px ${top}px`,
    `${right}px ${bottom}px`,
    `${left}px ${bottom}px`,
    `${left}px ${vpH}px`,
    `${vpW}px ${vpH}px`,
    `${vpW}px 0px`,
  ].join(', ');

  const callout = computeCalloutPosition(rect, placement, vpW, vpH);

  return { found: true, rect, clipPath: `polygon(${clipPath})`, callout };
}

function computeCalloutPosition(rect, placement, vpW, vpH) {
  const GAP = 16;
  const base = { position: 'fixed', width: CALLOUT_WIDTH };

  switch (placement) {
    case 'right':
      return { ...base, top: clamp(rect.top + rect.height / 2, 60, vpH - 60), left: rect.right + GAP, transform: 'translateY(-50%)' };
    case 'left':
      return { ...base, top: clamp(rect.top + rect.height / 2, 60, vpH - 60), left: rect.left - CALLOUT_WIDTH - GAP, transform: 'translateY(-50%)' };
    case 'bottom':
      return { ...base, top: rect.bottom + GAP, left: clamp(rect.left + rect.width / 2 - CALLOUT_WIDTH / 2, 12, vpW - CALLOUT_WIDTH - 12) };
    case 'top':
      return { ...base, top: rect.top - GAP, left: clamp(rect.left + rect.width / 2 - CALLOUT_WIDTH / 2, 12, vpW - CALLOUT_WIDTH - 12), transform: 'translateY(-100%)' };
    default: // center
      return { ...base, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}
```

- [ ] **Step 2: Manual verify**

No visual change yet. Confirm no import errors:
```js
// In browser console (after dev server is running):
// Navigate to the app — no new errors in the console.
```

- [ ] **Step 3: Commit**

```bash
git add src/features/tutorial/lib/spotlight.js
git commit -m "feat(tutorial): add spotlight positioning engine"
```

---

## Task 5: GuidedTour shell + steps 1–3 (Monitor tab) + data-tour anchors

**Files:**
- Create: `src/features/tutorial/GuidedTour.jsx`
- Modify: `src/components/layout/Ticker.jsx` — add `data-tour="ticker"`
- Modify: `src/pages/CampaignWatch.jsx` — add `data-tour="monitor-map"` and `data-tour="monitor-feeds"`
- Modify: `src/App.jsx` — import + render `<GuidedTour>`; add `data-tour="tab-money"` to the Money Galaxy nav button

- [ ] **Step 1: Add `data-tour="ticker"` to `src/components/layout/Ticker.jsx`**

Open the file and find the outermost wrapper `<div>` or `<span>` that contains the whole ticker. Add `data-tour="ticker"` to it. Example — if the outer element looks like:
```jsx
<div style={{ background: t.tickerBg, ... }}>
```
Change it to:
```jsx
<div data-tour="ticker" style={{ background: t.tickerBg, ... }}>
```

- [ ] **Step 2: Add `data-tour` anchors in `src/pages/CampaignWatch.jsx`**

Find the map container — the `<div>` or `<Suspense>` wrapping `<DeckGLMap>` (around line 455 in CampaignWatch). Add `data-tour="monitor-map"`:
```jsx
<div data-tour="monitor-map" style={{ ... }}>
  <Suspense fallback={<MapFallback t={t} />}>
    <DeckGLMap ... />
  </Suspense>
</div>
```

Find the panels wrapper — the `<div>` containing both `<LiveNewsPanel />` and `<LiveFeedPanel />` (around line 408–450). Add `data-tour="monitor-feeds"`:
```jsx
<div data-tour="monitor-feeds" style={{ display: 'flex', ... }}>
  <LiveNewsPanel />
  ...
  <LiveFeedPanel />
</div>
```

- [ ] **Step 3: Add `data-tour="tab-money"` to the Money Galaxy tab button in `src/App.jsx`**

Find the desktop `TABS.map` block (around line 1575). The "Explore Money Galaxy" tab has `tb.id === 'money'`. Add `data-tour` to that button:
```jsx
{TABS.map(tb => {
  const on = tab===tb.id;
  return (
    <button
      key={tb.id}
      data-tour={tb.id === 'money' ? 'tab-money' : undefined}
      onClick={() => { setTab(tb.id); track("tab_view", { tab: tb.id }); }}
      style={{ ... }}
    >
      {tb.label}
      ...
    </button>
  );
})}
```

- [ ] **Step 4: Create `src/features/tutorial/GuidedTour.jsx`**

```jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../theme/index.js';
import { useTutorial } from './TutorialProvider.jsx';
import { useMobile } from '../../hooks/useMediaQuery.js';
import { STEPS } from './steps.js';
import { getSpotlightStyles } from './lib/spotlight.js';

const ORANGE = '#FF8000';
const MF = "'Roboto', sans-serif";

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
    const t = setTimeout(reposition, 80);
    roRef.current = new ResizeObserver(reposition);
    roRef.current.observe(document.body);
    window.addEventListener('resize', reposition);
    return () => {
      clearTimeout(t);
      roRef.current?.disconnect();
      window.removeEventListener('resize', reposition);
    };
  }, [isRunning, reposition]);

  // Step 4: auto-advance when user clicks the money tab
  useEffect(() => {
    if (!isRunning || !step?.waitForUserAction) return;
    if (tab === 'money') advance();
  }, [tab, isRunning, step?.waitForUserAction]);

  // Step 4: 30s timeout shows "skip step" link
  useEffect(() => {
    setShowSkipStep(false);
    clearTimeout(skipTimerRef.current);
    if (isRunning && step?.waitForUserAction) {
      skipTimerRef.current = setTimeout(() => setShowSkipStep(true), 30000);
    }
    return () => clearTimeout(skipTimerRef.current);
  }, [isRunning, currentStep]);

  // Auto-switch to correct tab for non-user-action steps
  useEffect(() => {
    if (!isRunning || !step || step.waitForUserAction) return;
    if (step.requiresTab && tab !== step.requiresTab) {
      setTab(step.requiresTab);
    }
  }, [isRunning, currentStep]);

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
```

- [ ] **Step 5: Render `<GuidedTour>` in `src/App.jsx`**

Add import:
```jsx
import GuidedTour from "./features/tutorial/GuidedTour.jsx";
```

In the `return` block, directly after `<WelcomeModal />`, add:
```jsx
      {/* Tutorial layer 2 — guided overlay tour */}
      <GuidedTour tab={tab} setTab={setTab} />
```

- [ ] **Step 6: Manual verify**

Run `npm run dev:all`. Clear the flag and reload:
```js
localStorage.removeItem('unr_tour_seen'); location.reload();
```
Click "Take the tour →". Step 1 should appear with a spotlight around the ticker, and the callout centered (because placement is `center`). Click "Next →" to step 2 — spotlight should jump to the live map. Step 3 — spotlight on the feed panels. After step 3, clicking "Next →" should show step 4 with the Money Galaxy tab highlighted and "Click the highlighted tab to continue." (no Back/Next buttons). Clicking the tab advances the tour. Clicking Esc during any step dismisses the tour silently.

- [ ] **Step 7: Commit**

```bash
git add src/features/tutorial/GuidedTour.jsx src/App.jsx src/components/layout/Ticker.jsx src/pages/CampaignWatch.jsx
git commit -m "feat(tutorial): guided tour shell with steps 1-4 and spotlight anchors"
```

---

## Task 6: Steps 5–8 (Money Galaxy sub-tabs) + sub-tab auto-switching

**Files:**
- Modify: `src/pages/FollowTheMoney.jsx` — add `data-tour` on PageSidebar items; subscribe to tour context for auto-switching

- [ ] **Step 1: Add `data-tour` attributes to the PageSidebar items in `src/pages/FollowTheMoney.jsx`**

Open the file. The `SUBTABS` array is at the top. The `PageSidebar` component renders these items. The sub-tab ids are `intel`, `flow`, `darkmoney`, `corpacs`.

Add `data-tour` props that get passed through to each sidebar button. First check how `PageSidebar` is defined. If it's a local component in `FollowTheMoney.jsx`, find where it renders each tab button and add `data-tour`:

Find the `PageSidebar` component or the loop that renders sub-tab buttons. Each button rendering `tb.id === 'intel'` should get `data-tour="subtab-intel"`, etc.

If `PageSidebar` accepts a prop or renders a button per tab, the change looks like:
```jsx
// Inside PageSidebar's render (wherever each sub-tab button is rendered):
<button
  key={tb.id}
  data-tour={`subtab-${tb.id}`}
  onClick={() => onChange(tb.id)}
  ...
>
  {tb.label}
</button>
```

- [ ] **Step 2: Add auto-sub-tab switching to `src/pages/FollowTheMoney.jsx`**

At the top of the file, add imports:
```jsx
import { useEffect } from 'react'; // already imported
import { useTutorial } from '../features/tutorial/TutorialProvider.jsx';
import { STEPS } from '../features/tutorial/steps.js';
```

Inside the `FollowTheMoney` component function, after the existing `const [sub, setSub] = useState("intel");` line, add:

```jsx
  const { phase, currentStep } = useTutorial();

  // Auto-switch sub-tab when the tour reaches a Galaxy step
  useEffect(() => {
    if (phase !== 'tour-running') return;
    const stepId = STEPS[currentStep]?.id;
    const subMap = {
      'donor-intel': 'intel',
      'money-flow': 'flow',
      'dark-money': 'darkmoney',
      'corp-pacs': 'corpacs',
    };
    const target = subMap[stepId];
    if (target) setSub(target);
  }, [phase, currentStep]);
```

- [ ] **Step 3: Manual verify**

Clear flag, reload, take the tour. After step 4 (clicking the Money Galaxy tab), steps 5–8 should each auto-switch the sub-tab and spotlight the correct sidebar item. Confirm the callout appears to the right of each highlighted sidebar item. "Next →" advances through Donor Intelligence → Money Flow → Dark Money → Corporate PACs.

- [ ] **Step 4: Commit**

```bash
git add src/pages/FollowTheMoney.jsx
git commit -m "feat(tutorial): add sub-tab tour steps 5-8 with auto-switching"
```

---

## Task 7: Step 9 (AI Analyst) + tour completion + `data-tour="ai-button"`

**Files:**
- Modify: `src/App.jsx` — add `data-tour="ai-button"` to the ANALYST button

- [ ] **Step 1: Add `data-tour="ai-button"` to the AI Analyst button in `src/App.jsx`**

Find the desktop ANALYST button (around line 1617):
```jsx
              <button onClick={() => { const next=!analyst; setAnalyst(next); track("analyst_panel_toggle",{open:next}); }} style={{
```
Add `data-tour="ai-button"` to it:
```jsx
              <button data-tour="ai-button" onClick={() => { const next=!analyst; setAnalyst(next); track("analyst_panel_toggle",{open:next}); }} style={{
```

- [ ] **Step 2: Manual verify end-to-end happy path**

Clear flag, reload, take the tour:
1. Steps 1–3 on Monitor tab ✓
2. Step 4 — click Money Galaxy tab ✓
3. Steps 5–8 auto-switch sub-tabs ✓
4. Step 9 — spotlight appears on the ANALYST button, callout says "The AI Analyst", button reads "Done ✓"
5. Click "Done ✓" — overlay disappears, `unr_tour_seen=v1` is written
6. Reload — welcome modal does not reappear

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat(tutorial): wire step 9 (AI Analyst) and tour completion"
```

---

## Task 8: Wire "Take a tour" in SettingsMenu

**Files:**
- Modify: `src/App.jsx` — pass `onTakeTour` to both `<SettingsMenu>` instances

- [ ] **Step 1: Import `useTutorial` in `src/App.jsx`**

Add import at the top:
```jsx
import { useTutorial } from "./features/tutorial/TutorialProvider.jsx";
```

- [ ] **Step 2: Destructure `startTour` from the context inside the App component**

Inside the `App` function body (after the existing `const { isAuthenticated, user, profile, signOut } = useAuth();` line), add:
```jsx
  const { startTour } = useTutorial();
```

- [ ] **Step 3: Pass `startTour` to both `<SettingsMenu>` instances**

Replace `onTakeTour={null}` in both `<SettingsMenu>` calls (desktop and mobile) with:
```jsx
onTakeTour={startTour}
```

- [ ] **Step 4: Manual verify replay**

Complete the tour so the flag is set. Then open the Settings dropdown and click "Take a tour". The guided overlay should relaunch from step 1. The welcome modal should NOT reappear. Completing the tour again is fine — flag stays set.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat(tutorial): wire Settings dropdown Take a tour replay"
```

---

## Task 9: CoachMark component + `i` icons on 6 anchor panels

**Files:**
- Create: `src/features/tutorial/coachMarks.js`
- Create: `src/features/tutorial/CoachMark.jsx`
- Modify: `src/pages/FollowTheMoney.jsx` — `<CoachMark>` next to sub-tab labels
- Modify: `src/App.jsx` — `<CoachMark>` next to AI button and Sign In button

- [ ] **Step 1: Create `src/features/tutorial/coachMarks.js`**

```js
export const COACH_MARKS = {
  'donor-intel-explainer': {
    title: 'Donor Intelligence',
    body: 'Search any donor by name to see their full contribution history, employer, PAC affiliations, and sector breakdown.',
  },
  'money-flow-explainer': {
    title: 'Money Flow',
    body: 'Sankey diagram tracing donations from employer → PAC → candidate. Select a cycle above to compare election years.',
  },
  'dark-money-explainer': {
    title: 'Dark Money',
    body: '501(c)(4) "social welfare" organisations can spend unlimited amounts on elections without disclosing their donors.',
  },
  'corp-pacs-explainer': {
    title: 'Corporate PACs',
    body: 'Force-directed graph of corporate parents, their PACs, and the politicians they fund. Drag nodes to explore.',
  },
  'ai-analyst-explainer': {
    title: 'AI Analyst',
    body: 'Four specialist agents analyse Policy, Spending, Donations, and Corruption. Ask anything — the orchestrator routes to the right agent and synthesizes findings.',
  },
  'sign-in-explainer': {
    title: 'Sign In',
    body: 'Sign in to unlock saved searches, watchlists, and personalised alerts when tracked politicians receive new donations.',
  },
};
```

- [ ] **Step 2: Create `src/features/tutorial/CoachMark.jsx`**

```jsx
import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../theme/index.js';
import { COACH_MARKS } from './coachMarks.js';

const ORANGE = '#FF8000';
const MF = "'Roboto', sans-serif";

export default function CoachMark({ id }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const entry = COACH_MARKS[id];

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!entry) return null;

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-block', marginLeft: 5, verticalAlign: 'middle' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        aria-label={`What is ${entry.title}?`}
        style={{
          width: 15, height: 15,
          borderRadius: '50%',
          border: `1px solid ${ORANGE}`,
          background: 'transparent',
          color: ORANGE,
          fontSize: 9,
          fontStyle: 'italic',
          fontFamily: 'Georgia, serif',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
          padding: 0,
        }}
      >
        i
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: '50%',
          transform: 'translateX(-50%)',
          marginTop: 6, zIndex: 400,
          background: t.card,
          border: `1px solid ${ORANGE}`,
          padding: '10px 14px',
          minWidth: 220, maxWidth: 300,
          boxShadow: `0 4px 16px rgba(255,128,0,.2)`,
          pointerEvents: 'auto',
        }}>
          <div style={{ color: ORANGE, fontSize: 9, letterSpacing: 1, marginBottom: 4, fontFamily: MF }}>
            {entry.title.toUpperCase()}
          </div>
          <div style={{ color: t.mid, fontSize: 12, lineHeight: 1.55, fontFamily: MF }}>
            {entry.body}
          </div>
        </div>
      )}
    </span>
  );
}
```

- [ ] **Step 3: Add `<CoachMark>` to the four sub-tab labels in `src/pages/FollowTheMoney.jsx`**

Add import at the top:
```jsx
import CoachMark from '../features/tutorial/CoachMark.jsx';
```

Find where the sub-tab labels are rendered (inside `PageSidebar` or in the sidebar buttons). Add `<CoachMark>` after each label:

```jsx
// Donor Intelligence tab button label:
Donor Intelligence <CoachMark id="donor-intel-explainer" />

// Money Flow tab button label:
Money Flow <CoachMark id="money-flow-explainer" />

// Dark Money tab button label:
Dark Money <CoachMark id="dark-money-explainer" />

// Corporate PACs tab button label:
Corporate PACs <CoachMark id="corp-pacs-explainer" />
```

The exact edit depends on how `PageSidebar` renders labels. If labels are plain strings inside `{tb.label}`, change them to render from the `SUBTABS` array with inline JSX for the ones needing coach marks. Example update to `SUBTABS`:

```jsx
const SUBTABS = [
  { id: "intel",     label: "Donor Intelligence", coachMarkId: "donor-intel-explainer" },
  { id: "flow",      label: "Money Flow",          coachMarkId: "money-flow-explainer", badge: "NEW" },
  { id: "darkmoney", label: "Dark Money",           coachMarkId: "dark-money-explainer" },
  { id: "corpacs",   label: "Corporate PACs",       coachMarkId: "corp-pacs-explainer",  badge: "NEW" },
];
```

Then in `PageSidebar`, render:
```jsx
{tb.label}{tb.coachMarkId && <CoachMark id={tb.coachMarkId} />}
```

- [ ] **Step 4: Add `<CoachMark>` to the AI button and Sign In button in `src/App.jsx`**

Add import at the top:
```jsx
import CoachMark from "./features/tutorial/CoachMark.jsx";
```

Near the AI Analyst button (line ~1617), wrap the button's container or append next to the label:
```jsx
<span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
  <span style={{ fontSize:12 }}>◈</span>
  ANALYST {analyst ? "▾" : "▸"}
  <CoachMark id="ai-analyst-explainer" />
</span>
```

Near the Sign In button (line ~1611), add after `SIGN IN`:
```jsx
<span style={{ letterSpacing:1 }}>SIGN IN</span>
<CoachMark id="sign-in-explainer" />
```

- [ ] **Step 5: Manual verify**

Load the app (any visit — not just first). Confirm small `i` circles appear next to the four sub-tab labels in the Money Galaxy sidebar and next to the AI Analyst and Sign In buttons. Click each one — popover appears with title + body. Click another coach mark while one is open — both can be open simultaneously. Click anywhere outside — popover closes.

- [ ] **Step 6: Commit**

```bash
git add src/features/tutorial/coachMarks.js src/features/tutorial/CoachMark.jsx src/pages/FollowTheMoney.jsx src/App.jsx
git commit -m "feat(tutorial): add CoachMark component and i coach marks on 6 panels (layer 3)"
```

---

## Task 10: Mobile path — suppress overlay, verify modal + marks

**Files:**
- Verify only — no new code needed. `useMobile()` check is already in `GuidedTour` (`isRunning = phase === 'tour-running' && !isMobile`) and `WelcomeModal` already hides the "Take the tour →" button on mobile.

- [ ] **Step 1: Manual verify — mobile welcome modal**

In DevTools, set viewport to 375px (iPhone). Clear flag:
```js
localStorage.removeItem('unr_tour_seen'); location.reload();
```
Confirm: welcome modal appears with only "Got it" (no "Take the tour →" button). Click "Got it" — modal dismisses, flag is set. Reload — modal does not reappear.

- [ ] **Step 2: Manual verify — no overlay on mobile**

On mobile viewport, open the Settings dropdown (hamburger → drawer). Confirm "Take a tour" row is present. Tap it. Confirm: NO guided overlay appears. `console.log` check — `useMobile()` should return `true` and `GuidedTour` returns null.

- [ ] **Step 3: Manual verify — coach marks on mobile**

Navigate to the Explore Money Galaxy tab on mobile. Confirm the `i` icons appear in the sidebar next to sub-tab labels. Tap one — popover appears. Tap outside — dismisses.

- [ ] **Step 4: Full smoke checklist**

Run through the 7-step smoke checklist from the spec (`docs/superpowers/specs/2026-05-12-newcomer-tutorial-design.md`, Manual smoke checklist section) one item at a time, on both desktop and mobile viewports. Check them off as you go.

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat(tutorial): verify mobile path — complete newcomer tutorial feature"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Welcome modal, first visit, everyone | Task 3 |
| 9-step guided overlay, desktop only | Tasks 4, 5, 6, 7 |
| Persistent `i` coach marks, everyone | Task 9 |
| Mobile: modal + marks, no overlay | Task 10 |
| localStorage `unr_tour_seen=v1` | Task 2 (`useFirstVisit`) |
| Flag written on complete OR skip, not start | Task 2 (`TutorialProvider`) |
| localStorage unavailable → modal every session | Task 2 (`useFirstVisit` try/catch) |
| Step 4: user clicks tab to advance | Task 5 (GuidedTour effect) |
| Steps 5–8: auto-switch sub-tab | Task 6 (FollowTheMoney effect) |
| 30s skip-step link on step 4 | Task 5 (GuidedTour skipTimerRef) |
| Esc / outside-click exits silently | Task 5 |
| Replay from Settings | Tasks 1 + 8 |
| SettingsMenu: Configure + Take a tour | Tasks 1, 8 |
| Mobile drawer: two inline rows | Task 1 |
| Missing `data-tour` target → centered fallback | Task 4 (`spotlight.js` null guard) |
| ResizeObserver repositions on resize | Task 5 (GuidedTour effect) |
| Auth-gating future-proof (`authGated` field) | Task 2 (`steps.js` field present, unused in v1) |

All spec requirements covered.

**Type consistency check:**
- `useTutorial()` returns `{ phase, currentStep, startTour, dismissWelcome, skipTour, advance, back }` — used consistently across `WelcomeModal`, `GuidedTour`, `FollowTheMoney`, `App`.
- `STEPS[n]` shape: `{ id, targetSelector, placement, requiresTab, waitForUserAction, authGated, title, body }` — all fields used in `GuidedTour` and `FollowTheMoney`.
- `getSpotlightStyles(selector, placement, vpW, vpH)` returns `{ found, clipPath, callout }` — used correctly in `GuidedTour`.
- `COACH_MARKS[id]` returns `{ title, body }` — used correctly in `CoachMark`.
