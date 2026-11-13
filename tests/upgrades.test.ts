import test from "node:test";
import assert from "node:assert/strict";
import { PIECES } from "../src/station/catalog.ts";
import { resolveStation } from "../src/station/generator.ts";
import { MAX_LEVEL, costToMax, resolveUpgrades, upgradeCost } from "../src/station/upgrades.ts";

const SEED = 4242;

test("nothing is upgraded before upgrade mode is used", () => {
  const state = resolveUpgrades(SEED, [], 0);
  assert.equal(state.levels.size, 0);
  assert.equal(state.current, null);
  assert.equal(state.coreLevel, 1);
});

test("the command core is upgraded first", () => {
  const log = [{ buildPoints: 400, upgradeFrom: 0 }];
  const start = resolveUpgrades(SEED, log, 0);
  assert.equal(start.current?.pieceId, 0);
  const after = resolveUpgrades(SEED, log, upgradeCost("core", 1));
  assert.equal(after.coreLevel, 2);
});

test("every module reaches level 2 before anything reaches level 3", () => {
  const log = [{ buildPoints: 400, upgradeFrom: 0 }];
  const pieces = resolveStation(SEED, 400).pieces;
  for (let points = 0; points < 3000; points += 37) {
    const { levels } = resolveUpgrades(SEED, log, points);
    const values = pieces.map((piece) => levels.get(piece.id) ?? 1);
    assert.ok(Math.max(...values) - Math.min(...values) <= 1, `levels spread too far at ${points} points`);
  }
});

test("levels are capped and the station can become fully upgraded", () => {
  const log = [{ buildPoints: 120, upgradeFrom: 0 }];
  const state = resolveUpgrades(SEED, log, 1e6);
  assert.ok(state.fullyUpgraded);
  for (const level of state.levels.values()) {
    assert.ok(level <= MAX_LEVEL);
  }
  assert.equal(state.coreLevel, MAX_LEVEL);
});

test("building more later never undoes earlier upgrades", () => {
  const first = [{ buildPoints: 300, upgradeFrom: 0 }];
  const before = resolveUpgrades(SEED, first, 500);
  // Build more modules, then come back to upgrading.
  const later = [...first, { buildPoints: 900, upgradeFrom: 500 }];
  for (const points of [500, 650, 2000]) {
    const after = resolveUpgrades(SEED, later, points);
    for (const [id, level] of before.levels) {
      assert.ok((after.levels.get(id) ?? 1) >= level, `module ${id} lost a level`);
    }
  }
});

test("a hull segment builds in 15 minutes and maxes out in about 30", () => {
  assert.equal(PIECES.hull.cost, 15);
  assert.ok(Math.abs(costToMax("hull", 1) - 30) <= 1, `hull full upgrade costs ${costToMax("hull", 1)}`);
  assert.ok(upgradeCost("hull", 1) < upgradeCost("hull", 4), "later levels cost more");
});

test("a picked module gets every point until it's maxed, then the automatic order resumes", () => {
  const pieces = resolveStation(SEED, 400).pieces;
  const far = pieces[pieces.length - 1];
  const log = [
    { buildPoints: 400, upgradeFrom: 0 },
    { type: "focus" as const, pieceId: far.id, at: 0 }
  ];
  const oneStep = resolveUpgrades(SEED, log, upgradeCost(far.kind, 1));
  assert.equal(oneStep.levels.get(far.id), 2);
  assert.equal(oneStep.coreLevel, 1); // the core was skipped in favour of the pick
  assert.equal(oneStep.focusId, far.id);

  const maxed = resolveUpgrades(SEED, log, costToMax(far.kind, 1));
  assert.equal(maxed.levels.get(far.id), MAX_LEVEL);
  assert.equal(maxed.focusId, null);
  assert.equal(maxed.current?.pieceId, 0); // back to the core first
});

test("picking a module that doesn't exist yet falls back to the automatic order", () => {
  const log = [
    { buildPoints: 100, upgradeFrom: 0 },
    { type: "focus" as const, pieceId: 9999, at: 0 }
  ];
  assert.equal(resolveUpgrades(SEED, log, 0).current?.pieceId, 0);
});

test("upgrades are deterministic", () => {
  const log = [{ buildPoints: 300, upgradeFrom: 0 }, { buildPoints: 700, upgradeFrom: 400 }];
  assert.deepEqual([...resolveUpgrades(SEED, log, 1200).levels], [...resolveUpgrades(SEED, log, 1200).levels]);
});
