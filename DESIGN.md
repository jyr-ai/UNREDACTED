---
name: UNREDACTED
description: "The War on Greed starts here — open-source political intelligence."
colors:
  signal-orange: "#FF8000"
  deep-blue: "#0028AA"
  readable-blue: "#4A7FFF"
  navy-band: "#001A7A"
  warn-amber: "#FFB84D"
  surface-black: "#0D0D0D"
  surface-deep: "#111111"
  card-surface: "#161616"
  card-surface-raised: "#1D1D1D"
  border-steel: "#272727"
  text-primary: "#FFFFFF"
  text-secondary: "#888888"
  text-muted: "#888888"
  ink-black: "#080808"
  nav-black: "#0A0A0A"
typography:
  display:
    fontFamily: "'Roboto', sans-serif"
    fontSize: "clamp(1.75rem, 4vw, 3rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'Roboto', sans-serif"
    fontSize: "1.22rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "'Roboto', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Roboto', sans-serif"
    fontSize: "0.5625rem"
    fontWeight: 500
    letterSpacing: "0.125em"
  micro:
    fontFamily: "'Roboto', sans-serif"
    fontSize: "0.53125rem"
    fontWeight: 400
    letterSpacing: "0.0625em"
rounded:
  none: "0px"
  sm: "4px"
  md: "8px"
  circle: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  base: "16px"
  lg: "18px"
components:
  card:
    backgroundColor: "{colors.card-surface}"
    rounded: "{rounded.none}"
    padding: "18px 18px 14px"
  band:
    backgroundColor: "{colors.navy-band}"
    textColor: "{colors.text-primary}"
  button-primary:
    backgroundColor: "{colors.signal-orange}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "#E67200"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
  chip-accent:
    backgroundColor: "{colors.card-surface}"
    textColor: "{colors.signal-orange}"
    rounded: "{rounded.sm}"
    padding: "4px 10px"
  tooltip:
    backgroundColor: "{colors.ink-black}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.none}"
    padding: "8px 12px"
---

# Design System: UNREDACTED

## 1. Overview

**Creative North Star: "The War Room Terminal"**

UNREDACTED is an open-source intelligence platform that exposes the money flows shaping American politics. Its visual system is built on one conviction: the data is the confrontation. Every panel is a briefing. Every chart is an accusation. Every number is evidence. The interface never decorates — it presents.

The aesthetic sits at the intersection of Bloomberg Terminal density and The Intercept's editorial credibility. Dark surfaces dominate (four near-black tones from #0D0D0D to #1D1D1D), carrying the gravity of a place where serious people track serious money. Signal Orange (#FF8000) functions as a signal flare — used on ≤10% of any screen, it marks KPI values, live ticker text, and primary CTAs so its impact is preserved as the mark of exposure. Deep Blue (#0028AA) carries institutional weight in band headers and secondary data panels: a reference to the government and corporate structures under observation.

Inside panels, the layout follows Vodafone's editorial discipline — typographic hierarchy does the work, spacing is generous between sections and tight within cards, surfaces are flat with no decorative shadows or gradients. The result earns the "War on Greed" tagline not through visual heat but through precision. It looks like a tool built by people who know exactly what they're looking at.

