import test from "node:test";
import assert from "node:assert/strict";
import { SEGMENT_LENGTH, SPINE_WIDTH, StationPlanner, WING_WIDTH, resolveStation, rotateCell } from "../src/station/generator.ts";
import { PIECES } from "../src/station/catalog.ts";
import { DESIGNS, activeDesign, setActiveDesign } from "../src/station/designs.ts";

test("rotating a cell four times returns it home", () => {
  let [x, z] = [1, 0];
  let [w, d] = [2, 1];
  for (let turn = 0; turn < 4; turn += 1) {
    [x, z] = rotateCell(x, z, w, d, 1);
    [w, d] = [d, w];
  }
  assert.deepEqual([x, z], [1, 0]);
});

test("the same seed always grows the same ship", () => {
  const a = new StationPlanner(1234);
  const b = new StationPlanner(1234);
  a.ensureSteps(150);
  b.ensureSteps(150);
  assert.deepEqual(a.steps, b.steps);
  const c = new StationPlanner(99);
  c.ensureSteps(150);
  assert.notDeepEqual(a.steps, c.steps);
});

test("parts never overlap within a layer", () => {
  for (const seed of [1, 2, 3, 42, 777]) {
    const planner = new StationPlanner(seed);
    planner.ensureSteps(300);
    const { pieces } = resolveStation(seed, planner.lastTotal());
    const seen = new Set<string>();
    for (const piece of pieces) {
      for (const [x, z] of piece.cells) {
        const cell = `${x},${z},${piece.layer}`;
        assert.ok(!seen.has(cell), `seed ${seed}: ${piece.kind} reuses ${cell}`);
        seen.add(cell);
      }
    }
  }
});

test("every part is mounted on an earlier part", () => {
  const planner = new StationPlanner(5);
  planner.ensureSteps(250);
  for (const piece of planner.pieces.slice(1)) {
    assert.ok(piece.parent >= 0 && piece.parent < piece.id, `${piece.kind} ${piece.id} has no earlier parent`);
  }
});

test("it looks like a ship: engines at the stern, the prow out front, mirrored batteries", () => {
  const seed = 11;
  const planner = new StationPlanner(seed);
  planner.ensureSteps(120);
  const { pieces } = resolveStation(seed, planner.lastTotal());
  const hullFront = Math.max(...pieces.filter((piece) => piece.kind === "hull" || piece.kind === "core").map((piece) => piece.x + piece.w - 1));
  const minX = Math.min(...pieces.map((piece) => piece.x));
  const prow = pieces.find((piece) => piece.kind === "prow")!;
  const engines = pieces.find((piece) => piece.kind === "engines")!;
  assert.equal(prow.x, hullFront + 1);
  assert.equal(engines.x, minX);
  for (const piece of pieces.filter((candidate) => candidate.tier > 0)) {
    const zs = piece.cells.map(([, z]) => z).sort((a, b) => a - b);
    const expected = piece.side === 0 ? [-(1 + piece.tier), 1 + piece.tier] : [piece.side * (1 + piece.tier)];
    assert.deepEqual(zs, expected, `${piece.kind} sits in the wrong place`);
  }
});

test("every design grows within its shape and keeps port and starboard roughly balanced", () => {
  for (const design of DESIGNS) {
    setActiveDesign(design.id);
    const planner = new StationPlanner(7, design);
    planner.ensureSteps(220);
    const { pieces } = resolveStation(7, planner.steps[219].total);
    const escorts = pieces.filter((piece) => piece.kind === "wing" || piece.kind === "battery");
    if (!design.mirrored) {
      const port = escorts.filter((piece) => piece.side === -1).length;
      const starboard = escorts.filter((piece) => piece.side === 1).length;
      assert.ok(Math.abs(port - starboard) <= Math.max(4, (port + starboard) * 0.45), `${design.id}: ${port} vs ${starboard}`);
    }
  }
  setActiveDesign("lance");
});

