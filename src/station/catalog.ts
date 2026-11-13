// The ship's building blocks. The ship grows along a spine (local x, bow at +x) and outward:
//   - the bridge section sits near the stern, with the engine bank behind it
//   - hull segments extend the ship forward; the armoured prow always rides at the front tip
//   - escort ships dock along the flanks, tier by tier, widest aft and tapering to the bow, so
//     the ship keeps its design's length-to-width shape instead of only getting longer; each
//     escort may sit a deck higher or lower than the one inboard of it, so the flanks terrace
//   - the main hull's deck has two side lanes for city blocks and sky hulls (small hulls
//     raised on pylons); keel spires hang under the hull and escorts
//   - the main hull carries superstructure (which stacks into towers, crowned with spires);
//     hull and escorts carry turrets, lattice masts and needle arrays; hull segments can hang
//     a hangar
//
// Costs are in focused minutes (build points). Later parts cost a little more over time.

export type PieceKind =
  | "core"
  | "engines"
  | "prow"
  | "hull"
  | "wing"
  | "battery"
  | "superstructure"
  | "spire"
  | "turret"
  | "hangar"
  | "mast"
  | "needles"
  | "district"
  | "keel"
  | "pod";

export interface PieceDef {
  kind: PieceKind;
  name: string;
  /** decks when first built, and how many it can grow to */
  levels: number;
  maxLevels: number;
  cost: number;
}

export const PIECES: Record<PieceKind, PieceDef> = {
  core: { kind: "core", name: "Bridge section", levels: 2, maxLevels: 6, cost: 0 },
  engines: { kind: "engines", name: "Engine bank", levels: 1, maxLevels: 1, cost: 25 },
  prow: { kind: "prow", name: "Armoured prow", levels: 1, maxLevels: 1, cost: 25 },
  hull: { kind: "hull", name: "Hull segment", levels: 1, maxLevels: 1, cost: 15 },
  wing: { kind: "wing", name: "Escort ships", levels: 1, maxLevels: 1, cost: 15 },
  mast: { kind: "mast", name: "Lattice mast", levels: 1, maxLevels: 1, cost: 12 },
  needles: { kind: "needles", name: "Needle array", levels: 1, maxLevels: 1, cost: 10 },
  battery: { kind: "battery", name: "Broadside battery", levels: 1, maxLevels: 1, cost: 18 },
  superstructure: { kind: "superstructure", name: "Superstructure", levels: 1, maxLevels: 4, cost: 20 },
  spire: { kind: "spire", name: "Spire cluster", levels: 1, maxLevels: 1, cost: 10 },
  turret: { kind: "turret", name: "Dorsal turret", levels: 1, maxLevels: 1, cost: 15 },
  hangar: { kind: "hangar", name: "Hangar bay", levels: 1, maxLevels: 1, cost: 18 },
  district: { kind: "district", name: "City block", levels: 1, maxLevels: 4, cost: 14 },
  keel: { kind: "keel", name: "Keel spire", levels: 1, maxLevels: 1, cost: 14 },
  pod: { kind: "pod", name: "Sky hull", levels: 1, maxLevels: 1, cost: 16 }
};

/** Cost to add one deck to the bridge tower or a superstructure. */
export const RAISE_COST = 12;

/** Later parts cost more, so growth stays steady instead of exploding. */
export function costScale(index: number): number {
  return 1 + index / 45;
}
