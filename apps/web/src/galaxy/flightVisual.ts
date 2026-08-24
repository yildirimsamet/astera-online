import type { HullId } from '@astera/rules';

/** Hull identity is visible in its rim, wake and drive—not inferred from mission kind. */
export const HULL_LIGHT: Record<HullId, { glow: string; flame: string }> = {
  WASP: { glow: '#3fa9ff', flame: '#8fd8ff' },
  LANCE: { glow: '#4d8dff', flame: '#9cc7ff' },
  BULWARK: { glow: '#5c76d9', flame: '#a7b9ff' },
  HAULER: { glow: '#55a7d9', flame: '#a5ddff' },
  RUNNER: { glow: '#ffc247', flame: '#ffe09a' },
  BREACHER: { glow: '#ff4059', flame: '#ff8a66' },
  BASTION: { glow: '#ff6548', flame: '#ffad78' },
  THORN: { glow: '#ff7845', flame: '#ffc07c' },
  PROSPECTOR: { glow: '#ffb057', flame: '#ffd9a8' },
};

export const DEATH_STAR_LIGHT = { glow: '#ff274d', flame: '#ff6b3d' } as const;

/** Ordinary focus geometry stays inside the hull's visual footprint. */
export const TRACKING_MARK = {
  standardRadius: 1.35,
  ringOuter: 1.035,
  fleetTickWidth: 0.045,
  fleetTickLength: 0.42,
} as const;

type Vec3Tuple = [number, number, number];

/** Unit direction from one formation slot to the parent-local common target. */
export function formationAimDirection(
  offset: readonly [number, number, number],
  targetDistance: number,
  out: Vec3Tuple = [0, 0, 0],
): Vec3Tuple {
  const dx = -offset[0];
  const dy = -offset[1];
  const dz = targetDistance - offset[2];
  const length = Math.hypot(dx, dy, dz);
  if (length < 1e-9) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 1;
    return out;
  }
  out[0] = dx / length;
  out[1] = dy / length;
  out[2] = dz / length;
  return out;
}
