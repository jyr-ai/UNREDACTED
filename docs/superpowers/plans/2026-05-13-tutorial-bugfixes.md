# Tutorial Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two reported bugs: (1) nav bar becomes scrollable when CoachMark `i` or SettingsMenu dropdown opens, and (2) tour guide callout disappears after steps 1–2.

**Architecture:** Bug 1 is caused by `position: absolute` popover/dropdown elements inside a nav container that has overflow constraints — Chrome includes absolutely-positioned descendants in the container's scroll area. The fix is to render both popovers via `createPortal` directly on `document.body` using `position: fixed` with coordinates computed from `getBoundingClientRect()`. Bug 2 is caused by incorrect step placements: full-width elements (map, feeds) with `'bottom'` placement push the callout past the viewport bottom, and a nav-tab element with `'top'` placement pushes the callout above the viewport top. The fix is to change those three steps to `'center'` or `'bottom'` as appropriate.

**Tech Stack:** React 18, `createPortal`, `getBoundingClientRect`, existing `useTheme()` / `useMobile()` hooks, inline styles.

**Spec:** `docs/superpowers/specs/2026-05-12-newcomer-tutorial-design.md`

---

## File Map

| File | Change |
|---|---|
| `src/features/tutorial/CoachMark.jsx` | Replace `position: absolute` popover with `createPortal` + `position: fixed` |
| `src/components/layout/SettingsMenu.jsx` | Replace `position: absolute` dropdown with `createPortal` + `position: fixed` |
| `src/features/tutorial/steps.js` | Fix 3 step placements: monitor-map → `center`, monitor-feeds → `center`, switch-to-galaxy → `bottom` |

---

## Task 1: Fix CoachMark popover — createPortal + fixed position

**Files:**
- Modify: `src/features/tutorial/CoachMark.jsx`

