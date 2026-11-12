// Grows a space station one step at a time by snapping pieces onto open connectors (jigsaw style),
// or adding a deck to an existing node or the core. Fully deterministic for a given seed, so the
// whole station can be rebuilt from (seed, build points) and never reshuffles.

import { PIECES, POOLS, POOL_PULL, RAISE_COST, costScale } from "./catalog.ts";
import type { Dir, PieceKind, PoolName } from "./catalog.ts";
import { createRng, pickWeighted, shuffle } from "./rng.ts";

export const DX = [1, 0, -1, 0] as const;
export const DZ = [0, 1, 0, -1] as const;

export interface PlacedPiece {
  id: number;
  kind: PieceKind;
  /** origin cell (min x / min z corner) */
  x: number;
  z: number;
  rot: number;
  /** footprint after rotation */
  w: number;
  d: number;
  cells: Array<[number, number]>;
  baseLevels: number;
  /** stable per-piece variation (roof style, banner colour, ...) */
  variant: number;
}

export type PlanStep =
  | { type: "place"; index: number; piece: PlacedPiece; cost: number; total: number }
  | { type: "raise"; index: number; target: number; level: number; cost: number; total: number };

interface OpenConnector {
  x: number;
  z: number;
  dir: Dir;
  pool: PoolName;
  owner: number;
}

const key = (x: number, z: number) => `${x},${z}`;

export function rotateCell(x: number, z: number, w: number, d: number, rot: number): [number, number] {
  switch (rot & 3) {
    case 1:
      return [d - 1 - z, x];
    case 2:
      return [w - 1 - x, d - 1 - z];
    case 3:
      return [z, w - 1 - x];
    default:
      return [x, z];
  }
}

export class StationPlanner {
  readonly seed: number;
  readonly steps: PlanStep[] = [];
  readonly pieces: PlacedPiece[] = [];
  private readonly rng: () => number;
  private readonly occupied = new Map<string, number>();
  private open: OpenConnector[] = [];
  private readonly counts = new Map<PieceKind, number>();
  private readonly plannedLevels: number[] = [];

  constructor(seed: number) {
    this.seed = seed;
    this.rng = createRng(seed);
    const core = this.makePiece("core", -1, -1, 0);
    this.commit(core);
    this.steps.push({ type: "place", index: 0, piece: core, cost: 0, total: 0 });
  }

  /** Plans steps until their combined cost passes `points` (plus one step beyond). */
  ensurePoints(points: number): void {
    while (this.lastTotal() <= points) {
      if (!this.next()) {
        return;
      }
    }
  }

  ensureSteps(count: number): void {
    while (this.steps.length < count) {
      if (!this.next()) {
        return;
      }
    }
  }

  lastTotal(): number {
    return this.steps[this.steps.length - 1]?.total ?? 0;
  }

  isOccupied(x: number, z: number): boolean {
    return this.occupied.has(key(x, z));
  }

  pieceAt(x: number, z: number): number | undefined {
    return this.occupied.get(key(x, z));
  }

  next(): PlanStep | null {
    const index = this.steps.length;
    const scale = costScale(index);
    const total = this.lastTotal();

    const raiseTargets = this.raiseTargets(index);
    if (raiseTargets.length > 0 && this.rng() < 0.2) {
      return this.pushRaise(index, raiseTargets, scale, total);
    }

    const placed = this.tryPlace(index);
    if (placed) {
      const cost = Math.round(PIECES[placed.kind].cost * scale);
      const step: PlanStep = { type: "place", index, piece: placed, cost, total: total + cost };
      this.steps.push(step);
      return step;
    }

    if (raiseTargets.length > 0) {
      return this.pushRaise(index, raiseTargets, scale, total);
    }
    return null;
  }

  private pushRaise(index: number, targets: number[], scale: number, total: number): PlanStep {
    const target =
      pickWeighted(this.rng, targets, (id) => {
        const piece = this.pieces[id];
        const preference = piece.kind === "core" ? 3 : piece.kind === "ring" ? 1.5 : piece.kind === "lab" ? 0.4 : 1;
        return preference / (1 + this.plannedLevels[id] - piece.baseLevels);
      }) ?? targets[0];
    this.plannedLevels[target] += 1;
    const cost = Math.round(RAISE_COST * scale);
    const step: PlanStep = {
      type: "raise",
      index,
      target,
      level: this.plannedLevels[target],
      cost,
      total: total + cost
    };
    this.steps.push(step);
    return step;
  }

  /** Nodes and the core gain decks as the station matures. */
  private raiseTargets(index: number): number[] {
    const targets: number[] = [];
    for (const piece of this.pieces) {
      const def = PIECES[piece.kind];
      const cap = Math.min(def.maxLevels, def.levels + 1 + Math.floor(index / 14));
      if (this.plannedLevels[piece.id] < cap) {
        targets.push(piece.id);
      }
    }
    return targets;
  }

  private tryPlace(index: number): PlacedPiece | null {
    while (this.open.length > 0) {
      const connector = pickWeighted(this.rng, this.open, (open) => {
        const tx = open.x + DX[open.dir];
        const tz = open.z + DZ[open.dir];
        return POOL_PULL[open.pool] / (1 + Math.hypot(tx + 0.5, tz + 0.5) ** 1.6 * 0.08);
      });
      if (!connector) {
        return null;
      }

      const placed = this.fitAt(connector, index);
      this.open = this.open.filter((open) => open !== connector);
      if (placed) {
        return placed;
      }
      // Nothing fits here; the connector is dropped for good.
    }
    return null;
  }

