/**
 * Per-galaxy theme tokens. Read from the light/dark toggle.
 * Consumers NEVER hardcode hex; they read through these maps.
 */
export const galaxyTokens = {
  dark: {
    surface:          '#1D1D1D',
    surfaceSub:       '#161616',
    band:             '#001A7A',
    bandText:         '#FFFFFF',
    nodeFill:         '#1D1D1D',
    employerStroke:   '#FF8000',
    pacStroke:        '#FF8000',
    darkMoneyStroke:  '#FFB84D',
    superPacStroke:   '#FF8000',
    politicianFill:   '#4A7FFF',
    edgeBase:         '#FF8000',
    edgeBaseOpacity:  0.5,
    edgeBridgeColor:  '#888888',
    textPrimary:      '#FFFFFF',
    textMuted:        '#888888',
    textLow:          '#484848',
    panelBorder:      '#272727',
    patternRing:      '#FF8000',
    drawerBackdrop:   'rgba(0,0,0,0.55)'
  },
  light: {
    surface:          '#FAFAFA',
    surfaceSub:       '#F0F0F0',
    band:             '#001A7A',
    bandText:         '#FFFFFF',
    nodeFill:         '#FFFFFF',
    employerStroke:   '#FF8000',
    pacStroke:        '#FF8000',
    darkMoneyStroke:  '#B8860B',
    superPacStroke:   '#FF8000',
    politicianFill:   '#0028AA',
    edgeBase:         '#FF8000',
    edgeBaseOpacity:  0.65,
    edgeBridgeColor:  '#888888',
    textPrimary:      '#0D0D0D',
    textMuted:        '#484848',
    textLow:          '#8A8A8A',
    panelBorder:      '#D4D4D4',
    patternRing:      '#FF8000',
    drawerBackdrop:   'rgba(0,0,0,0.35)'
  }
}
