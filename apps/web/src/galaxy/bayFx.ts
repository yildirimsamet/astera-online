import type { VesselSystem } from '@astera/rules';

/**
 * THE SHIP'S OWN EFFECTS (owner 2026-11-18: no round glow anywhere; each effect is its event).
 *
 * VFX brief, one per moment (CLAUDE.md):
 * - A repair under way. In the world: a welder works the bay, a jagged blue-white arc stutters and
 *   sparks fly off the hull in straight streaks that cool to orange. Assets: the arc is
 *   `assets/vfx/library/electric-line-4x4.webp` (Gabriel Aguiar, Unique AoE Magic, electricline01),
 *   the sparks are drawn as line streaks. Why: an arc and its sparks are what everyone knows a weld by.
 * - A system back. Each does its own work where it sits: the refinery's burner catches with a jet of
 *   flame and a puff of smoke (`flame-3-6x6.webp`, `sck-smoke-8x8.webp`); the antenna (telescope, radar,
 *   survey) sweeps the space round it twice, a hard-edged radar wedge; power arcs through the yard and
 *   the hold (`electric-line-4x4.webp`) with a burst of sparks. Why: the player sees what the system is.
 * - A mended bay. A running light that blinks twice and rests, like a ship's navigation strobe: a hard
 *   dot, never a halo. Why: a lit, blinking point says "this part is alive" and costs two frames a blink.
 */
export type BayReturn = 'burner' | 'sweep' | 'arcs';

export const BAY_RETURN: Readonly<Record<VesselSystem, BayReturn>> = {
  REFINERY: 'burner',
  DRIVE: 'burner',
  DEFENCE: 'sweep',
  SURVEY: 'sweep',
  CARGO: 'arcs',
};

const fract = (x: number): number => x - Math.floor(x);
const hash = (n: number): number => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);

/** Model units a second at birth, and how fast a spark slows. */
const SPARK_SPEED = 1.1;
const SPARK_DRAG = 3.2;

/**
 * Where a spark is, `age` seconds after it left its bay, in model units from the bay: out from the hull
 * (up more than down), straight, slowing; its heat runs from 1 at birth to 0 as it dies. Null once dead.
 */
export function sparkAt(seed: number, age: number, life: number): { at: [number, number, number]; heat: number } | null {
  if (age >= life || age < 0) return null;
  const around = hash(seed) * Math.PI * 2;
  const up = 0.15 + 0.85 * hash(seed + 1.7);
  const flat = Math.sqrt(1 - up * up);
  const speed = SPARK_SPEED * (0.55 + 0.45 * hash(seed + 3.1));
  const reach = (speed * (1 - Math.exp(-SPARK_DRAG * age))) / SPARK_DRAG;
  return { at: [Math.cos(around) * flat * reach, up * reach, Math.sin(around) * flat * reach], heat: 1 - age / life };
}

/** The frame of a looping flipbook `t` seconds in. */
export const flipbookFrame = (t: number, fps: number, frames: number): number => Math.floor(t * fps + 1e-6) % frames;

/** How far round the antenna's sweep has turned: twice over its time, then still. */
export const sweepTurn = (t: number, seconds: number): number => 4 * Math.PI * Math.min(1, Math.max(0, t / seconds));

/** A navigation strobe: two short flashes every two seconds; `offset` (0–1) puts each bay off the others' beat. */
export const STROBE_PERIOD = 2;
export function strobeOn(t: number, offset: number): boolean {
  const phase = fract(t / STROBE_PERIOD + offset);
  return phase < 0.06 || (phase >= 0.2 && phase < 0.26);
}
