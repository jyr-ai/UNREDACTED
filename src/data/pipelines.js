/**
 * Major US oil and gas pipeline coordinates
 * Simplified line paths for map visualization
 */

export const OIL_PIPELINES = [
  {
    name: "Keystone Pipeline System",
    type: "crude",
    operator: "TC Energy",
    coordinates: [
      [-101.0, 49.0], // Alberta, Canada border
      [-100.0, 48.5],
      [-99.0, 48.0],
      [-98.0, 47.5],
      [-97.0, 47.0], // North Dakota
      [-96.0, 46.5],
      [-95.0, 46.0],
      [-94.0, 45.5], // Minnesota
      [-93.0, 45.0],
      [-92.0, 44.5],
      [-91.0, 44.0], // Wisconsin
      [-90.0, 43.5],
      [-89.0, 43.0],
      [-88.0, 42.5], // Illinois
      [-87.0, 42.0],
      [-86.0, 41.5], // Indiana
      [-85.0, 41.0],
      [-84.0, 40.5], // Ohio
      [-83.0, 40.0],
      [-82.0, 39.5], // Pennsylvania
      [-81.0, 39.0],
      [-80.0, 38.5], // West Virginia
      [-79.0, 38.0],
      [-78.0, 37.5], // Virginia
      [-77.0, 37.0]  // Maryland
    ]
  },
  {
    name: "Colonial Pipeline",
    type: "refined",
    operator: "Colonial Pipeline Company",
    coordinates: [
      [-96.0, 30.0], // Houston, TX
      [-95.5, 30.5],
      [-95.0, 31.0],
      [-94.5, 31.5], // Louisiana
      [-94.0, 32.0],
      [-93.5, 32.5],
      [-93.0, 33.0], // Arkansas
      [-92.5, 33.5],
      [-92.0, 34.0],
      [-91.5, 34.5], // Mississippi
      [-91.0, 35.0],
      [-90.5, 35.5],
      [-90.0, 36.0], // Tennessee
      [-89.5, 36.5],
      [-89.0, 37.0],
      [-88.5, 37.5], // Kentucky
      [-88.0, 38.0],
      [-87.5, 38.5],
      [-87.0, 39.0], // Illinois
      [-86.5, 39.5],
      [-86.0, 40.0], // Indiana
      [-85.5, 40.5],
      [-85.0, 41.0], // Ohio
      [-84.5, 41.5],
      [-84.0, 42.0], // Michigan
      [-83.5, 42.5],
      [-83.0, 43.0]  // Detroit area
    ]
  },
  {
    name: "Dakota Access Pipeline",
    type: "crude",
    operator: "Energy Transfer Partners",
    coordinates: [
      [-103.0, 46.0], // North Dakota
      [-102.5, 45.5],
      [-102.0, 45.0],
      [-101.5, 44.5],
      [-101.0, 44.0], // South Dakota
      [-100.5, 43.5],
      [-100.0, 43.0],
      [-99.5, 42.5],
      [-99.0, 42.0], // Nebraska
      [-98.5, 41.5],
      [-98.0, 41.0],
      [-97.5, 40.5],
      [-97.0, 40.0], // Iowa
      [-96.5, 39.5],
      [-96.0, 39.0],
      [-95.5, 38.5], // Illinois
      [-95.0, 38.0],
      [-94.5, 37.5]  // Patoka, IL terminal
    ]
  },
  {
    name: "Trans-Alaska Pipeline",
    type: "crude",
    operator: "Alyeska Pipeline Service Company",
    coordinates: [
      [-148.0, 70.0], // Prudhoe Bay, AK
      [-147.5, 69.5],
      [-147.0, 69.0],
      [-146.5, 68.5],
      [-146.0, 68.0],
      [-145.5, 67.5],
      [-145.0, 67.0],
      [-144.5, 66.5],
      [-144.0, 66.0],
      [-143.5, 65.5],
      [-143.0, 65.0],
      [-142.5, 64.5],
      [-142.0, 64.0],
      [-141.5, 63.5],
      [-141.0, 63.0],
      [-140.5, 62.5],
      [-140.0, 62.0],
      [-139.5, 61.5],
      [-139.0, 61.0],
      [-138.5, 60.5],
      [-138.0, 60.0]  // Valdez, AK
    ]
  },
  {
    name: "Gulf Coast Pipeline",
    type: "natural gas",
    operator: "Kinder Morgan",
    coordinates: [
      [-94.0, 30.0], // Texas Gulf Coast
      [-93.5, 30.5],
      [-93.0, 31.0],
      [-92.5, 31.5],
      [-92.0, 32.0], // Louisiana
      [-91.5, 32.5],
      [-91.0, 33.0],
      [-90.5, 33.5],
      [-90.0, 34.0], // Mississippi
      [-89.5, 34.5],
      [-89.0, 35.0],
      [-88.5, 35.5], // Alabama
      [-88.0, 36.0],
      [-87.5, 36.5],
      [-87.0, 37.0], // Tennessee
      [-86.5, 37.5],
      [-86.0, 38.0], // Kentucky
      [-85.5, 38.5],
      [-85.0, 39.0]  // Ohio Valley
    ]
  }
];

export default OIL_PIPELINES;
