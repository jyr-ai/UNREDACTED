/**
 * US State geographic centroids (approximate centers).
 * Used by ArcLayer for source/target positions on contribution flow,
 * spending flow, and dark money arcs.
 *
 * Format: { stateCode: { lat, lon, name } }
 */
export const STATE_CENTROIDS = {
  AL: { lat: 32.806671, lon: -86.791130, name: 'Alabama' },
  AK: { lat: 61.370716, lon: -152.404419, name: 'Alaska' },
  AZ: { lat: 33.729759, lon: -111.431221, name: 'Arizona' },
  AR: { lat: 34.969704, lon: -92.373123, name: 'Arkansas' },
  CA: { lat: 36.116203, lon: -119.681564, name: 'California' },
  CO: { lat: 39.059811, lon: -105.311104, name: 'Colorado' },
  CT: { lat: 41.597782, lon: -72.755371, name: 'Connecticut' },
  DE: { lat: 39.318523, lon: -75.507141, name: 'Delaware' },
  DC: { lat: 38.897438, lon: -77.026817, name: 'Washington DC' },
  FL: { lat: 27.766279, lon: -81.686783, name: 'Florida' },
  GA: { lat: 33.040619, lon: -83.643074, name: 'Georgia' },
  HI: { lat: 21.094318, lon: -157.498337, name: 'Hawaii' },
  ID: { lat: 44.240459, lon: -114.478828, name: 'Idaho' },
  IL: { lat: 40.349457, lon: -88.986137, name: 'Illinois' },
  IN: { lat: 39.849426, lon: -86.258278, name: 'Indiana' },
  IA: { lat: 42.011539, lon: -93.210526, name: 'Iowa' },
  KS: { lat: 38.526600, lon: -96.726486, name: 'Kansas' },
  KY: { lat: 37.668140, lon: -84.670067, name: 'Kentucky' },
  LA: { lat: 31.169960, lon: -91.867805, name: 'Louisiana' },
  ME: { lat: 44.693947, lon: -69.381927, name: 'Maine' },
  MD: { lat: 39.063946, lon: -76.802101, name: 'Maryland' },
  MA: { lat: 42.230171, lon: -71.530106, name: 'Massachusetts' },
  MI: { lat: 43.326618, lon: -84.536095, name: 'Michigan' },
  MN: { lat: 45.694454, lon: -93.900192, name: 'Minnesota' },
  MS: { lat: 32.741646, lon: -89.678696, name: 'Mississippi' },
  MO: { lat: 38.456085, lon: -92.288368, name: 'Missouri' },
  MT: { lat: 46.921925, lon: -110.454353, name: 'Montana' },
  NE: { lat: 41.125370, lon: -98.268082, name: 'Nebraska' },
  NV: { lat: 38.313515, lon: -117.055374, name: 'Nevada' },
  NH: { lat: 43.452492, lon: -71.563896, name: 'New Hampshire' },
  NJ: { lat: 40.298904, lon: -74.521011, name: 'New Jersey' },
  NM: { lat: 34.840515, lon: -106.248482, name: 'New Mexico' },
  NY: { lat: 42.165726, lon: -74.948051, name: 'New York' },
  NC: { lat: 35.630066, lon: -79.806419, name: 'North Carolina' },
  ND: { lat: 47.528912, lon: -99.784012, name: 'North Dakota' },
  OH: { lat: 40.388783, lon: -82.764915, name: 'Ohio' },
  OK: { lat: 35.565342, lon: -96.928917, name: 'Oklahoma' },
  OR: { lat: 44.572021, lon: -122.070938, name: 'Oregon' },
  PA: { lat: 40.590752, lon: -77.209755, name: 'Pennsylvania' },
  RI: { lat: 41.680893, lon: -71.511780, name: 'Rhode Island' },
  SC: { lat: 33.856892, lon: -80.945007, name: 'South Carolina' },
  SD: { lat: 44.299782, lon: -99.438828, name: 'South Dakota' },
  TN: { lat: 35.747845, lon: -86.692345, name: 'Tennessee' },
  TX: { lat: 31.054487, lon: -97.563461, name: 'Texas' },
  UT: { lat: 40.150032, lon: -111.862434, name: 'Utah' },
  VT: { lat: 44.045876, lon: -72.710686, name: 'Vermont' },
  VA: { lat: 37.769337, lon: -78.169968, name: 'Virginia' },
  WA: { lat: 47.400902, lon: -121.490494, name: 'Washington' },
  WV: { lat: 38.491226, lon: -80.954453, name: 'West Virginia' },
  WI: { lat: 44.268543, lon: -89.616508, name: 'Wisconsin' },
  WY: { lat: 42.755966, lon: -107.302490, name: 'Wyoming' },
};

// Washington DC as a fixed point (federal hub for spending arcs)
export const DC_CENTROID = { lat: 38.897438, lon: -77.026817 };

/**
 * Get centroid for a state code, returns null if not found.
 * @param {string} stateCode e.g. 'CA'
 */
export function getCentroid(stateCode) {
  return STATE_CENTROIDS[stateCode?.toUpperCase()] ?? null;
}

export default STATE_CENTROIDS;
