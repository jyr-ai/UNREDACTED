/**
 * LiveNewsPanel — YouTube live news side panel
 *
 * Displays a YouTube live stream embed for 5 major US news channels.
 * Sits to the right of the DeckGLMap on the "News Map" (CampaignWatch) tab.
 *
 * No API keys required — uses YouTube's free public embed endpoint.
 * Autoplay requires mute=1 per browser autoplay policy.
 */

import React, { useState, useCallback } from 'react';
import { useTheme } from '../theme/index.js';

const MF = "'IBM Plex Mono','Courier New',monospace";
const ORANGE = '#FF8000';

// ── Channel registry ──────────────────────────────────────────────────────────
// Two embed strategies are supported per channel:
//
//  1. videoId   → direct video embed: /embed/VIDEO_ID
//     Use when a specific known-live video URL is provided by the user.
//     The video must be a public live stream or premiere.
//
//  2. channelId → channel auto-discovery: /embed/live_stream?channel=CHANNEL_ID
//     Use for channels with confirmed free 24/7 public live streams.
//     YouTube auto-finds the currently-active stream — no video ID to maintain.
//
// If both are present, videoId takes priority.
const CHANNELS = [
  {
    id:        'abc',
    label:     'ABC',
    name:      'ABC News Live',
    videoId:   'unwn_H2pRgM',  // ABC News Live stream
  },
  {
    id:        'cbs',
    label:     'CBS',
    name:      'CBS News',
    channelId: 'UC8p1vwvWtl6T73JiExfWs1g',  // CBS News Streaming 24/7 ✅ confirmed
  },
  {
    id:        'nbc',
    label:     'NBC',
    name:      'NBC News NOW',
    videoId:   'VX7VRS2ZBPU',  // NBC News NOW live stream
  },
  {
    id:        'fox',
    label:     'FOX',
    name:      'Fox News',
    videoId:   'Mz1NkvRm8O8',              // Fox News live stream
  },
  {
    id:      'bloomberg',
    label:   'BLOOMBERG',
    name:    'Bloomberg',
    videoId: 'iEpJwprxDdk',   // User-provided: youtube.com/watch?v=iEpJwprxDdk
  },
  {
    id:      'yahoo_finance',
    label:   'YAHOO FIN',
    name:    'Yahoo Finance',
    videoId: 'KQp-e_XQnDE',   // Yahoo Finance live stream
  },
];

