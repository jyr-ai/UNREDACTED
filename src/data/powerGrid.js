/**
 * Major US power grid transmission lines
 * Simplified line paths for map visualization
 */

export const POWER_GRID = [
  {
    name: "Eastern Interconnection",
    type: "AC",
    voltage: "765 kV",
    coordinates: [
      [-90.0, 30.0], // Gulf Coast
      [-89.0, 31.0],
      [-88.0, 32.0], // Mississippi
      [-87.0, 33.0],
      [-86.0, 34.0], // Alabama
      [-85.0, 35.0], // Georgia
      [-84.0, 36.0], // Tennessee
      [-83.0, 37.0], // Kentucky
      [-82.0, 38.0], // West Virginia
      [-81.0, 39.0], // Ohio
      [-80.0, 40.0], // Pennsylvania
      [-79.0, 41.0], // New York
      [-78.0, 42.0], // New England
      [-77.0, 43.0],
      [-76.0, 44.0]  // Upstate NY
    ]
  },
  {
    name: "Western Interconnection",
    type: "AC",
    voltage: "500 kV",
    coordinates: [
      [-124.0, 42.0], // Oregon coast
      [-123.0, 42.5],
      [-122.0, 43.0], // Oregon
      [-121.0, 43.5],
      [-120.0, 44.0], // Idaho
      [-119.0, 44.5],
      [-118.0, 45.0], // Montana
      [-117.0, 45.5],
      [-116.0, 46.0],
      [-115.0, 46.5], // Wyoming
      [-114.0, 47.0],
      [-113.0, 47.5],
      [-112.0, 48.0], // South Dakota
      [-111.0, 48.5],
      [-110.0, 49.0], // North Dakota
      [-109.0, 49.5],
      [-108.0, 50.0]  // Minnesota border
    ]
  },
  {
    name: "Texas Interconnection (ERCOT)",
    type: "AC",
    voltage: "345 kV",
    coordinates: [
      [-106.0, 32.0], // West Texas
      [-105.0, 32.5],
      [-104.0, 33.0], // New Mexico border
      [-103.0, 33.5],
      [-102.0, 34.0], // Panhandle
      [-101.0, 34.5],
      [-100.0, 35.0], // Oklahoma border
      [-99.0, 35.5],
      [-98.0, 36.0], // Central Texas
      [-97.0, 36.5],
      [-96.0, 37.0], // Dallas-Fort Worth
      [-95.0, 37.5],
      [-94.0, 38.0], // East Texas
      [-93.0, 38.5],
      [-92.0, 39.0]  // Louisiana border
    ]
  },
  {
    name: "Pacific DC Intertie",
    type: "HVDC",
    voltage: "±500 kV",
    coordinates: [
      [-119.0, 46.0], // Columbia River, WA
      [-118.5, 45.5],
      [-118.0, 45.0], // Oregon
      [-117.5, 44.5],
      [-117.0, 44.0],
      [-116.5, 43.5], // Idaho
      [-116.0, 43.0],
      [-115.5, 42.5],
      [-115.0, 42.0], // Nevada
      [-114.5, 41.5],
      [-114.0, 41.0],
      [-113.5, 40.5],
      [-113.0, 40.0], // Utah
      [-112.5, 39.5],
      [-112.0, 39.0],
      [-111.5, 38.5], // Colorado
      [-111.0, 38.0],
      [-110.5, 37.5],
      [-110.0, 37.0]  // New Mexico
    ]
  },
  {
    name: "Midwest Transmission Corridor",
    type: "AC",
    voltage: "765 kV",
    coordinates: [
      [-97.0, 49.0], // Manitoba, Canada border
      [-96.5, 48.5],
      [-96.0, 48.0], // Minnesota
      [-95.5, 47.5],
      [-95.0, 47.0],
      [-94.5, 46.5],
      [-94.0, 46.0],
      [-93.5, 45.5], // Wisconsin
      [-93.0, 45.0],
      [-92.5, 44.5],
      [-92.0, 44.0],
      [-91.5, 43.5], // Iowa
      [-91.0, 43.0],
      [-90.5, 42.5],
      [-90.0, 42.0], // Illinois
      [-89.5, 41.5],
      [-89.0, 41.0],
      [-88.5, 40.5],
      [-88.0, 40.0], // Indiana
      [-87.5, 39.5],
      [-87.0, 39.0]  // Kentucky border
    ]
  },
  {
    name: "Southeast Transmission Corridor",
    type: "AC",
    voltage: "500 kV",
    coordinates: [
      [-84.0, 33.0], // Atlanta, GA
      [-83.5, 33.5],
      [-83.0, 34.0], // South Carolina
      [-82.5, 34.5],
      [-82.0, 35.0], // North Carolina
      [-81.5, 35.5],
      [-81.0, 36.0],
      [-80.5, 36.5],
      [-80.0, 37.0], // Virginia
      [-79.5, 37.5],
      [-79.0, 38.0],
      [-78.5, 38.5],
      [-78.0, 39.0], // West Virginia
      [-77.5, 39.5],
      [-77.0, 40.0]  // Maryland/Pennsylvania
    ]
  },
  {
    name: "California Transmission Grid",
    type: "AC",
    voltage: "500 kV",
    coordinates: [
      [-121.0, 38.0], // Sacramento, CA
      [-120.5, 37.5],
      [-120.0, 37.0], // Central Valley
      [-119.5, 36.5],
      [-119.0, 36.0],
      [-118.5, 35.5], // Southern California
      [-118.0, 35.0],
      [-117.5, 34.5],
      [-117.0, 34.0], // Los Angeles
      [-116.5, 33.5],
      [-116.0, 33.0], // San Diego
      [-115.5, 32.5],
      [-115.0, 32.0]  // Mexico border
    ]
  }
];

export default POWER_GRID;
