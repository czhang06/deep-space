const test = require("node:test");
const assert = require("node:assert/strict");
const sim = require("../electron/services/sim.cjs");

const NOON = new Date(2026, 10, 11, 12, 0, 0).getTime();

function run(state, category, totalMinutes, now = NOON) {
  for (let minute = 0; minute < totalMinutes; minute += 1) {
    sim.step(state, { category, label: category, minutes: 1, now });
  }
}

test("work earns build points, with a bonus once a streak passes 25 minutes", () => {
  const state = sim.createState({ seed: 1 });
  run(state, "work", 25);
  assert.equal(Math.round(state.buildPoints), 25);
  run(state, "work", 10);
  assert.equal(Math.round(state.buildPoints), 40); // 25 + 10 * 1.5
});

test("breaks and neutral time cost nothing", () => {
  const state = sim.createState({ seed: 1 });
  run(state, "work", 20);
  const before = state.buildPoints;
  run(state, "idle", 60);
  run(state, "neutral", 60);
  assert.equal(state.buildPoints, before);
  assert.equal(sim.today(state, NOON).idle, 60);
});

test("play inside the daily allowance brings no rogues", () => {
  const state = sim.createState({ seed: 1 });
  run(state, "play", 89);
  assert.equal(state.rogues.length, 0);
});

test("play past the allowance brings rogues, capped at three", () => {
  const state = sim.createState({ seed: 1 });
  run(state, "play", 91);
  assert.equal(state.rogues.length, 1);
  assert.equal(sim.damageCount(state), 1);
  run(state, "play", 600);
  assert.equal(state.rogues.length, sim.MAX_ROGUES);
});

test("work repairs damage first, then chases rogues out", () => {
  const state = sim.createState({ seed: 1 });
  run(state, "play", 91);
  run(state, "work", 10);
  assert.equal(state.buildPoints, 0); // still repairing (rogue slows work by 20%)
  run(state, "work", sim.ROGUE_WORK_TO_EVICT);
  assert.equal(sim.damageCount(state), 0);
  assert.equal(state.rogues.length, 0);
  assert.ok(state.buildPoints > 0);
});

test("the allowance resets each day", () => {
  const state = sim.createState({ seed: 1 });
  run(state, "play", 80, NOON);
  run(state, "play", 80, NOON + 24 * 3600 * 1000);
  assert.equal(state.rogues.length, 0);
});

test("pauses expire", () => {
  const state = sim.createState({ seed: 1 });
  state.pausedUntil = NOON + 60000;
  assert.equal(sim.isPaused(state, NOON), true);
  assert.equal(sim.isPaused(state, NOON + 61000), false);
  state.pausedUntil = -1;
  assert.equal(sim.isPaused(state, NOON + 1e12), true);
});

test("old prototype saves are not revived", () => {
  assert.equal(sim.reviveState({ buildProgress: 40 }), null);
  const revived = sim.reviveState({ version: sim.STATE_VERSION, seed: 7, buildPoints: 12 });
  assert.equal(revived.buildPoints, 12);
  assert.equal(revived.settings.playAllowanceMinutes, 90);
});