  private fitAt(connector: OpenConnector, index: number): PlacedPiece | null {
    const targetX = connector.x + DX[connector.dir];
    const targetZ = connector.z + DZ[connector.dir];
    if (this.isOccupied(targetX, targetZ)) {
      return null;
    }
    const facing = ((connector.dir + 2) % 4) as Dir;

    let options = POOLS[connector.pool].filter((option) => {
      const def = PIECES[option.kind];
      const count = this.counts.get(option.kind) ?? 0;
      const shareCap = def.maxShare === undefined ? Infinity : 2 + def.maxShare * this.pieces.length;
      return def.minIndex <= index && count < def.maxCount && count < shareCap;
    });

    while (options.length > 0) {
      const option = pickWeighted(this.rng, options, (entry) => entry.weight);
      if (!option) {
        break;
      }
      options = options.filter((entry) => entry !== option);
      const def = PIECES[option.kind];

      for (const rot of shuffle(this.rng, [0, 1, 2, 3])) {
        for (const own of shuffle(this.rng, def.connectors)) {
          if (own.inbound === false || ((own.dir + rot) % 4) !== facing) {
            continue;
          }
          const [lx, lz] = rotateCell(own.x, own.z, def.w, def.d, rot);
          const piece = this.makePiece(option.kind, targetX - lx, targetZ - lz, rot);
          if (piece.cells.every(([x, z]) => !this.isOccupied(x, z))) {
            this.commit(piece, def.connectors.indexOf(own));
            return piece;
          }
        }
      }
    }
    return null;
  }

  private makePiece(kind: PieceKind, x: number, z: number, rot: number): PlacedPiece {
    const def = PIECES[kind];
    const odd = (rot & 1) === 1;
    const cells: Array<[number, number]> = [];
    for (let cx = 0; cx < def.w; cx += 1) {
      for (let cz = 0; cz < def.d; cz += 1) {
        const [rx, rz] = rotateCell(cx, cz, def.w, def.d, rot);
        cells.push([x + rx, z + rz]);
      }
    }
    return {
      id: this.pieces.length,
      kind,
      x,
      z,
      rot,
      w: odd ? def.d : def.w,
      d: odd ? def.w : def.d,
      cells,
      baseLevels: def.levels,
      variant: Math.floor(this.rng() * 1000)
    };
  }

  private commit(piece: PlacedPiece, usedConnector = -1): void {
    const def = PIECES[piece.kind];
    this.pieces.push(piece);
    this.plannedLevels[piece.id] = def.levels;
    this.counts.set(piece.kind, (this.counts.get(piece.kind) ?? 0) + 1);
    for (const [x, z] of piece.cells) {
      this.occupied.set(key(x, z), piece.id);
    }

    // Connectors that now point into this piece are used up.
    this.open = this.open.filter((open) => !this.isOccupied(open.x + DX[open.dir], open.z + DZ[open.dir]));

    def.connectors.forEach((own, connectorIndex) => {
      if (connectorIndex === usedConnector) {
        return;
      }
      const [lx, lz] = rotateCell(own.x, own.z, def.w, def.d, piece.rot);
      const dir = ((own.dir + piece.rot) % 4) as Dir;
      const x = piece.x + lx;
      const z = piece.z + lz;
      if (!this.isOccupied(x + DX[dir], z + DZ[dir])) {
        this.open.push({ x, z, dir, pool: own.pool, owner: piece.id });
      }
    });
  }
}

// ---- turning a plan + build points into what's on screen ------------------------------

export interface StationState {
  /** finished pieces, with their current storey count */
  pieces: Array<PlacedPiece & { levels: number }>;
  /** the step being worked on right now */
  current: PlanStep | null;
  progress: number;
  builtSteps: number;
  planner: StationPlanner;
}

const planners = new Map<number, StationPlanner>();

export function plannerFor(seed: number): StationPlanner {
  let planner = planners.get(seed);
  if (!planner) {
    planner = new StationPlanner(seed);
    planners.set(seed, planner);
  }
  return planner;
}

export function resolveStation(seed: number, points: number): StationState {
  const planner = plannerFor(seed);
  planner.ensurePoints(points);

  const levels = new Map<number, number>();
  const pieces: Array<PlacedPiece & { levels: number }> = [];
  let current: PlanStep | null = null;
  let builtSteps = 0;

  for (const step of planner.steps) {
    if (step.total > points) {
      current = step;
      break;
    }
    builtSteps += 1;
    if (step.type === "place") {
      levels.set(step.piece.id, step.piece.baseLevels);
      pieces.push({ ...step.piece, levels: step.piece.baseLevels });
    } else {
      levels.set(step.target, step.level);
    }
  }

  for (const piece of pieces) {
    piece.levels = levels.get(piece.id) ?? piece.baseLevels;
  }

  const progress = current ? Math.min(1, Math.max(0, (points - (current.total - current.cost)) / current.cost)) : 0;
  return { pieces, current, progress, builtSteps, planner };
}

export function stepLabel(step: PlanStep | null, planner: StationPlanner): string {
  if (!step) {
    return "Planning";
  }
  if (step.type === "place") {
    return PIECES[step.piece.kind].name;
  }
  const name = PIECES[planner.pieces[step.target].kind].name;
  return `${name}, deck ${step.level}`;
}
