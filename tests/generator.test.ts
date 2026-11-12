import test from "node:test";
import assert from "node:assert/strict";
import { CastlePlanner, DX, DZ, resolveCastle, rotateCell } from "../src/castle/generator.ts";
import { PIECES } from "../src/castle/catalog.ts";

test("rotating a cell four times returns it home", () => {
  const w = 2;
  const d = 1;
  let [x, z] = [1, 0];
  let [cw, cd] = [w, d];
  for (let turn = 0; turn < 4; turn += 1) {
    [x, z] = rotateCell(x, z, cw, cd, 1);
    [cw, cd] = [cd, cw];
  }
  assert.deepEqual([x, z], [1, 0]);
});

test("the same seed always grows the same castle", () => {
  const a = new CastlePlanner(1234);
  const b = new CastlePlanner(1234);
  a.ensureSteps(150);
  b.ensureSteps(150);
  assert.deepEqual(a.steps, b.steps);
  const c = new CastlePlanner(99);
  c.ensureSteps(150);
  assert.notDeepEqual(a.steps, c.steps);
});

test("pieces never overlap", () => {
  for (const seed of [1, 2, 3, 42, 777]) {
    const planner = new CastlePlanner(seed);
    planner.ensureSteps(300);
    const seen = new Set<string>();
    for (const piece of planner.pieces) {
      for (const [x, z] of piece.cells) {
        const cell = `${x},${z}`;
        assert.ok(!seen.has(cell), `seed ${seed}: cell ${cell} used twice`);
        seen.add(cell);
      }
    }
  }
});

test("every piece after the keep touches an earlier piece", () => {
  const planner = new CastlePlanner(5);
  planner.ensureSteps(200);
  const owner = new Map<string, number>();
  for (const piece of planner.pieces) {
    if (piece.id > 0) {
      const touches = piece.cells.some(([x, z]) =>
        [0, 1, 2, 3].some((dir) => {
          const other = owner.get(`${x + DX[dir]},${z + DZ[dir]}`);
          return other !== undefined && other < piece.id;
        })
      );
      assert.ok(touches, `piece ${piece.id} (${piece.kind}) floats on its own`);
    }
    for (const [x, z] of piece.cells) {
      owner.set(`${x},${z}`, piece.id);
    }
  }
});

test("the castle keeps growing for a long time", () => {
  const planner = new CastlePlanner(8);
  planner.ensureSteps(600);
  assert.equal(planner.steps.length, 600);
});

test("raised pieces stay within their height limit", () => {
  const planner = new CastlePlanner(21);
  planner.ensureSteps(400);
  const state = resolveCastle(21, planner.lastTotal());
  for (const piece of state.pieces) {
    assert.ok(piece.levels <= PIECES[piece.kind].maxLevels, `${piece.kind} too tall`);
  }
});

test("build points map onto finished pieces plus one in progress", () => {
  const empty = resolveCastle(3, 0);
  assert.equal(empty.pieces.length, 1); // just the keep
  assert.ok(empty.current);
  assert.equal(empty.progress, 0);

  const later = resolveCastle(3, 500);
  assert.ok(later.pieces.length > 10);
  assert.ok(later.progress >= 0 && later.progress < 1);
  assert.ok(later.current && later.current.total > 500);
});
