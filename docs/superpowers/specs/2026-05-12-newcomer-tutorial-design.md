# Newcomer Tutorial Design

**Date:** 2026-05-12
**Branch:** feature-research
**Status:** Approved — ready for implementation planning

---

## Overview

A hybrid three-layer onboarding system that walks new users through the Unredacted app without blocking power users. The three layers work together and can be used independently.

| Layer | What it is | Who sees it |
|---|---|---|
| 1. Welcome modal | First-visit orientation modal | Everyone (desktop + mobile) |
| 2. Guided overlay tour | 9-step spotlight walkthrough | Desktop + tablet only |
| 3. Persistent `i` coach marks | Always-on inline explainers | Everyone (desktop + mobile) |

---

## Shape: Hybrid (D)

**First visit (desktop):**
1. Welcome modal appears with copy: *"Unredacted tracks money relationships amongst US politics, corporations, and power. Take a 60-second tour, or skip in."*
2. "Take the tour" → guided overlay launches.
3. "Skip" → modal dismissed, user lands on the live app.

**First visit (mobile):**
1. Welcome modal appears (same copy).
2. No guided overlay tour — overlay mechanics are incompatible with the slide-out drawer nav.
3. `i` coach marks are present on all panels.

**Returning visits:** Nothing shown. Tour replayable from the Settings dropdown ("Take a tour").

---

## Persistence

| Key | Value | Written when |
|---|---|---|
| `unr_tour_seen` | `v1` | Tour completes **or** is skipped (not on start) |

- localStorage only. No backend changes for v1.
- If localStorage is unavailable (private mode, restricted webview): welcome modal shows every session. Acceptable degradation — we never silently suppress onboarding.
- **Version bumping:** bump the key to `v2`, `v3` etc. on major tour content changes (e.g., when Dark Money / Money Flow become auth-gated and step copy changes substantially). A version bump re-triggers the welcome modal for all users.
- **Replay:** "Take a tour" in the Settings dropdown calls `startTour()` — launches the overlay directly, does not reset the flag or reshow the welcome modal.

---

## Architecture

### New feature folder

```
src/features/tutorial/
  TutorialProvider.jsx      ← context, state machine, localStorage gate
  WelcomeModal.jsx          ← layer 1
  GuidedTour.jsx            ← layer 2 (desktop/tablet only)
  CoachMark.jsx             ← layer 3, reusable "i" icon + popover
  steps.js                  ← 9 tour-step definitions
  coachMarks.js             ← keyed coach-mark copy (id → { title, body })
  hooks/
    useTutorial.js          ← consumer hook
    useFirstVisit.js        ← localStorage read/write with try/catch
  lib/
    spotlight.js            ← clip-path + callout position from getBoundingClientRect
```

No external tour library (Shepherd, Driver.js, Joyride). Hand-rolled spotlight (~80 lines) matches existing theme tokens exactly.

**Note:** `src/components/MobileVisitorModal.jsx` already exists in the codebase but serves a different purpose (mobile-only first-visit prompt, unrelated to onboarding flow). `WelcomeModal.jsx` is a new, separate component shown to all users on first visit.

### State machine (TutorialProvider)

Four states:

```
boot → welcome → tour-running → done
              ↘ (mobile / skip / dismiss)
               done
```

- `boot`: reads localStorage. Flag present → `done` (nothing shown). No flag → `welcome`.
- `welcome`: modal visible. "Take the tour" (desktop only) → `tour-running`. "Skip" or mobile dismiss → `done`, flag written.
- `tour-running`: overlay active, `currentStep` 0–8.
- `done`: flag written, nothing shown.
- **Replay path:** `done` → `tour-running` directly via `startTour()`. Flag is not cleared.

### Public API via `useTutorial()`

```js
const { phase, currentStep, startTour, skipTour, advance, back, dismissWelcome } = useTutorial();
```

### Step shape (`steps.js`)

```js
{
  id: 'monitor-map',
  targetSelector: '[data-tour="monitor-map"]',
  title: 'The live map',
  body: 'Click any state to see its delegation, news, and contracts.',
  placement: 'right',           // 'top' | 'right' | 'bottom' | 'left' | 'center'
  requiresTab: 'monitor',       // ensures this tab is active before showing
  waitForUserAction: false,     // step 4 sets true — user must click tab to advance
  authGated: false,             // Dark Money + Money Flow flip true in a future release
}
```

### Target anchors — `data-tour` attributes

