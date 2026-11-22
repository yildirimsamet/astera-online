import { MOON, type MoonRarity, type Vec3 } from '@astera/rules';

/**
 * DETERMINISTIC MOON ORBITS & VISUAL RULES (Ay F9d, §9.1–9.2).
 *
 * Every observer computes the same orbital angle from `visualSeed` and server time,
 * so the server never ships per-frame moon coordinates. Zero allocations in hot loops.
 */

const RARITY_RING_HEX: Record<MoonRarity, number> = {
  COMMON: 0x94a3b8,
  RARE: 0x38bdf8,
  EPIC: 0xc084fc,
  LEGENDARY: 0xfbbf24,
};

const RARITY_SCALE: Record<MoonRarity, number> = {
  COMMON: 0.25,
  RARE: 0.27,
  EPIC: 0.29,
  LEGENDARY: 0.32,
};

/**
 * Write this moon's world-space position into `out` without allocating.
 * Orbit radius sits at 1.9–2.4× parent planet radius, slightly inclined by `visualSeed`.
 */
export function moonOrbitPosition(
  parentPos: Vec3,
  parentRadius: number,
  visualSeed: number,
  timeSec: number,
  out: { x: number; y: number; z: number },
): void {
  const s = Math.abs(visualSeed) % 10_000;
  const phase = (s % 360) * (Math.PI / 180);
  const speed = 0.045 + ((s % 17) * 0.002); // ~2 min full revolution
  const orbitR = parentRadius * (1.95 + ((s % 11) * 0.04));
  const tilt = (((s % 7) - 3) * 0.08);
  const angle = phase + timeSec * speed;

  out.x = parentPos.x + Math.cos(angle) * orbitR;
  out.y = parentPos.y + Math.sin(angle) * orbitR * Math.sin(tilt);
  out.z = parentPos.z + Math.sin(angle) * orbitR * Math.cos(tilt);
}

/** Proportional moon radius relative to its parent planet. */
export function moonRadiusFor(parentRadius: number, rarity: MoonRarity | undefined): number {
  return parentRadius * (rarity ? RARITY_SCALE[rarity] : 0.26);
}

/**
 * V17: Unknown rarity returns `null` (rendered WITHOUT a ring) so undiscovered moons
 * never confuse with Common's grey ring.
 */
export function moonRarityRingColor(rarity: MoonRarity | undefined): number | null {
  return rarity ? RARITY_RING_HEX[rarity] : null;
}

/** Rocky regolith base shade with warm fissure shift when cracked by Death Star hits. */
export function moonSurfaceColor(visualSeed: number, cracks: number): number {
  if (cracks >= 4) return 0xb45309;
  if (cracks > 0) return 0x9a7b6e;
  const palette = [0x9ca3af, 0xa8a29e, 0x8e99a8, 0xb5afa6] as const;
  return palette[Math.abs(visualSeed) % palette.length] ?? 0x9ca3af;
}

/** Returns 0..1 progress over `MOON.flashSeconds` for an active gate flash, or null if expired. */
export function moonFlashProgress(atMs: number, nowMs: number): number | null {
  const ageMs = nowMs - atMs;
  const totalMs = MOON.flashSeconds * 1_000;
  if (ageMs < 0 || ageMs > totalMs) return null;
  return ageMs / totalMs;
}
