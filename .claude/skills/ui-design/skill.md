---
name: ui-design
description: >
  Full-stack UI design orchestrator. Activates when the user wants to build,
  design, review, audit, animate, polish, or improve any frontend UI — including
  components, pages, dashboards, landing pages, apps, or design systems.
  Coordinates three installed skills as a design team: ui-ux-pro-max for design
  intelligence & database lookup, impeccable for quality standards & commands,
  and design-motion-principles for motion audits. Use this skill whenever the
  task will change how something looks, feels, moves, or is interacted with.
---

# UI Design — Global Orchestrator

This skill coordinates three installed skills as a layered design team. Each
skill has a distinct role. This file tells you when to invoke each one, in
what order, and how to combine them without conflict.

---

## Your Design Team

| Skill | Role | Fires when |
|---|---|---|
| **ui-ux-pro-max** | Design Intelligence — database of styles, palettes, fonts, UX rules | Any UI task; run its search script first for design system generation |
| **impeccable** | Senior Design Systems Engineer — quality standards, anti-patterns, commands | All design work; always active as the quality layer |
| **design-motion-principles** | Motion Specialist — per-designer animation audit | When adding or reviewing animations/transitions |

---

## Workflow: Building New UI

Follow this sequence every time you build new UI from scratch.

### Phase 1 — Context (before writing a single line of code)

1. **Run impeccable teach** if no `.impeccable.md` exists in the project root:
   ```
   /impeccable teach
   ```
   This gathers brand personality, audience, emotional tone. Store to `.impeccable.md`.
   Do not skip. Do not infer context from code.

2. **Generate a design system** using ui-ux-pro-max's search script:
   ```bash
   python3 ~/.claude/skills/ui-ux-pro-max/scripts/search.py \
     "<product-type> <industry> <tone>" --design-system
   ```
   Use multi-dimensional keywords: `"fintech dark premium dense"` not just `"app"`.
   For stack-specific rules, add `--stack react` / `--stack nextjs` / etc.
   This surfaces: style, color palette, font pairings, UX rules, chart types.

### Phase 2 — Creative Direction

3. **Commit to a bold aesthetic direction** using impeccable's design framework:
   - **Purpose**: Who uses this and in what context?
   - **Tone**: Pick an extreme — brutally minimal, maximalist chaos, editorial,
     luxury/refined, playful, brutalist, retro-futuristic, etc. Be specific.
   - **Differentiation**: What makes this unforgettable? What's the one thing
     someone will remember?
   - **Theme**: Derive light vs. dark from audience context, not preference.
     (e.g. a trading dashboard → dark; a wedding planner → light)

   Cross-reference the design system output from Phase 1 with the aesthetic
   direction chosen here. They should reinforce each other.

### Phase 3 — Build

4. **Implement the UI** following all impeccable quality standards (see
   Quality Standards section below). The impeccable rules are always active —
   they are not optional post-processing, they govern what you write.

5. **For motion**: when adding any animations or transitions, load
   design-motion-principles:
   ```
   "Add entrance animations to the hero section"
   ```
   The skill will do context reconnaissance, detect motion gaps, and propose
   a designer weighting (Emil Kowalski / Jakub Krehel / Jhey Tompkins)
   appropriate to your project type.

---

## Workflow: Reviewing Existing UI

Use this sequence to audit and improve existing UI.

```
/audit [scope]          — impeccable: a11y, performance, responsive issues
/critique [scope]       — impeccable: UX hierarchy, clarity, emotional resonance
"Audit the motion design in [scope]"   — design-motion-principles: animation audit
/polish [scope]         — impeccable: final pass before shipping
```

For a full design team review in one shot:
```
"Run a full design review on [feature/page]. 
Audit quality and UX with impeccable. 
Audit all motion using design-motion-principles.
Give me a prioritized fix list."
```

---

## Quality Standards (Always Active)

These rules from impeccable apply to ALL UI output. They are not a checklist
to run afterwards — they govern every line of code written.

### Typography

