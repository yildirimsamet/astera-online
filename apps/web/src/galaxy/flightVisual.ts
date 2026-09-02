import type { HullId } from '@astera/rules';
import { FLEET_V2_ASSET_MANIFEST } from '../ui/fleet-v2-assets.js';
import { slotOffset, type Marker } from './Squadrons.js';

type Vec3Tuple = [number, number, number];

/** Hull identity is visible in its rim, wake and drive—not inferred from mission kind. */
export const HULL_LIGHT: Record<HullId, { glow: string; flame: string }> = {
  ...Object.fromEntries(Object.entries(FLEET_V2_ASSET_MANIFEST).map(([id, asset]) => [
    id,
    { glow: asset.light.color, flame: asset.trail.color },
  ])) as Record<keyof typeof FLEET_V2_ASSET_MANIFEST, { glow: string; flame: string }>,
  BASTION: { glow: '#ff6548', flame: '#ffad78' },
  THORN: { glow: '#ff7845', flame: '#ffc07c' },
  PROSPECTOR: { glow: '#ffb057', flame: '#ffd9a8' },
};

/**
 * Relative visual presence after `orientedCraft` has centred and normalised a model.
 *
 * Normalisation deliberately removes arbitrary exporter dimensions. This authored
 * multiplier puts the intended distinction back: a Dart stays compact beside a
 * Citadel, while the preserved ground/mining catalog keeps its established size.
 * It belongs beside the model metadata and is consumed by every hull-dependent
 * flight effect so the body, wake, exhaust and count pips cannot drift apart.
 */
export const HULL_VISUAL_SCALE: Record<HullId, number> = {
  ...Object.fromEntries(Object.entries(FLEET_V2_ASSET_MANIFEST).map(([id, asset]) => [
    id,
    asset.scale,
  ])) as Record<keyof typeof FLEET_V2_ASSET_MANIFEST, number>,
  BASTION: 1,
  THORN: 1,
  PROSPECTOR: 1,
};

/** The world-space size for one authored hull at the caller's formation baseline. */
export const hullVisualScale = (hull: HullId, base: number): number =>
  base * HULL_VISUAL_SCALE[hull];

/**
 * Empty space around the largest hull in a formation.
 *
 * `slotOffset`'s closest two unit slots are about 0.59 apart. Multiplying the
 * largest authored hull size by 1.8 keeps even that closest pair just over one
 * full model-width apart. A mixed formation therefore makes room for a Citadel
 * instead of placing it on the same Dart-sized grid as everything else.
 */
export const FORMATION_SPACING = 1.8;

export interface FormationLayout {
  readonly slots: Vec3Tuple[];
  /** Largest world-space hull size; also the padding basis for the hit target. */
  readonly scale: number;
}

/** One size-aware layout shared by owned fleets and resolved foreign contacts. */
export function formationLayout(
  markers: readonly Marker[] | null,
  base: number,
): FormationLayout {
  if (markers === null) return { slots: [[0, 0, 0]], scale: base };

  const scale = markers.reduce(
    (largest, marker) => Math.max(largest, hullVisualScale(marker.hull, base)),
    base,
  );
  const spacing = scale * FORMATION_SPACING;
  return {
    slots: markers.map((_, index) => slotOffset(index, spacing)),
    scale,
  };
}

export const DEATH_STAR_LIGHT = { glow: '#ff274d', flame: '#ff6b3d' } as const;

/** Ordinary focus geometry stays inside the hull's visual footprint. */
export const TRACKING_MARK = {
  standardRadius: 1.35,
  ringOuter: 1.035,
  fleetTickWidth: 0.045,
  fleetTickLength: 0.42,
} as const;

/**
 * Radar's unresolved return is gameplay, not tracking furniture.
 *
 * It stays hue-neutral until an inbound leg earns the threat red, but its larger,
 * thicker additive mark must survive a star field on a portrait phone. Keeping
 * these values separate preserves the deliberately restrained probe/fleet rings.
 */
export const UNKNOWN_CONTACT_MARK = {
  radius: 1.65,
  ringOuter: 1.14,
  opacity: 0.88,
  focusedOpacity: 1,
  glyphScale: 2.5,
  glyphOpacity: 0.92,
  focusedGlyphOpacity: 1,
} as const;

/**
 * HOW FAR AWAY THE THING A FORMATION IS AIMING AT MAY BE TREATED AS BEING.
 *
 * Every member aims from its OWN slot at one shared point, which is what stops a
 * squadron reading as a rigid lattice (`visual-design.md`). That is right while
 * the point is far off — the slots come out very nearly parallel — and it falls
 * apart when the point is as close as the formation is wide: the outer ships turn
 * hard inward, and each one turns the opposite way from the ship on the other
 * side of the axis.
 *
 * WHICH IS EXACTLY WHAT A HEADING SAMPLE IS. A published bearing window ends
 * wherever the craft will be a few seconds later, and a pirate's window is ten
 * seconds long — under one and a half world units at these speeds, against a slot
 * spread of nearly one. Aimed literally at that, the noses swung wider and wider
 * as the craft ate the chord and then snapped back the moment the next window
 * arrived. A heading is a DIRECTION; the distance to the sample that expressed it
 * is not information the picture should be using.
 *
 * The floor is a multiple of the formation's own size, so it scales with the
 * squadron rather than being a magic number tuned against one hull. Convergence is
 * still available where it is meant: an engagement aims at the world being fired
 * on, which is a real place and comfortably outside this.
 */
export const FORMATION_AIM_FLOOR = 12;

export const formationAimDistance = (raw: number, formationScale: number): number =>
  Math.max(raw, formationScale * FORMATION_AIM_FLOOR);

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
