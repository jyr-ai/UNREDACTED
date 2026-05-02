import { galaxyTokens } from './lib/galaxyTokens.js'

export default function GalaxySurfaceToggle({ surface, onToggle, size = 20 }) {
  const t = galaxyTokens[surface]
  const next = surface === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      aria-label={`Switch galaxy to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={onToggle}
      style={{
        width: size + 8, height: size + 8,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent',
        border: `1px solid ${t.bandText}55`,
        color: t.bandText,
        cursor: 'pointer',
        padding: 0,
        fontSize: size - 4,
        lineHeight: 1
      }}
    >
      {surface === 'dark' ? '◐' : '☀'}
    </button>
  )
}
