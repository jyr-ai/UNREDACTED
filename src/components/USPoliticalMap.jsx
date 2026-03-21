/**
 * USPoliticalMap.jsx  — Enhanced with:
 *  • 50 state capitals (★, always visible)
 *  • ~40 tier-1 metros (zoom ≥ 2)
 *  • ~110 tier-2 regional cities (zoom ≥ 3.5)
 *  • ⛰️ Mountain range terrain lines
 *  • ⛽ Gas price choropleth + city-pinned price badges
 *  • GasPricePanel sidebar on city click
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { feature } from 'topojson-client'
import OIL_PIPELINES   from '../data/pipelines'
import RAILWAYS        from '../data/railways'
import POWER_GRID      from '../data/powerGrid'
import { STATE_ECONOMICS }       from '../data/stateEconomics'
import { DATA_CENTERS, STATE_FIPS_TO_ABBR } from '../data/geo'
import US_CITIES, { getCitiesForZoom } from '../data/usCities'
import MOUNTAIN_RANGES from '../data/mountainRanges'
import { gasPrices as gasPricesApi } from '../api/client.js'
import GasPricePanel from './GasPricePanel.jsx'

// ── Layer definitions ────────────────────────────────────────────────────────
const LAYER_DEFS = [
  { id: 'corruption',   name: '🔴 Corruption'    },
  { id: 'gdpEconomy',   name: '💰 GDP/Economy'   },
  { id: 'oilPipelines', name: '🛢️ Oil Pipelines' },
  { id: 'dataCenters',  name: '🖥️ Data Centers'  },
  { id: 'railways',     name: '🚂 Railways'       },
  { id: 'stateDebt',    name: '📊 State Debt'     },
  { id: 'population',   name: '👥 Population'     },
  { id: 'powerGrid',    name: '⚡ Power Grid'     },
  { id: 'agriculture',  name: '🌾 Agriculture'    },
  { id: 'gasPrices',    name: '⛽ Gas Prices'     },
  { id: 'cities',       name: '🏙️ Cities'        },
  { id: 'terrain',      name: '⛰️ Terrain'       },
]

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
  gasPrices:    false,
  cities:       true,
  terrain:      false,
}

// Simplified state centroids (population layer)
const STATE_CENTROIDS = {
  CA: [-119.4179, 36.7783], TX: [-99.9018, 31.9686], FL: [-81.5158, 27.6648],
  NY: [-75.4652, 42.6526], IL: [-89.3985, 40.6331], PA: [-77.1945, 41.2033],
  OH: [-82.9071, 40.4173], GA: [-83.6431, 32.1656], NC: [-79.8064, 35.7596],
  MI: [-85.6024, 44.3148], WA: [-120.7401, 47.7511], AZ: [-111.0937, 34.0489],
  CO: [-105.7821, 39.5501], MA: [-71.5301, 42.2302], TN: [-86.5804, 35.7478],
  MN: [-94.6859, 46.7296], NJ: [-74.4057, 40.0583], WI: [-89.6165, 44.2685],
  MO: [-91.8318, 37.9643], VA: [-79.0193, 37.4316],
}

// ── Component ────────────────────────────────────────────────────────────────
const USPoliticalMap = ({ onStateClick, theme, corruptionScores = {} }) => {
  const svgRef       = useRef(null)
  const containerRef = useRef(null)
  const zoomRef      = useRef(null)
  const topoRef      = useRef(null)
  const projRef      = useRef(null)

  const [activeLayers, setActiveLayers] = useState(INIT_LAYERS)
  const [timeRange,    setTimeRange]    = useState('ALL')
  const [ready,        setReady]        = useState(false)
  const [zoomScale,    setZoomScale]    = useState(1)

  // Gas price data
  const [gasData,      setGasData]      = useState(null)   // { prices, updatedAt, source }
  const [gasLoading,   setGasLoading]   = useState(false)

  // GasPricePanel state
  const [gasPanel,     setGasPanel]     = useState(null)   // { cityName, stateCode }

  const toggleLayer = useCallback((id, checked) => {
    setActiveLayers(prev => ({ ...prev, [id]: checked }))
  }, [])

  // Fetch gas prices when gas layer is turned on
  useEffect(() => {
    if (activeLayers.gasPrices && !gasData && !gasLoading) {
      setGasLoading(true)
      gasPricesApi.states()
        .then(d => { setGasData(d); setGasLoading(false) })
        .catch(() => { setGasLoading(false) })
    }
  }, [activeLayers.gasPrices, gasData, gasLoading])

  // Load TopoJSON once
  useEffect(() => {
    fetch('/data/us-states-10m.json')
      .then(r => r.json())
      .then(us => { topoRef.current = us; setReady(true) })
      .catch(() => setReady(true))
  }, [])

  // Gas price color scale helper (green→yellow→red)
  const gasPriceScale = useCallback((prices) => {
    if (!prices) return null
    const vals  = Object.values(prices)
    const minP  = Math.min(...vals)
    const maxP  = Math.max(...vals)
    return d3.scaleSequential()
      .domain([minP, maxP])
      .interpolator(d3.interpolateRgbBasis(['#22c55e', '#eab308', '#ef4444']))
  }, [])

  // ── Draw / redraw ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return

    const width  = containerRef.current.clientWidth || 900
    const height = 520

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', width).attr('height', height).style('background', theme.card)

    const projection = d3.geoAlbersUsa()
      .translate([width / 2, height / 2])
      .scale(width * 0.8)
    projRef.current = projection

    const path = d3.geoPath().projection(projection)

    // Zoom behaviour
    const zoom = d3.zoom()
      .scaleExtent([1, 10])
      .on('zoom', (e) => {
        g.attr('transform', e.transform)
        const k = e.transform.k
        setZoomScale(k)
        updateCityVisibility(k)
      })
    zoomRef.current = zoom
    svg.call(zoom)

    const g = svg.append('g').attr('class', 'zoomable')

    const colorScale = gasData?.prices
      ? gasPriceScale(gasData.prices)
      : null

    // ── States ──────────────────────────────────────────────────────────────
    if (topoRef.current) {
      const states = feature(topoRef.current, topoRef.current.objects.states).features

      g.selectAll('path.state')
        .data(states)
        .join('path')
        .attr('class', 'state')
        .attr('d', path)
        .attr('fill', d => {
          const fips = String(d.id).padStart(2, '0')
          const abbr = STATE_FIPS_TO_ABBR[fips]
          const eco  = abbr ? STATE_ECONOMICS[abbr] : null

          // Gas price choropleth takes priority when active
          if (activeLayers.gasPrices && colorScale && abbr && gasData?.prices?.[abbr]) {
            return colorScale(gasData.prices[abbr])
          }
          if (activeLayers.corruption && abbr && corruptionScores[abbr] != null) {
            return d3.interpolateRdYlGn(corruptionScores[abbr] / 100)
          }
          if (eco && activeLayers.gdpEconomy) {
            return d3.interpolateRdYlGn(1 - (eco.gdp / 3600000) * 0.8)
          }
          if (eco && activeLayers.stateDebt) {
            return d3.interpolateRdBu(1 - Math.min((eco.debt / eco.gdp) * 8, 1))
          }
          if (eco && activeLayers.agriculture) {
            return d3.interpolateGreens((eco.agriculturalOutput / 60000) * 0.85)
          }
          return theme.cardB || '#1e2330'
        })
        .attr('stroke',       theme.border)
        .attr('stroke-width', 0.5)
        .on('mouseover', function () {
          d3.select(this).attr('stroke', theme.accent).attr('stroke-width', 2)
        })
        .on('mouseout', function () {
          d3.select(this).attr('stroke', theme.border).attr('stroke-width', 0.5)
        })
        .on('click', (event, d) => {
          const fips = String(d.id).padStart(2, '0')
          const abbr = STATE_FIPS_TO_ABBR[fips]
          if (abbr && onStateClick) onStateClick(abbr)
          g.selectAll('path.state').attr('stroke', theme.border).attr('stroke-width', 0.5)
          d3.select(event.currentTarget).attr('stroke', theme.accent).attr('stroke-width', 2.5)
        })
    } else {
      g.append('rect').attr('x', width * 0.1).attr('y', height * 0.25)
        .attr('width', width * 0.8).attr('height', height * 0.5)
        .attr('fill', theme.cardB || '#1e2330').attr('rx', 6)
      g.append('text').attr('x', width / 2).attr('y', height / 2)
        .attr('text-anchor', 'middle').attr('fill', theme.mid)
        .style('font-family', "'IBM Plex Mono', monospace").style('font-size', '13px')
        .text('Loading US map…')
    }

    // ── Terrain — mountain ranges ──────────────────────────────────────────
    if (activeLayers.terrain) {
      const lineGen = d3.line()
        .x(d => { const p = projection(d); return p ? p[0] : 0 })
        .y(d => { const p = projection(d); return p ? p[1] : 0 })
        .defined(d => projection(d) !== null)

      MOUNTAIN_RANGES.forEach(range => {
        g.append('path')
          .datum(range.coordinates)
          .attr('d', lineGen)
          .attr('fill', 'none')
          .attr('stroke', range.color)
          .attr('stroke-width', range.strokeWidth)
          .attr('stroke-dasharray', range.dashArray)
          .attr('opacity', 0.55)
          .attr('class', 'terrain-range')
          .append('title').text(range.name)
      })
    }

    // ── Infrastructure layers ────────────────────────────────────────────────
    const projPoint = coords => projection(coords)

    if (activeLayers.oilPipelines) {
      const lineGen = d3.line()
        .x(d => { const p = projPoint(d); return p ? p[0] : 0 })
        .y(d => { const p = projPoint(d); return p ? p[1] : 0 })
        .defined(d => projPoint(d) !== null)
      OIL_PIPELINES.forEach(pl => {
        g.append('path').datum(pl.coordinates).attr('d', lineGen)
          .attr('fill', 'none').attr('stroke', theme.accent)
          .attr('stroke-width', 1.5).attr('stroke-dasharray', '5,3').attr('opacity', 0.65)
      })
    }

    if (activeLayers.dataCenters) {
      DATA_CENTERS.forEach(dc => {
        const p = projection([dc.lon, dc.lat])
        if (!p) return
        g.append('circle').attr('cx', p[0]).attr('cy', p[1]).attr('r', 4)
          .attr('fill', theme.blue || '#4A7FFF').attr('stroke', theme.card)
          .attr('stroke-width', 1).attr('opacity', 0.85)
      })
    }

    if (activeLayers.railways) {
      const lineGen = d3.line()
        .x(d => { const p = projPoint(d); return p ? p[0] : 0 })
        .y(d => { const p = projPoint(d); return p ? p[1] : 0 })
        .defined(d => projPoint(d) !== null)
      RAILWAYS.forEach(rw => {
        g.append('path').datum(rw.coordinates).attr('d', lineGen)
          .attr('fill', 'none').attr('stroke', theme.mid)
          .attr('stroke-width', 0.8).attr('opacity', 0.5)
      })
    }

    if (activeLayers.powerGrid) {
      const lineGen = d3.line()
        .x(d => { const p = projPoint(d); return p ? p[0] : 0 })
        .y(d => { const p = projPoint(d); return p ? p[1] : 0 })
        .defined(d => projPoint(d) !== null)
      POWER_GRID.forEach(ln => {
        g.append('path').datum(ln.coordinates).attr('d', lineGen)
          .attr('fill', 'none').attr('stroke', theme.warn || '#FF8000')
          .attr('stroke-width', 0.8).attr('stroke-dasharray', '3,2').attr('opacity', 0.5)
      })
    }

    if (activeLayers.population) {
      Object.entries(STATE_CENTROIDS).forEach(([abbr, coords]) => {
        const eco = STATE_ECONOMICS[abbr]
        if (!eco) return
        const p = projection(coords)
        if (!p) return
        const r = Math.sqrt(eco.population / 1e6) * 2.5
        g.append('circle').attr('cx', p[0]).attr('cy', p[1]).attr('r', r)
          .attr('fill', theme.blue || '#4A7FFF').attr('fill-opacity', 0.25)
          .attr('stroke', theme.blue || '#4A7FFF').attr('stroke-width', 0.5)
      })
    }

    // ── Cities layer ─────────────────────────────────────────────────────────
    if (activeLayers.cities || activeLayers.gasPrices) {
      const citiesGroup = g.append('g').attr('class', 'cities-layer')

      US_CITIES.forEach(city => {
        const p = projection([city.lng, city.lat])
        if (!p) return

        const isCapital = city.tier === 'capital'
        const isTier1   = city.tier === 'tier1'
        const dotR      = isCapital ? 4.5 : isTier1 ? 3.5 : 2.5

        const cityG = citiesGroup.append('g')
          .attr('class', `city city-${city.tier}`)
          .attr('transform', `translate(${p[0]},${p[1]})`)
          .attr('data-tier', city.tier)
          .style('cursor', 'pointer')
          .on('mouseover', function () {
            d3.select(this).select('.city-label').style('opacity', 1)
          })
          .on('mouseout', function () {
            d3.select(this).select('.city-label').style('opacity', 0)
          })
          .on('click', () => {
            if (activeLayers.gasPrices) {
              setGasPanel({ cityName: city.name, stateCode: city.state })
            }
          })

        // City dot
        if (isCapital) {
          // Star marker for capitals
          const star = d3.symbol().type(d3.symbolStar).size(isCapital ? 36 : 20)
          cityG.append('path')
            .attr('d', star())
            .attr('fill', activeLayers.gasPrices && gasData?.prices?.[city.state]
              ? (colorScale ? colorScale(gasData.prices[city.state]) : '#facc15')
              : '#facc15')
            .attr('stroke', theme.card)
            .attr('stroke-width', 0.8)
            .attr('opacity', 0.9)
        } else {
          cityG.append('circle')
            .attr('r', dotR)
            .attr('fill', activeLayers.gasPrices && gasData?.prices?.[city.state] && colorScale
              ? colorScale(gasData.prices[city.state])
              : (isTier1 ? (theme.blue || '#4A7FFF') : theme.mid))
            .attr('stroke', theme.card)
            .attr('stroke-width', 0.5)
            .attr('opacity', 0.85)
        }

        // Gas price badge (when gas layer is on)
        if (activeLayers.gasPrices && gasData?.prices?.[city.state]) {
          const price     = gasData.prices[city.state]
          const badgeText = `$${price.toFixed(2)}`
          const badgeW    = isCapital ? 36 : 34
          const badgeH    = 12
          const badgeY    = -(dotR + badgeH + 6)
          const badgeColor = colorScale ? colorScale(price) : '#fb923c'

          const badgeG = cityG.append('g')
            .attr('class', 'gas-badge')
            .attr('transform', `translate(${-badgeW / 2},${badgeY})`)

          // Badge rect
          badgeG.append('rect')
            .attr('width', badgeW).attr('height', badgeH)
            .attr('rx', 3)
            .attr('fill', badgeColor)
            .attr('opacity', 0.92)

          // Badge text
          badgeG.append('text')
            .attr('x', badgeW / 2).attr('y', badgeH - 3)
            .attr('text-anchor', 'middle')
            .attr('fill', '#000')
            .style('font-family', "'IBM Plex Mono', monospace")
            .style('font-size', '7px')
            .style('font-weight', '700')
            .style('pointer-events', 'none')
            .text(badgeText)

          // Connector tick
          cityG.append('line')
            .attr('x1', 0).attr('y1', badgeY + badgeH)
            .attr('x2', 0).attr('y2', -(dotR + 2))
            .attr('stroke', badgeColor)
            .attr('stroke-width', 0.8)
            .attr('opacity', 0.7)
        }

        // City label — hidden by default, shown on hover
        const labelY = isCapital ? dotR + 11 : dotR + 9
        cityG.append('text')
          .attr('class', 'city-label')
          .attr('y', labelY)
          .attr('text-anchor', 'middle')
          .attr('fill', isCapital ? '#facc15' : (theme.mid))
          .style('font-family', "'IBM Plex Mono', monospace")
          .style('font-size', isCapital ? '8px' : isTier1 ? '7px' : '6.5px')
          .style('font-weight', isCapital ? '600' : '400')
          .style('pointer-events', 'none')
          .style('text-shadow', `0 0 3px ${theme.card}`)
          .style('opacity', 0)
          .text(isCapital ? `★ ${city.name}` : city.name)
      })

      // Initial visibility — hide tier2 cities at default zoom
      updateCityVisibility(1)
    }

    // ── Zoom controls ────────────────────────────────────────────────────────
    const ctrl = svg.append('g').attr('transform', 'translate(16, 16)')
    ;[
      { y: 0,  label: '+', action: () => svg.transition().call(zoom.scaleBy, 1.5) },
      { y: 34, label: '−', action: () => svg.transition().call(zoom.scaleBy, 0.67) },
      { y: 68, label: '⟲', action: () => svg.transition().call(zoom.transform, d3.zoomIdentity) },
    ].forEach(btn => {
      ctrl.append('rect').attr('y', btn.y).attr('width', 28).attr('height', 28)
        .attr('fill', theme.card).attr('stroke', theme.border).attr('rx', 4)
        .style('cursor', 'pointer').on('click', btn.action)
      ctrl.append('text').attr('x', 14).attr('y', btn.y + 18)
        .attr('text-anchor', 'middle').attr('fill', theme.hi)
        .style('font-family', "'IBM Plex Mono', monospace").style('font-size', '14px')
        .style('pointer-events', 'none').text(btn.label)
    })

    // ── Legend ───────────────────────────────────────────────────────────────
    const LW = 168
    let LH   = activeLayers.gasPrices ? 152 : (activeLayers.corruption ? 136 : 110)
    const leg = svg.append('g').attr('transform', `translate(${width - LW - 12}, ${height - LH - 12})`)
    leg.append('rect').attr('width', LW).attr('height', LH)
      .attr('fill', theme.card).attr('stroke', theme.border).attr('rx', 4).attr('opacity', 0.95)
    leg.append('text').attr('x', 8).attr('y', 18)
      .attr('fill', theme.accent).style('font-family', "'IBM Plex Mono',monospace").style('font-size', '9px')
      .style('letter-spacing', '1.5px').text('LEGEND')

    if (activeLayers.gasPrices && gasData?.prices) {
      const prices = Object.values(gasData.prices)
      const minP   = Math.min(...prices).toFixed(2)
      const midP   = ((Math.min(...prices) + Math.max(...prices)) / 2).toFixed(2)
      const maxP   = Math.max(...prices).toFixed(2)

      // Gas price gradient bar
      const gradId = 'gas-legend-grad'
      const defs   = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs')
      const grad   = defs.append('linearGradient')
        .attr('id', gradId).attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '0%')
      ;[0, 0.5, 1].forEach((t2, i) => {
        grad.append('stop').attr('offset', `${t2 * 100}%`)
          .attr('stop-color', ['#22c55e', '#eab308', '#ef4444'][i])
      })

      leg.append('text').attr('x', 8).attr('y', 32)
        .attr('fill', '#fb923c').style('font-family', "'IBM Plex Mono',monospace").style('font-size', '8px')
        .style('letter-spacing', '1px').text('⛽ GAS PRICES $/GAL')
      leg.append('rect').attr('x', 8).attr('y', 38).attr('width', LW - 16).attr('height', 10)
        .attr('rx', 2).attr('fill', `url(#${gradId})`)
      ;[minP, midP, maxP].forEach((v, i) => {
        leg.append('text').attr('x', i === 0 ? 8 : i === 1 ? LW / 2 : LW - 8).attr('y', 60)
          .attr('text-anchor', i === 0 ? 'start' : i === 1 ? 'middle' : 'end')
          .attr('fill', theme.low).style('font-family', "'IBM Plex Mono',monospace").style('font-size', '7.5px')
          .text(`$${v}`)
      })

      leg.append('line').attr('x1', 8).attr('y1', 64).attr('x2', LW - 8).attr('y2', 64)
        .attr('stroke', theme.border).attr('stroke-width', 0.5)

      ;[
        { label: '★ State capital',  color: '#facc15',              y: 80 },
        { label: '● Tier-1 metro',   color: theme.blue || '#4A7FFF', y: 96 },
        { label: '· Tier-2 city',    color: theme.mid,               y: 112 },
        { label: '⛰️ Mountain range', color: '#8B7355',              y: 128 },
      ].forEach(item => {
        leg.append('circle').attr('cx', 12).attr('cy', item.y - 4).attr('r', 4).attr('fill', item.color)
        leg.append('text').attr('x', 22).attr('y', item.y)
          .attr('fill', theme.mid).style('font-family', "'IBM Plex Mono',monospace").style('font-size', '9px')
          .text(item.label)
      })

    } else if (activeLayers.corruption) {
      // Corruption gradient (existing logic)
      const gradId = 'corr-legend-grad'
      const defs   = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs')
      const grad   = defs.append('linearGradient')
        .attr('id', gradId).attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '0%')
      ;[0, 0.25, 0.5, 0.75, 1].forEach(t2 => {
        grad.append('stop').attr('offset', `${t2 * 100}%`).attr('stop-color', d3.interpolateRdYlGn(t2))
      })
      leg.append('rect').attr('x', 8).attr('y', 26).attr('width', LW - 16).attr('height', 12).attr('rx', 2).attr('fill', `url(#${gradId})`)
      leg.append('text').attr('x', 8).attr('y', 50).attr('fill', theme.low).style('font-family', "'IBM Plex Mono',monospace").style('font-size', '7.5px').text('High Risk')
      leg.append('text').attr('x', LW - 8).attr('y', 50).attr('text-anchor', 'end').attr('fill', theme.low).style('font-family', "'IBM Plex Mono',monospace").style('font-size', '7.5px').text('Low Risk')
      leg.append('line').attr('x1', 8).attr('y1', 56).attr('x2', LW - 8).attr('y2', 56).attr('stroke', theme.border).attr('stroke-width', 0.5)
      ;[
        { label: '🛢️ Oil Pipelines', color: theme.accent,           y: 72 },
        { label: '🖥️ Data Centers',  color: theme.blue || '#4A7FFF', y: 88 },
        { label: '🚂 Railways',      color: theme.mid,               y: 104 },
        { label: '⚡ Power Grid',    color: theme.warn || '#FF8000', y: 120 },
      ].forEach(item => {
        leg.append('circle').attr('cx', 12).attr('cy', item.y - 4).attr('r', 4).attr('fill', item.color)
        leg.append('text').attr('x', 22).attr('y', item.y).attr('fill', theme.mid).style('font-family', "'IBM Plex Mono',monospace").style('font-size', '9px').text(item.label)
      })
    } else {
      ;[
        { label: '🔴 Corruption',    color: '#ff4444',              y: 34 },
        { label: '🛢️ Oil Pipelines', color: theme.accent,           y: 50 },
        { label: '🖥️ Data Centers',  color: theme.blue || '#4A7FFF', y: 66 },
        { label: '🚂 Railways',      color: theme.mid,               y: 82 },
        { label: '⚡ Power Grid',    color: theme.warn || '#FF8000', y: 98 },
      ].forEach(item => {
        leg.append('circle').attr('cx', 12).attr('cy', item.y - 4).attr('r', 4).attr('fill', item.color)
        leg.append('text').attr('x', 22).attr('y', item.y).attr('fill', theme.mid).style('font-family', "'IBM Plex Mono',monospace").style('font-size', '9px').text(item.label)
      })
    }

    // ── Time-range buttons ───────────────────────────────────────────────────
    const TR_W = 160, TR_H = 48
    const tr = svg.append('g').attr('transform', `translate(${(width - TR_W) / 2}, ${height - TR_H - 12})`)
    tr.append('rect').attr('width', TR_W).attr('height', TR_H)
      .attr('fill', theme.card).attr('stroke', theme.border).attr('rx', 4).attr('opacity', 0.95)
    tr.append('text').attr('x', 8).attr('y', 16).attr('fill', theme.accent)
      .style('font-family', "'IBM Plex Mono',monospace").style('font-size', '9px').style('letter-spacing', '1.5px').text('TIME RANGE')
    ;['1Y', '2Y', '5Y', 'ALL'].forEach((range, i) => {
      const bx = 4 + i * 38
      const active = timeRange === range
      tr.append('rect').attr('x', bx).attr('y', 24).attr('width', 34).attr('height', 18)
        .attr('fill', active ? theme.accent : (theme.cardB || '#1e2330'))
        .attr('stroke', theme.border).attr('rx', 3).style('cursor', 'pointer')
        .on('click', () => setTimeRange(range))
      tr.append('text').attr('x', bx + 17).attr('y', 36).attr('text-anchor', 'middle')
        .attr('fill', active ? '#fff' : theme.hi)
        .style('font-family', "'IBM Plex Mono',monospace").style('font-size', '9px')
        .style('pointer-events', 'none').text(range)
    })

    // ── Helper: update city visibility by zoom scale ─────────────────────────
    function updateCityVisibility(k) {
      if (!svgRef.current) return
      const svg2 = d3.select(svgRef.current)
      svg2.selectAll('.city-tier2').style('display', k >= 3.5 ? null : 'none')
      svg2.selectAll('.city-tier1').style('display', k >= 2.0 ? null : 'none')
      // Labels are hover-only; ensure they stay hidden when city groups are re-shown
      svg2.selectAll('.city-label').style('opacity', 0)
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayers, timeRange, theme, ready, onStateClick, corruptionScores, gasData])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ width: '100%', position: 'relative', display: 'flex' }}>
      {/* Map container */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative' }}>
        <svg ref={svgRef} style={{ width: '100%', height: 520, display: 'block' }} />

        {/* Gas loading overlay */}
        {gasLoading && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(0,0,0,0.7)', borderRadius: 6, padding: '6px 12px',
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
            color: '#fb923c', border: '1px solid rgba(251,146,60,0.3)',
          }}>
            ⛽ Loading gas prices…
          </div>
        )}

        {/* Zoom hint */}
        <div style={{
          position: 'absolute', bottom: 8, right: 8,
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
          color: theme.low, pointerEvents: 'none',
        }}>
          Zoom {zoomScale.toFixed(1)}x · Scroll to zoom · Click to drill down
        </div>

        {/* Layer toggles */}
        <div style={{
          position: 'absolute', left: 16, bottom: 16,
          background: theme.card, border: `1px solid ${theme.border}`,
          borderRadius: 4, padding: '10px 14px', opacity: 0.95, minWidth: 170,
        }}>
          <div style={{
            fontFamily: "'IBM Plex Mono',monospace", fontSize: 9,
            color: theme.accent, letterSpacing: '1.5px', marginBottom: 8,
          }}>LAYER TOGGLES</div>
          {LAYER_DEFS.map(layer => (
            <label key={layer.id} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={activeLayers[layer.id]}
                onChange={e => toggleLayer(layer.id, e.target.checked)}
                style={{ cursor: 'pointer', accentColor: theme.accent }}
              />
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: theme.mid }}>
                {layer.name}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* GasPricePanel — slides in on city click when gas layer is active */}
      {gasPanel && activeLayers.gasPrices && (
        <GasPricePanel
          cityName={gasPanel.cityName}
          stateCode={gasPanel.stateCode}
          statePriceData={gasData}
          onClose={() => setGasPanel(null)}
        />
      )}
    </div>
  )
}

export default USPoliticalMap
