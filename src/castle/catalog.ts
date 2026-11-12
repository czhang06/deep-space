// The castle's building blocks. Each piece occupies grid cells and has connectors on its edges.
// A connector points outward and names a pool: the set of pieces allowed to attach there.
// The generator grows the castle by snapping pieces onto open connectors, jigsaw style.
//
// Directions: 0 = +x (east), 1 = +z (south), 2 = -x (west), 3 = -z (north).

export type Dir = 0 | 1 | 2 | 3;

export type PieceKind =
  | "keep"
  | "tower"
  | "greatTower"
  | "wall"
  | "gate"
  | "hall"
  | "chapel"
  | "house"
  | "garden"
  | "well";

export type PoolName = "keep" | "wall" | "tower" | "hall" | "yard";

export interface Connector {
  x: number;
  z: number;
  dir: Dir;
  pool: PoolName;
  /** false = other pieces can attach here, but this piece can't use it to attach itself */
  inbound?: boolean;
}

export interface PieceDef {
  kind: PieceKind;
  name: string;
  /** footprint in cells along local x and z */
  w: number;
  d: number;
  /** storeys when first built, and how high it can be raised */
  levels: number;
  maxLevels: number;
  cost: number;
  /** earliest build number this piece can appear at */
  minIndex: number;
  maxCount: number;
  /** cap as a fraction of all pieces, so small buildings can't take over the castle */
  maxShare?: number;
  connectors: Connector[];
}

/** How strongly open connectors of each pool attract the next piece. */
export const POOL_PULL: Record<PoolName, number> = {
  keep: 2,
  wall: 1.8,
  tower: 1.6,
  hall: 1,
  yard: 0.3
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

export const PIECES: Record<PieceKind, PieceDef> = {
  keep: {
    kind: "keep",
    name: "Keep",
    w: 2,
    d: 2,
    levels: 2,
    maxLevels: 6,
    cost: 0,
    minIndex: 0,
    maxCount: 1,
    connectors: ringOf2x2("keep")
  },
  tower: {
    kind: "tower",
    name: "Round tower",
    w: 1,
    d: 1,
    levels: 2,
    maxLevels: 5,
    cost: 20,
    minIndex: 1,
    maxCount: Infinity,
    connectors: allSides("tower")
  },
  greatTower: {
    kind: "greatTower",
    name: "Great tower",
    w: 2,
    d: 2,
    levels: 3,
    maxLevels: 7,
    cost: 70,
    minIndex: 24,
    maxCount: 4,
    connectors: ringOf2x2("tower")
  },
  wall: {
    kind: "wall",
    name: "Curtain wall",
    w: 1,
    d: 1,
    levels: 1,
    maxLevels: 1,
    cost: 8,
    minIndex: 1,
    maxCount: Infinity,
    connectors: [
      { x: 0, z: 0, dir: 0, pool: "wall" },
      { x: 0, z: 0, dir: 2, pool: "wall" },
      { x: 0, z: 0, dir: 1, pool: "yard", inbound: false },
      { x: 0, z: 0, dir: 3, pool: "yard", inbound: false }
    ]
  },
  gate: {
    kind: "gate",
    name: "Gatehouse",
    w: 1,
    d: 1,
    levels: 2,
    maxLevels: 2,
    cost: 35,
    minIndex: 6,
    maxCount: 4,
    connectors: [
      { x: 0, z: 0, dir: 0, pool: "wall" },
      { x: 0, z: 0, dir: 2, pool: "wall" },
      { x: 0, z: 0, dir: 1, pool: "yard", inbound: false },
      { x: 0, z: 0, dir: 3, pool: "yard", inbound: false }
    ]
  },
  hall: {
    kind: "hall",
    name: "Great hall",
    w: 2,
    d: 1,
    levels: 1,
    maxLevels: 2,
    cost: 40,
    minIndex: 3,
    maxCount: 6,
    connectors: [
      { x: 0, z: 0, dir: 2, pool: "hall" },
      { x: 1, z: 0, dir: 0, pool: "hall" },
      { x: 0, z: 0, dir: 1, pool: "yard", inbound: false },
      { x: 1, z: 0, dir: 1, pool: "yard", inbound: false },
      { x: 0, z: 0, dir: 3, pool: "yard", inbound: false },
      { x: 1, z: 0, dir: 3, pool: "yard", inbound: false }
    ]
  },
  chapel: {
    kind: "chapel",
    name: "Chapel",
    w: 1,
    d: 2,
    levels: 1,
    maxLevels: 1,
    cost: 45,
    minIndex: 8,
    maxCount: 2,
    connectors: [
      { x: 0, z: 0, dir: 3, pool: "hall" },
      { x: 0, z: 1, dir: 1, pool: "yard", inbound: false },
      { x: 0, z: 0, dir: 0, pool: "yard", inbound: false },
      { x: 0, z: 1, dir: 2, pool: "yard", inbound: false }
    ]
  },
  house: {
    kind: "house",
    name: "Cottage",
    w: 1,
    d: 1,
    levels: 1,
    maxLevels: 1,
    cost: 14,
    minIndex: 2,
    maxCount: Infinity,
    maxShare: 0.16,
    connectors: [{ x: 0, z: 0, dir: 3, pool: "yard" }]
  },
  garden: {
    kind: "garden",
    name: "Garden",
    w: 1,
    d: 1,
    levels: 0,
    maxLevels: 0,
    cost: 8,
    minIndex: 2,
    maxCount: Infinity,
    maxShare: 0.1,
    connectors: [{ x: 0, z: 0, dir: 3, pool: "yard" }]
  },
  well: {
    kind: "well",
    name: "Well",
    w: 1,
    d: 1,
    levels: 0,
    maxLevels: 0,
    cost: 10,
    minIndex: 4,
    maxCount: 3,
    connectors: [{ x: 0, z: 0, dir: 3, pool: "yard" }]
  }
};

/** Which pieces may snap onto a connector of each pool, and how likely each is. */
export const POOLS: Record<PoolName, Array<{ kind: PieceKind; weight: number }>> = {
  keep: [
    { kind: "wall", weight: 5 },
    { kind: "tower", weight: 4 },
    { kind: "hall", weight: 4 },
    { kind: "chapel", weight: 1.5 },
    { kind: "garden", weight: 1 },
    { kind: "well", weight: 0.6 }
  ],
  wall: [
    { kind: "wall", weight: 6 },
    { kind: "tower", weight: 3 },
    { kind: "gate", weight: 1 },
    { kind: "greatTower", weight: 0.5 }
  ],
  tower: [
    { kind: "wall", weight: 7 },
    { kind: "hall", weight: 1 },
    { kind: "tower", weight: 0.3 }
  ],
  hall: [
    { kind: "tower", weight: 2 },
    { kind: "wall", weight: 2 },
    { kind: "hall", weight: 1 },
    { kind: "chapel", weight: 1 },
    { kind: "house", weight: 1.5 }
  ],
  yard: [
    { kind: "house", weight: 4 },
    { kind: "garden", weight: 2.5 },
    { kind: "well", weight: 0.6 }
  ]
};

/** Cost to raise a tower or keep by one storey. */
export const RAISE_COST = 18;

/** Later pieces cost more, so growth stays steady instead of exploding. */
export function costScale(index: number): number {
  return 1 + index / 45;
}
