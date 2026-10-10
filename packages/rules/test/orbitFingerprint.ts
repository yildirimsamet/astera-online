import { createHash } from 'node:crypto';

/** Math.pow-derived orbit values differ by final binary bits in Node 22/24.
 * Keep every other identity/RNG/window field exact; never change runtime geometry.
 */
export function orbitFingerprint(value: unknown): string {
  const json = JSON.stringify(value, (key, entry: unknown) =>
    (key === 'radius' || key === 'period') && typeof entry === 'number'
      ? Number(entry.toPrecision(12)) : entry);
  return createHash('sha256').update(json).digest('hex');
}