| Step | Attribute | File |
|---|---|---|
| 1 | `data-tour="ticker"` | `src/components/layout/Ticker.jsx` |
| 2 | `data-tour="monitor-map"` | `src/pages/CampaignWatch.jsx` |
| 3 | `data-tour="monitor-feeds"` | `src/pages/CampaignWatch.jsx` |
| 4 | `data-tour="tab-money"` | `src/App.jsx` (desktop nav tab button) |
| 5 | `data-tour="subtab-flow"` | `src/pages/FollowTheMoney.jsx` |
| 6 | `data-tour="subtab-intel"` | `src/pages/FollowTheMoney.jsx` |
| 7 | `data-tour="subtab-darkmoney"` | `src/pages/FollowTheMoney.jsx` |
| 8 | `data-tour="subtab-corpacs"` | `src/pages/FollowTheMoney.jsx` |
| 9 | `data-tour="ai-button"` | `src/App.jsx` |

No CSS classes, no threaded refs — `spotlight.js` uses `document.querySelector('[data-tour="..."]')`.

---

## Tour — 9 Steps

| # | Id | Title | Placement | Notes |
|---|---|---|---|---|
| 1 | `what-is-unredacted` | What is UN*REDACTED? | center | Oriented on the ticker / header |
| 2 | `monitor-map` | The live map | right | Click a state → delegation panel |
| 3 | `monitor-feeds` | Live news & feed | bottom | What's surfacing right now |
| 4 | `switch-to-galaxy` | Explore Money Galaxy | top | `waitForUserAction: true` — user clicks tab to advance |
| 5 | `donor-intel` | Donor Intelligence | right | Deep-dive donor profiles |
| 6 | `money-flow` | Money Flow | right | Sankey: donor → PAC → candidate |
| 7 | `dark-money` | Dark Money | right | 501(c)(4) and undisclosed flows |
| 8 | `corp-pacs` | Corporate PACs | right | FundingFlowGalaxy network graph |
| 9 | `ai-analyst` | The AI Analyst | left | Ask anything — agents route and synthesize. **END.** |

---

## Step 4 — Tab-change mechanics

Step 4 (`waitForUserAction: true`):
- Spotlight highlights `[data-tour="tab-money"]`.
- "Next" button is hidden; callout reads: *"Click the highlighted tab to continue."*
- Provider listens for `tab === 'money'` state change and auto-advances.
- After 30 s of no action, a "skip step →" link appears in the callout. Prevents trapping the user.
- If user clicks any other tab: spotlight stays, callout stays on step 4.

Steps 5–8 (sub-tab switching):
- Provider calls the sub-tab setter directly, waits one frame, then positions spotlight.
- These are not user-driven (user is already on the Galaxy tab).

---

## Escape / exit behavior

- **Esc**, **click outside spotlight**, or the **×** button: tour ends silently, `unr_tour_seen=v1` written.
- No confirmation dialog.
- Reload mid-tour: flag is NOT set (set only on complete/skip), so next visit offers the tour again.
- Browser back/forward during tour: tour ends silently, flag set.

---

## Auth-gating (future-proof)

`authGated: false` on all steps in v1. When Dark Money and Money Flow become auth-gated:

1. Set `authGated: true` on steps 6 and 7 (Money Flow and Dark Money).
2. If step reached and `!isAuthenticated`: swap callout body to *"Sign in to explore [feature name] — click below or continue the tour."* Two buttons: Sign In (opens existing `<Auth/>` modal alongside) and Next.
3. Either action advances the tour. **Tour never blocks on auth.**
4. Bump localStorage key to `v2` so existing users see the updated tour once.

---

## Settings Dropdown — `SettingsMenu`

**Desktop / tablet:** `⚙ Settings ▾` button in the top nav opens a two-item dropdown:

| Item | Icon | Action |
|---|---|---|
| Take a tour | `i` | `startTour()` — relaunches guided overlay. Welcome modal stays dismissed. |
| Configure | `⚙` | Switches to `tab = "settings"` — the existing Settings page. |

Click outside / Esc closes the dropdown.

**Mobile drawer:** The current single "⚙ Settings" row is replaced with two inline rows (no nested menu):
- `i` Take a tour
- `⚙` Configure

**New file:** `src/components/layout/SettingsMenu.jsx` (~60 lines, uses `useMobile()` and `useTheme()`).

---

## Coach Marks (`i` info glyph)

### Component

```jsx
<CardTitle>
  Money Flow <CoachMark id="money-flow-explainer" />
</CardTitle>
```

- Looks up `coachMarks[id]` in `coachMarks.js` and renders a small `i` glyph.
- Click → popover with title + body, styled with `t.card`, `t.border`, `t.accent`.
- Multiple popovers can be open simultaneously; each closes independently on outside click.
- If `id` has no entry in `coachMarks.js`: renders nothing (no icon). Caught during manual testing.

