import test from "node:test";
import assert from "node:assert/strict";
import { formatDistance, formatSpeed, journeyAt, speedAt } from "../src/station/journey.ts";

test("past the planets, every leg takes the ship further from Earth", () => {
  let last = 0;
  let leftSolarSystem = false;
  for (let steps = 1; steps < 600; steps += 1) {
    const journey = journeyAt(steps, 0);
    if (journey.index >= 9) {
      leftSolarSystem = true;
      assert.ok(journey.distance >= last, `step ${steps}: ${journey.distance} < ${last}`);
    }
    last = journey.distance;
  }
  assert.ok(leftSolarSystem);
});

test("the route runs planets, stars, nebulae, then galaxies, and never runs out", () => {
  const names = new Set<string>();
  for (let steps = 1; steps < 800; steps += 1) {
    names.add(journeyAt(steps).current.name);
  }
  for (const name of ["Mercury", "Pluto", "Sirius", "the Orion Nebula", "Andromeda"]) {
    assert.ok(names.has(name), name);
  }
  assert.ok([...names].some((name) => name.startsWith("galaxy ")));
});

test("the ship speeds up as it grows", () => {
  assert.ok(speedAt(200) > speedAt(100));
  assert.ok(speedAt(100) > speedAt(10));
});

test("distances and speeds read in sensible units", () => {
  assert.equal(formatDistance(384400), "384,400 km");
  assert.equal(formatDistance(78e6), "78 million km");
  assert.equal(formatDistance(4.4e9), "4.4 billion km");
  assert.equal(formatDistance(4.37 * 9.4607e12), "4.4 light years");
  assert.equal(formatDistance(2.5e6 * 9.4607e12), "2.5 million light years");
  assert.equal(formatSpeed(0.5), "0.50c");
  assert.equal(formatSpeed(40), "40c");
  assert.equal(formatSpeed(2500), "2.5k c");
});