**Root cause:** CoachMark renders its popover as `position: absolute` relative to a `position: relative` ancestor `<span>`. When that span sits inside the App nav container (which has `overflow: auto` / `overflow: hidden` in Chrome's layout model), the absolutely-positioned popover height contributes to the container's scroll area, making the nav bar scrollable.

**Fix:** Remove the outer `<span>` wrapper. Move the `i` button to a direct element with a `ref`. Render the popover via `createPortal` into `document.body` with `position: fixed` coordinates computed from `btnRef.current.getBoundingClientRect()`. Use a `data-coachmark-popover` attribute on the portal element for outside-click detection.

- [ ] **Step 1: Rewrite `src/features/tutorial/CoachMark.jsx`**

Replace the entire file with:

```jsx
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../theme/index.js';
import { COACH_MARKS } from './coachMarks.js';

const ORANGE = '#FF8000';
const MF = "'Roboto', sans-serif";

export default function CoachMark({ id }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const entry = COACH_MARKS[id];

  function computePos() {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
  }

  useEffect(() => {
    if (!open) return;
    computePos();
    const onDown = (e) => {
      if (e.target.closest('[data-coachmark-popover]')) return;
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', computePos);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', computePos);
    };
  }, [open]);

  if (!entry) return null;

  return (
    <>
      <button
        ref={btnRef}
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
          marginLeft: 5,
          verticalAlign: 'middle',
          flexShrink: 0,
        }}
      >
        i
      </button>

      {open && pos && createPortal(
        <div
          data-coachmark-popover=""
          style={{
            position: 'fixed',
            top: pos.top,
            right: pos.right,
            zIndex: 900,
            background: t.card,
            border: `1px solid ${ORANGE}`,
            padding: '10px 14px',
            minWidth: 220,
            maxWidth: 'min(300px, calc(100vw - 24px))',
            boxShadow: `0 4px 16px rgba(255,128,0,.2)`,
          }}
        >
          <div style={{ color: ORANGE, fontSize: 9, letterSpacing: 1, marginBottom: 4, fontFamily: MF }}>
            {entry.title.toUpperCase()}
          </div>
          <div style={{ color: t.mid, fontSize: 12, lineHeight: 1.55, fontFamily: MF }}>
            {entry.body}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
```

**What changed from the old version:**
- Removed the outer `<span ref={ref}>` wrapper — the component now renders a fragment `<>...</>`
- `ref` moves directly to the `<button>` element as `btnRef`
- The margin/vertical-align/flexShrink previously on the outer span are now on the button itself
- Popover renders via `createPortal(_, document.body)` with `position: fixed`
- Position computed via `getBoundingClientRect()` → stored in `pos` state
- Outside-click detection uses `data-coachmark-popover=""` attribute check instead of `ref.current.contains()`

- [ ] **Step 2: Check PageSidebar.jsx for the outer wrapper span**

The CoachMark used to be wrapped in:
```jsx
<span style={{ position: 'relative', display: 'inline-block', marginLeft: 5, verticalAlign: 'middle' }}>
  <CoachMark id={...} />
</span>
```
But since we moved to a fragment, that outer span in PageSidebar is now just an empty wrapper. Read `src/components/ui/PageSidebar.jsx` and confirm the CoachMark call sites do NOT have that extra outer span — the implementer in Task 9 already placed CoachMark directly without the outer relative span (it's in an absolutely positioned sibling span, not a relative wrapper). No change needed. Confirm visually by searching for `<CoachMark` in the file.

- [ ] **Step 3: Commit**

```bash
git add src/features/tutorial/CoachMark.jsx
git commit -m "fix(tutorial): CoachMark popover via createPortal — escape nav overflow"
```

---

## Task 2: Fix SettingsMenu dropdown — createPortal + fixed position

**Files:**
- Modify: `src/components/layout/SettingsMenu.jsx`

**Root cause:** Same as CoachMark — `position: absolute` dropdown inside the nav container with overflow constraints.

**Fix:** Replace the `<div ref={ref}>` relative wrapper with a fragment. Move `ref` to the trigger `<button>` as `btnRef`. Render the dropdown panel via `createPortal` with `position: fixed` coordinates.

- [ ] **Step 1: Rewrite `src/components/layout/SettingsMenu.jsx`**

Replace the entire file with:

```jsx
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../theme/index.js';
import { useMobile } from '../../hooks/useMediaQuery.js';

const ORANGE = '#FF8000';
const MF = "'Roboto', sans-serif";

export default function SettingsMenu({ onConfigure, onTakeTour }) {
  const t = useTheme();
  const isMobile = useMobile();
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState(null);
  const btnRef = useRef(null);

  function computePos() {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setDropPos({ top: rect.bottom + 2, right: window.innerWidth - rect.right });
  }

  useEffect(() => {
    if (!open) return;
    computePos();
    const onDown = (e) => {
      if (e.target.closest('[data-settings-dropdown]')) return;
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (isMobile) {
    return (
      <button onClick={() => { onConfigure(); }} style={mobileRowStyle(t)}>
        <span style={{ color: ORANGE }}>⚙</span>
        Configure
      </button>
    );
  }

  return (
    <>
      <button
        ref={btnRef}
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

      {open && dropPos && createPortal(
        <div
          data-settings-dropdown=""
          style={{
            position: 'fixed',
            top: dropPos.top,
            right: dropPos.right,
            background: t.navBg || t.bg,
            border: `1px solid ${ORANGE}`,
            minWidth: 210,
            zIndex: 900,
            boxShadow: `0 6px 20px rgba(255,128,0,.2)`,
          }}
        >
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
              <div style={{ color: t.mid, fontSize: 9, fontFamily: MF, marginTop: 1 }}>Theme & API keys</div>
            </div>
          </button>
        </div>,
        document.body
      )}
    </>
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

**What changed:**
- Removed outer `<div ref={ref} style={{ position: 'relative' }}>` wrapper — component renders a fragment `<>...</>` on desktop
- `ref` moves to the trigger `<button>` as `btnRef`
- Dropdown panel renders via `createPortal(_, document.body)` with `position: fixed`
- Position computed via `getBoundingClientRect()` → `dropPos` state
- Outside-click detection uses `data-settings-dropdown=""` attribute check

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/SettingsMenu.jsx
git commit -m "fix(tutorial): SettingsMenu dropdown via createPortal — escape nav overflow"
```

---

## Task 3: Fix tour step placements for off-screen callouts

**Files:**
- Modify: `src/features/tutorial/steps.js`

**Root cause:**
- Steps 2 & 3 (`monitor-map`, `monitor-feeds`): these targets are large/full-width elements occupying most of the viewport height. `placement: 'bottom'` computes `top: rect.bottom + 16` — if `rect.bottom` is near or past the viewport height, the callout renders off-screen below the fold. Users see the spotlight but no callout card.
- Step 4 (`switch-to-galaxy`): targets `[data-tour="tab-money"]`, a nav tab at approximately y=130px from top. `placement: 'top'` computes `top: rect.top - 16` with `transform: 'translateY(-100%)'` — the callout renders above y=0, behind the header, completely invisible.

**Fix:**
- Steps 2 & 3: change `placement` to `'center'` — callout floats in the center of the viewport, independent of element position. The spotlight still highlights the map/feeds.
- Step 4: change `placement` to `'bottom'` — callout renders below the nav tab in the content area, fully visible.

- [ ] **Step 1: Update three placements in `src/features/tutorial/steps.js`**

Change the `placement` field for three steps:

```js
// Step 2: monitor-map — was 'bottom', full-width map element
{
  id: 'monitor-map',
  targetSelector: '[data-tour="monitor-map"]',
  title: 'The live map',
  body: 'Click any state to see its congressional delegation, live news, and active federal contracts.',
  placement: 'center',   // ← changed from 'bottom'
  requiresTab: 'monitor',
  waitForUserAction: false,
  authGated: false,
},

// Step 3: monitor-feeds — was 'bottom', full-width feeds section
{
  id: 'monitor-feeds',
  targetSelector: '[data-tour="monitor-feeds"]',
  title: 'Live news & feed',
  body: 'Stories and filings surfacing in real time. The feed updates as new FEC data and news hits.',
  placement: 'center',   // ← changed from 'bottom'
  requiresTab: 'monitor',
  waitForUserAction: false,
  authGated: false,
},

// Step 4: switch-to-galaxy — was 'top', nav tab near top of viewport
{
  id: 'switch-to-galaxy',
  targetSelector: '[data-tour="tab-money"]',
  title: 'Explore Money Galaxy',
  body: 'Click this tab to follow the money — donations, PACs, dark money, and corporate networks.',
  placement: 'bottom',   // ← changed from 'top'
  requiresTab: 'monitor',
  waitForUserAction: true,
  authGated: false,
},
```

All other steps (1, 5–9) are unaffected.

- [ ] **Step 2: Commit**

```bash
git add src/features/tutorial/steps.js
git commit -m "fix(tutorial): fix step placements — center for full-width, bottom for nav tab"
```

---

## Verification

After all 3 tasks:

1. **Nav scroll bug:** Open the app. Click the `i` next to ANALYST — popover appears below the nav bar (floating over page content), nav bar does NOT scroll. Click `⚙ Settings ▾` — dropdown appears below the nav bar, nav bar does NOT scroll. Dismiss by clicking outside.

2. **Tour callout bug:** Clear flag and start tour:
   ```js
   localStorage.removeItem('unr_tour_seen'); location.reload();
   ```
   - Step 1: centered callout on the ticker ✓
   - Step 2: centered callout (spotlight on map) — callout visible in viewport center ✓
   - Step 3: centered callout (spotlight on feeds) — callout visible in viewport center ✓
   - Step 4: callout below the tab bar — "Click the highlighted tab to continue." ✓
   - Steps 5–8: callout to the right of each sidebar item ✓
   - Step 9: callout to the left of the ANALYST button ✓

---

## Self-Review

**Spec coverage:**
- Bug 1 (nav scroll) — covered by Tasks 1 & 2
- Bug 2 (tour stops) — covered by Task 3
- No other tutorial behavior changed; all other steps, state machine, mobile gating, coach marks remain as-is

**Placeholder scan:** None found. All code is complete.

**Type consistency:**
- `computePos()` → `pos: { top: number, right: number }` — used as `position: fixed, top: pos.top, right: pos.right` — consistent
- `computePos()` in SettingsMenu → `dropPos: { top: number, right: number }` — same pattern — consistent
- `placement: 'center'` — already handled in `spotlight.js` default case — consistent
- `placement: 'bottom'` — already handled in `spotlight.js` — consistent
