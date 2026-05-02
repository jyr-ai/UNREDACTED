# Galaxy Feature — Manual Test Checklist

Run through this before flipping `VITE_GALAXY_ENABLED=true` in production.

## Setup
- [ ] Server running on 3001 with `GALAXY_ENABLED=true` and `GALAXY_AI_ENABLED=true`
- [ ] Frontend running on 3000 with `VITE_GALAXY_ENABLED=true`
- [ ] `funding_flow_patterns` table has ≥5 rows for cycle 2024
- [ ] `node scripts/verify-galaxy-api.js` reports 0 failures

## Donor Intelligence subtab
- [ ] Loads without console errors
- [ ] Galaxy renders ≥100 nodes
- [ ] Pattern flares pulse on at least one sector cluster
- [ ] Hovering a node dims unrelated nodes (opacity visibly drops)
- [ ] Clicking a node opens the drawer with entity name + Total $ KPI
- [ ] Clicking a pattern flare opens drawer with narrative + evidence edges
- [ ] Pressing ESC closes the drawer
- [ ] Clicking the backdrop outside the drawer closes it
- [ ] `<CandidatesBrowser />` still renders below the galaxy

## Money Flow subtab
- [ ] No employer selected + sector = "Finance": right panel shows Finance sector galaxy
- [ ] Sector = "All Sectors": right panel shows sector galaxy for `null` sector (graceful: either empty state or default cluster)
- [ ] Clicking an employer row switches right panel to the employer galaxy
- [ ] Employer galaxy shows employer node + committee nodes + politician leaf nodes
- [ ] Clicking same row again deselects → right panel reverts to sector galaxy

## Light/Dark toggle
- [ ] ◐/☀ icon in top-right of galaxy panel
- [ ] Click → galaxy surface flips from #1D1D1D to #FAFAFA (or back)
- [ ] Node strokes + politician fills re-theme
- [ ] Reload page → preference persists (localStorage: `unredacted:galaxy-surface`)
- [ ] Open DevTools > Application > Local Storage to verify key

## Interactions
- [ ] Mouse wheel zooms toward cursor
- [ ] Drag empty space pans the view
- [ ] Touch: two-finger pinch zoom works (mobile or DevTools touch emulation)
- [ ] Reduced-motion OS setting: galaxy renders without animated force ticks (static layout)

## Feature flag OFF
- [ ] Flip `VITE_GALAXY_ENABLED=false`, restart Vite, reload
- [ ] Donor Intelligence: original bar chart + politician profiles + old MoneyFlowSankey render
- [ ] Money Flow: original Sankey behavior restored
- [ ] No console errors

## API verifier
- [ ] `node scripts/verify-galaxy-api.js` → 0 failures
- [ ] Cron endpoint auth: `curl -X POST http://127.0.0.1:3001/api/cron/detect-funding-patterns` → 401 when `CRON_AUTH_SECRET` set without header

## Pattern detection cron (manual trigger)
- [ ] `node etl/patterns/detectFundingPatterns.js --cycle 2024` completes in <60s
- [ ] Log file written to `etl/patterns/logs/YYYY-MM-DD.json`
- [ ] At least one pattern inserted (or `reason: insufficient_data` with explanation)
- [ ] Manually inspect 3 patterns — every cited node_id exists in edges
