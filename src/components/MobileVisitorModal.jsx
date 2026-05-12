import { useState, useEffect } from 'react'
import { useTheme } from '../theme/index.js'
import { FONT_MONO } from '../theme/tokens.js'
import { useMobile } from '../hooks/useMediaQuery.js'

const ORANGE = '#FF8000'
const DISMISSED_KEY = 'unredacted_mobile_v1'

const SOCIAL = [
  {
    label: 'X',
    title: 'Share on X',
    icon: '𝕏',
    href: (url) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Follow the money — UNREDACTED')}`,
  },
  {
    label: 'FB',
    title: 'Share on Facebook',
    icon: 'f',
    href: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    label: 'in',
    title: 'Share on LinkedIn',
    icon: 'in',
    href: (url) =>
      `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(url)}&title=${encodeURIComponent('UNREDACTED')}`,
  },
  {
    label: 'WA',
    title: 'Share via WhatsApp',
    icon: '💬',
    href: (url) => `https://wa.me/?text=${encodeURIComponent(url)}`,
  },
]

export default function MobileVisitorModal() {
  const isMobile = useMobile()
  const t = useTheme()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isMobile && localStorage.getItem(DISMISSED_KEY) !== 'dismissed') {
      const t = setTimeout(() => setVisible(true), 5000)
      return () => clearTimeout(t)
    }
  }, [isMobile])

  if (!visible) return null

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, 'dismissed')
    setVisible(false)
  }

  function openEmailApp() {
    const url = window.location.href
    window.location.href =
      `mailto:?subject=${encodeURIComponent('Check out UNREDACTED')}&body=${encodeURIComponent('Open this on your desktop for the full experience:\n\n' + url)}`
  }

  function openShare(hrefFn) {
    window.open(hrefFn(window.location.href), '_blank', 'noopener,noreferrer')
  }

  function webShare() {
    navigator.share?.({ url: window.location.href, title: 'UNREDACTED' })
  }

  const MF = FONT_MONO

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={dismiss}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 999 }}
      />

      {/* Card */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          width: 'min(92vw, 420px)',
          maxHeight: '85vh',
          overflowY: 'auto',
          background: t.card,
          border: `1px solid ${t.border}`,
          borderRadius: 10,
          padding: '24px 20px 20px',
          fontFamily: MF,
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <span style={{ fontSize: 28, lineHeight: 1 }}>🖥️</span>
          <div>
            <div style={{ color: t.hi, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
              Best experienced on desktop
            </div>
            <div style={{ color: t.mid, fontSize: 12, lineHeight: 1.5 }}>
              UNREDACTED uses network graphs, maps, and financial flows that work best on a wider
              screen. Send yourself this link to open later on desktop.
            </div>
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: `1px solid ${t.border}`, margin: '0 0 16px' }} />

        {/* Email button — opens native email app pre-filled */}
        <button
          onClick={openEmailApp}
          style={{
            width: '100%',
            padding: '12px',
            background: ORANGE,
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontFamily: MF,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            minHeight: 44,
            marginBottom: 16,
          }}
        >
          ✉ Email this link to myself
        </button>

        {/* Social share */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: t.mid, fontSize: 11, marginBottom: 8 }}>Or share via</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SOCIAL.map(({ label, title, icon, href }) => (
              <button
                key={label}
                onClick={() => openShare(href)}
                title={title}
                style={{
                  padding: '8px 14px',
                  background: t.bg,
                  border: `1px solid ${t.border}`,
                  borderRadius: 6,
                  color: t.hi,
                  fontFamily: MF,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  minHeight: 44,
                  minWidth: 52,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {icon}
              </button>
            ))}
            {typeof navigator !== 'undefined' && navigator.share && (
              <button
                onClick={webShare}
                title="More options (Instagram & others)"
                style={{
                  padding: '8px 14px',
                  background: t.bg,
                  border: `1px solid ${t.border}`,
                  borderRadius: 6,
                  color: t.mid,
                  fontFamily: MF,
                  fontSize: 12,
                  cursor: 'pointer',
                  minHeight: 44,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                ⋯ More
              </button>
            )}
          </div>
        </div>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          style={{
            width: '100%',
            padding: '11px',
            background: 'transparent',
            border: `1px solid ${t.border}`,
            borderRadius: 6,
            color: t.low,
            fontFamily: MF,
            fontSize: 12,
            cursor: 'pointer',
            minHeight: 44,
          }}
        >
          Continue on mobile anyway →
        </button>
      </div>
    </>
  )
}
