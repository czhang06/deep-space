// Grows a ship one step at a time, following the active design preset (see designs.ts). Each
// step either adds a part (a hull segment to lengthen it, an escort or battery to widen it,
// superstructure, a spire, a turret, a lattice mast, a needle array, a hangar) or adds a deck
// to the bridge tower or a superstructure. The ship grows toward the design's length:width
// ratio: when it gets too long it grows outward, filling a rounded outline that tapers at the
// bow. Escorts dock in mirrored pairs or one side at a time, depending on the design. Fully
// deterministic for a given seed and design, so the whole ship is rebuilt from
// (seed, build points) and never reshuffles.
//
// Grid: x = cells along the spine (bow at +x). The spine is tier 0 and spans z -1..1; escort
// tier t sits at z = side * (1 + t), or on both sides for a mirrored pair (side 0).
// layer 0 = hull level, 1 = on deck, 2 = on top of a superstructure, -1 = under the keel.
// The spine's deck has a centre position (z 0) and two side lanes (z -1 and 1); a segment uses
// either the centre or its lanes. Escorts carry an elevation, and everything on them inherits it.

import { PIECES, RAISE_COST, costScale, type PieceKind } from "./catalog.ts";
import { activeDesign, type Design } from "./designs.ts";
import { createRng, pickWeighted } from "./rng.ts";

export const DX = [1, 0, -1, 0] as const;
export const DZ = [0, 1, 0, -1] as const;

/** World size of one spine segment (along x) and one escort tier (across, per side). */
export const SEGMENT_LENGTH = 2.4;
export const WING_WIDTH = 1.4;
export const SPINE_WIDTH = 3.0;
/** World z of the spine's side lanes, and the height of one escort elevation step. */
export const LANE_OFFSET = 0.85;
export const ELEVATION_STEP = 0.9;

export interface PlacedPiece {
  id: number;
  kind: PieceKind;
  /** origin cell (min x / min z) */
  x: number;
  z: number;
  rot: number;
  /** footprint in cells along x and z */
  w: number;
  d: number;
  cells: Array<[number, number]>;
  /** 0 hull, 1 on deck, 2 on superstructure, -1 under the keel */
  layer: number;
  /** 0 on the spine; t for an escort tier */
  tier: number;
  /** -1 port, 1 starboard, 0 centred (the spine, or a mirrored pair) */
  side: number;
  /** what it's mounted on (-1 for the bridge section) */
  parent: number;
  baseLevels: number;
  /** stable per-piece variation */
  variant: number;
  /** world height offset (escorts step up and down; their deck parts follow) */
  elev: number;
  /** escorts: how far above the part inboard of it this one sits (for struts and pylons) */
  rise: number;
  /** spine deck lane: -1 port, 1 starboard, 0 centre */
  lane: number;
}

export type PlanStep =
  | { type: "place"; index: number; piece: PlacedPiece; cost: number; total: number }
  | { type: "raise"; index: number; target: number; level: number; cost: number; total: number };

/** One hull-level slot: a spine segment (tier 0) or an escort (tier >= 1) at some x and side. */
interface Slot {
  x: number;
  tier: number;
  side: number;
  pieceId: number;
  kind: "core" | "hull" | "wing" | "battery";
  dorsal: "none" | "super" | "turret" | "tower" | "mast" | "needles" | "district" | "pod" | "lanes";
  superId: number;
  spire: boolean;
  hangar: boolean;
  elev: number;
  /** spine side lanes in use: [port, starboard] */
  lanes: [boolean, boolean];
  /** something hangs underneath already */
  under: boolean;
}

/** Kept for older callers: rotates a cell inside a w x d footprint by quarter turns. */
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

const span = (x: number, w: number, z0: number, z1: number) => {
  const cells: Array<[number, number]> = [];
  for (let cx = x; cx < x + w; cx += 1) {
    for (let cz = z0; cz <= z1; cz += 1) {
      cells.push([cx, cz]);
    }
  }
  return cells;
};

