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
