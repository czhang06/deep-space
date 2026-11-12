/** Small seeded PRNG (mulberry32) so the same seed always grows the same station. */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable pseudo-random number in [0, 1) for a seed and a key, without consuming the stream. */
export function hash01(seed: number, key: number): number {
  return createRng((seed * 2654435761 + key * 40503) >>> 0)();
}

export function pickWeighted<T>(rng: () => number, items: T[], weight: (item: T) => number): T | null {
  let total = 0;
  for (const item of items) {
    total += Math.max(0, weight(item));
  }
  if (total <= 0) {
    return null;
  }
  let roll = rng() * total;
  for (const item of items) {
    roll -= Math.max(0, weight(item));
    if (roll < 0) {
      return item;
    }
  }
  return items[items.length - 1] ?? null;
}

export function shuffle<T>(rng: () => number, items: T[]): T[] {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}
