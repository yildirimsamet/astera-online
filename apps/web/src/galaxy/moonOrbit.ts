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
 * Orbit radius sits at 2.45–2.85× parent planet radius so moons cleanly clear
 * Core 12–20 Dyson Shells (~1.95× parentRadius), slightly inclined by `visualSeed`.
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
  const orbitR = parentRadius * (2.45 + ((s % 11) * 0.04));
  const tilt = (((s % 7) - 3) * 0.08);
  const angle = phase + timeSec * speed;

  out.x = parentPos.x + Math.cos(angle) * orbitR;
  out.y = parentPos.y + Math.sin(angle) * orbitR * Math.sin(tilt);
  out.z = parentPos.z + Math.sin(angle) * orbitR * Math.cos(tilt);
}

/**
 * Compute a unit launch/arrival staging direction from `moonPos` toward `targetPos`
 * that never clips through the parent planet + Dyson shell sphere (`clearanceR`).
 * If the direct line passes through the exclusion sphere, smoothly deflects outward
 * along the tangent away from the planet center. Zero allocations.
 */
export function moonClearStagingDirection(
  parentPos: Vec3,
  parentRadius: number,
  moonPos: Vec3,
  targetPos: Vec3,
  out: { x: number; y: number; z: number },
): void {
  let dx = targetPos.x - moonPos.x;
  let dy = targetPos.y - moonPos.y;
  let dz = targetPos.z - moonPos.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 1e-4) {
    out.x = 1; out.y = 0; out.z = 0;
    return;
  }
  dx /= dist; dy /= dist; dz /= dist;

  // Vector from moon to parent center
  const px = parentPos.x - moonPos.x;
  const py = parentPos.y - moonPos.y;
  const pz = parentPos.z - moonPos.z;
  const proj = px * dx + py * dy + pz * dz;

  // Clearance sphere covers planet + Dyson Shell (2.25× parentRadius)
  const clearanceR = parentRadius * 2.25;
  if (proj > 0) {
    // Closest point on ray to parent center
    const cx = px - dx * proj;
    const cy = py - dy * proj;
    const cz = pz - dz * proj;
    const missDist = Math.hypot(cx, cy, cz);
    if (missDist < clearanceR) {
      // Push outward radially from parent center toward the moon side + perpendicular tangent
      let ox = -cx;
      let oy = -cy;
      let oz = -cz;
      let oLen = Math.hypot(ox, oy, oz);
      if (oLen < 1e-4) {
        // Moon is directly opposite target across planet center: pick orbital tangent in XZ plane
        ox = -dz; oy = 0.25; oz = dx;
        oLen = Math.hypot(ox, oy, oz);
      }
      ox /= oLen; oy /= oLen; oz /= oLen;

      // Blend outward tangent enough to clear the Dyson sphere cleanly
      const deflect = Math.min(1, (clearanceR - missDist) / clearanceR + 0.35);
      dx = dx * (1 - deflect * 0.45) + ox * (deflect * 0.95);
      dy = dy * (1 - deflect * 0.45) + oy * (deflect * 0.95);
      dz = dz * (1 - deflect * 0.45) + oz * (deflect * 0.95);
      const nLen = Math.hypot(dx, dy, dz) || 1;
      dx /= nLen; dy /= nLen; dz /= nLen;
    }
  }

  out.x = dx;
  out.y = dy;
  out.z = dz;
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

/** What the moon list says changed since the last one: the births and the shattered (review W8). */
export interface MoonListState {
  readonly hydrated: boolean;
  readonly known: ReadonlySet<string>;
}

/**
 * The first list a page loads is the galaxy as it already stands — nothing in it is born. Every later list
 * names its newcomers (a birth) and its missing (a shatter). An empty first list counts as loaded too, so
 * the first moon a galaxy ever sees still plays its birth.
 */
export function moonListChanges(
  previous: MoonListState, planetIds: readonly string[],
): MoonListState & { births: string[]; gone: string[] } {
  const now = new Set(planetIds);
  if (!previous.hydrated) return { hydrated: true, known: now, births: [], gone: [] };
  return {
    hydrated: true,
    known: now,
    births: planetIds.filter((id) => !previous.known.has(id)),
    gone: [...previous.known].filter((id) => !now.has(id)),
  };
}
