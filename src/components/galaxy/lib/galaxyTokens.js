/**
 * Per-galaxy theme tokens. Read from the light/dark toggle.
 * Consumers NEVER hardcode hex; they read through these maps.
 *
 * Node color palette (consistent across MiniGalaxy + GalaxyGraph):
 *   employer    → #FFB84D  amber/gold   solid filled circle
 *   trad_pac    → #00CCAA  teal         hexagon, faint fill
 *   super_pac   → #FF6B35  orange-red   diamond, faint fill
 *   dark_money  → #CC88FF  purple       dashed rect, faint fill
 *   politician  → party-colored         solid circle (R=#FF4466, D=#4A7FFF)
 */
export const galaxyTokens = {
  dark: {
    surface:          '#1D1D1D',
    surfaceSub:       '#0e0e16',
    band:             '#001A7A',
    bandText:         '#FFFFFF',
    nodeFill:         '#1D1D1D',
    employerStroke:   '#FFB84D',
    pacStroke:        '#00CCAA',
    darkMoneyStroke:  '#CC88FF',
    superPacStroke:   '#FF6B35',
    politicianFill:   '#4A7FFF',
    edgeBase:         '#FF8000',
    edgeBaseOpacity:  0.45,
    edgeBridgeColor:  '#555566',
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
    employerStroke:   '#E8960A',
    pacStroke:        '#008F78',
    darkMoneyStroke:  '#8844BB',
    superPacStroke:   '#CC4400',
    politicianFill:   '#0028AA',
    edgeBase:         '#FF8000',
    edgeBaseOpacity:  0.55,
    edgeBridgeColor:  '#888888',
    textPrimary:      '#0D0D0D',
    textMuted:        '#484848',
    textLow:          '#8A8A8A',
    panelBorder:      '#D4D4D4',
    patternRing:      '#FF8000',
    drawerBackdrop:   'rgba(0,0,0,0.35)'
  }
}
