import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTheme } from '../theme/index.js';
import { FONT_MONO } from '../theme/tokens.js';

const ORANGE = '#FF8000';

const CHANNELS = [
  { id: 'bloomberg',    label: 'BLOOMBERG',  name: 'Bloomberg',       videoId: 'iEpJwprxDdk' },
  { id: 'abc',          label: 'ABC',        name: 'ABC News Live',   videoId: 'unwn_H2pRgM' },
  { id: 'cbs',          label: 'CBS',        name: 'CBS News',        channelId: 'UC8p1vwvWtl6T73JiExfWs1g' },
  { id: 'nbc',          label: 'NBC',        name: 'NBC News NOW',    videoId: 'VX7VRS2ZBPU' },
  { id: 'fox',          label: 'FOX',        name: 'Fox News',        videoId: 'Mz1NkvRm8O8' },
  { id: 'yahoo_finance',label: 'YAHOO FIN',  name: 'Yahoo Finance',   videoId: 'KQp-e_XQnDE' },
];

function buildEmbedUrl(channel, muted) {
  const params = new URLSearchParams({
    autoplay: '1', mute: muted ? '1' : '0',
    rel: '0', modestbranding: '1', playsinline: '1',
  });
  if (channel.videoId) return `https://www.youtube.com/embed/${channel.videoId}?${params}`;
  params.set('channel', channel.channelId);
  return `https://www.youtube.com/embed/live_stream?${params}`;
}

function usePanelWidth(ref) {
  const [width, setWidth] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

export default function LiveNewsPanel() {
  const t = useTheme();
  const [activeIdx, setActiveIdx] = useState(0);
  const [muted, setMuted]         = useState(true);
  const [iframeKey, setIframeKey] = useState(0);
  const panelRef = useRef(null);
  const w = usePanelWidth(panelRef);
  const s = Math.max(0.72, Math.min(1, w / 580));

  const channel  = CHANNELS[activeIdx];
  const embedUrl = buildEmbedUrl(channel, muted);

  const selectChannel = useCallback((idx) => {
    if (idx === activeIdx) return;
    setActiveIdx(idx);
    setMuted(true);
    setIframeKey(k => k + 1);
  }, [activeIdx]);

  const toggleMute = useCallback(() => {
    setMuted(m => !m);
    setIframeKey(k => k + 1);
  }, []);

  return (
    <div ref={panelRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: t.card, overflow: 'hidden', minHeight: 0 }}>

      {/* ── Header ── */}
      <div style={{ background: t.navBg, borderBottom: `1px solid ${t.border}`, padding: '7px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 6px #ef4444', flexShrink: 0, animation: 'livePulse 1.8s ease-in-out infinite' }} />
          <span style={{ fontFamily: FONT_MONO, fontSize: 11 * s, color: t.hi, letterSpacing: 2, flexShrink: 0 }}>LIVE NEWS</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11 * s, color: ORANGE, letterSpacing: 1, paddingLeft: 6, borderLeft: `1px solid ${t.border}`, marginLeft: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {channel.name.toUpperCase()}
          </span>
        </div>
        <button
          onClick={toggleMute}
          title={muted ? 'Unmute (reloads stream)' : 'Mute'}
          style={{ background: muted ? 'none' : ORANGE + '22', border: `1px solid ${muted ? t.border : ORANGE}`, color: muted ? t.mid : ORANGE, padding: `3px ${Math.round(10 * s)}px`, fontFamily: FONT_MONO, fontSize: Math.round(9 * s), letterSpacing: 1, cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0 }}
        >
          {muted ? '▶ UNMUTE' : '◼ MUTE'}
        </button>
      </div>

      {/* ── Channel tabs ── */}
      <div style={{ display: 'flex', background: t.cardB, borderBottom: `1px solid ${t.border}`, flexShrink: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {CHANNELS.map((ch, i) => {
          const isActive = i === activeIdx;
          return (
            <button
              key={ch.id}
              onClick={() => selectChannel(i)}
              title={ch.name}
              style={{ flex: 1, padding: `${Math.round(8 * s)}px ${Math.max(4, Math.round(10 * s))}px`, background: 'none', border: 'none', borderBottom: `3px solid ${isActive ? ORANGE : 'transparent'}`, fontFamily: FONT_MONO, fontSize: Math.round(10 * s), fontWeight: isActive ? 700 : 400, color: isActive ? ORANGE : t.mid, cursor: 'pointer', transition: 'color 0.13s, border-color 0.13s', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = t.hi; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = t.mid; }}
            >
              {ch.label}
            </button>
          );
        })}
      </div>

      {/* ── Video content ── */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', background: '#000' }}>
        <iframe
          key={`yt-${channel.id}-${iframeKey}`}
          src={embedUrl}
          title={`${channel.name} Live`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
        />
      </div>

      {/* ── Footer ── */}
      <div style={{ background: t.cardB, borderTop: `1px solid ${t.border}`, padding: '7px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: Math.round(9 * s), color: t.low, letterSpacing: 0.5 }}>YOUTUBE · LIVE</span>
        {muted && (
          <span style={{ fontFamily: FONT_MONO, fontSize: Math.round(7.5 * s), color: t.low }}>
            Autoplay requires mute
          </span>
        )}
        <a
          href={channel.videoId ? `https://www.youtube.com/watch?v=${channel.videoId}` : `https://www.youtube.com/channel/${channel.channelId}/live`}
          target="_blank" rel="noopener noreferrer"
          style={{ fontFamily: FONT_MONO, fontSize: Math.round(9 * s), color: t.low, textDecoration: 'none', letterSpacing: 0.5, transition: 'color 0.13s' }}
          onMouseEnter={e => { e.currentTarget.style.color = ORANGE; }}
          onMouseLeave={e => { e.currentTarget.style.color = t.low; }}
        >
          ↗ YT
        </a>
      </div>

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 4px #ef4444; }
          50%       { opacity: 0.55; box-shadow: 0 0 10px #ef4444; }
        }
      `}</style>
    </div>
  );
}