### Initial set (v1, ~6 anchors)

| Anchor | Location |
|---|---|
| Money Flow sub-tab | `FollowTheMoney.jsx` |
| Donor Intelligence sub-tab | `FollowTheMoney.jsx` |
| Dark Money sub-tab | `FollowTheMoney.jsx` |
| Corporate PACs sub-tab | `FollowTheMoney.jsx` |
| `◈` AI Analyst button | `App.jsx` nav |
| Sign In button | `App.jsx` nav |

Additional marks (gradient legend, contracts overlay, state delegation panel, theme toggle, cycle selector) can be added incrementally without touching the tutorial system.

---

## Files touched (outside `src/features/tutorial/`)

| File | Change |
|---|---|
| `src/main.jsx` | Wrap `<App/>` in `<TutorialProvider>` |
| `src/App.jsx` | Add `data-tour` on tab buttons + AI button; render `<WelcomeModal/>` + `<GuidedTour/>` portals; replace `⚙` nav button with `<SettingsMenu/>` |
| `src/components/layout/Ticker.jsx` | Add `data-tour="ticker"` |
| `src/pages/CampaignWatch.jsx` | Add `data-tour="monitor-map"` + `data-tour="monitor-feeds"` |
| `src/pages/FollowTheMoney.jsx` | Add `data-tour` on PageSidebar items; add `<CoachMark>` next to sub-tab titles |
| `src/components/layout/SettingsMenu.jsx` | **New file** |

---

## Mobile

Detected via the existing `useMobile()` hook from `src/hooks/useMediaQuery.js`.

| Feature | Desktop/Tablet | Mobile |
|---|---|---|
| Welcome modal | ✓ | ✓ |
| Guided overlay tour | ✓ | ✗ (suppressed in `TutorialProvider`) |
| `i` coach marks | ✓ | ✓ |
| Settings dropdown | dropdown | inline rows in drawer |

---

## Edge cases

| Situation | Behavior |
|---|---|
| `data-tour` target missing from DOM | Callout renders centered, no spotlight ring. Tour continues. `console.warn` in dev. |
| Target moves (resize, lazy load) | ResizeObserver + MutationObserver reposition on next animation frame, throttled to 60fps. |
| Cross mobile breakpoint during tour | Tour ends silently. Mobile experience resumes on next visit. |
| Page reload during tour | Tour gone (state in React only). Flag not yet set → tour offered again next visit. |
| localStorage unavailable | Welcome modal shows every session. Never suppressed. |

---

## Rollout sequence

| # | Piece | Deliverable |
|---|---|---|
| 1 | `SettingsMenu` dropdown (Configure only, no tour link yet) | Cleaner nav, ships standalone |
| 2 | `TutorialProvider` + `useFirstVisit` + welcome modal | Layer 1 live |
| 3 | `spotlight.js` + `GuidedTour` shell + steps 1–3 | Spotlight engine validated on Monitor tab |
| 4 | Tab-change step (4) + steps 5–8 | Galaxy sub-tab mechanics |
| 5 | Step 9 + completion + flag write | Happy path end-to-end shippable |
| 6 | "Take a tour" in `SettingsMenu` | Replay entry live |
| 7 | `CoachMark` component + initial 6 anchors | Layer 3 live |
| 8 | Mobile path (suppress overlay, verify modal + marks) | Full hybrid live |

---

## Acceptance criteria

1. Fresh browser → welcome modal on first visit only.
2. Tour walks all 9 stops; step 4 requires the user to click the tab themselves.
3. Esc / outside-click / completion set `unr_tour_seen=v1`.
4. Settings dropdown: "Take a tour" replays overlay (modal stays dismissed); "Configure" opens Settings page.
5. `i` icons on ~6 anchor panels open independent inline explainers.
6. Mobile: welcome modal + `i` marks; no overlay tour.
7. localStorage unavailable: welcome modal shows each session, no crash.
8. Manual smoke checklist (7 steps) passes.

---

## Manual smoke checklist

1. Fresh incognito profile → `localhost:3000` → welcome modal appears.
2. "Take the tour" → steps 1–9 advance; step 4 requires a real tab click.
3. Esc on step 5 → tour ends; reload → no modal, no overlay.
4. Settings → "Take a tour" → overlay launches; welcome modal stays dismissed.
5. Resize window mid-tour → spotlight repositions; cross mobile breakpoint → tour ends.
6. Mobile viewport (DevTools) → welcome modal renders; no overlay tour; `i` marks work.
7. Network off on Galaxy tab → chunk load failure → centered callout fallback; tour doesn't hang.
