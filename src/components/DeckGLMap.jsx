/**
 * DeckGLMap — WebGL-accelerated political accountability map
 *
 * Stack: MapLibre GL (basemap) + deck.gl MapboxOverlay (interleaved WebGL layers)
 * Basemap: PMTiles (self-hosted) → OpenFreeMap → CARTO fallback chain
 *
 * Phase 1: Static layers (states choropleth, pipelines, railways, power grid,
 *           data centers, cities, mountain ranges, news locations, contribution arcs)
 * Phase 2: Dynamic pipeline layers (election races, dark money, spending flows,
 *           STOCK Act trades) — fed via Upstash Redis bootstrap cache
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import './DeckGLMap.css';
import Supercluster from 'supercluster';
import freshnessTracker from '../services/data-freshness.js';

import maplibregl from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import {
  GeoJsonLayer,
  ScatterplotLayer,
  PathLayer,
  TextLayer,
  ArcLayer,
} from '@deck.gl/layers';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';

import {
  registerPMTilesProtocol,
  getStyleForTheme,
  FALLBACK_DARK_STYLE,
  FALLBACK_LIGHT_STYLE,
} from '../config/basemap.js';

import { feature as topoFeature } from 'topojson-client';
import { DATA_CENTERS, STATE_FIPS_TO_ABBR } from '../data/geo.js';
import { OIL_PIPELINES } from '../data/pipelines.js';
import { RAILWAYS } from '../data/railways.js';
import { POWER_GRID } from '../data/powerGrid.js';
import MOUNTAIN_RANGES from '../data/mountainRanges.js';
import US_CITIES from '../data/usCities.js';

// ─── Constants ─────────────────────────────────────────────────────────────

const VIEW_PRESETS = {
  national: { center: [-98,  38], zoom: 3.5 },
  east:     { center: [-77,  39], zoom: 5.0 },
  west:     { center: [-119, 37], zoom: 5.0 },
  midwest:  { center: [-90,  41], zoom: 5.0 },
  south:    { center: [-88,  32], zoom: 5.0 },
  alaska:   { center: [-153, 64], zoom: 4.0 },
  hawaii:   { center: [-157, 20], zoom: 6.0 },
};

const LAYER_ZOOM_THRESHOLDS = {
  cities:         { minZoom: 4.0 },
  mountainRanges: { minZoom: 4.5 },
  powerGrid:      { minZoom: 3.0 },
  railways:       { minZoom: 3.0 },
  dataCenters:    { minZoom: 2.5 },
};

const DEFAULT_LAYERS = {
  corruption:     true,
  gasPrices:      false,
  pipelines:      true,
  railways:       false,
  powerGrid:      false,
  dataCenters:    true,
  mountainRanges: false,
  cities:         false,
  newsLocations:  true,
  contributions:  false,
  // Phase 2 — off by default (activate once seed data is populated)
  electionRaces:  false,
  darkMoneyFlows: false,
  spendingFlows:  false,
  stockActTrades: false,
};

// Time-range filter constants (ms cutoffs from "now")
const TIME_RANGE_MS = {
  '1h':  1  * 60 * 60 * 1000,
  '6h':  6  * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d':  7  * 24 * 60 * 60 * 1000,
  'all': Infinity,
};

const THREAT_RGB = {
  critical: [239, 68,  68],
  high:     [249, 115, 22],
  medium:   [234, 179,  8],
  low:      [ 34, 197, 94],
  info:     [ 59, 130, 246],
};

// ─── Utility helpers ────────────────────────────────────────────────────────

function debounce(fn, ms) {
  let timer = null;
  const deb = (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
  deb.cancel = () => clearTimeout(timer);
  return deb;
}

function rafSchedule(fn) {
  let rafId = null;
  const sched = () => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => { rafId = null; fn(); });
  };
  sched.cancel = () => { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } };
  return sched;
}

function esc(v) { return String(v ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

/**
 * Filter an array by item.timestamp against a time-range key ('1h','6h','24h','7d','all').
 * Items with no timestamp are always kept.
 */
function filterByTime(items, rangeKey) {
  const cutoffMs = TIME_RANGE_MS[rangeKey] ?? Infinity;
  if (!isFinite(cutoffMs)) return items;
  const since = Date.now() - cutoffMs;
  return items.filter(it => {
    if (!it.timestamp) return true;
    const ts = typeof it.timestamp === 'number' ? it.timestamp : new Date(it.timestamp).getTime();
    return ts >= since;
  });
}

/**
 * Build Supercluster-reduced points for a set of point-data at the given zoom.
 * Returns { clusters: Array, index: Supercluster } where each cluster has
 * { lon, lat, count, data? } — data is the original item for single points.
 */
function buildClusters(items, zoom, getLon = r => r.lon, getLat = r => r.lat) {
  if (!items.length) return { clusters: [], index: null };
  const sc = new Supercluster({ radius: 50, maxZoom: 9, minZoom: 2 });
  const features = items.map((it, i) => ({
    type: 'Feature',
    properties: { idx: i, data: it },
    geometry: { type: 'Point', coordinates: [getLon(it), getLat(it)] },
  }));
  sc.load(features);
  const raw = sc.getClusters([-180, -85, 180, 85], Math.floor(zoom));
  const clusters = raw.map(f => ({
    lon:     f.geometry.coordinates[0],
    lat:     f.geometry.coordinates[1],
    count:   f.properties.point_count || 1,
    cluster: !!f.properties.cluster,
    data:    f.properties.cluster ? null : f.properties.data,
    clusterId: f.properties.cluster_id ?? null,
  }));
  return { clusters, index: sc };
}

// ─── Color helpers ──────────────────────────────────────────────────────────

function corruptionFill(score) {
  if (score == null) return [15, 20, 40, 50];
  const t = Math.min(1, Math.max(0, score / 100));
  return [Math.round(220 - t * 180), Math.round(55 + t * 160), Math.round(55 + t * 20), 150];
}

