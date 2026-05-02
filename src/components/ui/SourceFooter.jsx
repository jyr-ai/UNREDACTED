import { useTheme } from '../../theme/index.js'
import { FONT_MONO } from '../../theme/tokens.js'

function SourceFooter({ s, href }) {
  const t = useTheme()
  const style = {
    marginTop: 10, paddingTop: 8,
    borderTop: `1px solid ${t.border}`,
    fontFamily: FONT_MONO, fontSize: 8.5, color: t.low,
  }
  const text = `Sources: ${s}`
  return (
    <div style={style}>
      {href
        ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: t.low, textDecoration: 'none' }}>{text} ↗</a>
        : text}
    </div>
  )
}

export default SourceFooter