const key = (x: number, tier: number, side: number) => `${x},${tier},${side}`;
const TALL = new Set(["super", "mast", "tower", "lanes"]);

export class StationPlanner {
  readonly seed: number;
  readonly design: Design;
  readonly steps: PlanStep[] = [];
  readonly pieces: PlacedPiece[] = [];
  private readonly rng: () => number;
  private readonly slots = new Map<string, Slot>();
  private readonly plannedLevels: number[] = [];
  private readonly sides: number[];
  /** which side this ship favours when it's allowed to be lopsided */
  private readonly favoured: number;
  private front = 1;
  /** how many escort tiers the widest part of the ship may have */
  private widthLevel = 1;

  constructor(seed: number, design: Design = activeDesign()) {
    this.seed = seed;
    this.design = design;
    this.rng = createRng(seed);
    this.sides = design.mirrored ? [0] : [-1, 1];
    this.favoured = seed % 2 === 0 ? 1 : -1;
    const core = this.add("core", 0, -1, 2, 3, 0, 0, 0, -1);
    for (const x of [0, 1]) {
      this.slots.set(key(x, 0, 0), { x, tier: 0, side: 0, pieceId: core.id, kind: "core", dorsal: "tower", superId: -1, spire: false, hangar: false, elev: 0, lanes: [true, true], under: true });
    }
    this.steps.push({ type: "place", index: 0, piece: core, cost: 0, total: 0 });
  }

  /** Plans steps until their combined cost passes `points` (plus one step beyond). */
  ensurePoints(points: number): void {
    while (this.lastTotal() <= points) {
      this.next();
    }
  }

  ensureSteps(count: number): void {
    while (this.steps.length < count) {
      this.next();
    }
  }

  lastTotal(): number {
    return this.steps[this.steps.length - 1]?.total ?? 0;
  }

  private slotAt(x: number, tier: number, side: number): Slot | undefined {
    return tier === 0 ? this.slots.get(key(x, 0, 0)) : this.slots.get(key(x, tier, side));
  }

  /** Outermost escort tier at x on one side (0 when there are none). */
  private tierAt(x: number, side: number): number {
    let tier = 0;
    while (this.slots.has(key(x, tier + 1, side))) {
      tier += 1;
    }
    return tier;
  }

  /** Widest allowed tier at x: full width for most of the length, tapering at the bow (and a little at the stern). */
  private allowedTier(x: number): number {
    const position = (x + 1) / (this.front + 2);
    const { taperStart, sternTaper } = this.design;
    const bow = position > taperStart ? Math.max(0, 1 - (position - taperStart) / (1 - taperStart)) : 1;
    const stern = position < 0.25 ? 1 - sternTaper * (1 - position / 0.25) : 1;
    return Math.floor(this.widthLevel * bow * stern + 0.0001);
  }

  private countSide(side: number): number {
    let count = 0;
    for (const slot of this.slots.values()) {
      if (slot.side === side && slot.tier > 0) {
        count += 1;
      }
    }
    return count;
  }

  /** Places that could take an escort (or battery) right now. */
  private openWingSlots(): Array<{ x: number; tier: number; side: number; last: boolean }> {
    const open: Array<{ x: number; tier: number; side: number; last: boolean }> = [];
    for (let x = 0; x <= this.front; x += 1) {
      for (const side of this.sides) {
        const current = this.tierAt(x, side);
        const outer = this.slotAt(x, current, side);
        if (!outer || outer.kind === "battery") {
          continue; // a battery closes off that edge
        }
        const allowed = this.allowedTier(x);
        if (current + 1 <= allowed) {
          open.push({ x, tier: current + 1, side, last: current + 1 === allowed });
        }
      }
    }
    return open;
  }

