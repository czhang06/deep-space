// Milestones are the places on the ship's journey. Each one is reached at a fixed number of
// build points (derived, like the ship, from the seed), so the whole route can be laid out
// ahead of time: what's been passed, the next stop, and how far off the ones after it are.

import { plannerFor } from "./generator.ts";
import { destination, distanceOf, formatDistance, legLength, regionOf } from "./journey.ts";

export interface MilestonePlanEntry {
  index: number;
  /** build points at which the ship arrives */
  points: number;
  name: string;
  /** e.g. "8.600 light years from Earth" */
  detail: string;
  /** a bigger moment worth its own headline */
  announce?: string;
}

const ANNOUNCEMENTS: Record<number, string> = {
  9: "You've left the solar system!",
  18: "You've reached the heart of the Milky Way!",
  19: "You've left the Milky Way!",
  24: "Into the deep field: nothing but galaxies from here."
};

/** The build step count at which destination `index` is reached (see journeyAt). */
function arrivalStep(index: number): number {
  let steps = 0;
  for (let leg = 0; leg < index; leg += 1) {
    steps += legLength(leg);
  }
  return steps;
}

/** Build points needed to reach destination `index`. */
export function milestonePoints(seed: number, index: number): number {
  const planner = plannerFor(seed);
  const step = arrivalStep(index);
  planner.ensureSteps(step + 1);
  return planner.steps[step].total;
}

export function milestoneDetail(index: number): string {
  return index === 2 ? "Home" : `${formatDistance(distanceOf(index))} from Earth`;
}

/** The plan for destinations 0..count-1, as sent to the main process. */
export function milestonePlan(seed: number, count: number): MilestonePlanEntry[] {
  return Array.from({ length: count }, (_, index) => {
    const entry: MilestonePlanEntry = { index, points: milestonePoints(seed, index), name: destination(index).name, detail: milestoneDetail(index) };
    if (ANNOUNCEMENTS[index]) {
      entry.announce = ANNOUNCEMENTS[index];
    }
    return entry;
  });
}

/** "the Orion Nebula" -> "The Orion Nebula", for headings. */
export function placeTitle(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export const REGION_TITLES: Record<string, string> = {
  "the solar system": "The solar system",
  "nearby stars": "Nearby stars",
  "the Milky Way": "The Milky Way",
  "intergalactic space": "Other galaxies"
};

export { regionOf };
