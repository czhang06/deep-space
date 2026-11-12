// The station's building blocks. Each module occupies grid cells and has docking ports on its
// edges. A port points outward and names a pool: the set of modules allowed to dock there.
// The generator grows the station by snapping modules onto open ports, jigsaw style.
//
// Directions: 0 = +x (east), 1 = +z (south), 2 = -x (west), 3 = -z (north).

export type Dir = 0 | 1 | 2 | 3;

export type PieceKind =
  | "core"
  | "node"
  | "ring"
  | "corridor"
  | "dock"
  | "lab"
  | "observatory"
  | "solar"
  | "greenhouse"
  | "dish";

export type PoolName = "core" | "corridor" | "node" | "lab" | "side";

export interface Connector {
  x: number;
  z: number;
  dir: Dir;
  pool: PoolName;
  /** false = other modules can dock here, but this module can't use it to attach itself */
  inbound?: boolean;
}

export interface PieceDef {
  kind: PieceKind;
  name: string;
  /** footprint in cells along local x and z */
  w: number;
  d: number;
  /** decks when first built, and how many it can grow to */
  levels: number;
  maxLevels: number;
  cost: number;
  /** earliest build number this module can appear at */
  minIndex: number;
  maxCount: number;
  /** cap as a fraction of all modules, so small add-ons can't take over the station */
  maxShare?: number;
  connectors: Connector[];
}

/** How strongly open ports of each pool attract the next module. */
export const POOL_PULL: Record<PoolName, number> = {
  core: 2,
  corridor: 1.8,
  node: 1.6,
  lab: 1,
  side: 0.45
};

const allSides = (pool: PoolName): Connector[] => [
  { x: 0, z: 0, dir: 0, pool },
  { x: 0, z: 0, dir: 1, pool },
  { x: 0, z: 0, dir: 2, pool },
  { x: 0, z: 0, dir: 3, pool }
];

const ringOf2x2 = (pool: PoolName): Connector[] => [
  { x: 1, z: 0, dir: 0, pool },
  { x: 1, z: 1, dir: 0, pool },
  { x: 0, z: 1, dir: 1, pool },
  { x: 1, z: 1, dir: 1, pool },
  { x: 0, z: 0, dir: 2, pool },
  { x: 0, z: 1, dir: 2, pool },
  { x: 0, z: 0, dir: 3, pool },
  { x: 1, z: 0, dir: 3, pool }
];

const straight = (sidePool: PoolName | null): Connector[] => [
  { x: 0, z: 0, dir: 0, pool: "corridor" },
  { x: 0, z: 0, dir: 2, pool: "corridor" },
  ...(sidePool
    ? ([
        { x: 0, z: 0, dir: 1, pool: sidePool, inbound: false },
        { x: 0, z: 0, dir: 3, pool: sidePool, inbound: false }
      ] as Connector[])
    : [])
];

