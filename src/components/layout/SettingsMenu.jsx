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
          background: t.navBg || t.bg, border: `1px solid ${ORANGE}`,
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
              <div style={{ color: t.mid, fontSize: 9, fontFamily: MF, marginTop: 1 }}>Theme & API keys</div>
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
