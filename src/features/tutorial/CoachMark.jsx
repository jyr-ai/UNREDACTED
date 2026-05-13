import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../theme/index.js';
import { COACH_MARKS } from './coachMarks.js';

const ORANGE = '#FF8000';
const MF = "'Roboto', sans-serif";

export default function CoachMark({ id }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const entry = COACH_MARKS[id];

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!entry) return null;

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-block', marginLeft: 5, verticalAlign: 'middle' }}>
      <button
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
        }}
      >
        i
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0,
          marginTop: 6, zIndex: 400,
          background: t.card,
          border: `1px solid ${ORANGE}`,
          padding: '10px 14px',
          minWidth: 220, maxWidth: 'min(300px, calc(100vw - 24px))',
          boxShadow: `0 4px 16px rgba(255,128,0,.2)`,
          pointerEvents: 'auto',
        }}>
          <div style={{ color: ORANGE, fontSize: 9, letterSpacing: 1, marginBottom: 4, fontFamily: MF }}>
            {entry.title.toUpperCase()}
          </div>
          <div style={{ color: t.mid, fontSize: 12, lineHeight: 1.55, fontFamily: MF }}>
            {entry.body}
          </div>
        </div>
      )}
    </span>
  );
}
