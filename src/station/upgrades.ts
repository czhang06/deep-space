// Upgrade mode, Clash-of-Clans style: modules level up from 1 to MAX_LEVEL, always the
// lowest-level module first and, among equals, the one closest to the command core. So the
// core goes first, the upgrade ripples outward, and nothing reaches level 3 until everything
// reachable is level 2.
//
// Like building, upgrades are derived, not stored: replaying the upgrade log (one entry per
// stint in upgrade mode, noting how far building had got) with the points spent gives the same
// levels every time, and modules built later never reshuffle earlier upgrades.

import type { PieceKind } from "./catalog.ts";
import { DX, DZ, resolveStation, type PlacedPiece } from "./generator.ts";

export const MAX_LEVEL = 5;

export interface UpgradeSegment {
  /** build points when this stint in upgrade mode began (fixes which modules existed) */
  buildPoints: number;
  /** upgrade points already spent when it began */
  upgradeFrom: number;
}

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
}

const BASE_COST: Record<PieceKind, number> = {
  core: 45,
  ring: 60,
  lab: 30,
  observatory: 30,
  dock: 28,
  node: 22,
  greenhouse: 14,
  corridor: 10,
  solar: 10,
  dish: 10
};

/** Points to take a module from `fromLevel` to the next level. Each level costs more. */
export function upgradeCost(kind: PieceKind, fromLevel: number): number {
  return Math.round(BASE_COST[kind] * (0.8 + 0.45 * fromLevel));
}

/** Hops from the command core through touching modules. */
function distancesFromCore(pieces: PlacedPiece[]): Map<number, number> {
  const owner = new Map<string, number>();
  for (const piece of pieces) {
    for (const [x, z] of piece.cells) {
      owner.set(`${x},${z}`, piece.id);
    }
  }
  const byId = new Map(pieces.map((piece) => [piece.id, piece]));
  const distance = new Map<number, number>([[0, 0]]);
  const queue = [0];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const piece = byId.get(id);
    if (!piece) {
      continue;
    }
    for (const [x, z] of piece.cells) {
      for (let dir = 0; dir < 4; dir += 1) {
        const next = owner.get(`${x + DX[dir]},${z + DZ[dir]}`);
        if (next !== undefined && !distance.has(next)) {
          distance.set(next, distance.get(id)! + 1);
          queue.push(next);
        }
      }
    }
  }
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

  log.forEach((segment, index) => {
    const end = index + 1 < log.length ? log[index + 1].upgradeFrom : upgradePoints;
    let budget = credit + Math.max(0, end - segment.upgradeFrom);
    pieces = resolveStation(seed, segment.buildPoints).pieces;
    distance = distancesFromCore(pieces);
    for (;;) {
      const target = nextTarget(pieces, levels, distance);
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

  const target = log.length ? nextTarget(pieces, levels, distance) : null;
  let current: UpgradeTarget | null = null;
  if (target) {
    const level = levels.get(target.id) ?? 1;
    const cost = upgradeCost(target.kind, level);
    current = { pieceId: target.id, kind: target.kind, toLevel: level + 1, cost, progress: Math.min(1, credit / cost) };
  }

  return {
    levels,
    current,
    fullyUpgraded: log.length > 0 && !target,
    coreLevel: levels.get(0) ?? 1
  };
}
