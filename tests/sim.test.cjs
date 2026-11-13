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

test("play inside the daily allowance brings no aliens", () => {
  const state = sim.createState({ seed: 1 });
  run(state, "play", 89);
  assert.equal(state.aliens.length, 0);
});

test("play past the allowance brings aliens, capped at three", () => {
  const state = sim.createState({ seed: 1 });
  run(state, "play", 91);
  assert.equal(state.aliens.length, 1);
  assert.equal(sim.damageCount(state), 1);
  run(state, "play", 600);
  assert.equal(state.aliens.length, sim.MAX_ALIENS);
});

test("work repairs damage first, then pries aliens off", () => {
  const state = sim.createState({ seed: 1 });
  run(state, "play", 91);
  run(state, "work", 10);
  assert.equal(state.buildPoints, 0); // still repairing (an alien slows work by 20%)
  run(state, "work", sim.ALIEN_WORK_TO_EVICT);
  assert.equal(sim.damageCount(state), 0);
  assert.equal(state.aliens.length, 0);
  assert.ok(state.buildPoints > 0);
});

test("the allowance resets each day", () => {
  const state = sim.createState({ seed: 1 });
  run(state, "play", 80, NOON);
  run(state, "play", 80, NOON + 24 * 3600 * 1000);
  assert.equal(state.aliens.length, 0);
});

test("upgrade mode sends work to upgrades and logs where building stood", () => {
  const state = sim.createState({ seed: 1 });
  run(state, "work", 20);
  sim.setMode(state, "upgrade", NOON);
  run(state, "neutral", 1); // end the streak so the 1.5x bonus doesn't kick in
  run(state, "work", 10);
  assert.equal(Math.round(state.buildPoints), 20);
  assert.equal(Math.round(state.upgradePoints), 10);
  assert.deepEqual(state.upgradeLog, [{ buildPoints: 20, upgradeFrom: 0 }]);

  sim.setMode(state, "upgrade", NOON); // no-op when already upgrading
  assert.equal(state.upgradeLog.length, 1);
  sim.setMode(state, "build", NOON);
  run(state, "work", 5);
  assert.equal(Math.round(state.buildPoints), 25);
  assert.throws(() => sim.setMode(state, "demolish"));
});

test("picking a module switches to upgrade mode and records the pick once", () => {
  const state = sim.createState({ seed: 1 });
  run(state, "work", 20);
  sim.setUpgradeFocus(state, 3, "hab node", NOON);
  assert.equal(state.mode, "upgrade");
  assert.deepEqual(state.upgradeLog, [
    { buildPoints: 20, upgradeFrom: 0 },
    { type: "focus", pieceId: 3, at: 0 }
  ]);
  sim.setUpgradeFocus(state, 3, "hab node", NOON); // same pick again: no new entry
  assert.equal(state.upgradeLog.length, 2);
  assert.throws(() => sim.setUpgradeFocus(state, -1, "x", NOON));
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

test("milestones already passed are backfilled with dates from the daily history", () => {
  const now = new Date("2026-11-10T18:00:00").getTime();
  const state = sim.createState({ seed: 1, now });
  // 60 focused minutes on each of three days at up to 1.5 points a minute (270), plus 10 earlier.
  state.days = {
    "2026-11-08": { work: 60, play: 0, idle: 0, neutral: 0, labels: {}, aliensArrived: 0 },
    "2026-11-09": { work: 60, play: 0, idle: 0, neutral: 0, labels: {}, aliensArrived: 0 },
    "2026-11-10": { work: 60, play: 0, idle: 0, neutral: 0, labels: {}, aliensArrived: 0 }
  };
  state.buildPoints = 280;
  const plan = [
    { index: 0, points: 0, name: "Mercury", detail: "x" },
    { index: 1, points: 150, name: "Venus", detail: "x" },
    { index: 2, points: 270, name: "Earth", detail: "x" },
    { index: 3, points: 500, name: "Mars", detail: "x" }
  ];
  sim.setMilestonePlan(state, plan, now);
  const reached = Object.fromEntries(state.milestones.reached.map((entry) => [entry.index, entry]));
  assert.equal(reached[0].at, null); // before the records began
  assert.equal(new Date(reached[1].at).getDate(), 9);
  assert.equal(new Date(reached[2].at).getDate(), 10);
  assert.ok(reached[2].approx);
  assert.equal(reached[3], undefined);
});

test("reaching a milestone records it once, with an event, and reports it for a notification", () => {
  const now = Date.now();
  const state = sim.createState({ seed: 1, now });
  sim.setMilestonePlan(state, [{ index: 9, points: 30, name: "Alpha Centauri", detail: "4.370 light years from Earth", announce: "You've left the solar system!" }], now);
  assert.equal(sim.checkMilestones(state, now).length, 0);
  state.buildPoints = 31;
  const arrived = sim.checkMilestones(state, now + 1000);
  assert.equal(arrived.length, 1);
  assert.equal(arrived[0].name, "Alpha Centauri");
  assert.deepEqual(state.milestones.reached, [{ index: 9, at: now + 1000 }]);
  assert.match(state.events[0].text, /left the solar system/);
  assert.equal(sim.checkMilestones(state, now + 2000).length, 0);
});

test("the weekly recap comes once, from Monday 9am, about the week before", () => {
  const day = (key, work, play = 0) => ({ work, play, idle: 0, neutral: 0, labels: {}, aliensArrived: 0, key });
  const state = sim.createState({ seed: 1 });
  // Week of Mon 2 Nov 2026 (the one before), and the week of Mon 9 Nov (the one reported).
  state.days = {
    "2026-11-03": day("2026-11-03", 120),
    "2026-11-10": day("2026-11-10", 90),
    "2026-11-12": day("2026-11-12", 150, 30),
    "2026-11-13": day("2026-11-13", 20)
  };
  state.milestones.plan = [{ index: 11, points: 1, name: "Sirius", detail: "x" }];
  state.milestones.reached = [{ index: 11, at: new Date("2026-11-12T15:00:00").getTime() }];

  assert.equal(sim.dueWeeklyRecap(state, new Date("2026-11-16T08:30:00").getTime()), null); // Monday, too early
  const recap = sim.dueWeeklyRecap(state, new Date("2026-11-16T09:30:00").getTime());
  assert.equal(recap.week.start, "2026-11-09");
  assert.equal(recap.week.work, 260);
  assert.equal(recap.week.focusedDays, 2);
  assert.equal(recap.week.bestDay, "2026-11-12");
  assert.deepEqual(recap.week.places, ["Sirius"]);
  assert.equal(recap.previous.work, 120);
  assert.equal(sim.dueWeeklyRecap(state, new Date("2026-11-17T10:00:00").getTime()), null); // only once

  state.settings.weeklyRecap = false;
  state.lastRecapWeek = null;
  assert.equal(sim.dueWeeklyRecap(state, new Date("2026-11-17T10:00:00").getTime()), null);
});

test("recent days fill gaps with zeros, oldest first", () => {
  const state = sim.createState({ seed: 1 });
  state.days = { "2026-11-12": { work: 61.6, play: 0, idle: 0, neutral: 0, labels: {}, aliensArrived: 0 } };
  const days = sim.recentDays(state, new Date("2026-11-13T10:00:00").getTime(), 3);
  assert.deepEqual(days.map((entry) => [entry.date, entry.work]), [["2026-11-11", 0], ["2026-11-12", 62], ["2026-11-13", 0]]);
});