  private shape() {
    const length = (this.front + 2) * SEGMENT_LENGTH + 4; // engines and prow add a little
    const widestOn = (side: number) => {
      let widest = 0;
      for (let x = 0; x <= this.front; x += 1) {
        widest = Math.max(widest, this.tierAt(x, side));
      }
      return widest;
    };
    // Width is averaged along the whole hull, so one deep stack of escorts at the stern can't
    // pass for a broad ship: the flanks have to fill out before the ship may grow longer.
    let tierTotal = 0;
    for (let x = 0; x <= this.front; x += 1) {
      tierTotal += this.design.mirrored ? this.tierAt(x, 0) * 2 : this.tierAt(x, -1) + this.tierAt(x, 1);
    }
    const averageTiers = tierTotal / (this.front + 1);
    const widest = Math.max(...this.sides.map(widestOn));
    return { length, width: SPINE_WIDTH + averageTiers * WING_WIDTH, widest };
  }

  next(): PlanStep {
    const index = this.steps.length;
    const scale = costScale(index);
    const total = this.lastTotal();
    const weights = this.design.weights;
    const place = (piece: PlacedPiece): PlanStep => {
      const cost = Math.round(PIECES[piece.kind].cost * scale);
      const step: PlanStep = { type: "place", index, piece, cost, total: total + cost };
      this.steps.push(step);
      return step;
    };

    // The engines and the prow come first, so the silhouette reads as a ship straight away.
    if (index === 1) {
      return place(this.add("engines", -1, -1, 1, 3, 0, 0, 0, 0));
    }
    if (index === 2) {
      return place(this.add("prow", this.front + 1, -1, 2, 3, 0, 0, 0, 0));
    }

    const rng = this.rng;
    const { length, width, widest } = this.shape();
    const tooLong = length > width * this.design.ratio;

    // When the ship needs width and every allowed place is filled, push the outline out.
    let wingSlots = this.openWingSlots();
    if (tooLong && wingSlots.length === 0) {
      this.widthLevel = Math.max(this.widthLevel, widest) + 1;
      wingSlots = this.openWingSlots();
    }

    const all = [...this.slots.values()];
    const behindBow = (slot: Slot) => slot.x <= this.front - 1;
    const deckFree = (slot: Slot) => slot.dorsal === "none" && slot.kind !== "battery";
    // Needle arrays point forward, so keep tall things out of their way (and vice versa).
    const clearAhead = (slot: Slot) => !TALL.has(this.slotAt(slot.x + 1, slot.tier, slot.side)?.dorsal ?? "none");
    const clearBehind = (slot: Slot) => this.slotAt(slot.x - 1, slot.tier, slot.side)?.dorsal !== "needles";
    const pick = <T,>(items: T[]) => items[Math.floor(rng() * items.length)];
    // Small deck parts mostly go on escorts, keeping the main hull's deck for towers.
    const preferEscorts = (items: Slot[]) =>
      pickWeighted(rng, items, (slot) => (slot.tier > 0 ? 4 : slot.x <= this.front - 1 ? 0.1 : 1.5)) ?? items[0];
    const raiseTargets = this.pieces.filter((piece) => {
      const cap = piece.kind === "core" ? PIECES.core.maxLevels : Math.min(PIECES[piece.kind].maxLevels, 2 + Math.floor(index / 14));
      return (piece.kind === "core" || piece.kind === "superstructure" || piece.kind === "district") && this.plannedLevels[piece.id] < cap;
    });
    // City blocks and sky hulls: a free side lane on a spine segment, or a free escort deck.
    const laneFree = (slot: Slot) => slot.tier === 0 && slot.kind === "hull" && (slot.dorsal === "none" || slot.dorsal === "lanes") && (!slot.lanes[0] || !slot.lanes[1]);
    const canBlock = (slot: Slot) => laneFree(slot) || (slot.tier > 0 && deckFree(slot));
    const canKeel = (slot: Slot) => (slot.tier > 0 ? !slot.under : slot.kind === "hull" && !slot.hangar && !slot.under);
    const canSuper = (slot: Slot) => deckFree(slot) && behindBow(slot) && clearBehind(slot) && slot.kind !== "battery";
    const canMast = (slot: Slot) => deckFree(slot) && clearBehind(slot);
    const canNeedles = (slot: Slot) => deckFree(slot) && clearAhead(slot);
    // Broadside batteries are deck mounts on escorts, guns facing outboard.
    const canBattery = (slot: Slot) => deckFree(slot) && slot.tier > 0;

    const options: Array<{ kind: string; weight: number }> = [
      { kind: "hull", weight: tooLong ? 0 : weights.hull },
      { kind: "wing", weight: wingSlots.length ? weights.wing * (tooLong ? 2.5 : 0.3) : 0 },
      { kind: "battery", weight: all.some(canBattery) ? weights.battery : 0 },
      { kind: "superstructure", weight: all.some(canSuper) ? weights.superstructure : 0 },
      { kind: "turret", weight: all.some(deckFree) ? weights.turret : 0 },
      { kind: "mast", weight: all.some(canMast) ? weights.mast : 0 },
      { kind: "needles", weight: all.some(canNeedles) ? weights.needles : 0 },
      { kind: "spire", weight: all.some((slot) => slot.dorsal === "super" && !slot.spire) ? weights.spire : 0 },
      { kind: "hangar", weight: all.some((slot) => slot.tier === 0 && !slot.hangar && !slot.under && slot.x > 1) ? weights.hangar : 0 },
      { kind: "district", weight: all.some(canBlock) ? weights.district : 0 },
      { kind: "pod", weight: all.some(canBlock) ? weights.pod : 0 },
      { kind: "keel", weight: all.some(canKeel) ? weights.keel : 0 },
      { kind: "raise", weight: raiseTargets.length ? weights.raise : 0 }
    ];
    const choice = pickWeighted(rng, options, (option) => option.weight)?.kind ?? "hull";

    const onDeck = (kind: PieceKind, slot: Slot, layer: number, parent: number) => {
      const piece = this.add(kind, slot.x, slot.tier ? slot.side * (1 + slot.tier) : 0, 1, 1, layer, slot.tier, slot.side, parent);
      piece.elev = slot.elev;
      return piece;
    };

    switch (choice) {
      case "battery": {
        const slot = pick(all.filter(canBattery));
        slot.dorsal = "turret";
        return place(onDeck("battery", slot, 1, slot.pieceId));
      }
      case "wing": {
        const choices = wingSlots;
        const lead = (side: number) => (side === 0 ? 0 : this.countSide(side) - this.countSide(-side));
        // Fill inner tiers first so the outline fills out evenly; when lopsided, let the
        // favoured side run ahead a little, but never too far.
        const target =
          pickWeighted(rng, choices, (slot) => {
            const fill = 1 / (slot.tier * slot.tier + 1);
            const bias = slot.side === 0 ? 1 : 1 + this.design.lopsided * (slot.side === this.favoured ? 1 : -0.6);
            const balance = 1 / (1 + Math.max(0, lead(slot.side) - 2 - this.design.lopsided * 6) * 0.8);
            return fill * Math.max(0.05, bias) * balance;
          }) ?? choices[0];
        const inner = this.slotAt(target.x, target.tier - 1, target.side)!;
        const piece = this.add("wing", target.x, target.side * (1 + target.tier), 1, 1, 0, target.tier, target.side, inner.pieceId);
        // Escorts terrace: often level with a neighbour along the flank, otherwise a deck above
        // or below the one inboard of them, within two decks of the main hull.
        const neighbour = this.slotAt(target.x - 1, target.tier, target.side) ?? this.slotAt(target.x + 1, target.tier, target.side);
        const steps = [-1, 0, 1, 1][Math.floor(rng() * 4)];
        const elev =
          neighbour && rng() < 0.5 ? neighbour.elev : Math.max(-2 * ELEVATION_STEP, Math.min(2 * ELEVATION_STEP, inner.elev + steps * ELEVATION_STEP));
        piece.elev = elev;
        piece.rise = elev - inner.elev;
        this.slots.set(key(target.x, target.tier, target.side), {
          x: target.x,
          tier: target.tier,
          side: target.side,
          pieceId: piece.id,
          kind: "wing",
          dorsal: "none",
          superId: -1,
          spire: false,
          hangar: false,
          elev,
          lanes: [true, true],
          under: false
        });
        return place(piece);
      }
      case "mast":
      case "needles": {
        const slot = preferEscorts(all.filter(choice === "mast" ? canMast : canNeedles));
        slot.dorsal = choice;
        return place(onDeck(choice, slot, 1, slot.pieceId));
      }
      case "superstructure": {
        // Towers rise from the main hull first; escorts get smaller ones once it's crowded.
        const slot = pickWeighted(rng, all.filter(canSuper), (candidate) => (candidate.tier === 0 ? 6 : 1 / candidate.tier)) ?? all.filter(canSuper)[0];
        const piece = onDeck("superstructure", slot, 1, slot.pieceId);
        slot.dorsal = "super";
        slot.superId = piece.id;
        return place(piece);
      }
      case "turret": {
        const slot = preferEscorts(all.filter(deckFree));
        slot.dorsal = "turret";
        return place(onDeck("turret", slot, 1, slot.pieceId));
      }
      case "spire": {
        const slot = pick(all.filter((candidate) => candidate.dorsal === "super" && !candidate.spire));
        slot.spire = true;
        return place(onDeck("spire", slot, 2, slot.superId));
      }
      case "district":
      case "pod": {
        // Mostly on the main hull's lanes, so the spine fills with a skyline.
        const candidates = all.filter(canBlock);
        const slot = pickWeighted(rng, candidates, (candidate) => (candidate.tier === 0 ? 3 : 1)) ?? candidates[0];
        if (slot.tier === 0) {
          const options = [0, 1].filter((index) => !slot.lanes[index]);
          const index = options[Math.floor(rng() * options.length)];
          slot.lanes[index] = true;
          slot.dorsal = "lanes";
          const lane = index === 0 ? -1 : 1;
          const piece = this.add(choice, slot.x, lane, 1, 1, 1, 0, 0, slot.pieceId);
          piece.lane = lane;
          return place(piece);
        }
        slot.dorsal = choice;
        return place(onDeck(choice, slot, 1, slot.pieceId));
      }
      case "keel": {
        const candidates = all.filter(canKeel);
        const slot = pickWeighted(rng, candidates, (candidate) => (candidate.tier === 0 ? 1.5 : 1)) ?? candidates[0];
        slot.under = true;
        slot.hangar = true;
        return place(onDeck("keel", slot, -1, slot.pieceId));
      }
      case "hangar": {
        const slot = pick(all.filter((candidate) => candidate.tier === 0 && !candidate.hangar && !candidate.under && candidate.x > 1));
        slot.hangar = true;
        slot.under = true;
        return place(this.add("hangar", slot.x, 0, 1, 1, -1, 0, 0, slot.pieceId));
      }
      case "raise": {
        const target =
          pickWeighted(rng, raiseTargets, (piece) => (piece.kind === "core" ? 2 : 1) / (1 + this.plannedLevels[piece.id] - piece.baseLevels)) ??
          raiseTargets[0];
        this.plannedLevels[target.id] += 1;
        const cost = Math.round(RAISE_COST * scale);
        const step: PlanStep = { type: "raise", index, target: target.id, level: this.plannedLevels[target.id], cost, total: total + cost };
        this.steps.push(step);
        return step;
      }
      default: {
        const behind = this.slotAt(this.front, 0, 0)!;
        this.front += 1;
        const piece = this.add("hull", this.front, -1, 1, 3, 0, 0, 0, behind.pieceId);
        this.slots.set(key(this.front, 0, 0), { x: this.front, tier: 0, side: 0, pieceId: piece.id, kind: "hull", dorsal: "none", superId: -1, spire: false, hangar: false, elev: 0, lanes: [false, false], under: false });
        return place(piece);
      }
    }
  }