// Build the embed URL.
// If the channel has a videoId, embed that specific video directly.
// Otherwise use channel-based live auto-discovery.
function buildEmbedUrl(channel, muted) {
  const params = new URLSearchParams({
    autoplay:       '1',
    mute:           muted ? '1' : '0',
    rel:            '0',          // suppress related videos
    modestbranding: '1',
    playsinline:    '1',
  });
  if (channel.videoId) {
    return `https://www.youtube.com/embed/${channel.videoId}?${params.toString()}`;
  }
  params.set('channel', channel.channelId);
  return `https://www.youtube.com/embed/live_stream?${params.toString()}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LiveNewsPanel() {
  const t = useTheme();

  const [activeIdx,  setActiveIdx]  = useState(0);
  const [muted,      setMuted]      = useState(true);   // must start muted for autoplay
  const [collapsed,  setCollapsed]  = useState(false);
  // iframeKey forces a full re-mount (and new src) when channel or mute changes
  const [iframeKey,  setIframeKey]  = useState(0);

  const channel = CHANNELS[activeIdx];
  const embedUrl = buildEmbedUrl(channel, muted);

  const selectChannel = useCallback((idx) => {
    if (idx === activeIdx) return;
    setActiveIdx(idx);
    setMuted(true);           // reset to muted on channel switch (autoplay policy)
    setIframeKey(k => k + 1);
  }, [activeIdx]);

  const toggleMute = useCallback(() => {
    setMuted(m => !m);
    setIframeKey(k => k + 1); // rebuild iframe with new mute param
  }, []);

  const toggleCollapse = useCallback(() => {
    setCollapsed(c => !c);
  }, []);

  // ── Collapsed state — show just a narrow header strip ────────────────────
  if (collapsed) {
    return (
      <div style={{
        width: 50,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: t.card,
        border: `1px solid ${t.border}`,
        borderTop: `3px solid ${ORANGE}`,
        cursor: 'pointer',
        paddingTop: 1,
        gap: 8,
        userSelect: 'none',
      }}
        onClick={toggleCollapse}
        title="Expand Live News"
      >
        {/* Vertical label */}
        <div style={{
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          fontFamily: MF,
          fontSize: 9,
          color: ORANGE,
          letterSpacing: 2,
          transform: 'rotate(180deg)',
          marginTop: 8,
        }}>
          ▸ LIVE NEWS
        </div>
        {/* Pulsing live dot */}
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: '#ef4444',
          boxShadow: '0 0 6px #ef4444',
          animation: 'livePulse 1.8s ease-in-out infinite',
          marginTop: 6,
        }} />
      </div>
    );
  }

  // ── Expanded state ─────────────────────────────────────────────────────────
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: t.card,
      overflow: 'hidden',
    }}>

      {/* ── Header bar ────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '7px 12px',
        background: t.band || '#0A1A4A',
        borderBottom: `1px solid ${t.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {/* Live indicator dot */}
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#ef4444',
            boxShadow: '0 0 6px #ef4444aa',
            flexShrink: 0,
            animation: 'livePulse 1.8s ease-in-out infinite',
          }} />
          <span style={{ fontFamily: MF, fontSize: 9, color: '#ffffff', letterSpacing: 2 }}>
            LIVE NEWS
          </span>
          <span style={{
            fontFamily: MF, fontSize: 9,
            color: ORANGE,
            letterSpacing: 1,
            paddingLeft: 4,
            borderLeft: `1px solid ${t.border}`,
            marginLeft: 2,
          }}>
            {channel.name.toUpperCase()}
          </span>
        </div>
        {/* Collapse button */}
        <button
          onClick={toggleCollapse}
          title="Collapse live news panel"
          style={{
            background: 'none',
            border: `1px solid ${t.border}`,
            color: t.mid,
            width: 24, height: 24,
            fontSize: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            fontFamily: MF,
            flexShrink: 0,
          }}
        >
          ▸
        </button>
      </div>

      {/* ── Channel switcher tabs ─────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        borderBottom: `1px solid ${t.border}`,
        background: t.cardB || t.card,
        flexShrink: 0,
      }}>
        {CHANNELS.map((ch, i) => {
          const isActive = i === activeIdx;
          return (
            <button
              key={ch.id}
              onClick={() => selectChannel(i)}
              title={ch.name}
              style={{
                flex: 1,
                padding: '8px 2px',
                background: 'none',
                border: 'none',
                borderBottom: `3px solid ${isActive ? ORANGE : 'transparent'}`,
                fontFamily: MF,
                fontSize: 9,
                fontWeight: isActive ? 700 : 400,
                letterSpacing: 0,
                color: isActive ? ORANGE : t.mid,
                cursor: 'pointer',
                transition: 'color 0.13s, border-color 0.13s',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = t.hi; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = t.mid; }}
            >
              {ch.label}
            </button>
          );
        })}
      </div>

      {/* ── YouTube iframe embed ──────────────────────────────────────── */}
      <div style={{
        position: 'relative',
        width: '100%',
        paddingTop: '56.25%', // 16:9 aspect ratio
        background: '#000',
        flexShrink: 0,
      }}>
        <iframe
          key={`yt-${channel.id}-${iframeKey}`}
          src={embedUrl}
          title={`${channel.name} Live`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{
            position: 'absolute',
            top: 0, left: 0,
            width: '100%',
            height: '100%',
            border: 'none',
          }}
        />
      </div>

      {/* ── Controls bar ──────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '7px 12px',
        borderTop: `1px solid ${t.border}`,
        background: t.cardB || t.card,
        flexShrink: 0,
      }}>
        {/* Mute toggle */}
        <button
          onClick={toggleMute}
          title={muted ? 'Unmute (reload required)' : 'Mute'}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: muted ? 'none' : ORANGE + '22',
            border: `1px solid ${muted ? t.border : ORANGE}`,
            padding: '4px 12px',
            fontFamily: MF,
            fontSize: 12,
            letterSpacing: 1,
            color: muted ? t.mid : ORANGE,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <span style={{ fontSize: 11 }}>{muted ? '🔇' : '🔊'}</span>
          {muted ? 'UNMUTE' : 'MUTE'}
        </button>

        {/* Source attribution */}
        <span style={{ fontFamily: MF, fontSize: 12, color: t.low, letterSpacing: 0.5 }}>
          YOUTUBE · LIVE
        </span>

        {/* Open in YouTube link — use direct video URL if videoId, else channel live page */}
        <a
          href={
            channel.videoId
              ? `https://www.youtube.com/watch?v=${channel.videoId}`
              : `https://www.youtube.com/channel/${channel.channelId}/live`
          }
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 2,
            fontFamily: MF, fontSize: 15.5,
            color: t.low,
            textDecoration: 'none',
            letterSpacing: 0.5,
            transition: 'color 0.13s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = ORANGE; }}
          onMouseLeave={e => { e.currentTarget.style.color = t.low; }}
        >
          ↗ YT
        </a>
      </div>

      {/* Autoplay note — shown only while muted */}
      {muted && (
        <div style={{
          padding: '5px 12px',
          background: t.sigBg || t.cardB,
          borderTop: `1px solid ${t.border}`,
          fontFamily: MF,
          fontSize: 10,
          color: t.low,
          lineHeight: 1.5,
        }}>
          ℹ Autoplay requires mute. Click UNMUTE or use player controls.
        </div>
      )}

      {/* Inline keyframe for the live pulse animation */}
      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 4px #ef4444; }
          50% { opacity: 0.55; box-shadow: 0 0 10px #ef4444; }
        }
      `}</style>
    </div>
  );
}
