/**
 * Basemap configuration for MapLibre GL + deck.gl
 * Adapted from Worldmonitor basemap.ts
 *
 * Tile provider priority:
 *   1. PMTiles (self-hosted Cloudflare R2) — set VITE_PMTILES_URL
 *   2. OpenFreeMap (free, no API key)
 *   3. CARTO (dark-matter / voyager)
 */

import { Protocol } from 'pmtiles';
import maplibregl from 'maplibre-gl';

// Optional self-hosted PMTiles URL (Cloudflare R2 or similar)
const R2_BASE = import.meta.env.VITE_PMTILES_URL ?? '';
export const hasPMTilesUrl = !!R2_BASE;

let registered = false;

/**
 * Register the pmtiles:// protocol with MapLibre.
 * Safe to call multiple times — only registers once.
 */
export function registerPMTilesProtocol() {
  if (registered) return;
  registered = true;
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
}

/**
 * Build a MapLibre StyleSpecification backed by PMTiles (Protomaps).
 * Returns null if VITE_PMTILES_URL is not set.
 */
export function buildPMTilesStyle(theme = 'dark') {
  if (!hasPMTilesUrl) return null;
  const flavor = theme === 'light' ? 'light' : 'dark';

  // Dynamic import of @protomaps/basemaps layer builders
  // We use a synchronous approach since the style object is needed at init time.
  // The layers/namedFlavor functions return plain arrays/objects.
  try {
    // eslint-disable-next-line no-undef
    const { layers, namedFlavor } = window.__protomapsBasemaps__ || {};
    if (layers && namedFlavor) {
      return {
        version: 8,
        glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
        sprite: `https://protomaps.github.io/basemaps-assets/sprites/v4/${flavor}`,
        sources: {
          basemap: {
            type: 'vector',
            url: `pmtiles://${R2_BASE}`,
            attribution: '<a href="https://protomaps.com">Protomaps</a> | <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
          },
        },
        layers: layers('basemap', namedFlavor(flavor), { lang: 'en' }),
      };
    }
  } catch { /* fall through */ }

  return null;
}

// ── Fallback styles ──────────────────────────────────────────────────────────

export const FALLBACK_DARK_STYLE  = 'https://tiles.openfreemap.org/styles/dark';
export const FALLBACK_LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/positron';

export const CARTO_DARK  = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
export const CARTO_LIGHT = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

/**
 * Returns the best available MapLibre style string for the given theme.
 * Priority: PMTiles → CARTO (reliable CDN) → OpenFreeMap (fallback on error)
 *
 * @param {'dark'|'light'} theme
 * @param {'auto'|'pmtiles'|'openfreemap'|'carto'} [provider]
 */
export function getStyleForTheme(theme = 'dark', provider = 'auto') {
  if (provider === 'carto') {
    return theme === 'light' ? CARTO_LIGHT : CARTO_DARK;
  }
  if (provider === 'openfreemap') {
    return theme === 'light' ? FALLBACK_LIGHT_STYLE : FALLBACK_DARK_STYLE;
  }
  // 'pmtiles' or 'auto': PMTiles → CARTO (reliable CDN) → OpenFreeMap
  const pmtiles = buildPMTilesStyle(theme);
  if (pmtiles) return pmtiles;
  return theme === 'light' ? CARTO_LIGHT : CARTO_DARK;
}

// ── Provider preference (persisted in localStorage) ───────────────────────────

const STORAGE_KEY = 'unredacted-map-provider';

export function getMapProvider() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'pmtiles' && !hasPMTilesUrl) return 'openfreemap';
    if (stored) return stored;
  } catch { /* localStorage unavailable */ }
  return hasPMTilesUrl ? 'auto' : 'openfreemap';
}

export function setMapProvider(provider) {
  try { localStorage.setItem(STORAGE_KEY, provider); } catch { /* ignore */ }
}
