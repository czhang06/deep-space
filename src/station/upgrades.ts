// Upgrade mode, Clash-of-Clans style: modules level up from 1 to MAX_LEVEL. By default the
// lowest-level module goes first and, among equals, the one closest to the command core, so
// the core goes first and each level ripples outward. You can also pick a module: it then
// gets every upgrade point until it's maxed, after which the automatic order resumes.
//
// Like building, upgrades are derived, not stored: replaying the upgrade log (an entry for each
// stint in upgrade mode, noting how far building had got, and one for each pick) with the
// points spent gives the same levels every time, and modules built later never reshuffle
// earlier upgrades.

import type { PieceKind } from "./catalog.ts";
import { resolveStation, type PlacedPiece } from "./generator.ts";

export const MAX_LEVEL = 5;

export type UpgradeSegment =
  | {
      type?: "stint";
      /** build points when this stint in upgrade mode began (fixes which modules existed) */
      buildPoints: number;
      /** upgrade points already spent when it began */
      upgradeFrom: number;
    }
  | {
      type: "focus";
      /** the module picked to upgrade next, or null to go back to the automatic order */
      pieceId: number | null;
      /** upgrade points already spent when it was picked */
      at: number;
    };

const startOf = (entry: UpgradeSegment) => (entry.type === "focus" ? entry.at : entry.upgradeFrom);

export interface UpgradeTarget {
  pieceId: number;
  kind: PieceKind;
  toLevel: number;
  cost: number;
  progress: number;
}

export interface UpgradeState {
  levels: Map<number, number>;
  /** the next upgrade in line (in progress while upgrade mode is on) */
  current: UpgradeTarget | null;
  /** every module that existed in the latest stint is at MAX_LEVEL */
  fullyUpgraded: boolean;
  /** the command core's level, the station's headline level */
  coreLevel: number;
  /** the module you picked, while it's still being upgraded */
  focusId: number | null;
}

/** Points still needed to take a module from `level` to MAX_LEVEL. */
export function costToMax(kind: PieceKind, level: number): number {
  let total = 0;
  for (let from = level; from < MAX_LEVEL; from += 1) {
    total += upgradeCost(kind, from);
  }
  return total;
}

/**
 * Focused minutes to take a part all the way from level 1 to MAX_LEVEL. About twice what it
 * cost to build, spread over four quick steps, so upgrading feels fast and rewarding: a hull
 * segment (15 minutes to build) maxes out in about 30.
 */
const FULL_UPGRADE: Record<PieceKind, number> = {
  core: 80,
  engines: 50,
  prow: 50,
  superstructure: 40,
  battery: 36,
  hangar: 36,
  hull: 30,
  wing: 30,
  turret: 30,
  mast: 24,
  needles: 20,
  spire: 20
};

/** Share of the full upgrade each step costs (1 to 2, 2 to 3, 3 to 4, 4 to 5). */
const STEP_SHARE = [0.15, 0.2, 0.28, 0.37];

/** Points (focused minutes) to take a module from `fromLevel` to the next level. */
export function upgradeCost(kind: PieceKind, fromLevel: number): number {
  const share = STEP_SHARE[Math.min(STEP_SHARE.length, Math.max(1, fromLevel)) - 1];
  return Math.max(2, Math.round(FULL_UPGRADE[kind] * share));
}

/** Hops from the bridge section along what each part is mounted on. */
function distancesFromCore(pieces: PlacedPiece[]): Map<number, number> {
  const byId = new Map(pieces.map((piece) => [piece.id, piece]));
  const distance = new Map<number, number>();
  const depth = (piece: PlacedPiece): number => {
    const known = distance.get(piece.id);
    if (known !== undefined) {
      return known;
    }
    const parent = byId.get(piece.parent);
    const value = piece.id === 0 || !parent ? 0 : depth(parent) + 1;
    distance.set(piece.id, value);
    return value;
  };
  pieces.forEach(depth);
  return distance;
}

function nextTarget(pieces: PlacedPiece[], levels: Map<number, number>, distance: Map<number, number>): PlacedPiece | null {
  let best: PlacedPiece | null = null;
  let bestKey: [number, number, number] | null = null;
  for (const piece of pieces) {
    const level = levels.get(piece.id) ?? 1;
    if (level >= MAX_LEVEL) {
      continue;
    }
    const key: [number, number, number] = [level, distance.get(piece.id) ?? Number.MAX_SAFE_INTEGER, piece.id];
    if (!bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && (key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])))) {
      best = piece;
      bestKey = key;
    }
  }
  return best;
}

export function resolveUpgrades(seed: number, log: UpgradeSegment[], upgradePoints: number): UpgradeState {
  const levels = new Map<number, number>();
  let credit = 0;
  let pieces: PlacedPiece[] = [];
  let distance = new Map<number, number>();
  let focus: number | null = null;
  let started = false;

  // A picked module wins while it exists and isn't maxed; otherwise use the automatic order.
  const pick = () => {
    if (focus !== null) {
      const picked = pieces.find((piece) => piece.id === focus);
      if (picked && (levels.get(picked.id) ?? 1) < MAX_LEVEL) {
        return picked;
      }
    }
    return nextTarget(pieces, levels, distance);
  };

  log.forEach((entry, index) => {
    if (entry.type === "focus") {
      focus = entry.pieceId;
    } else {
      started = true;
      pieces = resolveStation(seed, entry.buildPoints).pieces;
      distance = distancesFromCore(pieces);
    }
    const end = index + 1 < log.length ? startOf(log[index + 1]) : upgradePoints;
    let budget = credit + Math.max(0, end - startOf(entry));
    for (;;) {
      const target = pick();
      if (!target) {
        break; // everything is maxed; spare points wait for new modules
      }
      const level = levels.get(target.id) ?? 1;
      const cost = upgradeCost(target.kind, level);
      if (budget < cost) {
        break;
      }
      budget -= cost;
      levels.set(target.id, level + 1);
    }
    credit = budget;
  });

  const target = started ? pick() : null;
  let current: UpgradeTarget | null = null;
  if (target) {
    const level = levels.get(target.id) ?? 1;
    const cost = upgradeCost(target.kind, level);
    current = { pieceId: target.id, kind: target.kind, toLevel: level + 1, cost, progress: Math.min(1, credit / cost) };
  }

  return {
    levels,
    current,
    fullyUpgraded: started && !target,
    coreLevel: levels.get(0) ?? 1,
    focusId: target && target.id === focus ? focus : null
  };
}
