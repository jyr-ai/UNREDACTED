# 📺 Live News Panel — Implementation Plan

**Feature:** YouTube Live News side panel on the "News Map" tab (CampaignWatch page)
**Approach:** Simplest/cheapest — hardcoded YouTube embeds, zero API keys, zero backend changes
**Date:** March 2026

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CampaignWatch Page ("News Map" tab)           │
│                                                                   │
│  ┌─────────────────────────────┐  ┌──────────────────────────┐  │
│  │                             │  │   LiveNewsPanel.jsx       │  │
│  │       DeckGLMap             │  │                          │  │
│  │       (existing)            │  │  [FOX][CNN][CBS][NBC][BB]│  │
│  │       flex: 1               │  │  ┌────────────────────┐  │  │
│  │                             │  │  │                    │  │  │
│  │                             │  │  │  YouTube iframe    │  │  │
│  │                             │  │  │  embed /live       │  │  │
│  │                             │  │  │                    │  │  │
│  │                             │  │  └────────────────────┘  │  │
│  │                             │  │  🔇 Mute  ⛶ Collapse    │  │
│  └─────────────────────────────┘  └──────────────────────────┘  │
│     map fills remaining space →      ← fixed ~380px             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/components/LiveNewsPanel.jsx` | **CREATE** | New YouTube live news component |
| `src/pages/CampaignWatch.jsx` | **MODIFY** | Add flex row layout + import LiveNewsPanel |

---

## Channel Registry

> **Embed strategy:** Channel-based auto-discovery via `live_stream?channel=CHANNEL_ID`.
> YouTube resolves the currently-active live stream for the channel — no video IDs to maintain.
> Channel IDs are permanent and never change for an established channel.
>
> **⚠️ Important:** Only channels with confirmed **free 24/7 public live streams** on YouTube
> are listed. Fox News, CNN, and Bloomberg TV were removed because they do not run
> free 24/7 public streams (Fox/CNN live content is paywalled; Bloomberg main channel
> is geo-restricted and inconsistent).

Two embed strategies supported:

| Strategy | When to use | URL pattern |
|----------|-------------|-------------|
| `videoId` | Specific user-provided video URL | `/embed/VIDEO_ID?autoplay=1&mute=1...` |
| `channelId` | Channel with confirmed 24/7 stream | `/embed/live_stream?channel=CHANNEL_ID&autoplay=1&mute=1...` |

**Active channels:**

| Channel | Label | Strategy | ID | Free 24/7? |
|---------|-------|----------|----|------------|
| ABC News Live | ABC | channelId | `UCBi2mrWuNuyYy4gbM6fU18Q` | ✅ |
| CBS News Streaming | CBS | channelId | `UC8p1vwvWtl6T73JiExfWs1g` | ✅ |
| NBC News NOW | NBC | channelId | `UCeY0bbntWzzVIaj2z3QigXg` | ✅ |
| Fox News | FOX | videoId | `x-K_xTqtFCw` | ✅ user-provided |
| Bloomberg | BLOOMBERG | videoId | `iEpJwprxDdk` | ✅ user-provided |

**Channels removed (no free 24/7 YouTube stream):**

| Channel | Reason |
|---------|--------|
| Sky News (`UCoMdktPbSTixAyNGwb-UYkQ`) | Replaced by user-provided Fox News video stream |
| Bloomberg Quicktake (`UCUMZ7gohGI9HcU9VNsr2FJQ`) | Replaced by user-provided Bloomberg video stream |
| CNN (`UCupvZG-5ko_eiXAupbDfxWw`) | Live content is behind CNN Max paywall |
| Bloomberg TV (`UCIALMKvObZNtJ68-rmLjgSA`) | Main channel geo-restricted; use Bloomberg Quicktake instead |

---

## Component Spec: `LiveNewsPanel.jsx`

### Props
- None required — fully self-contained

### State
- `activeChannel` — currently selected channel index (default: 0)
- `muted` — iframe mute state (default: true — autoplay requires mute)
- `collapsed` — whether panel is collapsed (default: false)

### Features
1. **Channel tab bar** — horizontal buttons for each of the 5 channels
2. **YouTube iframe embed** — lazy-loads on channel switch by key-forcing re-mount
3. **Mute/unmute toggle** — updates iframe `mute` param via URL rebuild
4. **Collapse/expand button** — hides panel to give full map width
5. **Styled to UNREDACTED theme** — IBM Plex Mono, ORANGE accent, dark background, border tokens

### Non-Goals (kept simple on purpose)
- No YouTube IFrame Player API JS SDK
- No HLS manifest management
- No Railway proxy / Vercel edge functions
- No bot-check detection
- No idle/eco mode (iframe is lightweight)
- No drag-to-reorder channels
- No custom channel input

---

## Layout Change in `CampaignWatch.jsx`

The map section changes from a single `<div>` to a **flex row**:

```jsx
// BEFORE (just the map section):
<div>
  <Band label="..." />
  <Card>
    <DeckGLMap ... />
  </Card>
</div>

// AFTER (map + live news side by side):
<div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
  <div style={{ flex: 1, minWidth: 0 }}>
    <Band label="..." />
    <Card>
      <DeckGLMap ... />
    </Card>
  </div>
  <LiveNewsPanel />
</div>
```

On mobile (< 768px): LiveNewsPanel stacks below the map.

---

## Cost Analysis

| Item | Cost |
|------|------|
| YouTube embeds | **$0** — free, no API key |
| Backend changes | **$0** — none required |
| New API routes | **$0** — none |
| Vercel edge functions | **$0** — not needed |
| Ongoing proxy/relay | **$0** — not needed |

**Total: $0 ongoing cost**

---

## Progress Checklist

- [x] Write implementation plan (`youtube_progress.md`)
- [x] Create `src/components/LiveNewsPanel.jsx`
- [x] Modify `src/pages/CampaignWatch.jsx` to add flex layout + import (`useMobile` responsive)
- [x] Mobile responsive — `isMobile` stacks panel below map on < 768px
- [x] Fix `buildEmbedUrl` call signature bug
- [x] Fix "Video unavailable — private" bug → reverted to channel-based embed
- [x] Replace Fox/CNN/Bloomberg (no free 24/7 stream) with ABC/Sky/Bloomberg Quicktake
- [x] Replace Sky News with user-provided Fox News video (`x-K_xTqtFCw`)
- [x] Fix "↗ YT" link to use `watch?v=` URL for `videoId` channels
- [x] Replace Bloomberg Quicktake (BB) with user-provided Bloomberg video (`iEpJwprxDdk`), label → BLOOMBERG
- [x] Reduce tab font to 9px + ellipsis overflow for longer labels
- [x] All items complete ✅

---

## Notes

- YouTube embeds **require `mute=1`** for autoplay to work in modern browsers (autoplay policy)
- The UNMUTE button rebuilds the iframe src URL with `mute=0`; user must click play on the player first due to browser autoplay policies
- Channel IDs are permanent — YouTube never changes them for established channels
- If a channel stops showing live content, verify the channel is currently live at `youtube.com/@ChannelName/live`