export const PIECES: Record<PieceKind, PieceDef> = {
  core: {
    kind: "core",
    name: "Command core",
    w: 2,
    d: 2,
    levels: 2,
    maxLevels: 6,
    cost: 0,
    minIndex: 0,
    maxCount: 1,
    connectors: ringOf2x2("core")
  },
  node: {
    kind: "node",
    name: "Hab node",
    w: 1,
    d: 1,
    levels: 1,
    maxLevels: 4,
    cost: 20,
    minIndex: 1,
    maxCount: Infinity,
    connectors: allSides("node")
  },
  ring: {
    kind: "ring",
    name: "Ring habitat",
    w: 2,
    d: 2,
    levels: 1,
    maxLevels: 3,
    cost: 80,
    minIndex: 22,
    maxCount: 3,
    connectors: ringOf2x2("node")
  },
  corridor: {
    kind: "corridor",
    name: "Corridor",
    w: 1,
    d: 1,
    levels: 1,
    maxLevels: 1,
    cost: 8,
    minIndex: 1,
    maxCount: Infinity,
    connectors: straight("side")
  },
  dock: {
    kind: "dock",
    name: "Docking port",
    w: 1,
    d: 1,
    levels: 1,
    maxLevels: 1,
    cost: 35,
    minIndex: 6,
    maxCount: 4,
    connectors: straight(null)
  },
  lab: {
    kind: "lab",
    name: "Lab module",
    w: 2,
    d: 1,
    levels: 1,
    maxLevels: 2,
    cost: 40,
    minIndex: 3,
    maxCount: 8,
    connectors: [
      { x: 0, z: 0, dir: 2, pool: "lab" },
      { x: 1, z: 0, dir: 0, pool: "lab" },
      { x: 0, z: 0, dir: 1, pool: "side", inbound: false },
      { x: 1, z: 0, dir: 1, pool: "side", inbound: false },
      { x: 0, z: 0, dir: 3, pool: "side", inbound: false },
      { x: 1, z: 0, dir: 3, pool: "side", inbound: false }
    ]
  },
  observatory: {
    kind: "observatory",
    name: "Observatory",
    w: 1,
    d: 2,
    levels: 1,
    maxLevels: 1,
    cost: 45,
    minIndex: 8,
    maxCount: 2,
    connectors: [
      { x: 0, z: 0, dir: 3, pool: "lab" },
      { x: 0, z: 0, dir: 0, pool: "side", inbound: false },
      { x: 0, z: 1, dir: 2, pool: "side", inbound: false }
    ]
  },
  solar: {
    kind: "solar",
    name: "Solar array",
    w: 1,
    d: 1,
    levels: 1,
    maxLevels: 1,
    cost: 14,
    minIndex: 2,
    maxCount: Infinity,
    maxShare: 0.2,
    connectors: [{ x: 0, z: 0, dir: 3, pool: "side" }]
  },
  greenhouse: {
    kind: "greenhouse",
    name: "Greenhouse dome",
    w: 1,
    d: 1,
    levels: 1,
    maxLevels: 1,
    cost: 18,
    minIndex: 4,
    maxCount: Infinity,
    maxShare: 0.08,
    connectors: [{ x: 0, z: 0, dir: 3, pool: "side" }]
  },
  dish: {
    kind: "dish",
    name: "Comms dish",
    w: 1,
    d: 1,
    levels: 1,
    maxLevels: 1,
    cost: 12,
    minIndex: 5,
    maxCount: 6,
    connectors: [{ x: 0, z: 0, dir: 3, pool: "side" }]
  }
};

/** Which modules may dock onto a port of each pool, and how likely each is. */
export const POOLS: Record<PoolName, Array<{ kind: PieceKind; weight: number }>> = {
  core: [
    { kind: "corridor", weight: 5 },
    { kind: "node", weight: 3 },
    { kind: "lab", weight: 4 },
    { kind: "observatory", weight: 1 },
    { kind: "solar", weight: 1.5 }
  ],
  corridor: [
    { kind: "corridor", weight: 5 },
    { kind: "node", weight: 3.5 },
    { kind: "dock", weight: 1 },
    { kind: "lab", weight: 1.2 },
    { kind: "ring", weight: 0.6 }
  ],
  node: [
    { kind: "corridor", weight: 6 },
    { kind: "lab", weight: 1.5 },
    { kind: "solar", weight: 1 },
    { kind: "node", weight: 0.3 }
  ],
  lab: [
    { kind: "node", weight: 2 },
    { kind: "corridor", weight: 2 },
    { kind: "lab", weight: 1 },
    { kind: "observatory", weight: 1 }
  ],
  side: [
    { kind: "solar", weight: 4 },
    { kind: "greenhouse", weight: 1.5 },
    { kind: "dish", weight: 1 }
  ]
};

/** Cost to add one deck to a node or the core. */
export const RAISE_COST = 18;

/** Later modules cost more, so growth stays steady instead of exploding. */
export function costScale(index: number): number {
  return 1 + index / 45;
}
