# Product

## Register

product

## Users

Three audiences, equal weight:

- **Civic-minded general public** — occasional visitors who want to understand where political money comes from. They need punchy entry points, clear summaries, and findings they can share. They will not dig through raw data.
- **Journalists & researchers** — investigative reporters and political analysts doing deep dives. They want drill-downs, raw numbers, and data they can export and cite. They tolerate density; they expect accuracy.
- **Politically engaged activists** — people who are angry about dark money and want ammunition. They want shareable revelations, not just charts. The emotional register matters as much as the data.

Design must work for all three without compromising any. Lead with clarity, reward depth.

## Product Purpose

UNREDACTED is an open-source intelligence platform that monitors and exposes the nexus between government spending, campaign finance, and policy decisions. It gives Americans the tools to trace who funds whom, follow money from donor to policy outcome, and surface dark money flows that would otherwise stay hidden.

Success looks like: a journalist finds a story, an activist gets a shareable finding, a curious voter understands something they couldn't before — all from the same interface, the same session.

## Brand Personality

**Bold · Confrontational · Revealing**

UNREDACTED is a verb. It exposes, it names names, it pulls the curtain back. The voice is confident and direct — never sensational, never conspiratorial, but never bureaucratic. It speaks to the people, challenges power, and earns trust through precision. Emotional heat is fine; it must always be backed by exact data.

Tagline: *"The War on Greed starts here."*

## Anti-references

- **Corporate government sites** (USA.gov, Congress.gov, FEC.gov) — the bureaucratic, institutional aesthetic of the systems UNREDACTED exists to expose. Never look like the thing you're watching.
- **Conspiracy / chan aesthetics** — red string, walls of text, tinfoil — undermines credibility even when the data is real. UNREDACTED is an intelligence tool, not a forum.

## Design Principles

1. **Data as confrontation.** Every number is a revelation, not just information. Charts and tables should feel like evidence presented in court, not metrics in a SaaS dashboard.
2. **Credibility through precision.** The emotional weight of "War on Greed" is earned by exact data, sourced tables, and named figures. Never sacrifice accuracy for drama.
3. **Depth earned, not imposed.** Entry points are clean enough for a first-time visitor. Drill-downs, filters, and raw data exist for researchers — but they don't obstruct the public.
4. **Dark by default; orange as a signal flare.** The dark surface communicates seriousness and sustained reading. Orange (#FF8000) marks the exposed truth — use it sparingly so it retains impact. Deep blue (#0028AA) carries the institutional weight.
5. **No institutional camouflage.** The aesthetic must never resemble the government sites and corporate portals it monitors. Bold typography, sharp layout, and high-contrast data panels set UNREDACTED apart from what it exposes.

## Aesthetic Direction

Panel interiors follow the Vodafone editorial layout system — disciplined spacing, typographic hierarchy, and flat surfaces with no decorative shadows or gradients. The Vodafone red is replaced by two brand colors:
- **Orange** (`#FF8000`) — primary accent, CTAs, exposed-truth highlights
- **Deep Blue** (`#0028AA`) — institutional weight, secondary panels, data surfaces

Reference aesthetic: Bloomberg Terminal density meets The Intercept's editorial credibility. Dark default surfaces, sharp edges, data-first layout, and no softness that would undercut the confrontational brand.

## Accessibility & Inclusion

Target WCAG AA compliance. All text/background combinations must meet 4.5:1 contrast ratio. Orange (#FF8000) on dark surfaces must be verified at each usage size — it can fail AA at small weights. Deep blue (#0028AA) must never be used for body text on dark backgrounds without contrast verification. Support `prefers-reduced-motion` for all chart animations and panel transitions.
