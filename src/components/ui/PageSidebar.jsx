import { useState } from 'react';
import { useTheme } from '../../theme/index.js';
import { FONT_MONO } from '../../theme/tokens.js';
import CoachMark from '../../features/tutorial/CoachMark.jsx';

const ORANGE = '#FF8000';

// ── SVG icon registry — keyed by sub-tab id ──────────────────────────────────
const ICONS = {
  // Follow the Money
  flow: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="2.5" cy="8" r="1.5"/><circle cx="8" cy="3.5" r="1.5"/><circle cx="8" cy="12.5" r="1.5"/><circle cx="13.5" cy="8" r="1.5"/>
      <line x1="4" y1="7.2" x2="6.5" y2="4.5"/><line x1="4" y1="8.8" x2="6.5" y2="11.5"/>
      <line x1="9.5" y1="4.5" x2="12" y2="7.2"/><line x1="9.5" y1="11.5" x2="12" y2="8.8"/>
    </svg>
  ),
  intel: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7" cy="7" r="4.5"/><line x1="10.2" y1="10.2" x2="14" y2="14"/>
    </svg>
  ),
  darkmoney: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M1 8c2-4 12-4 14 0-2 4-12 4-14 0z"/><circle cx="8" cy="8" r="2"/><line x1="2" y1="2" x2="14" y2="14"/>
    </svg>
  ),
  anomalies: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1,13 3,13 5,5 7,10 9,3 11,9 13,7 15,7"/>
    </svg>
  ),
  web: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="3" r="1.5"/><circle cx="3" cy="12" r="1.5"/><circle cx="13" cy="12" r="1.5"/>
      <line x1="7" y1="4.3" x2="4" y2="10.7"/><line x1="9" y1="4.3" x2="12" y2="10.7"/><line x1="4.5" y1="12" x2="11.5" y2="12"/>
    </svg>
  ),
  bundlers: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="12" height="8" rx="1"/><path d="M5 6V5a3 3 0 016 0v1"/><line x1="2" y1="10" x2="14" y2="10"/>
    </svg>
  ),
  ie: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="6"/><path d="M8 5v.5M8 10.5V11M10 6.5H7a1.5 1.5 0 000 3h2a1.5 1.5 0 010 3H6"/>
    </svg>
  ),
  corpacs: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="12" height="9"/><polyline points="2,5 8,1 14,5"/>
      <rect x="5" y="10" width="2.5" height="4"/><rect x="8.5" y="10" width="2.5" height="4"/>
      <rect x="4" y="7" width="2" height="2"/><rect x="10" y="7" width="2" height="2"/>
    </svg>
  ),
  // Accountability
  accountability: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2L2 5v4c0 3.3 2.7 5.5 6 6.5 3.3-1 6-3.2 6-6.5V5L8 2z"/><polyline points="5.5,8 7.5,10 11,6"/>
    </svg>
  ),
  stockact: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1,12 4,8 7,10 10,5 13,7"/><line x1="13" y1="3" x2="13" y2="7"/><polyline points="11,3 13,3 13,5"/>
    </svg>
  ),
  vote_donor: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="10,2 14,5 10,8"/><line x1="2" y1="5" x2="14" y2="5"/>
      <polyline points="6,8 2,11 6,14"/><line x1="14" y1="11" x2="2" y2="11"/>
    </svg>
  ),
  watchlist: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2h8a1 1 0 011 1v11l-5-3-5 3V3a1 1 0 011-1z"/>
    </svg>
  ),
  // Policy
  ai: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="9,1 3,9 8,9 7,15 13,7 8,7"/>
    </svg>
  ),
  bills: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="3" y="2" width="10" height="12" rx="1"/><line x1="6" y1="6" x2="11" y2="6"/><line x1="6" y1="9" x2="11" y2="9"/><line x1="6" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  eo: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 2l3 3-8 8H3v-3l8-8z"/><line x1="9" y1="4" x2="12" y2="7"/>
    </svg>
  ),
  rulemaking: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="2" x2="4" y2="14"/><path d="M4 2l9 3.5-9 3.5"/>
    </svg>
  ),
  // Budget & Contracts
  spending: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="6"/><line x1="8" y1="8" x2="8" y2="2"/><line x1="8" y1="8" x2="13.2" y2="11"/>
    </svg>
  ),
  contracts: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="8,2 9.5,6.5 14,6.5 10.5,9.5 11.5,14 8,11.5 4.5,14 5.5,9.5 2,6.5 6.5,6.5"/>
    </svg>
  ),
  selfdealing: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="6" cy="4.5" r="2.5"/><path d="M1 14v-1a5 5 0 0110 0v1"/>
      <circle cx="13.5" cy="9.5" r="2"/><line x1="13.5" y1="8" x2="13.5" y2="7"/><line x1="13.5" y1="11" x2="13.5" y2="12"/>
    </svg>
  ),
  paytoplay: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="6"/><path d="M8 5.5v.5M8 10v.5M10 7H7a1 1 0 000 2h2a1 1 0 010 2H6"/>
    </svg>
  ),
  index: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="5" height="5" rx="0.5"/><rect x="9" y="2" width="5" height="5" rx="0.5"/>
      <rect x="2" y="9" width="5" height="5" rx="0.5"/><rect x="9" y="9" width="5" height="5" rx="0.5"/>
    </svg>
  ),
  profile: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="1" y="3" width="14" height="10" rx="1"/>
      <circle cx="5.5" cy="8" r="2"/><line x1="9" y1="6.5" x2="13" y2="6.5"/><line x1="9" y1="9.5" x2="12" y2="9.5"/>
    </svg>
  ),
  energy: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="9,1 4,9 8.5,9 7,15 12,7 7.5,7"/>
    </svg>
  ),
};