test("the ship keeps its outline instead of only getting longer", () => {
  for (const seed of [3, 11, 29]) {
    const planner = new StationPlanner(seed);
    for (const steps of [80, 160, 320]) {
      planner.ensureSteps(steps);
      const { pieces } = resolveStation(seed, planner.steps[steps - 1].total);
      const xs = pieces.filter((piece) => piece.layer === 0).flatMap((piece) => piece.cells.map(([x]) => x));
      const length = (Math.max(...xs) - Math.min(...xs) + 1) * SEGMENT_LENGTH;
      // Width averaged along the hull, the same measure the generator steers by.
      const escorts = pieces.filter((piece) => piece.kind === "wing" || piece.kind === "battery");
      const hullXs = [...new Set(pieces.filter((piece) => piece.kind === "hull" || piece.kind === "core").flatMap((piece) => piece.cells.map(([x]) => x)))];
      const tiersAt = (x: number) => escorts.filter((piece) => piece.x === x).reduce((sum, piece) => sum + (piece.side === 0 ? 2 : 1), 0);
      const averageTiers = hullXs.reduce((sum, x) => sum + tiersAt(x), 0) / hullXs.length;
      const width = SPINE_WIDTH + averageTiers * WING_WIDTH;
      const ratio = length / width;
      const target = activeDesign().ratio;
      assert.ok(ratio < target + 0.6, `seed ${seed} at ${steps} steps is ${ratio.toFixed(2)}:1, too long`);
      assert.ok(ratio > target * 0.6, `seed ${seed} at ${steps} steps is ${ratio.toFixed(2)}:1, too stubby`);
    }
  }
});

test("wings taper toward the bow", () => {
  const seed = 17;
  const planner = new StationPlanner(seed);
  planner.ensureSteps(300);
  const { pieces } = resolveStation(seed, planner.lastTotal());
  const front = Math.max(...pieces.filter((piece) => piece.kind === "hull").map((piece) => piece.x));
  const tierAt = (x: number) => Math.max(0, ...pieces.filter((piece) => piece.layer === 0 && piece.tier > 0 && piece.x === x).map((piece) => piece.tier));
  const mean = (xs: number[]) => xs.reduce((sum, x) => sum + tierAt(x), 0) / Math.max(1, xs.length);
  const all = Array.from({ length: front + 1 }, (_, x) => x);
  const bowStart = Math.ceil(front * 0.75);
  assert.ok(mean(all.filter((x) => x >= bowStart)) <= mean(all.filter((x) => x < bowStart)) + 0.25, "the bow is wider than the rest of the ship");
});

test("the ship keeps growing for a long time", () => {
  const planner = new StationPlanner(8);
  planner.ensureSteps(600);
  assert.equal(planner.steps.length, 600);
});

test("raised parts stay within their deck limit", () => {
  const planner = new StationPlanner(21);
  planner.ensureSteps(400);
  const state = resolveStation(21, planner.lastTotal());
  for (const piece of state.pieces) {
    assert.ok(piece.levels <= PIECES[piece.kind].maxLevels, `${piece.kind} too tall`);
  }
});

test("build points map onto finished parts plus one in progress", () => {
  const empty = resolveStation(3, 0);
  assert.equal(empty.pieces.length, 1); // just the bridge section
  assert.ok(empty.current && empty.currentPiece);
  assert.equal(empty.progress, 0);

  const later = resolveStation(3, 500);
  assert.ok(later.pieces.length > 10);
  assert.ok(later.progress >= 0 && later.progress < 1);
  assert.ok(later.current && later.current.total > 500);
});

test("both flanks share one height profile", () => {
  for (const seed of [3, 11, 29, 20261111]) {
    const planner = new StationPlanner(seed);
    planner.ensureSteps(300);
    const { pieces } = resolveStation(seed, planner.lastTotal());
    const heights = new Map<string, number>();
    for (const piece of pieces.filter((candidate) => candidate.kind === "wing" && candidate.side !== 0)) {
      heights.set(`${piece.x},${piece.tier},${piece.side}`, piece.elev);
    }
    for (const [cell, elev] of heights) {
      const [x, tier, side] = cell.split(",").map(Number);
      const other = heights.get(`${x},${tier},${-side}`);
      if (other !== undefined) {
        assert.equal(other, elev, `seed ${seed}: escorts at x ${x}, tier ${tier} sit at different heights`);
      }
    }
  }
});