  private add(kind: PieceKind, x: number, z: number, w: number, d: number, layer: number, tier: number, side: number, parent: number): PlacedPiece {
    let cells: Array<[number, number]>;
    let originZ = z;
    let depth = d;
    if (tier > 0 && side === 0) {
      cells = [
        [x, -(1 + tier)],
        [x, 1 + tier]
      ];
      originZ = -(1 + tier);
      depth = 2 * (1 + tier) + 1;
    } else if (tier > 0) {
      cells = [[x, side * (1 + tier)]];
      originZ = side * (1 + tier);
      depth = 1;
    } else {
      cells = span(x, w, z, z + d - 1);
    }
    const piece: PlacedPiece = {
      id: this.pieces.length,
      kind,
      x,
      z: originZ,
      rot: 0,
      w,
      d: depth,
      cells,
      layer,
      tier,
      side,
      parent,
      baseLevels: PIECES[kind].levels,
      variant: Math.floor(this.rng() * 1000),
      elev: 0,
      rise: 0,
      lane: 0
    };
    this.pieces.push(piece);
    this.plannedLevels[piece.id] = piece.baseLevels;
    return piece;
  }
}

// ---- turning a plan + build points into what's on screen ------------------------------

export type ResolvedPiece = PlacedPiece & { levels: number };