**Key Characteristics:**
- Dark-first: four surface depths (#0D0D0D / #111111 / #161616 / #1D1D1D), all near-black
- Signal Orange used on ≤10% of any screen — KPI numbers, CTAs, live ticker, accent marks
- Deep Blue (#0028AA / #001A7A) for institutional band headers and secondary data panels
- Zero border radius on cards — sharp-cornered surfaces throughout
- Flat elevation: 1px solid borders carry hierarchy, no drop shadows
- Roboto exclusively across all scales; weight and size do all the work
- Band component opens every data section: full-width navy bar, 9px uppercase label, letter-spacing 2px

## 2. Colors: The Signal Palette

A restrained two-accent system — one signal (orange) and one institution (blue) — against a field of near-blacks. Every color has a mission; none are decorative.

### Primary

- **Signal Orange** (`#FF8000`): The brand's single loudest element. KPI metric values, primary CTAs, live ticker text, chart tooltip left-border accent, and data signal marks. Never applied to large background areas. Its rarity is the point.

### Secondary

- **Deep Authority Blue** (`#0028AA`): Institutional panels, secondary data surfaces, and chart elements on light surfaces. Communicates the weight of the financial and governmental structures under observation.
- **Readable Blue** (`#4A7FFF`): Lightened blue for readability on dark backgrounds. Used for "ok" states, scatter plot points, and chart series where #0028AA would fail contrast against near-black surfaces.

### Tertiary

- **Navy Band** (`#001A7A`): Band component backgrounds and panel section headers. Darker than Deep Authority Blue — the anchor color for data compartmentalization.
- **Warn Amber** (`#FFB84D`): Warning states and risk indicators only. Never applied decoratively.

### Neutral

- **Surface Black** (`#0D0D0D`): Base page canvas — the darkest recurring surface.
- **Surface Deep** (`#111111`): Page-level surface between cards.
- **Card Surface** (`#161616`): Default card and panel background.
- **Card Surface Raised** (`#1D1D1D`): Nested panel or secondary container — the lightest dark surface.
- **Border Steel** (`#272727`): All 1px structural borders.
- **Text Primary** (`#FFFFFF`): Headlines, KPI values, key data points.
- **Text Secondary** (`#888888`): Body copy, metadata, supporting labels.
- **Text Muted** (`#484848`): De-emphasized content and disabled states.
- **Ink Black** (`#080808`): Tooltip and deepest-surface backgrounds.
- **Nav Black** (`#0A0A0A`): Navigation bar and input field backgrounds.

**The One Signal Rule.** Orange appears on ≤10% of any given screen. A dashboard where everything is orange is a dashboard where nothing is urgent. Reserve it for the moments that demand attention.

**The Dark Discipline Rule.** Never pure black (#000) or pure white (#fff). The darkest surface is #0D0D0D; the lightest text is #FFFFFF. The four dark surface tones are a complete system — do not introduce new ones.

## 3. Typography

**Display / Body Font:** Roboto (with `sans-serif` fallback) — used exclusively throughout.

**Character:** A single-family system built on weight and size contrast. Roboto's neutrality is a deliberate choice — the data is the personality. Weight spread (400 → 700) and a scale from 8.5px to 48px+ carry all hierarchy without a second typeface introducing noise.

### Hierarchy

- **Display** (700, clamp(1.75rem → 3rem), line-height 1, −0.02em tracking): KPI metric values and hero numbers — Follow the Money totals, Corruption Watch scores, Dark Money figures. Always Text Primary or Signal Orange.
- **Headline** (600, ~1.22rem / 19.5px, line-height 1.35): Card titles and panel section headers. White on dark surface.
- **Body** (400, 0.875rem / 14px, line-height 1.5): Supporting text, metadata rows, data labels, and descriptive copy.
- **Label** (500, 0.5625rem / 9px, letter-spacing 0.125em, uppercase): Band component text, section headers inside navy bars, micro-category labels. Always uppercase with generous tracking.
- **Micro** (400, ~0.53rem / 8.5px, letter-spacing 0.0625em): Source footers, chart axis ticks, timestamp meta, legal lines.

**The Single-Family Rule.** Roboto everywhere, always. No display serif, no mono accent, no second family for "character." Weight and scale alone carry all hierarchy.

**The Uppercase-at-Label-Scale-Only Rule.** Uppercase with letter-spacing is reserved for Band labels (9px) and micro-labels. Headlines and body copy are sentence case. Uppercase above 14px reads as bureaucratic — the exact register UNREDACTED opposes.

## 4. Elevation

This system is flat by design. There are no decorative drop shadows. Depth is conveyed through four dark surface tones, 1px solid borders, and the Band component which compartmentalizes data sections with a navy header bar.

### Shadow Vocabulary

- **Signal Glow** (`box-shadow: 0 0 12px rgba(255,128,0,0.15)`): Used only on orange-accented interactive elements at hover and focus states — primary CTAs and KPI cards. A warm aura, not a structural lift.

**The Tonal-Not-Lifted Rule.** Do not add drop shadows to cards, panels, or navigation. The four near-black surface tones create perceived depth through tonal shift alone. Shadows imply softness — this system does not traffic in softness.

## 5. Components

### Band

The system's defining structural component. A full-width navy (#001A7A) bar that opens every major data section — simultaneously a section header, a chapter break, and the card's top border. Plays the same role as Vodafone's red divider band, with institutional blue replacing brand red.

- **Shape:** 0px radius, full-width
- **Background:** Navy Band (`#001A7A`)
- **Label:** 9px Roboto 500, letter-spacing 2px, uppercase, Text Primary
- **Right-side meta:** 8px Roboto 400, `rgba(255,255,255,0.45)` — secondary context text
- **Padding:** 7px 14px

### Cards / Containers

The default data container. Sharp-cornered, flat, bordered, no shadows.

- **Corner Style:** 0px radius
- **Background:** Card Surface (`#161616`)
- **Shadow Strategy:** None
- **Border:** 1px solid Border Steel (`#272727`); `border-top: none` — the Band provides the top edge
- **Internal Padding:** 18px 18px 14px standard; 8–12px inside dense data rows

### Chart Tooltip

Inline data label on chart hover. Its 3px left-edge orange accent is Signal Orange appearing in context — marking the active datum.

- **Background:** Ink Black (`#080808`)
- **Border:** 1px solid Border Steel (`#272727`); left: 3px solid Signal Orange (`#FF8000`)
- **Corner Style:** 0px
- **Padding:** 8px 12px
- **Label row:** 9px Roboto 500, Text Secondary (`#888888`), letter-spacing 1px, uppercase
- **Value row:** 11px Roboto 400, Text Primary (`#FFFFFF`)

### Buttons

Sharp-cornered throughout. Orange fill for primary actions; ghost for secondary.

- **Shape:** 4px radius — the only soft edge in the system; distinguishes interactive from structural
- **Primary:** Signal Orange fill, white text, 8px 16px padding, Roboto 500
- **Primary Hover:** `#E67200`, `transform: translateY(-1px)`, Signal Glow shadow
- **Ghost:** 1px Border Steel border, transparent background, Text Secondary text; hover shifts border and text to Signal Orange
- **Focus:** `outline: 2px solid rgba(255,128,0,0.6)`, `outline-offset: 2px`

### Chips / Tags

- **Accent Chip:** Card Surface background, Signal Orange text, 4px radius, 4px 10px padding, 9px Roboto 700 uppercase
- **Neutral Chip:** 1px Border Steel border, transparent background, Text Muted text, 0px radius

### Navigation

- **Background:** Nav Black (`#0A0A0A`)
- **Height:** ~48px desktop
- **Brand text:** Text Primary, Roboto 700, uppercase with letter-spacing
- **Nav links:** 9–11px Roboto 500, Text Secondary at rest; Signal Orange on hover/active
- **Active indicator:** 1px bottom border in Signal Orange

### Ticker Panel

Live data strip — a signature institutional surface.

- **Background:** `#060606` (one step below page canvas)
- **Values:** Display-scale Roboto 700, Signal Orange
- **Labels:** 8px Roboto 400, Text Secondary

## 6. Do's and Don'ts

### Do:

- **Do** use Signal Orange (`#FF8000`) on ≤10% of any screen. KPI numbers, primary CTAs, the live ticker, and chart tooltip accents are its natural habitat — use it nowhere else.
- **Do** open every data panel with the Band component. The navy header bar is the system's structural signature; a card without one looks unfinished.
- **Do** apply 0px border radius to all cards, panels, and containers. Sharp edges are intentional — precision over playfulness.
- **Do** use Roboto weight 700 for all metric and KPI values. The weight jump between display numbers and body copy is how hierarchy is communicated.
- **Do** set `border-top: none` on Cards — the Band's bottom edge is the card's top border. The two components connect flush by design.
- **Do** verify WCAG AA contrast (4.5:1) on all text combinations. Signal Orange at small sizes on dark backgrounds requires careful size and weight management.
- **Do** support `prefers-reduced-motion` for all chart animations, panel transitions, and data load sequences.

### Don't:

- **Don't** use Signal Orange as a background for large surface areas. Orange cards, orange panels, and orange section fills are prohibited — the color works because it's rare.
- **Don't** add border-radius to cards or the Band component. Softness undercuts the confrontational brand.
- **Don't** add drop shadows to cards, containers, or navigation. Shadows make the interface look like a generic SaaS tool (Salesforce, Monday.com) — the exact aesthetic UNREDACTED rejects.
- **Don't** use gradients on backgrounds, buttons, surfaces, or text. The system is gradient-free by doctrine.
- **Don't** let the interface resemble a government or corporate portal. USA.gov, Congress.gov, and FEC.gov are the aesthetic anti-references. UNREDACTED is the tool those sites are afraid of.
- **Don't** use visual patterns that read as conspiratorial — red string, unbroken walls of text, neon-on-black, or aesthetics a tin-foil-hat forum would recognize. Credibility comes from precision, not theatrics.
- **Don't** introduce a second font family. Roboto is the only typeface in this system.
- **Don't** use uppercase with letter-spacing above the Label scale. Card titles and body copy are always sentence case — uppercase at 14px+ reads as bureaucratic.
- **Don't** use pure black (#000) or pure white (#fff). Every surface and text color has a specific token — use it.
