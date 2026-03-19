/**
 * Major US railway corridors
 * Simplified line paths for map visualization
 */

export const RAILWAYS = [
  {
    name: "Northeast Corridor",
    operator: "Amtrak",
    type: "passenger",
    coordinates: [
      [-77.0, 39.0], // Washington, DC
      [-77.5, 39.5],
      [-78.0, 40.0], // Maryland
      [-78.5, 40.5],
      [-79.0, 41.0], // Pennsylvania
      [-79.5, 41.5],
      [-80.0, 42.0], // Ohio
      [-80.5, 42.5],
      [-81.0, 43.0], // New York
      [-81.5, 43.5],
      [-82.0, 44.0], // Ontario, Canada
      [-82.5, 44.5],
      [-83.0, 45.0], // Michigan
      [-83.5, 45.5],
      [-84.0, 46.0]  // Detroit area
    ]
  },
  {
    name: "Sunset Limited",
    operator: "Amtrak",
    type: "passenger",
    coordinates: [
      [-118.0, 34.0], // Los Angeles, CA
      [-117.5, 34.5],
      [-117.0, 35.0],
      [-116.5, 35.5], // Arizona
      [-116.0, 36.0],
      [-115.5, 36.5],
      [-115.0, 37.0], // Nevada
      [-114.5, 37.5],
      [-114.0, 38.0],
      [-113.5, 38.5], // Utah
      [-113.0, 39.0],
      [-112.5, 39.5],
      [-112.0, 40.0], // Colorado
      [-111.5, 40.5],
      [-111.0, 41.0],
      [-110.5, 41.5], // Wyoming
      [-110.0, 42.0],
      [-109.5, 42.5],
      [-109.0, 43.0]  // Montana
    ]
  },
  {
    name: "Empire Builder",
    operator: "Amtrak",
    type: "passenger",
    coordinates: [
      [-122.0, 48.0], // Seattle, WA
      [-121.5, 48.5],
      [-121.0, 49.0],
      [-120.5, 49.5], // Idaho
      [-120.0, 50.0],
      [-119.5, 50.5],
      [-119.0, 51.0], // Montana
      [-118.5, 51.5],
      [-118.0, 52.0],
      [-117.5, 52.5],
      [-117.0, 53.0],
      [-116.5, 53.5],
      [-116.0, 54.0], // North Dakota
      [-115.5, 54.5],
      [-115.0, 55.0],
      [-114.5, 55.5],
      [-114.0, 56.0], // Minnesota
      [-113.5, 56.5],
      [-113.0, 57.0],
      [-112.5, 57.5],
      [-112.0, 58.0]  // Chicago, IL
    ]
  },
  {
    name: "BNSF Transcon",
    operator: "BNSF Railway",
    type: "freight",
    coordinates: [
      [-118.0, 34.0], // Los Angeles, CA
      [-117.0, 34.5],
      [-116.0, 35.0], // Arizona
      [-115.0, 35.5],
      [-114.0, 36.0],
      [-113.0, 36.5], // New Mexico
      [-112.0, 37.0],
      [-111.0, 37.5],
      [-110.0, 38.0], // Colorado
      [-109.0, 38.5],
      [-108.0, 39.0],
      [-107.0, 39.5], // Kansas
      [-106.0, 40.0],
      [-105.0, 40.5],
      [-104.0, 41.0], // Nebraska
      [-103.0, 41.5],
      [-102.0, 42.0],
      [-101.0, 42.5], // Iowa
      [-100.0, 43.0],
      [-99.0, 43.5],
      [-98.0, 44.0], // Illinois
      [-97.0, 44.5],
      [-96.0, 45.0],
      [-95.0, 45.5], // Minnesota
      [-94.0, 46.0],
      [-93.0, 46.5],
      [-92.0, 47.0]  // Chicago, IL
    ]
  },
  {
    name: "Union Pacific Overland Route",
    operator: "Union Pacific",
    type: "freight",
    coordinates: [
      [-122.0, 38.0], // San Francisco, CA
      [-121.0, 38.5],
      [-120.0, 39.0], // Nevada
      [-119.0, 39.5],
      [-118.0, 40.0],
      [-117.0, 40.5], // Utah
      [-116.0, 41.0],
      [-115.0, 41.5],
      [-114.0, 42.0], // Wyoming
      [-113.0, 42.5],
      [-112.0, 43.0],
      [-111.0, 43.5], // Nebraska
      [-110.0, 44.0],
      [-109.0, 44.5],
      [-108.0, 45.0],
      [-107.0, 45.5], // Iowa
      [-106.0, 46.0],
      [-105.0, 46.5],
      [-104.0, 47.0], // Illinois
      [-103.0, 47.5],
      [-102.0, 48.0],
      [-101.0, 48.5],
      [-100.0, 49.0]  // Chicago, IL
    ]
  },
  {
    name: "CSX Main Line",
    operator: "CSX Transportation",
    type: "freight",
    coordinates: [
      [-84.0, 34.0], // Atlanta, GA
      [-84.5, 34.5],
      [-85.0, 35.0], // Tennessee
      [-85.5, 35.5],
      [-86.0, 36.0],
      [-86.5, 36.5],
      [-87.0, 37.0], // Kentucky
      [-87.5, 37.5],
      [-88.0, 38.0],
      [-88.5, 38.5], // Illinois
      [-89.0, 39.0],
      [-89.5, 39.5],
      [-90.0, 40.0], // Missouri
      [-90.5, 40.5],
      [-91.0, 41.0],
      [-91.5, 41.5], // Iowa
      [-92.0, 42.0],
      [-92.5, 42.5],
      [-93.0, 43.0]  // Minneapolis, MN
    ]
  }
];

export default RAILWAYS;
