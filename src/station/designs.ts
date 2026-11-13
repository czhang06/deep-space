// Ship design presets: each one sets the outline (length:width, where the bow tapers), whether
// escorts dock in mirrored pairs or one side at a time, which structures it favours, which
// escort classes it uses, and its colours. The generator and the models read the active one.

export type EscortClass = "frigate" | "hauler" | "lancer" | "cruiser";

export interface Weights {
  hull: number;
  wing: number;
  battery: number;
  superstructure: number;
  turret: number;
  mast: number;
  needles: number;
  spire: number;
  hangar: number;
  raise: number;
}

export interface Design {
  id: string;
  name: string;
  /** length : width the ship grows toward */
  ratio: number;
  /** fraction of the length (from the stern) where the outline starts tapering to the bow */
  taperStart: number;
  /** extra taper at the stern (0 = square stern) */
  sternTaper: number;
  /** true: escorts dock in mirrored pairs; false: one side at a time */
  mirrored: boolean;
  /** how far one side may run ahead of the other when not mirrored (0 = balanced) */
  lopsided: number;
  weights: Weights;
  escorts: EscortClass[];
  /** colour overrides for the base palette */
  palette: Record<string, string>;
  /** surface finish for the structural materials: higher metalness reads as bare steel */
  finish?: { metalness: number; roughness: number; reflections: number };
  /** escort ships carry forward needle banks along their flanks */
  escortNeedles?: boolean;
}

const base: Weights = {
  hull: 3,
  wing: 3.2,
  battery: 1.2,
  superstructure: 2,
  turret: 1,
  mast: 1.1,
  needles: 1.3,
  spire: 1.1,
  hangar: 0.6,
  raise: 1.4
};

export const DESIGNS: Design[] = [
  {
    id: "lance",
    name: "Needle Lance",
    ratio: 1.6,
    taperStart: 0.55,
    sternTaper: 0.1,
    mirrored: false,
    lopsided: 0.6,
    weights: { ...base, superstructure: 0.6, spire: 0.4, needles: 3.6, mast: 1.6, turret: 0.4, battery: 0.5 },
    escorts: ["lancer", "frigate"],
    // Dark battleship grey: gunmetal plating, darker trim, steel highlights, warm windows.
    palette: {
      hull: "#5e636b",
      hullShade: "#4b4f56",
      panel: "#34373d",
      plate: "#6f747b",
      bone: "#7b8087",
      truss: "#686e76",
      gunmetal: "#3d4147",
      gold: "#8d949c",
      accent: "#4f565f",
      graphite: "#202226",
      windowGlow: "#ffd9a0"
    },
    finish: { metalness: 0.6, roughness: 0.48, reflections: 0.28 },
    escortNeedles: true
  },
  {
    id: "gothic",
    name: "Gothic Spire",
    ratio: 1.25,
    taperStart: 0.7,
    sternTaper: 0,
    mirrored: false,
    lopsided: 0.35,
    weights: { ...base, superstructure: 3.5, spire: 1.6 },
    escorts: ["frigate", "cruiser", "hauler"],
    palette: {}
  },
  {
    id: "raft",
    name: "Flotilla Raft",
    ratio: 1.0,
    taperStart: 0.85,
    sternTaper: 0,
    mirrored: false,
    lopsided: 0.8,
    weights: { ...base, wing: 4.5, superstructure: 0.9, spire: 0.5, mast: 1.4, needles: 1.0, turret: 1.4, battery: 0.8 },
    escorts: ["frigate", "hauler", "lancer", "cruiser"],
    palette: {
      hull: "#6f7d8e",
      hullShade: "#56637a",
      panel: "#3e4858",
      truss: "#7a8597",
      gunmetal: "#4c5668",
      accent: "#e0742c",
      gold: "#d98a3c",
      bone: "#c9d2dc",
      windowGlow: "#ffd28a"
    }
  },
  {
    id: "wedge",
    name: "Obsidian Wedge",
    ratio: 1.3,
    taperStart: 0.05,
    sternTaper: 0,
    mirrored: true,
    lopsided: 0,
    weights: { ...base, superstructure: 0.8, spire: 0.3, mast: 0.4, needles: 2.0, turret: 1.6, battery: 2.0, hangar: 0.3 },
    escorts: ["cruiser", "frigate"],
    palette: {
      hull: "#2c2f36",
      hullShade: "#22252b",
      panel: "#16181c",
      plate: "#3a3e46",
      truss: "#3a3e46",
      gunmetal: "#33363d",
      accent: "#d8342a",
      gold: "#c2402f",
      bone: "#4a4e57",
      windowGlow: "#ff5a3c"
    }
  },
  {
    id: "crown",
    name: "Ivory Crown",
    ratio: 1.35,
    taperStart: 0.6,
    sternTaper: 0.25,
    mirrored: true,
    lopsided: 0,
    weights: { ...base, superstructure: 3.0, spire: 2.4, needles: 1.6, mast: 0.6, turret: 0.6, battery: 0.6 },
    escorts: ["frigate", "cruiser"],
    palette: {
      hull: "#e4ddcd",
      hullShade: "#cfc6b2",
      panel: "#a99d84",
      plate: "#f3ede0",
      truss: "#b8984f",
      gunmetal: "#a38549",
      gold: "#d6ad55",
      accent: "#b8862f",
      bone: "#fbf8f0",
      windowGlow: "#ffe2a6"
    }
  }
];

let active = DESIGNS[0];

export function activeDesign(): Design {
  return active;
}

/** Picks the design by id (unknown ids keep the default). */
export function setActiveDesign(id: string | null | undefined): Design {
  active = DESIGNS.find((design) => design.id === id) ?? DESIGNS[0];
  return active;
}
