/**
 * src/data/mountainRanges.js
 * Simplified polyline coordinates for major US mountain ranges.
 * Rendered as subtle terrain ridge lines on the USPoliticalMap when the ⛰️ Terrain layer is active.
 *
 * Coordinates are [longitude, latitude] pairs (D3 geoPath convention).
 */

const MOUNTAIN_RANGES = [
  {
    id: 'rocky-mountains',
    name: 'Rocky Mountains',
    states: ['MT', 'ID', 'WY', 'CO', 'NM'],
    color: '#8B7355',
    strokeWidth: 1.8,
    dashArray: '4,3',
    coordinates: [
      [-114.0, 48.8], [-113.5, 47.5], [-113.0, 46.8], [-112.5, 46.0],
      [-111.8, 45.0], [-110.8, 44.0], [-110.5, 43.0], [-110.0, 42.0],
      [-109.5, 41.0], [-108.8, 40.0], [-107.5, 39.2], [-106.5, 38.8],
      [-106.0, 38.0], [-105.8, 37.2], [-105.5, 36.5], [-105.2, 35.8],
      [-104.8, 35.0], [-104.5, 34.2], [-105.0, 33.5],
    ],
  },
  {
    id: 'rocky-mountains-west',
    name: 'Rocky Mountains (West)',
    states: ['MT', 'ID', 'UT'],
    color: '#8B7355',
    strokeWidth: 1.4,
    dashArray: '3,3',
    coordinates: [
      [-116.0, 48.5], [-115.5, 47.5], [-115.0, 46.5],
      [-114.5, 45.5], [-113.8, 44.5], [-113.2, 43.5],
      [-113.0, 42.5], [-112.5, 41.8], [-112.0, 41.0],
      [-111.5, 40.5], [-111.0, 40.0],
    ],
  },
  {
    id: 'appalachian-mountains',
    name: 'Appalachian Mountains',
    states: ['ME', 'NH', 'VT', 'MA', 'CT', 'NY', 'PA', 'MD', 'WV', 'VA', 'NC', 'TN', 'GA', 'AL'],
    color: '#7A8B6F',
    strokeWidth: 1.5,
    dashArray: '3,3',
    coordinates: [
      [-70.2, 44.5], [-71.0, 44.0], [-71.5, 43.5], [-72.0, 43.0],
      [-72.5, 42.5], [-73.0, 42.0], [-73.5, 41.5], [-74.0, 41.0],
      [-74.5, 40.5], [-75.5, 40.0], [-76.5, 39.5], [-77.5, 39.0],
      [-78.5, 38.5], [-79.0, 38.0], [-79.5, 37.5], [-80.0, 37.0],
      [-80.5, 36.5], [-81.0, 36.0], [-81.5, 35.5], [-82.0, 35.0],
      [-82.5, 34.5], [-83.0, 34.0], [-84.0, 33.5], [-85.0, 33.0],
    ],
  },
  {
    id: 'sierra-nevada',
    name: 'Sierra Nevada',
    states: ['CA'],
    color: '#9B8B6B',
    strokeWidth: 1.6,
    dashArray: '4,2',
    coordinates: [
      [-120.0, 39.5], [-119.8, 39.0], [-119.5, 38.5], [-119.2, 38.0],
      [-118.8, 37.5], [-118.5, 37.0], [-118.2, 36.5], [-118.0, 36.0],
      [-117.8, 35.8],
    ],
  },
  {
    id: 'cascade-range',
    name: 'Cascade Range',
    states: ['WA', 'OR', 'CA'],
    color: '#7B8B7A',
    strokeWidth: 1.6,
    dashArray: '4,3',
    coordinates: [
      [-121.5, 48.8], [-121.8, 48.2], [-121.6, 47.5], [-121.8, 46.8],
      [-121.7, 46.2], [-121.8, 45.5], [-122.0, 44.8], [-121.8, 44.2],
      [-121.5, 43.5], [-121.2, 43.0], [-121.0, 42.5], [-120.8, 42.0],
    ],
  },
  {
    id: 'great-smoky-mountains',
    name: 'Great Smoky Mountains',
    states: ['TN', 'NC'],
    color: '#6B7B6A',
    strokeWidth: 1.3,
    dashArray: '3,2',
    coordinates: [
      [-84.5, 35.7], [-84.0, 35.6], [-83.5, 35.5], [-83.0, 35.5],
      [-82.5, 35.6], [-82.0, 35.7],
    ],
  },
  {
    id: 'black-hills',
    name: 'Black Hills',
    states: ['SD', 'WY'],
    color: '#6B6B5B',
    strokeWidth: 1.2,
    dashArray: '3,3',
    coordinates: [
      [-104.2, 44.5], [-103.8, 44.2], [-103.5, 44.0],
      [-103.5, 43.8], [-103.8, 43.5], [-104.2, 43.5],
    ],
  },
  {
    id: 'ozark-highlands',
    name: 'Ozark Highlands',
    states: ['MO', 'AR'],
    color: '#7B7B6B',
    strokeWidth: 1.1,
    dashArray: '2,3',
    coordinates: [
      [-94.5, 37.0], [-93.5, 36.8], [-92.5, 36.5], [-91.5, 36.3],
      [-90.8, 36.2], [-90.5, 35.8], [-91.0, 35.5], [-92.0, 35.3],
      [-93.0, 35.5], [-94.0, 35.8], [-94.5, 36.3], [-94.5, 37.0],
    ],
  },
  {
    id: 'coast-ranges',
    name: 'Pacific Coast Ranges',
    states: ['CA', 'OR', 'WA'],
    color: '#8B9B8B',
    strokeWidth: 1.2,
    dashArray: '2,3',
    coordinates: [
      [-124.5, 48.5], [-124.2, 47.5], [-124.0, 46.5], [-124.2, 45.5],
      [-124.0, 44.5], [-123.8, 43.5], [-123.5, 42.5],
      [-122.5, 41.5], [-122.0, 40.5], [-121.8, 39.5],
      [-121.5, 38.5], [-121.8, 37.5],
    ],
  },
  {
    id: 'alaska-range',
    name: 'Alaska Range',
    states: ['AK'],
    color: '#9B9B9B',
    strokeWidth: 1.5,
    dashArray: '4,3',
    coordinates: [
      [-155.0, 62.5], [-153.0, 63.0], [-151.0, 63.5], [-149.5, 62.8],
      [-147.5, 62.5], [-146.0, 62.2], [-144.5, 62.0],
    ],
  },
]

export default MOUNTAIN_RANGES
