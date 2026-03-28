/**
 * Static geographic data for the Campaign Watch map
 */

// US State boundaries (simplified for map visualization)
export const US_STATES_GEO = {
  type: "FeatureCollection",
  features: [
    // Sample states - in production, this would be a full TopoJSON file
    {
      type: "Feature",
      properties: { name: "Alabama", fips: "01", abbreviation: "AL" },
      geometry: { type: "Polygon", coordinates: [[[-88.0, 35.0], [-85.0, 35.0], [-85.0, 32.0], [-88.0, 32.0], [-88.0, 35.0]]] }
    },
    {
      type: "Feature",
      properties: { name: "Texas", fips: "48", abbreviation: "TX" },
      geometry: { type: "Polygon", coordinates: [[[-106.0, 36.5], [-93.5, 36.5], [-93.5, 25.5], [-106.0, 25.5], [-106.0, 36.5]]] }
    },
    {
      type: "Feature",
      properties: { name: "California", fips: "06", abbreviation: "CA" },
      geometry: { type: "Polygon", coordinates: [[[-124.0, 42.0], [-114.0, 42.0], [-114.0, 32.5], [-124.0, 32.5], [-124.0, 42.0]]] }
    },
    {
      type: "Feature",
      properties: { name: "Florida", fips: "12", abbreviation: "FL" },
      geometry: { type: "Polygon", coordinates: [[[-87.5, 31.0], [-80.0, 31.0], [-80.0, 24.5], [-87.5, 24.5], [-87.5, 31.0]]] }
    },
    {
      type: "Feature",
      properties: { name: "New York", fips: "36", abbreviation: "NY" },
      geometry: { type: "Polygon", coordinates: [[[-79.5, 45.0], [-71.5, 45.0], [-71.5, 40.5], [-79.5, 40.5], [-79.5, 45.0]]] }
    }
  ]
};

// State FIPS to abbreviation mapping
export const STATE_FIPS_TO_ABBR = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA",
  "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
  "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN",
  "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
  "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
  "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
  "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
  "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
  "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI",
  "56": "WY"
};

// State abbreviation to FIPS mapping
export const STATE_ABBR_TO_FIPS = Object.fromEntries(
  Object.entries(STATE_FIPS_TO_ABBR).map(([fips, abbr]) => [abbr, fips])
);

// Data center locations (sample data - would be expanded with real data)
export const DATA_CENTERS = [
  { name: "Ashburn Data Center Corridor", state: "VA", lat: 39.0438, lon: -77.4874, type: "hyperscale", capacity: "1000+ MW" },
  { name: "Silicon Valley Campus", state: "CA", lat: 37.3875, lon: -121.9749, type: "enterprise", capacity: "500+ MW" },
  { name: "Dallas-Fort Worth Metroplex", state: "TX", lat: 32.7767, lon: -96.7970, type: "hyperscale", capacity: "800+ MW" },
  { name: "Chicago Data Hub", state: "IL", lat: 41.8781, lon: -87.6298, type: "colocation", capacity: "300+ MW" },
  { name: "Phoenix Metro", state: "AZ", lat: 33.4484, lon: -112.0740, type: "hyperscale", capacity: "600+ MW" },
  { name: "Atlanta Metro", state: "GA", lat: 33.7490, lon: -84.3880, type: "enterprise", capacity: "400+ MW" },
  { name: "Northern Virginia", state: "VA", lat: 38.8048, lon: -77.0469, type: "hyperscale", capacity: "1200+ MW" },
  { name: "Portland", state: "OR", lat: 45.5152, lon: -122.6784, type: "colocation", capacity: "200+ MW" },
  { name: "Salt Lake City", state: "UT", lat: 40.7608, lon: -111.8910, type: "enterprise", capacity: "250+ MW" },
  { name: "Miami", state: "FL", lat: 25.7617, lon: -80.1918, type: "colocation", capacity: "150+ MW" }
];

// 2026 Election Races (sample data)
export const ELECTION_2026_RACES = [
  { state: "TX", type: "Senate", incumbent: "Ted Cruz", party: "R", rating: "Lean R", candidates: 3 },
  { state: "CA", type: "Senate", incumbent: "Alex Padilla", party: "D", rating: "Safe D", candidates: 2 },
  { state: "FL", type: "Senate", incumbent: "Marco Rubio", party: "R", rating: "Likely R", candidates: 4 },
  { state: "NY", type: "Senate", incumbent: "Kirsten Gillibrand", party: "D", rating: "Safe D", candidates: 2 },
  { state: "PA", type: "Senate", incumbent: "Bob Casey Jr.", party: "D", rating: "Lean D", candidates: 3 },
  { state: "OH", type: "Senate", incumbent: "Sherrod Brown", party: "D", rating: "Toss-up", candidates: 5 },
  { state: "AZ", type: "Senate", incumbent: "Mark Kelly", party: "D", rating: "Toss-up", candidates: 4 },
  { state: "WI", type: "Senate", incumbent: "Tammy Baldwin", party: "D", rating: "Lean D", candidates: 3 },
  { state: "NV", type: "Senate", incumbent: "Jacky Rosen", party: "D", rating: "Toss-up", candidates: 4 },
  { state: "MT", type: "Senate", incumbent: "Jon Tester", party: "D", rating: "Toss-up", candidates: 5 }
];

// State population data (for per-capita calculations)
export const STATE_POPULATIONS = {
  "CA": 39538223, "TX": 29145505, "FL": 21538187, "NY": 20201249,
  "PA": 13002700, "IL": 12812508, "OH": 11799448, "GA": 10711908,
  "NC": 10439388, "MI": 10077331, "NJ": 9288994, "VA": 8631393,
  "WA": 7705281, "AZ": 7151502, "MA": 7029917, "TN": 6910840,
  "IN": 6785528, "MD": 6177224, "MO": 6154913, "WI": 5893718,
  "CO": 5773714, "MN": 5706494, "SC": 5118425, "AL": 5024279,
  "LA": 4657757, "KY": 4505836, "OR": 4237256, "OK": 3959353,
  "CT": 3605944, "UT": 3271616, "IA": 3190369, "NV": 3104614,
  "AR": 3011524, "MS": 2961279, "KS": 2937880, "NM": 2117522,
  "NE": 1961504, "ID": 1839106, "WV": 1793716, "HI": 1455271,
  "NH": 1377529, "ME": 1362359, "RI": 1097379, "MT": 1084225,
  "DE": 989948, "SD": 886667, "ND": 779094, "AK": 733391,
  "DC": 689545, "VT": 643077, "WY": 576851
};

export default {
  US_STATES_GEO,
  STATE_FIPS_TO_ABBR,
  STATE_ABBR_TO_FIPS,
  DATA_CENTERS,
  ELECTION_2026_RACES,
  STATE_POPULATIONS
};
