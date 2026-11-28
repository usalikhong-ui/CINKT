export function drawIndex(count, randomSource = globalThis.crypto) {
  const value = new Uint32Array(1);
  // Discard the incomplete bucket so each stick has the same chance.
  const limit = Math.floor(2 ** 32 / count) * count;
  do {
    randomSource.getRandomValues(value);
  } while (value[0] >= limit);
  return value[0] % count;
}
