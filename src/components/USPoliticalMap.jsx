/**
 * US Political Map Component
 * Interactive D3 map with infrastructure layers, zoom controls, and layer toggles
 * Modeled after World Monitor's Map.ts pattern
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import OIL_PIPELINES from '../data/pipelines';
import RAILWAYS from '../data/railways';
import POWER_GRID from '../data/powerGrid';
import { STATE_ECONOMICS } from '../data/stateEconomics';
import { DATA_CENTERS, STATE_FIPS_TO_ABBR } from '../data/geo';

const LAYER_DEFS = [
  { id: 'corruption',   name: '🔴 Corruption' },
  { id: 'gdpEconomy',   name: '💰 GDP/Economy' },
  { id: 'oilPipelines', name: '🛢️ Oil Pipelines' },
  { id: 'dataCenters',  name: '🖥️ Data Centers' },
  { id: 'railways',     name: '🚂 Railways' },
  { id: 'stateDebt',    name: '📊 State Debt' },
  { id: 'population',   name: '👥 Population' },
  { id: 'powerGrid',    name: '⚡ Power Grid' },
  { id: 'agriculture',  name: '🌾 Agriculture' },
];

const INIT_LAYERS = {
  corruption:   true,
  oilPipelines: false,
  dataCenters:  true,
  railways:     false,
  gdpEconomy:   false,
  stateDebt:    false,
  population:   false,
  powerGrid:    false,
  agriculture:  false,
};

// Simplified state centroids for population circles
const STATE_CENTROIDS = {
  CA: [-119.4179, 36.7783], TX: [-99.9018, 31.9686], FL: [-81.5158, 27.6648],
  NY: [-75.4652, 42.6526], IL: [-89.3985, 40.6331], PA: [-77.1945, 41.2033],
  OH: [-82.9071, 40.4173], GA: [-83.6431, 32.1656], NC: [-79.8064, 35.7596],
  MI: [-85.6024, 44.3148], WA: [-120.7401, 47.7511], AZ: [-111.0937, 34.0489],
  CO: [-105.7821, 39.5501], MA: [-71.5301, 42.2302], TN: [-86.5804, 35.7478],
  MN: [-94.6859, 46.7296], NJ: [-74.4057, 40.0583], WI: [-89.6165, 44.2685],
  MO: [-91.8318, 37.9643], VA: [-79.0193, 37.4316],
};

const USPoliticalMap = ({ onStateClick, theme, corruptionScores = {} }) => {
  const svgRef       = useRef(null);
  const containerRef = useRef(null);
  const zoomRef      = useRef(null);
  const topoRef      = useRef(null);

  const [activeLayers, setActiveLayers] = useState(INIT_LAYERS);
  const [timeRange,    setTimeRange]    = useState('ALL');
  const [ready,        setReady]        = useState(false);

  // ── Helper: toggle a layer checkbox ───────────────────────────────────────
  const toggleLayer = useCallback((id, checked) => {
    setActiveLayers(prev => ({ ...prev, [id]: checked }));
  }, []);

  // ── Load TopoJSON once ────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/data/us-states-10m.json')
      .then(r => r.json())
      .then(us => { topoRef.current = us; setReady(true); })
      .catch(err => { console.error('TopoJSON load error:', err); setReady(true); });
  }, []);

  // ── Draw / redraw whenever layers, timeRange, or theme change ─────────────
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width  = containerRef.current.clientWidth  || 900;
    const height = 520;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height)
       .style('background', theme.card);

    const projection = d3.geoAlbersUsa()
      .translate([width / 2, height / 2])
      .scale(width * 0.8);

    const path = d3.geoPath().projection(projection);

    // Zoom behaviour
    const zoom = d3.zoom()
      .scaleExtent([1, 8])
      .on('zoom', (e) => g.attr('transform', e.transform));
    zoomRef.current = zoom;
    svg.call(zoom);

    const g = svg.append('g').attr('class', 'zoomable');

    // ── Draw states ──────────────────────────────────────────────────────────
    if (topoRef.current) {
      const states = feature(topoRef.current, topoRef.current.objects.states).features;

      g.selectAll('path.state')
        .data(states)
        .join('path')
        .attr('class', 'state')
        .attr('d', path)
        .attr('fill', d => {
          // The census TopoJSON uses numeric FIPS in d.id
          const fips = String(d.id).padStart(2, '0');
          const abbr = STATE_FIPS_TO_ABBR[fips];
          const eco  = abbr ? STATE_ECONOMICS[abbr] : null;

          // Corruption choropleth — lower score = more corrupt = red
          if (activeLayers.corruption && abbr && corruptionScores[abbr] != null) {
            const score = corruptionScores[abbr]; // 0–100, lower = worse
            return d3.interpolateRdYlGn(score / 100);
          }
          if (eco && activeLayers.gdpEconomy) {
            const maxGdp = 3600000;
            return d3.interpolateRdYlGn(1 - (eco.gdp / maxGdp) * 0.8);
          }
          if (eco && activeLayers.stateDebt) {
            const ratio = Math.min((eco.debt / eco.gdp) * 8, 1);
            return d3.interpolateRdBu(1 - ratio);
          }
          if (eco && activeLayers.agriculture) {
            const maxAg = 60000;
            return d3.interpolateGreens((eco.agriculturalOutput / maxAg) * 0.85);
          }
          return theme.cardB || '#1e2330';
        })
        .attr('stroke',       theme.border)
        .attr('stroke-width', 0.5)
        .on('mouseover', function () {
          d3.select(this).attr('stroke', theme.accent).attr('stroke-width', 2);
        })
        .on('mouseout', function () {
          d3.select(this).attr('stroke', theme.border).attr('stroke-width', 0.5);
        })
        .on('click', (event, d) => {
          const fips = String(d.id).padStart(2, '0');
          const abbr = STATE_FIPS_TO_ABBR[fips];
          if (abbr && onStateClick) onStateClick(abbr);
          // Highlight
          g.selectAll('path.state')
            .attr('stroke', theme.border).attr('stroke-width', 0.5);
          d3.select(event.currentTarget)
            .attr('stroke', theme.accent).attr('stroke-width', 2.5);
        });
    } else {
      // Fallback placeholder while TopoJSON is loading
      g.append('rect')
        .attr('x', width * 0.1).attr('y', height * 0.25)
        .attr('width', width * 0.8).attr('height', height * 0.5)
        .attr('fill', theme.cardB || '#1e2330')
        .attr('rx', 6);
      g.append('text')
        .attr('x', width / 2).attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', theme.mid)
        .style('font-family', "'IBM Plex Mono', monospace")
        .style('font-size', '13px')
        .text('Loading US map…');
    }

    // ── Infrastructure layers ─────────────────────────────────────────────────
    const projPoint = coords => {
      const p = projection(coords);
      return p ? p : null;
    };

    if (activeLayers.oilPipelines) {
      OIL_PIPELINES.forEach(pl => {
        const lineGen = d3.line()
          .x(d => { const p = projPoint(d); return p ? p[0] : 0; })
          .y(d => { const p = projPoint(d); return p ? p[1] : 0; })
          .defined(d => projPoint(d) !== null);
        g.append('path')
          .datum(pl.coordinates)
          .attr('d', lineGen)
          .attr('fill', 'none')
          .attr('stroke', theme.accent)
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '5,3')
          .attr('opacity', 0.65);
      });
    }

    if (activeLayers.dataCenters) {
      DATA_CENTERS.forEach(dc => {
        const p = projection([dc.lon, dc.lat]);
        if (!p) return;
        g.append('circle')
          .attr('cx', p[0]).attr('cy', p[1]).attr('r', 4)
          .attr('fill', theme.blue || '#4A7FFF')
          .attr('stroke', theme.card).attr('stroke-width', 1)
          .attr('opacity', 0.85);
      });
    }

    if (activeLayers.railways) {
      RAILWAYS.forEach(rw => {
        const lineGen = d3.line()
          .x(d => { const p = projPoint(d); return p ? p[0] : 0; })
          .y(d => { const p = projPoint(d); return p ? p[1] : 0; })
          .defined(d => projPoint(d) !== null);
        g.append('path')
          .datum(rw.coordinates)
          .attr('d', lineGen)
          .attr('fill', 'none')
          .attr('stroke', theme.mid)
          .attr('stroke-width', 0.8)
          .attr('opacity', 0.5);
      });
    }

    if (activeLayers.powerGrid) {
      POWER_GRID.forEach(ln => {
        const lineGen = d3.line()
          .x(d => { const p = projPoint(d); return p ? p[0] : 0; })
          .y(d => { const p = projPoint(d); return p ? p[1] : 0; })
          .defined(d => projPoint(d) !== null);
        g.append('path')
          .datum(ln.coordinates)
          .attr('d', lineGen)
          .attr('fill', 'none')
          .attr('stroke', theme.warn || '#FF8000')
          .attr('stroke-width', 0.8)
          .attr('stroke-dasharray', '3,2')
          .attr('opacity', 0.5);
      });
    }

    if (activeLayers.population) {
      Object.entries(STATE_CENTROIDS).forEach(([abbr, coords]) => {
        const eco = STATE_ECONOMICS[abbr];
        if (!eco) return;
        const p = projection(coords);
        if (!p) return;
        const r = Math.sqrt(eco.population / 1e6) * 2.5;
        g.append('circle')
          .attr('cx', p[0]).attr('cy', p[1]).attr('r', r)
          .attr('fill', theme.blue || '#4A7FFF')
          .attr('fill-opacity', 0.25)
          .attr('stroke', theme.blue || '#4A7FFF')
          .attr('stroke-width', 0.5);
      });
    }

    // ── Zoom controls (top-left, outside zoomable g) ──────────────────────────
    const ctrl = svg.append('g').attr('transform', 'translate(16, 16)');
    [
      { y: 0,  label: '+', action: () => svg.transition().call(zoom.scaleBy, 1.5) },
      { y: 34, label: '−', action: () => svg.transition().call(zoom.scaleBy, 0.67) },
      { y: 68, label: '⟲', action: () => svg.transition().call(zoom.transform, d3.zoomIdentity) },
    ].forEach(btn => {
      ctrl.append('rect')
        .attr('y', btn.y).attr('width', 28).attr('height', 28)
        .attr('fill', theme.card).attr('stroke', theme.border).attr('rx', 4)
        .style('cursor', 'pointer')
        .on('click', btn.action);
      ctrl.append('text')
        .attr('x', 14).attr('y', btn.y + 18)
        .attr('text-anchor', 'middle')
        .attr('fill', theme.hi)
        .style('font-family', "'IBM Plex Mono', monospace").style('font-size', '14px')
        .style('pointer-events', 'none')
        .text(btn.label);
    });

    // ── Legend (bottom-right) ──────────────────────────────────────────────────
    // Height grows by ~28px when corruption gradient bar is shown
    const showGradient = activeLayers.corruption;
    const LW = 160;
    const LH = showGradient ? 136 : 108;
    const leg = svg.append('g').attr('transform', `translate(${width - LW - 12}, ${height - LH - 12})`);
    leg.append('rect').attr('width', LW).attr('height', LH)
      .attr('fill', theme.card).attr('stroke', theme.border).attr('rx', 4).attr('opacity', 0.95);
    leg.append('text').attr('x', 8).attr('y', 18)
      .attr('fill', theme.accent).style('font-family', "'IBM Plex Mono',monospace").style('font-size', '9px')
      .style('letter-spacing', '1.5px').text('LEGEND');

    // Corruption gradient bar — only shown when corruption layer is ON
    if (showGradient) {
      // Build a linear gradient definition
      const gradId = 'corr-legend-grad';
      const defs = svg.append('defs');
      const grad = defs.append('linearGradient')
        .attr('id', gradId).attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '0%');
      // d3.interpolateRdYlGn: 0 = red (high risk), 1 = green (low risk)
      [0, 0.25, 0.5, 0.75, 1].forEach(t => {
        grad.append('stop')
          .attr('offset', `${t * 100}%`)
          .attr('stop-color', d3.interpolateRdYlGn(t));
      });

      // Gradient rect
      leg.append('rect')
        .attr('x', 8).attr('y', 26).attr('width', LW - 16).attr('height', 12)
        .attr('rx', 2)
        .attr('fill', `url(#${gradId})`);

      // Labels below gradient
      leg.append('text').attr('x', 8).attr('y', 50)
        .attr('fill', theme.low).style('font-family', "'IBM Plex Mono',monospace").style('font-size', '7.5px')
        .text('High Risk');
      leg.append('text').attr('x', LW - 8).attr('y', 50)
        .attr('text-anchor', 'end')
        .attr('fill', theme.low).style('font-family', "'IBM Plex Mono',monospace").style('font-size', '7.5px')
        .text('Low Risk');
      leg.append('text').attr('x', LW / 2).attr('y', 50)
        .attr('text-anchor', 'middle')
        .attr('fill', theme.low).style('font-family', "'IBM Plex Mono',monospace").style('font-size', '7.5px')
        .text('50');

      // Separator line
      leg.append('line')
        .attr('x1', 8).attr('y1', 56).attr('x2', LW - 8).attr('y2', 56)
        .attr('stroke', theme.border).attr('stroke-width', 0.5);

      // Remaining layer items shifted down by 28px
      [
        { label: '🛢️ Oil Pipelines', color: theme.accent,           y: 72 },
        { label: '🖥️ Data Centers',  color: theme.blue || '#4A7FFF', y: 88 },
        { label: '🚂 Railways',      color: theme.mid,               y: 104 },
        { label: '⚡ Power Grid',    color: theme.warn || '#FF8000', y: 120 },
      ].forEach(item => {
        leg.append('circle').attr('cx', 12).attr('cy', item.y - 4).attr('r', 4).attr('fill', item.color);
        leg.append('text').attr('x', 22).attr('y', item.y)
          .attr('fill', theme.mid).style('font-family', "'IBM Plex Mono',monospace").style('font-size', '9px')
          .text(item.label);
      });
    } else {
      // Standard dot legend when corruption layer is off
      [
        { label: '🔴 Corruption',    color: '#ff4444',              y: 34 },
        { label: '🛢️ Oil Pipelines', color: theme.accent,           y: 50 },
        { label: '🖥️ Data Centers',  color: theme.blue || '#4A7FFF', y: 66 },
        { label: '🚂 Railways',      color: theme.mid,               y: 82 },
        { label: '⚡ Power Grid',    color: theme.warn || '#FF8000', y: 98 },
      ].forEach(item => {
        leg.append('circle').attr('cx', 12).attr('cy', item.y - 4).attr('r', 4).attr('fill', item.color);
        leg.append('text').attr('x', 22).attr('y', item.y)
          .attr('fill', theme.mid).style('font-family', "'IBM Plex Mono',monospace").style('font-size', '9px')
          .text(item.label);
      });
    }

    // ── Time-range buttons (bottom-center) ────────────────────────────────────
    const TR_W = 160, TR_H = 48;
    const tr = svg.append('g').attr('transform', `translate(${(width - TR_W) / 2}, ${height - TR_H - 12})`);
    tr.append('rect').attr('width', TR_W).attr('height', TR_H)
      .attr('fill', theme.card).attr('stroke', theme.border).attr('rx', 4).attr('opacity', 0.95);
    tr.append('text').attr('x', 8).attr('y', 16)
      .attr('fill', theme.accent).style('font-family', "'IBM Plex Mono',monospace").style('font-size', '9px')
      .style('letter-spacing', '1.5px').text('TIME RANGE');
    ['1Y', '2Y', '5Y', 'ALL'].forEach((range, i) => {
      const bx = 4 + i * 38;
      const active = timeRange === range;
      tr.append('rect')
        .attr('x', bx).attr('y', 24).attr('width', 34).attr('height', 18)
        .attr('fill', active ? theme.accent : (theme.cardB || '#1e2330'))
        .attr('stroke', theme.border).attr('rx', 3)
        .style('cursor', 'pointer')
        .on('click', () => setTimeRange(range));
      tr.append('text')
        .attr('x', bx + 17).attr('y', 36).attr('text-anchor', 'middle')
        .attr('fill', active ? '#fff' : theme.hi)
        .style('font-family', "'IBM Plex Mono',monospace").style('font-size', '9px')
        .style('pointer-events', 'none')
        .text(range);
    });

  }, [activeLayers, timeRange, theme, ready, onStateClick, corruptionScores]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <svg ref={svgRef} style={{ width: '100%', height: 520, display: 'block' }} />

      {/* Layer toggles — rendered via React so state updates work cleanly */}
      <div style={{
        position: 'absolute',
        left: 16,
        bottom: 16,
        background: theme.card,
        border: `1px solid ${theme.border}`,
        borderRadius: 4,
        padding: '10px 14px',
        opacity: 0.95,
        minWidth: 170,
      }}>
        <div style={{
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 9,
          color: theme.accent,
          letterSpacing: '1.5px',
          marginBottom: 8,
        }}>LAYER TOGGLES</div>
        {LAYER_DEFS.map(layer => (
          <label key={layer.id} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            marginBottom: 5,
            cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={activeLayers[layer.id]}
              onChange={e => toggleLayer(layer.id, e.target.checked)}
              style={{ cursor: 'pointer', accentColor: theme.accent }}
            />
            <span style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 10,
              color: theme.mid,
            }}>{layer.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default USPoliticalMap;