function gasPriceFill(price) {
  if (price == null) return [15, 20, 40, 50];
  const t = Math.min(1, Math.max(0, (price - 2.5) / 3.0));
  return [Math.round(40 + t * 200), Math.round(200 - t * 160), 50, 140];
}

function fmtAmt(amt) {
  if (!amt) return '$0';
  if (amt >= 1e9) return `$${(amt / 1e9).toFixed(1)}B`;
  if (amt >= 1e6) return `$${(amt / 1e6).toFixed(1)}M`;
  if (amt >= 1e3) return `$${(amt / 1e3).toFixed(0)}K`;
  return `$${amt}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function DeckGLMap({
  corruptionScores  = {},
  gasPriceByState   = {},
  newsLocations     = [],
  contributions     = [],
  // Phase 2 — dynamic pipeline data
  electionRaces     = [],
  darkMoneyFlows    = [],
  spendingFlows     = [],
  stockActTrades    = [],
  onStateClick,
  onBoundsChange,   // Phase 4: (bounds: {north,south,east,west}) => void
  theme,
  initialLayers,
  mapTheme          = 'dark',
  height,           // optional override for .deckgl-map-root height (px number)
}) {
  const rootRef    = useRef(null);
  const mapRef     = useRef(null);
  const overlayRef = useRef(null);
  const rebuildRef    = useRef(null);
  const rafRebuildRef = useRef(null);
  const mapThemeInitRef = useRef(false); // skip setStyle on initial render

  const dataRef = useRef({
    corruptionScores: {},
    gasPriceByState:  {},
    newsLocations:    [],
    contributions:    [],
    electionRaces:    [],
    darkMoneyFlows:   [],
    spendingFlows:    [],
    stockActTrades:   [],
    zoom:             3.5,
    choroplethMode:   'corruption',
    statesGeo:        null,
  });

  const [activeLayers,  setActiveLayers]  = useState({ ...DEFAULT_LAYERS, ...(initialLayers || {}) });
  const [currentView,   setCurrentView]   = useState('national');
  const [collapsed,     setCollapsed]     = useState(false);
  const [mapThemeState, setMapThemeState] = useState(mapTheme);
  const [statesGeo,     setStatesGeo]     = useState(null);

  const activeLayersRef  = useRef({ ...DEFAULT_LAYERS, ...(initialLayers || {}) });
  const pulseTimeRef     = useRef(Date.now());
  const pulseIntervalRef = useRef(null);
  const newsFirstSeenRef = useRef(new Map());
  const usedFallbackRef  = useRef(false);
  const buildLayersRef   = useRef(null);

  // ── Phase 3: Time-range filter state ──────────────────────────────────────
  const [timeRange, setTimeRange] = useState('all');
  const timeRangeRef = useRef('all');

  // ── Phase 3: Data freshness badge state ───────────────────────────────────
  const [freshnessSnap, setFreshnessSnap] = useState(null);
  const [freshExpanded, setFreshExpanded] = useState(false);

  // ── Sync props → dataRef, trigger RAF rebuild ──────────────────────────────

  useEffect(() => { dataRef.current.statesGeo = statesGeo; rafRebuildRef.current?.(); }, [statesGeo]);
  useEffect(() => { dataRef.current.corruptionScores = corruptionScores; rafRebuildRef.current?.(); }, [corruptionScores]);
  useEffect(() => { dataRef.current.gasPriceByState  = gasPriceByState;  rafRebuildRef.current?.(); }, [gasPriceByState]);

  useEffect(() => {
    const now = Date.now();
    newsLocations.forEach(n => { if (!newsFirstSeenRef.current.has(n.title)) newsFirstSeenRef.current.set(n.title, now); });
    for (const [k, t] of newsFirstSeenRef.current) { if (now - t > 60_000) newsFirstSeenRef.current.delete(k); }
    dataRef.current.newsLocations = newsLocations;
    rafRebuildRef.current?.();
  }, [newsLocations]);

  useEffect(() => { dataRef.current.contributions  = contributions;  rafRebuildRef.current?.(); }, [contributions]);
  useEffect(() => { dataRef.current.electionRaces  = electionRaces;  rafRebuildRef.current?.(); }, [electionRaces]);
  useEffect(() => { dataRef.current.darkMoneyFlows = darkMoneyFlows; rafRebuildRef.current?.(); }, [darkMoneyFlows]);
  useEffect(() => { dataRef.current.spendingFlows  = spendingFlows;  rafRebuildRef.current?.(); }, [spendingFlows]);
  useEffect(() => { dataRef.current.stockActTrades = stockActTrades; rafRebuildRef.current?.(); }, [stockActTrades]);
  useEffect(() => { activeLayersRef.current = activeLayers; rafRebuildRef.current?.(); }, [activeLayers]);

  // Sync timeRange → ref + trigger rebuild
  useEffect(() => {
    timeRangeRef.current = timeRange;
    rafRebuildRef.current?.();
  }, [timeRange]);

  // Poll DataFreshnessTracker every 30s for badge
  useEffect(() => {
    const tick = () => {
      try { setFreshnessSnap(freshnessTracker.getSnapshot()); } catch {}
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  // ── Pulse animation ────────────────────────────────────────────────────────
  useEffect(() => {
    const hasRecentNews = newsLocations.some(n => {
      const fs = newsFirstSeenRef.current.get(n.title);
      return fs && (Date.now() - fs) < 30_000;
    });
    if (hasRecentNews && !pulseIntervalRef.current) {
      pulseIntervalRef.current = setInterval(() => { pulseTimeRef.current = Date.now(); rafRebuildRef.current?.(); }, 500);
    } else if (!hasRecentNews && pulseIntervalRef.current) {
      clearInterval(pulseIntervalRef.current); pulseIntervalRef.current = null;
    }
  }, [newsLocations]);

  // ── Layer builder ──────────────────────────────────────────────────────────

  function buildLayers() {
    const layers = [];
    const al   = activeLayersRef.current;
    const d    = dataRef.current;
    const zoom = d.zoom || 3.5;

    const isVisible = (key) => { const th = LAYER_ZOOM_THRESHOLDS[key]; return !th || zoom >= th.minZoom; };

    // ── State choropleth ──────────────────────────────────────────────────
    if ((al.corruption || al.gasPrices) && d.statesGeo) {
      const mode = d.choroplethMode;
      layers.push(new GeoJsonLayer({
        id: 'states-choropleth',
        data: d.statesGeo,
        filled: true, stroked: true,
        getFillColor: (f) => {
          const abbr = f.properties?.abbreviation;
          if (!abbr) return [15, 20, 40, 50];
          return mode === 'gasPrices' ? gasPriceFill(d.gasPriceByState[abbr]) : corruptionFill(d.corruptionScores[abbr]);
        },
        getLineColor: [50, 70, 110, 120],
        getLineWidth: 1, lineWidthUnits: 'pixels', lineWidthMinPixels: 0.5,
        pickable: true,
        updateTriggers: { getFillColor: [d.choroplethMode, Object.keys(d.corruptionScores).length, Object.keys(d.gasPriceByState).length, d.statesGeo?.features?.length] },
      }));
    }

    // ── Pipelines ─────────────────────────────────────────────────────────
    if (al.pipelines) {
      layers.push(new PathLayer({
        id: 'pipelines-layer', data: OIL_PIPELINES,
        getPath: (d) => d.coordinates,
        getColor: (d) => d.type === 'crude' ? [255,120,40,190] : d.type === 'refined' ? [255,200,60,190] : d.type === 'natural gas' ? [80,200,255,190] : [180,180,180,160],
        getWidth: 2, widthMinPixels: 1, widthMaxPixels: 5, pickable: true,
      }));
    }

    // ── Railways ──────────────────────────────────────────────────────────
    if (al.railways && isVisible('railways')) {
      layers.push(new PathLayer({
        id: 'railways-layer', data: RAILWAYS,
        getPath: (d) => d.coordinates,
        getColor: (d) => d.type === 'passenger' ? [80,160,255,160] : [130,130,160,140],
        getWidth: 1.5, widthMinPixels: 1, widthMaxPixels: 3, pickable: true,
      }));
    }

    // ── Power grid ────────────────────────────────────────────────────────
    if (al.powerGrid && isVisible('powerGrid')) {
      layers.push(new PathLayer({
        id: 'power-grid-layer', data: POWER_GRID,
        getPath: (d) => d.coordinates, getColor: [240,220,50,160],
        getWidth: 1, widthMinPixels: 1, widthMaxPixels: 3, pickable: true,
      }));
    }

    // ── Data centers ──────────────────────────────────────────────────────
    if (al.dataCenters && isVisible('dataCenters')) {
      layers.push(new ScatterplotLayer({
        id: 'datacenters-layer', data: DATA_CENTERS,
        getPosition: (d) => [d.lon, d.lat],
        getRadius: (d) => d.type === 'hyperscale' ? 18000 : 12000,
        getFillColor: [80,200,255,180], getLineColor: [80,200,255,220],
        stroked: true, lineWidthMinPixels: 1, radiusMinPixels: 4, radiusMaxPixels: 14, pickable: true,
      }));
    }

    // ── Mountain ranges ───────────────────────────────────────────────────
    if (al.mountainRanges && isVisible('mountainRanges')) {
      const ranges = Array.isArray(MOUNTAIN_RANGES) ? MOUNTAIN_RANGES : [];
      if (ranges.length > 0) {
        layers.push(new PathLayer({
          id: 'mountain-ranges-layer', data: ranges,
          getPath: (d) => d.coordinates || d.path || d.points || [],
          getColor: [160,140,120,110], getWidth: 2, widthMinPixels: 1, widthMaxPixels: 4, pickable: false,
        }));
      }
    }

    // ── Cities ────────────────────────────────────────────────────────────
    if (al.cities && isVisible('cities')) {
      const cityArr = Array.isArray(US_CITIES) ? US_CITIES : [];
      const minPop  = zoom < 5 ? 500_000 : zoom < 6 ? 200_000 : 50_000;
      const filtered = cityArr.filter(c => (c.population || 0) >= minPop).slice(0, zoom < 5 ? 20 : 80);
      if (filtered.length > 0) {
        layers.push(new ScatterplotLayer({
          id: 'cities-dots', data: filtered,
          getPosition: (c) => [c.lon ?? c.lng ?? 0, c.lat ?? 0],
          getRadius: 3000, getFillColor: [200,210,230,160], radiusMinPixels: 2, radiusMaxPixels: 5, pickable: false,
        }));
        layers.push(new TextLayer({
          id: 'cities-labels', data: filtered.slice(0, 30),
          getPosition: (c) => [c.lon ?? c.lng ?? 0, c.lat ?? 0],
          getText: (c) => c.name ?? c.city ?? '',
          getSize: 11, getColor: [190,205,230,200], getPixelOffset: [0,14],
          fontFamily: "'IBM Plex Mono', system-ui, sans-serif", fontWeight: 500,
          background: true, getBackgroundColor: [8,12,28,160], backgroundPadding: [3,1,3,1], pickable: false,
        }));
      }
    }

    // ── News geo-locations ────────────────────────────────────────────────
    if (al.newsLocations && d.newsLocations.length > 0) {
      layers.push(new ScatterplotLayer({
        id: 'news-locations-layer', data: d.newsLocations,
        getPosition: (n) => [n.lon, n.lat],
        getRadius: 18000,
        getFillColor: (n) => { const rgb = THREAT_RGB[n.threatLevel] || THREAT_RGB.info; return [...rgb, 180]; },
        radiusMinPixels: 4, radiusMaxPixels: 14, pickable: true,
      }));
      const now = pulseTimeRef.current;
      const recent = d.newsLocations.filter(n => { const fs = newsFirstSeenRef.current.get(n.title); return fs && (now - fs) < 30_000; });
      if (recent.length > 0) {
        const pulse = 1.0 + 1.5 * (0.5 + 0.5 * Math.sin(now / 318));
        layers.push(new ScatterplotLayer({
          id: 'news-pulse-layer', data: recent,
          getPosition: (n) => [n.lon, n.lat],
          getRadius: 18000, radiusScale: pulse, radiusMinPixels: 6, radiusMaxPixels: 30,
          stroked: true, filled: false,
          getLineColor: (n) => { const rgb = THREAT_RGB[n.threatLevel] || THREAT_RGB.info; return [...rgb, 120]; },
          lineWidthMinPixels: 1.5, pickable: false, updateTriggers: { radiusScale: now },
        }));
      }
    }

    // ── PAC contributions — HeatmapLayer at low zoom, ArcLayer when zoomed in ──
    if (al.contributions && d.contributions.length > 0) {
      if (zoom < 5) {
        // Phase 4: HeatmapLayer — aggregate contribution density at national view
        layers.push(new HeatmapLayer({
          id: 'contribution-heat-layer', data: d.contributions,
          getPosition: (c) => [c.toLon, c.toLat],
          getWeight: (c) => Math.max(1, Math.log10(Math.max(1, c.amount || 1))),
          radiusPixels: 60,
          intensity: 1.2,
          threshold: 0.03,
          colorRange: [
            [255,255,178,0],
            [254,204, 92,120],
            [253,141, 60,160],
            [240, 59, 32,200],
            [189,  0, 38,255],
          ],
          updateTriggers: { getWeight: [d.contributions.length] },
        }));
      } else {
        // Zoomed in: show individual flow arcs
        layers.push(new ArcLayer({
          id: 'contribution-arcs-layer', data: d.contributions,
          getSourcePosition: (c) => [c.fromLon, c.fromLat],
          getTargetPosition: (c) => [c.toLon, c.toLat],
          getSourceColor: [255,200,50,150], getTargetColor: [255,80,80,150],
          getWidth: (c) => Math.max(1, Math.log2(Math.max(1, (c.amount || 1) / 10_000))),
          widthMinPixels: 1, widthMaxPixels: 6, greatCircle: false, pickable: true,
        }));
      }
    }

    // ── Phase 3: Election races (time-filtered + supercluster) ────────────
    if (al.electionRaces && d.electionRaces.length > 0) {
      const filtered = filterByTime(d.electionRaces, timeRangeRef.current);
      const { clusters: elClusters } = buildClusters(filtered, zoom);
      layers.push(new ScatterplotLayer({
        id: 'election-races-layer', data: elClusters,
        getPosition: (r) => [r.lon, r.lat],
        getRadius: (r) => r.cluster ? Math.max(22000, Math.sqrt(r.count) * 18000) : 22000,
        getFillColor: (r) => {
          if (r.cluster) return [168,85,247,200];
          const party = r.data?.party?.toLowerCase() || '';
          return party.includes('republican') ? [239,68,68,200] : party.includes('democrat') ? [59,130,246,200] : [200,200,80,200];
        },
        getLineColor: [255,255,255,80], stroked: true, lineWidthMinPixels: 1,
        radiusMinPixels: 5, radiusMaxPixels: 30, pickable: true,
        updateTriggers: { getFillColor: [timeRangeRef.current], getRadius: [zoom] },
      }));
      // Cluster count labels
      const clusterDots = elClusters.filter(c => c.cluster);
      if (clusterDots.length > 0) {
        layers.push(new TextLayer({
          id: 'election-cluster-labels', data: clusterDots,
          getPosition: (r) => [r.lon, r.lat],
          getText: (r) => String(r.count),
          getSize: 11, getColor: [255,255,255,230],
          fontFamily: "'IBM Plex Mono', sans-serif", fontWeight: 700,
          getTextAnchor: 'middle', getAlignmentBaseline: 'center', pickable: false,
        }));
      }
    }

    // ── Phase 2: Dark money flow arcs ─────────────────────────────────────
    if (al.darkMoneyFlows && d.darkMoneyFlows.length > 0) {
      layers.push(new ArcLayer({
        id: 'dark-money-arcs-layer', data: d.darkMoneyFlows,
        getSourcePosition: (a) => [a.fromLon, a.fromLat],
        getTargetPosition: (a) => [a.toLon, a.toLat],
        getSourceColor: [180,40,220,160], getTargetColor: [100,0,180,160],
        getWidth: (a) => Math.max(1, Math.log2(Math.max(1, (a.amount || 1) / 50_000))),
        widthMinPixels: 1, widthMaxPixels: 5, greatCircle: false, pickable: true,
      }));
    }

    // ── Phase 2: Federal spending flows (DC → states) ─────────────────────
    if (al.spendingFlows && d.spendingFlows.length > 0) {
      layers.push(new ArcLayer({
        id: 'spending-flows-layer', data: d.spendingFlows,
        getSourcePosition: (a) => [a.fromLon, a.fromLat],
        getTargetPosition: (a) => [a.toLon, a.toLat],
        getSourceColor: [50,200,100,140], getTargetColor: [100,240,160,140],
        getWidth: (a) => Math.max(1, Math.log2(Math.max(1, (a.amount || 1) / 100_000_000))),
        widthMinPixels: 1, widthMaxPixels: 5, greatCircle: false, pickable: true,
      }));
    }

    // ── Phase 3: STOCK Act trades (time-filtered + supercluster) ──────────
    if (al.stockActTrades && d.stockActTrades.length > 0) {
      const filtered = filterByTime(d.stockActTrades, timeRangeRef.current);
      const { clusters: stClusters } = buildClusters(filtered, zoom);
      layers.push(new ScatterplotLayer({
        id: 'stockact-trades-layer', data: stClusters,
        getPosition: (t) => [t.lon, t.lat],
        getRadius: (t) => t.cluster ? Math.max(15000, Math.sqrt(t.count) * 12000) : 15000,
        getFillColor: (t) => {
          if (t.cluster) return [134,239,172,200];
          return t.data?.action?.toLowerCase() === 'purchase' ? [50,200,100,200] : [239,68,68,200];
        },
        getLineColor: [255,255,255,80], stroked: true, lineWidthMinPixels: 1,
        radiusMinPixels: 4, radiusMaxPixels: 24, pickable: true,
        updateTriggers: { getFillColor: [timeRangeRef.current], getRadius: [zoom] },
      }));
      const clusterDots = stClusters.filter(c => c.cluster);
      if (clusterDots.length > 0) {
        layers.push(new TextLayer({
          id: 'stockact-cluster-labels', data: clusterDots,
          getPosition: (t) => [t.lon, t.lat],
          getText: (t) => String(t.count),
          getSize: 10, getColor: [10,20,40,230],
          fontFamily: "'IBM Plex Mono', sans-serif", fontWeight: 700,
          getTextAnchor: 'middle', getAlignmentBaseline: 'center', pickable: false,
        }));
      }
    }

    return layers;
  }

  buildLayersRef.current = buildLayers;

  // ── Tooltip ────────────────────────────────────────────────────────────────

  function getTooltip(info) {
    if (!info.object) return null;
    const obj = info.object;
    const lid = info.layer?.id || '';
    const d   = dataRef.current;

    if (lid === 'states-choropleth') {
      const abbr = obj.properties?.abbreviation, name = obj.properties?.name;
      const score = d.corruptionScores[abbr], gas = d.gasPriceByState[abbr];
      const mode  = d.choroplethMode;
      return { html: `<div class="deckgl-tooltip"><strong>${esc(name)}</strong> (${esc(abbr)})${score!=null?`<br/>Accountability: <strong style="color:${score>60?'#22c55e':score>35?'#f59e0b':'#ef4444'}">${score}/100</strong>`:''}${gas!=null?`<br/>⛽ $${gas.toFixed(2)}/gal`:''}</div>` };
    }
    if (lid === 'pipelines-layer') {
      return { html: `<div class="deckgl-tooltip"><strong>${esc(obj.name)}</strong><br/>${obj.type === 'crude' ? '🛢 Crude' : obj.type === 'natural gas' ? '🔥 Gas' : '⛽ Refined'}<br/><span style="opacity:.7">${esc(obj.operator)}</span></div>` };
    }
    if (lid === 'railways-layer') {
      return { html: `<div class="deckgl-tooltip"><strong>${esc(obj.name)}</strong><br/>${obj.type === 'passenger' ? '🚆 Passenger' : '🚂 Freight'} rail</div>` };
    }
    if (lid === 'power-grid-layer') {
      return { html: `<div class="deckgl-tooltip">⚡ <strong>${esc(obj.name || 'Power Line')}</strong><br/>${esc(obj.type || 'Transmission')}</div>` };
    }
    if (lid === 'datacenters-layer') {
      return { html: `<div class="deckgl-tooltip">🖥 <strong>${esc(obj.name)}</strong><br/>${esc(obj.type)} · ${esc(obj.state)}<br/><span style="opacity:.7">${esc(obj.capacity)}</span></div>` };
    }
    if (lid === 'news-locations-layer') {
      const c = obj.threatLevel === 'critical' ? '#ef4444' : obj.threatLevel === 'high' ? '#f97316' : obj.threatLevel === 'medium' ? '#eab308' : '#3b82f6';
      return { html: `<div class="deckgl-tooltip"><strong style="color:${c}">📰 ${esc(obj.threatLevel || 'news')}</strong><br/>${esc((obj.title||'').slice(0,90))}</div>` };
    }
    if (lid === 'contribution-arcs-layer') {
      return { html: `<div class="deckgl-tooltip">💰 <strong>${esc(obj.label || 'PAC Contribution')}</strong><br/>${fmtAmt(obj.amount)}</div>` };
    }
    if (lid === 'election-races-layer') {
      if (obj.cluster) return { html: `<div class="deckgl-tooltip">🗳 <strong style="color:#a855f7">${obj.count} races</strong><br/><span style="opacity:.7">Zoom in to expand</span></div>` };
      const item = obj.data || obj;
      const partyColor = item.party?.toLowerCase().includes('republican') ? '#ef4444' : item.party?.toLowerCase().includes('democrat') ? '#3b82f6' : '#aaa';
      return { html: `<div class="deckgl-tooltip">🗳 <strong style="color:${partyColor}">${esc(item.candidate)}</strong><br/>${esc(item.office)} · ${esc(item.state)}<br/><span style="opacity:.7">${esc(item.party)}</span></div>` };
    }
    if (lid === 'dark-money-arcs-layer') {
      return { html: `<div class="deckgl-tooltip">🕶 <strong>${esc(obj.label || 'Dark Money')}</strong><br/>${fmtAmt(obj.amount)}<br/><span style="opacity:.7">${esc(obj.type)}</span></div>` };
    }
    if (lid === 'spending-flows-layer') {
      return { html: `<div class="deckgl-tooltip">🏛 <strong>${esc(obj.label || 'Federal Spending')}</strong><br/>${fmtAmt(obj.amount)} → ${esc(obj.state)}</div>` };
    }
    if (lid === 'stockact-trades-layer') {
      if (obj.cluster) return { html: `<div class="deckgl-tooltip">📈 <strong style="color:#86efac">${obj.count} trades</strong><br/><span style="opacity:.7">Zoom in to expand</span></div>` };
      const item = obj.data || obj;
      const aColor = item.action?.toLowerCase() === 'purchase' ? '#22c55e' : '#ef4444';
      return { html: `<div class="deckgl-tooltip">📈 <strong>${esc(item.politician)}</strong><br/><span style="color:${aColor}">${esc(item.action)}</span> ${esc(item.ticker)}<br/>${fmtAmt(item.amount)} · ${esc(item.date)}</div>` };
    }
    return null;
  }

  // ── Click handler ──────────────────────────────────────────────────────────

  function handleClick(info) {
    if (!info.object) return;
    if (info.layer?.id === 'states-choropleth' && onStateClick) {
      const abbr = info.object.properties?.abbreviation;
      if (abbr) onStateClick(abbr);
    }
  }

  // ── MapLibre + deck.gl init ────────────────────────────────────────────────

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const canvasEl = root.querySelector('.deckgl-map-canvas');
    if (!canvasEl) return;

    // ── Cleanups collected inside useEffect so the return fn can reach them ──
    let cleanup = () => {};

    // ── Core init function — called once container has real dimensions ────────
    function initMap() {
      registerPMTilesProtocol();

      let map;
      try {
        map = new maplibregl.Map({
          container: canvasEl,
          style:     getStyleForTheme(mapThemeState, 'auto'),
          center:    VIEW_PRESETS.national.center,
          zoom:      VIEW_PRESETS.national.zoom,
          attributionControl:  false,
          renderWorldCopies:   false,
        });
      } catch (err) {
        console.warn('[DeckGLMap] Map constructor failed:', err.message);
        // Retry on next animation frame — container may still be settling
        const retryId = requestAnimationFrame(initMap);
        cleanup = () => cancelAnimationFrame(retryId);
        return;
      }

      mapRef.current = map;

    let tileLoadOk = false, tileErrCount = 0;
    const applyFallback = () => {
      if (usedFallbackRef.current) return;
      usedFallbackRef.current = true;
      // CARTO is primary; fall back to OpenFreeMap if it fails
      map.setStyle(mapThemeState === 'light' ? FALLBACK_LIGHT_STYLE : FALLBACK_DARK_STYLE);
      map.once('style.load', () => { try { map.triggerRepaint(); } catch {} });
    };
    map.on('error', (e) => {
      const msg = e.error?.message || '';
      if (msg.includes('fetch') || msg.includes('AJAXError') || msg.includes('403') || msg.includes('NetworkError')) {
        if (!tileLoadOk && ++tileErrCount >= 2) applyFallback();
      }
    });
    map.on('data', (e) => { if (e.dataType === 'source') tileLoadOk = true; });
    const fallbackTimer = setTimeout(() => { if (!tileLoadOk) applyFallback(); }, 10_000);

    const canvas = map.getCanvas();
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); });
    canvas.addEventListener('webglcontextrestored', () => map.triggerRepaint());

    let deckOverlay = null;
    map.once('load', () => {
      deckOverlay = new MapboxOverlay({
        interleaved: false, layers: [],
        getTooltip: (info) => getTooltip(info),
        onClick:    (info) => handleClick(info),
        pickingRadius: 8,
        useDevicePixels: window.devicePixelRatio > 2 ? 2 : true,
        onError: (err) => console.warn('[DeckGLMap]', err?.message),
      });
      overlayRef.current = deckOverlay;
      map.addControl(deckOverlay);
      // Kick-start MapLibre's render loop — in interleaved:false mode deck.gl
      // listens to map.on('render'); a forced repaint ensures the first frame fires.
      map.triggerRepaint();

      const rebuild = debounce(() => {
        if (!overlayRef.current) return;
        try { overlayRef.current.setProps({ layers: buildLayersRef.current() }); } catch {}
        map.triggerRepaint();
      }, 150);
      rebuildRef.current = rebuild;

      const rafRebuild = rafSchedule(() => {
        if (!overlayRef.current) return;
        try { overlayRef.current.setProps({ layers: buildLayersRef.current() }); } catch {}
        map.triggerRepaint();
      });
      rafRebuildRef.current = rafRebuild;
      rebuild();
    });

    // Phase 4: Tab-hide render pause — stop RAF+pulse when tab is hidden
    const handleVisibility = () => {
      if (document.hidden) {
        rebuildRef.current?.cancel?.();
        rafRebuildRef.current?.cancel?.();
        if (pulseIntervalRef.current) {
          clearInterval(pulseIntervalRef.current);
          pulseIntervalRef.current = null;
        }
      } else {
        // Tab visible again — force a full rebuild + repaint
        try { overlayRef.current?.setProps({ layers: buildLayersRef.current() }); } catch {}
        map.triggerRepaint();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Phase 4: Bounds tracking — fire onBoundsChange on every move/zoom
    const fireBounds = () => {
      dataRef.current.zoom = map.getZoom();
      rafRebuildRef.current?.();
      if (typeof onBoundsChange === 'function') {
        try {
          const b = map.getBounds();
          onBoundsChange({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() });
        } catch {}
      }
    };

    map.on('moveend', fireBounds);
    map.on('zoomend', fireBounds);

      cleanup = () => {
        mapThemeInitRef.current = false; // reset so remount (StrictMode) skips setStyle again
        clearTimeout(fallbackTimer);
        document.removeEventListener('visibilitychange', handleVisibility);
        rebuildRef.current?.cancel?.();
        rafRebuildRef.current?.cancel?.();
        if (pulseIntervalRef.current) { clearInterval(pulseIntervalRef.current); pulseIntervalRef.current = null; }
        deckOverlay?.finalize();
        try { map.remove(); } catch {}
        mapRef.current = overlayRef.current = null;
      };
    } // end initMap

    // Fix 1: guard against zero-size container (lazy + Suspense timing issue).
    // If the container already has real dimensions, init immediately.
    // Otherwise wait for the ResizeObserver to fire once it gets layout.
    if (canvasEl.offsetWidth > 0 && canvasEl.offsetHeight > 0) {
      initMap();
    } else {
      const ro = new ResizeObserver((entries) => {
        const rect = entries[0]?.contentRect;
        if (rect && rect.width > 0 && rect.height > 0) {
          ro.disconnect();
          initMap();
        }
      });
      ro.observe(canvasEl);
      cleanup = () => ro.disconnect();
    }

    return () => cleanup();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Skip the initial render — the map constructor already sets the correct style.
    // Only call setStyle() when the user explicitly toggles the theme.
    if (!mapThemeInitRef.current) { mapThemeInitRef.current = true; return; }
    if (!mapRef.current) return;
    usedFallbackRef.current = false; // allow fallback logic to re-trigger on new style
    mapRef.current.setStyle(getStyleForTheme(mapThemeState, 'auto'));
    // Re-push deck.gl layers after style finishes reloading
    mapRef.current.once('style.load', () => { rebuildRef.current?.(); });
  }, [mapThemeState]);

  // ── Load full US state boundaries from TopoJSON ────────────────────────────
  useEffect(() => {
    fetch('/data/us-states-10m.json')
      .then(r => r.json())
      .then(us => {
        const raw = topoFeature(us, us.objects.states);
        // Inject abbreviation from FIPS id so choropleth getFillColor can look up scores
        raw.features.forEach(f => {
          const fips = String(f.id ?? '').padStart(2, '0');
          f.properties = { ...f.properties, abbreviation: STATE_FIPS_TO_ABBR[fips] || '' };
        });
        setStatesGeo(raw);
        rafRebuildRef.current?.();
      })
      .catch(err => console.warn('[DeckGLMap] TopoJSON load failed:', err.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Map callbacks ──────────────────────────────────────────────────────────

  const flyToPreset = useCallback((key) => {
    const p = VIEW_PRESETS[key]; if (!p || !mapRef.current) return;
    setCurrentView(key); mapRef.current.flyTo({ center: p.center, zoom: p.zoom, duration: 800 });
  }, []);
  const zoomIn  = useCallback(() => mapRef.current?.zoomIn(),  []);
  const zoomOut = useCallback(() => mapRef.current?.zoomOut(), []);
  const toggleLayer = useCallback((key) => {
    setActiveLayers(prev => { const next = { ...prev, [key]: !prev[key] }; activeLayersRef.current = next; return next; });
  }, []);
  const setChoroplethMode = useCallback((mode) => {
    dataRef.current.choroplethMode = mode; rafRebuildRef.current?.(); setActiveLayers(prev => ({ ...prev }));
  }, []);
  const toggleMapTheme = useCallback(() => setMapThemeState(t => t === 'dark' ? 'light' : 'dark'), []);

  // ── Layer defs for UI ──────────────────────────────────────────────────────

  const LAYER_DEFS = [
    { key: 'corruption',     icon: '🔴', label: 'Accountability'  },
    { key: 'gasPrices',      icon: '⛽', label: 'Gas Prices'      },
    { key: 'pipelines',      icon: '🛢', label: 'Pipelines'       },
    { key: 'railways',       icon: '🚂', label: 'Railways'        },
    { key: 'powerGrid',      icon: '⚡', label: 'Power Grid'      },
    { key: 'dataCenters',    icon: '🖥', label: 'Data Centers'    },
    { key: 'mountainRanges', icon: '⛰', label: 'Mountains'       },
    { key: 'cities',         icon: '🏙', label: 'Cities'          },
    { key: 'newsLocations',  icon: '📰', label: 'News Locations'  },
    { key: 'contributions',  icon: '💰', label: 'PAC Flows'       },
    { key: 'electionRaces',  icon: '🗳', label: 'Election Races'  },
    { key: 'darkMoneyFlows', icon: '🕶', label: 'Dark Money'      },
    { key: 'spendingFlows',  icon: '🏛', label: 'Fed Spending'    },
    { key: 'stockActTrades', icon: '📈', label: 'STOCK Act'       },
  ];

  const choroplethMode = dataRef.current.choroplethMode;
  const showChoropleth = activeLayers.corruption || activeLayers.gasPrices;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="deckgl-map-root" ref={rootRef} style={height ? { height } : undefined}>
      <div className="deckgl-map-canvas" />

      {/* Zoom + view controls */}
      <div className="deckgl-controls">
        <button className="deckgl-btn" onClick={zoomIn}  title="Zoom in">+</button>
        <button className="deckgl-btn" onClick={zoomOut} title="Zoom out">−</button>
        <button className="deckgl-btn" onClick={() => flyToPreset('national')} title="National view">⌂</button>
        <button className="deckgl-btn" onClick={toggleMapTheme} title="Toggle basemap theme" style={{ fontSize: 13 }}>
          {mapThemeState === 'dark' ? '☀' : '🌙'}
        </button>
        <div className="deckgl-view-sep" />
        <select className="deckgl-view-select" value={currentView} onChange={e => flyToPreset(e.target.value)}>
          <option value="national">🇺🇸 National</option>
          <option value="east">East Coast</option>
          <option value="west">West Coast</option>
          <option value="midwest">Midwest</option>
          <option value="south">South</option>
          <option value="alaska">Alaska</option>
          <option value="hawaii">Hawaii</option>
        </select>
      </div>

      {/* Layer toggles */}
      <div className="deckgl-layer-toggles">
        <div className="deckgl-toggle-header" onClick={() => setCollapsed(c => !c)}>
          <span>LAYERS</span>
          <span style={{ fontSize: 10, opacity: 0.7 }}>{collapsed ? '▶' : '▼'}</span>
        </div>
        <div className={`deckgl-toggle-list${collapsed ? ' collapsed' : ''}`}>
          {LAYER_DEFS.map(({ key, icon, label }) => (
            <label key={key} className={`deckgl-toggle-item${activeLayers[key] ? ' active' : ''}`}>
              <input type="checkbox" checked={!!activeLayers[key]} onChange={() => toggleLayer(key)} />
              <span className="deckgl-toggle-icon">{icon}</span>
              <span className="deckgl-toggle-label">{label}</span>
            </label>
          ))}
        </div>
        {showChoropleth && !collapsed && (
          <div className="deckgl-choropleth-selector">
            <button className={`deckgl-choropleth-btn${choroplethMode === 'corruption' ? ' active' : ''}`} onClick={() => setChoroplethMode('corruption')}>ACCOUNTABILITY</button>
            <button className={`deckgl-choropleth-btn${choroplethMode === 'gasPrices'  ? ' active' : ''}`} onClick={() => setChoroplethMode('gasPrices')}>GAS PRICE</button>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="deckgl-legend">
        {showChoropleth && choroplethMode === 'corruption' && (
          <div className="deckgl-legend-section">
            <div className="deckgl-legend-title">ACCOUNTABILITY SCORE</div>
            <div className="deckgl-legend-gradient" style={{ background: 'linear-gradient(to right, #dc3c3c, #e08840, #22c55e)' }} />
            <div className="deckgl-legend-labels"><span>Corrupt (0)</span><span>Clean (100)</span></div>
          </div>
        )}
        {showChoropleth && choroplethMode === 'gasPrices' && (
          <div className="deckgl-legend-section">
            <div className="deckgl-legend-title">GAS PRICE ($/GAL)</div>
            <div className="deckgl-legend-gradient" style={{ background: 'linear-gradient(to right, #28c828, #c8c820, #f03232)' }} />
            <div className="deckgl-legend-labels"><span>$2.50</span><span>$5.50</span></div>
          </div>
        )}
        <div className="deckgl-legend-items">
          {activeLayers.pipelines      && <span className="deckgl-legend-item"><span style={{ background: '#ff7828', borderRadius: 2 }} />Pipelines</span>}
          {activeLayers.powerGrid      && <span className="deckgl-legend-item"><span style={{ background: '#f0dc32' }} />Power Grid</span>}
          {activeLayers.railways       && <span className="deckgl-legend-item"><span style={{ background: '#50a0ff' }} />Railways</span>}
          {activeLayers.dataCenters    && <span className="deckgl-legend-item"><span style={{ background: '#50c8ff' }} />Data Centers</span>}
          {activeLayers.newsLocations  && <span className="deckgl-legend-item"><span style={{ background: '#ef4444' }} />News Events</span>}
          {activeLayers.contributions  && <span className="deckgl-legend-item"><span style={{ background: '#ffc832', borderRadius: 0, height: 3, width: 16, display: 'inline-block' }} />PAC Flows</span>}
          {activeLayers.electionRaces  && <span className="deckgl-legend-item"><span style={{ background: '#a855f7' }} />Elections</span>}
          {activeLayers.darkMoneyFlows && <span className="deckgl-legend-item"><span style={{ background: '#7c3aed', borderRadius: 0, height: 3, width: 16, display: 'inline-block' }} />Dark Money</span>}
          {activeLayers.spendingFlows  && <span className="deckgl-legend-item"><span style={{ background: '#22c55e', borderRadius: 0, height: 3, width: 16, display: 'inline-block' }} />Fed Spending</span>}
          {activeLayers.stockActTrades && <span className="deckgl-legend-item"><span style={{ background: '#86efac' }} />STOCK Act</span>}
        </div>
      </div>

      {/* ── Time-range filter toolbar (bottom-center) ─────────────────── */}
      <div className="deckgl-timerange">
        {['1h','6h','24h','7d','all'].map(r => (
          <button
            key={r}
            className={`deckgl-timerange-btn${timeRange === r ? ' active' : ''}`}
            onClick={() => setTimeRange(r)}
          >
            {r === 'all' ? 'ALL' : r.toUpperCase()}
          </button>
        ))}
      </div>

      {/* ── Data freshness badge (bottom-left) ───────────────────────── */}
      {freshnessSnap && Object.keys(freshnessSnap).length > 0 && (() => {
        const entries = Object.values(freshnessSnap);
        const fresh     = entries.filter(e => e.currentStatus === 'fresh').length;
        const stale     = entries.filter(e => e.currentStatus === 'stale' || e.currentStatus === 'very_stale').length;
        const errors    = entries.filter(e => e.currentStatus === 'error' || e.currentStatus === 'no_data').length;
        const dotColor  = errors > 0 ? '#ef4444' : stale > 0 ? '#f59e0b' : '#22c55e';
        return (
          <div className="deckgl-freshness-badge" onClick={() => setFreshExpanded(x => !x)}>
            <span className="deckgl-freshness-dot" style={{ background: dotColor }} />
            <span className="deckgl-freshness-label">DATA {fresh}/{entries.length}</span>
            {freshExpanded && (
              <div className="deckgl-freshness-panel">
                <div className="deckgl-freshness-panel-title">DATA SOURCE STATUS</div>
                {Object.entries(freshnessSnap).map(([key, e]) => {
                  const sc = e.currentStatus === 'fresh' ? '#22c55e' : e.currentStatus === 'stale' ? '#f59e0b' : e.currentStatus === 'very_stale' ? '#f97316' : '#ef4444';
                  return (
                    <div key={key} className="deckgl-freshness-row">
                      <span style={{ color: sc }}>●</span>
                      <span className="deckgl-freshness-key">{key.replace(/:v\d+$/, '')}</span>
                      <span className="deckgl-freshness-age" style={{ color: sc }}>
                        {e.currentStatus}{e.ageMinutes != null ? ` · ${e.ageMinutes}m ago` : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Attribution */}
      <div className="deckgl-attribution">
        © <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a>
        {' · '}
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
      </div>
    </div>
  );
}
