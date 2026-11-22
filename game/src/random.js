// Seeded random numbers (mulberry32): the same seed builds the same city, the same
// traffic and the same screenshot scenes, so a scene can be staged again exactly.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A value in [min, max). */
export function randomRange(random, min, max) {
  return min + random() * (max - min);
}

/** An integer in [min, max]. */
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** One element of an array, uniformly. */
export function randomPick(random, array) {
  return array[Math.floor(random() * array.length)];
}

/** Fisher-Yates shuffle, in place, driven by the seeded generator. */
export function shuffle(random, array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = array[i];
    array[i] = array[j];
    array[j] = tmp;
  }
  return array;
}