export interface StationState {
  /** finished pieces, with their current deck count */
  pieces: ResolvedPiece[];
  /** the step being worked on right now */
  current: PlanStep | null;
  /** the piece that step builds or raises, positioned for the current ship */
  currentPiece: ResolvedPiece | null;
  progress: number;
  builtSteps: number;
  planner: StationPlanner;
}

const planners = new Map<string, StationPlanner>();

export function plannerFor(seed: number): StationPlanner {
  const design = activeDesign();
  const cacheKey = `${design.id}:${seed}`;
  let planner = planners.get(cacheKey);
  if (!planner) {
    planner = new StationPlanner(seed, design);
    planners.set(cacheKey, planner);
  }
  return planner;
}

/** The prow always rides at the front of the hull, wherever the spine has grown to. */
function placeProw(piece: ResolvedPiece, pieces: ResolvedPiece[]): ResolvedPiece {
  const front = pieces.reduce((max, other) => (other.kind === "hull" || other.kind === "core" ? Math.max(max, other.x + other.w - 1) : max), 1);
  return { ...piece, x: front + 1, cells: span(front + 1, piece.w, -1, 1) };
}

export function resolveStation(seed: number, points: number): StationState {
  const planner = plannerFor(seed);
  planner.ensurePoints(points);

  const levels = new Map<number, number>();
  let pieces: ResolvedPiece[] = [];
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

  pieces = pieces.map((piece) => ({ ...piece, levels: levels.get(piece.id) ?? piece.baseLevels }));
  pieces = pieces.map((piece) => (piece.kind === "prow" ? placeProw(piece, pieces) : piece));

  let currentPiece: ResolvedPiece | null = null;
  if (current?.type === "place") {
    const piece = { ...current.piece, levels: current.piece.baseLevels };
    currentPiece = piece.kind === "prow" ? placeProw(piece, pieces) : piece;
  } else if (current?.type === "raise") {
    const target = pieces.find((piece) => piece.id === current!.target);
    currentPiece = target ? { ...target, levels: current.level } : null;
  }

  const progress = current ? Math.min(1, Math.max(0, (points - (current.total - current.cost)) / current.cost)) : 0;
  return { pieces, current, currentPiece, progress, builtSteps, planner };
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

/** World z of the centre of wing tier t (per side). */
export function tierCenter(tier: number): number {
  return SPINE_WIDTH / 2 + (tier - 0.5) * WING_WIDTH;
}

/** Where a part sits in the world, on the ship's own axes: [x along the spine, z across]. */
export function worldCenter(piece: PlacedPiece): [number, number] {
  const x = (piece.x + (piece.w - 1) / 2) * SEGMENT_LENGTH;
  if (piece.lane) {
    return [x, piece.lane * LANE_OFFSET];
  }
  return [x, piece.tier > 0 && piece.side !== 0 ? piece.side * tierCenter(piece.tier) : 0];
}
