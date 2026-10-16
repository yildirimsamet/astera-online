import type * as THREE from 'three';

/**
 * PUBLIC STRIKE MOMENTS, AS A BYSTANDER RECEIVES THEM. Owner, 2026-10-16: a Death Star or a
 * radiation bomb hit must be seen outside Telescope sight, and a struck world noticed from a
 * zoomed-out disc — "abartmadan".
 */

/** News arriving within this of the hit counts as on time. */
const ON_TIME_MS = 250;

/**
 * How late a hit may be discovered and still play from its first frame. A bystander learns
 * of a strike only from the refetch the hit itself triggers, about a second after it; a tab
 * reopened in the middle of the smoke keeps the real clock instead.
 */
export const LATE_REPLAY_MS = 4_000;

/** When this screen starts a public hit's animation: its instant, or its discovery. */
export function replayStart(at: number, seenAt: number): number {
  return replayStarts([at], seenAt)[0]!;
}

/**
 * WHEN A BATCH OF HITS LEARNED IN ONE READ STARTS. The worker wakes once a second, so a burst
 * half a second apart usually arrives in one refetch; replayed one by one from discovery it
 * collapsed onto a single frame (owner, 2026-10-16). The earliest late hit starts at
 * discovery and every landed hit after it keeps its spacing; hits still to come and hits found
 * long afterwards keep their own clock.
 */
export function replayStarts(ats: readonly number[], seenAt: number): number[] {
  const late = ats.filter((at) => seenAt - at > ON_TIME_MS && seenAt - at < LATE_REPLAY_MS);
  if (late.length === 0) return [...ats];
  const first = Math.min(...late);
  return ats.map((at) => at >= first && at <= seenAt ? at + seenAt - first : at);
}

/**
 * Remembers when each public moment starts on this screen, once: the moments new to this
 * read are started together (`replayStarts`), and the ones no longer listed are forgotten.
 */
export function rememberStarts(starts: Map<string, number>,
  moments: readonly { id: string; at: number }[], now: number): Map<string, number> {
  for (const id of starts.keys()) if (!moments.some((moment) => moment.id === id)) starts.delete(id);
  const fresh = moments.filter((moment) => !starts.has(moment.id));
  const replayed = replayStarts(fresh.map((moment) => moment.at), now);
  fresh.forEach((moment, index) => starts.set(moment.id, replayed[index]!));
  return starts;
}

/**
 * THE AGE, IN SECONDS, OF EACH HIT A RADIATION CLOUD IS STILL DETONATING — newest first, -1
 * for an empty slot, written into `into` so a frame allocates nothing. One age per hit lets a
 * burst's second bomb add its own detonation instead of restarting the first (owner, 2026-10-16).
 */
export function recentHitAges(hits: readonly number[], now: number, slots: number,
  into: number[] = new Array<number>(slots)): number[] {
  into.length = slots;
  into.fill(-1);
  let slot = 0;
  for (let index = hits.length - 1; index >= 0 && slot < slots; index--) {
    const hit = hits[index]!;
    if (hit <= now) into[slot++] = (now - hit) / 1000;
  }
  return into;
}

/**
 * HOW MUCH A WORLD-SIZED MARK MUST GROW TO STAY `minPixels` ON SCREEN.
 *
 * 1 when it is already that large; otherwise the factor that brings `worldSize` up to the
 * floor, so a struck world reads as a few pixels of fire or haze from across the disc and
 * returns to its true size as the camera closes in.
 */
export function screenFloorScale(
  worldSize: number,
  at: THREE.Vector3,
  camera: THREE.Camera,
  viewportHeight: number,
  minPixels: number,
): number {
  return Math.max(1, minPixels / Math.max(1e-6, screenPixels(worldSize, at, camera, viewportHeight)));
}

/** How many screen pixels `worldSize` spans at `at`, for this perspective camera and viewport. */
export function screenPixels(worldSize: number, at: THREE.Vector3, camera: THREE.Camera, viewportHeight: number): number {
  const projection = camera.projectionMatrix.elements[5];
  return worldSize * Math.max(1, viewportHeight) * projection / (2 * Math.max(1e-6, at.distanceTo(camera.position)));
}