const DEFAULT_ICON = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="8" cy="8" r="6"/>
  </svg>
);

// ── Desktop sidebar ───────────────────────────────────────────────────────────
function DesktopSidebar({ tabs, active, onChange }) {
  const t = useTheme();
  return (
    <div style={{
      width: 220, flexShrink: 0,
      background: t.navBg,
      borderRight: `1px solid ${t.border}`,
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto', scrollbarWidth: 'none',
    }}>
      {tabs.map(tab => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            data-tour={`subtab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            title={tab.label}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 14px',
              background: isActive ? t.card : 'none',
              border: 'none',
              borderBottom: `1px solid ${t.border}`,
              color: isActive ? t.hi : t.mid,
              fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5,
              cursor: 'pointer', width: '100%', textAlign: 'left',
              transition: 'background 0.12s, color 0.12s',
              position: 'relative',
            }}
            onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = t.cardB; e.currentTarget.style.color = t.hi; } }}
            onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = t.mid; } }}
          >
            {/* Active indicator — 3px DOM element, not border-left */}
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: 3,
              background: isActive ? ORANGE : 'transparent',
              transition: 'background 0.12s',
            }} />
            <span style={{ color: isActive ? ORANGE : 'inherit', flexShrink: 0, display: 'flex' }}>
              {ICONS[tab.id] || DEFAULT_ICON}
            </span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
              {tab.label}
              {tab.coachMarkId && <CoachMark id={tab.coachMarkId} />}
            </span>
            {tab.badge && (
              <span style={{
                fontFamily: FONT_MONO, fontSize: 7.5, letterSpacing: 0.5,
                color: ORANGE, background: ORANGE + '18',
                border: `1px solid ${ORANGE}44`,
                padding: '1px 5px', flexShrink: 0,
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Mobile drawer ─────────────────────────────────────────────────────────────
function MobileDrawer({ tabs, active, onChange, open, onClose }) {
  const t = useTheme();
  return (
    <>
      {/* Scrim */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 400,
            background: 'rgba(0,0,0,0.6)',
          }}
        />
      )}
      {/* Drawer */}
      <div style={{
        position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 401,
        width: 260,
        background: t.navBg,
        borderRight: `1px solid ${t.border}`,
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Drawer header */}
        <div style={{
          padding: '8px 14px',
          background: t.band,
          borderBottom: `1px solid ${t.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: '#fff', letterSpacing: 2 }}>NAVIGATION</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.mid, fontFamily: FONT_MONO, fontSize: 16, cursor: 'pointer', padding: '0 4px' }}>✕</button>
        </div>
        {tabs.map(tab => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              data-tour={`subtab-${tab.id}`}
              onClick={() => { onChange(tab.id); onClose(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 16px',
                background: isActive ? t.card : 'none',
                border: 'none',
                borderBottom: `1px solid ${t.border}`,
                color: isActive ? t.hi : t.mid,
                fontFamily: FONT_MONO, fontSize: 12, letterSpacing: 0.5,
                cursor: 'pointer', width: '100%', textAlign: 'left',
                position: 'relative',
              }}
            >
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: isActive ? ORANGE : 'transparent' }} />
              <span style={{ color: isActive ? ORANGE : 'inherit', display: 'flex' }}>
                {ICONS[tab.id] || DEFAULT_ICON}
              </span>
              <span style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                {tab.label}
                {tab.coachMarkId && <CoachMark id={tab.coachMarkId} />}
              </span>
              {tab.badge && (
                <span style={{ fontFamily: FONT_MONO, fontSize: 7.5, color: ORANGE, background: ORANGE + '18', border: `1px solid ${ORANGE}44`, padding: '1px 5px' }}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ── Mobile trigger bar ────────────────────────────────────────────────────────
function MobileTrigger({ tabs, active, onOpen }) {
  const t = useTheme();
  const activeTab = tabs.find(t => t.id === active) || tabs[0];
  return (
    <div style={{
      background: t.navBg, borderBottom: `1px solid ${t.border}`,
      padding: '8px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
      flexShrink: 0,
    }}>
      <button onClick={onOpen} style={{ background: 'none', border: `1px solid ${t.border}`, color: t.mid, padding: '4px 8px', fontFamily: FONT_MONO, fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>
        ☰
      </button>
      <span style={{ color: ORANGE, display: 'flex' }}>{ICONS[activeTab.id] || DEFAULT_ICON}</span>
      <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: t.hi, letterSpacing: 0.5 }}>{activeTab.label}</span>
      {activeTab.badge && (
        <span style={{ fontFamily: FONT_MONO, fontSize: 7.5, color: ORANGE, background: ORANGE + '18', border: `1px solid ${ORANGE}44`, padding: '1px 5px' }}>
          {activeTab.badge}
        </span>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function PageSidebar({ tabs, active, onChange, isMobile }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (isMobile) {
    return (
      <>
        <MobileTrigger tabs={tabs} active={active} onOpen={() => setDrawerOpen(true)} />
        <MobileDrawer tabs={tabs} active={active} onChange={onChange} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      </>
    );
  }

  return <DesktopSidebar tabs={tabs} active={active} onChange={onChange} />;
}