- Run the font selection procedure: write 3 brand-voice words, list your
  reflex font choices, then reject every font from this banned list:
  `Fraunces, Newsreader, Lora, Crimson Pro, Playfair Display, Cormorant,
  Syne, IBM Plex Mono/Sans/Serif, Space Mono, Space Grotesk, Inter, DM Sans,
  DM Serif Display, Outfit, Plus Jakarta Sans, Instrument Sans/Serif`
- Pair a distinctive display font with a refined body font. Never one family.
- Use a modular type scale (clamp for marketing, fixed rem for app UI).
- Cap line length at 65–75ch for body text.

### Color

- Use OKLCH, not HSL. Reduce chroma as lightness approaches extremes.
- Tint neutrals toward the brand hue (even chroma 0.005 is perceptible).
- Theme choice (light/dark) must be derived from audience context, not default.
- Never pure black (`#000`) or pure white (`#fff`). Always tint.
- Cross-reference the color palette from ui-ux-pro-max's design system output.

### Layout & Space

- 4pt spacing scale with semantic tokens (`--space-sm`, `--space-md`).
- Use `gap` instead of margins for sibling spacing.
- Vary spacing for hierarchy. Don't apply the same padding everywhere.
- Use container queries (`@container`) for component-level responsiveness.

### Absolute Bans (Never Write These)

**BAN 1 — Side-stripe borders:**
`border-left` or `border-right` wider than 1px as a colored accent.
Forbidden on cards, list items, callouts, alerts in any color or CSS variable.
Rewrite the element structure entirely instead.

**BAN 2 — Gradient text:**
`background-clip: text` combined with any gradient background. Use solid color.
If emphasis is needed, use weight or size — not gradient fill.

**BAN 3 — AI slop patterns:**
- Purple-on-white gradients or neon accents on dark backgrounds
- Cards nested inside cards
- Glassmorphism used decoratively (blur/glow everywhere)
- Identical card grids (icon + heading + text, repeated)
- Hero metric layout (big number, small label, gradient accent)
- Bounce or elastic easing in animations
- Emojis used as icons (SVG only)
- Modals as default for any interaction

### Motion (when adding animations)

- Use `transform` and `opacity` only. Never animate layout properties.
- Use exponential easing (ease-out-quart/quint/expo) for deceleration.
- For height animations, use `grid-template-rows` transitions.
- Focus on high-impact moments (page load staggered reveal) over
  scattered micro-interactions.
- Always respect `prefers-reduced-motion`.
- For full animation audits, delegate to design-motion-principles.

---

## Quick Command Reference

| Goal | Command |
|---|---|
| First-time project setup | `/impeccable teach` |
| Generate a design system | `python3 ~/.claude/skills/ui-ux-pro-max/scripts/search.py "<keywords>" --design-system` |
| Stack-specific UX rules | add `--stack react` / `--stack nextjs` / `--stack shadcn` etc. |
| Find the right style | `python3 ... --domain style` |
| Find the right fonts | `python3 ... --domain typography` |
| Find the right colors | `python3 ... --domain color` |
| Technical quality audit | `/audit [scope]` |
| UX design review | `/critique [scope]` |
| Motion audit | `"Audit the motion design in [scope]"` |
| Final pre-ship pass | `/polish [scope]` |
| Typography fix | `/typeset [scope]` |
| Layout fix | `/layout [scope]` |
| Too bland | `/bolder [scope]` |
| Too busy | `/quieter [scope]` |
| Add purposeful animation | `/animate [scope]` |
| Add delight moments | `/delight [scope]` |
| Extract reusable tokens | `/impeccable extract` |
| Full shape-then-build flow | `/impeccable craft [feature]` |

---

## The AI Slop Test

Before finishing any UI task, ask: if you showed this to someone and said
"AI made this," would they immediately believe you? If yes, that's a failure.

A distinctive interface makes someone ask "how was this made?" — not
"which AI template is this from?"

Review the bans above. They are the fingerprints of AI-generated work.

---

## Skill Dependency Notes

This skill assumes the following are installed globally (`~/.claude/skills/`):
- `ui-ux-pro-max` (from `nextlevelbuilder/ui-ux-pro-max-skill`)
- `impeccable` (from `pbakaus/impeccable`)
- `design-motion-principles` (from `kylezantos/design-motion-principles`)

If any are missing, the relevant phase degrades gracefully — but for full
team coverage all three should be present.
