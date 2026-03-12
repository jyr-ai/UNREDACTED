import { ORANGE } from '../theme/tokens.js';

// Graph nodes for donor web visualization
export const GN_NODES = [
  { id: 1, x: 310, y: 195, lbl: "Raytheon",           type: "COMPANY",   sc: 34 },
  { id: 2, x: 130, y: 110, lbl: "Sen. Hughes",         type: "POLITICIAN", sc: 28 },
  { id: 3, x: 130, y: 310, lbl: "Armed Services\nCmte", type: "COMMITTEE", sc: null },
  { id: 4, x: 310, y: 355, lbl: "DoD / Air Force",    type: "AGENCY",    sc: null },
  { id: 5, x: 490, y: 110, lbl: "Raytheon PAC",        type: "PAC",       sc: null },
  { id: 6, x: 490, y: 355, lbl: "F-35 Contract\n$5.1B", type: "CONTRACT", sc: null },
  { id: 7, x: 310, y: 55,  lbl: "Gen. Park → RTX VP", type: "PERSON",    sc: null },
];

// Graph edges
export const GN_EDGES = [
  { f: 5, t: 2, lbl: "$2.8M",      c: ORANGE          },
  { f: 2, t: 3, lbl: "Sits on",    c: "#555"           },
  { f: 3, t: 4, lbl: "Oversees",   c: "#555"           },
  { f: 4, t: 6, lbl: "Awarded",    c: "#FFB84D"        },
  { f: 6, t: 1, lbl: "Recipient",  c: "#4A7FFF"        },
  { f: 1, t: 5, lbl: "Controls",   c: "#9966CC"        },
  { f: 7, t: 4, lbl: "Fmr. role",  c: "#555"           },
  { f: 7, t: 1, lbl: "Now at RTX", c: ORANGE           },
];

// Node colors by type
export const NODE_COL = {
  COMPANY: "#4A7FFF",
  POLITICIAN: ORANGE,
  COMMITTEE: "#9966CC",
  AGENCY: "#00AADD",
  PAC: ORANGE,
  CONTRACT: "#FFB84D",
  PERSON: "#AAAAAA",
};
