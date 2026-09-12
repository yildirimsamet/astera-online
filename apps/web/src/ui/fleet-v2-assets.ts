import type { MobileHullId } from '@astera/rules';
import type { CraftPose, Facing } from '../galaxy/model.js';

export interface FleetV2Asset {
  readonly card: string;
  readonly icon: string;
  readonly model: string;
  /** Measured in the six-side development viewer, never inferred from bounds. */
  readonly facing: Facing;
  /** Relative world-space presence; geometry is still normalised by orientedCraft. */
  readonly scale: number;
  /** Owner-approved additive pose after the authored nose is normalised onto +Z. */
  readonly pose: CraftPose;
  readonly light: {
    readonly color: string;
    readonly intensity: number;
    readonly distance: number;
  };
  readonly trail: { readonly color: string; readonly width: number };
}

type Presentation = Pick<FleetV2Asset, 'facing' | 'scale' | 'light' | 'trail'>;

const asset = (id: string, presentation: Presentation, pose: CraftPose): FleetV2Asset => ({
  card: `/assets/images/ships/${id}.webp`,
  icon: `/assets/images/ships/icons/${id}.webp`,
  model: `/assets/models/ships/${id}.glb`,
  ...presentation,
  pose,
});

const calibrated = (x: number, y: number, z: number, height: number): CraftPose => ({
  rotation: [x, y, z],
  height,
});

const offensive = (facing: Facing, scale: number, color: string, width: number): Presentation => ({
  facing,
  scale,
  light: { color, intensity: 1.55, distance: 2.8 * scale },
  trail: { color, width },
});

const defensive = (facing: Facing, scale: number, color: string, width: number): Presentation => ({
  facing,
  scale,
  light: { color, intensity: 1.35, distance: 2.6 * scale },
  trail: { color, width },
});

const cargo = (facing: Facing, scale: number, width: number): Presentation => ({
  facing,
  scale,
  light: { color: '#0bc089', intensity: 1.25, distance: 2.5 * scale },
  trail: { color: '#0bc089', width },
});

/**
 * The web's one exhaustive Fleet V2 asset contract.
 *
 * Stable rule IDs are translated to canonical URLs here, not at call sites. The
 * staging folder and its provisional/misspelled names therefore cannot leak into
 * network requests. Presentation metadata sits beside the model it describes so
 * a later scene cannot silently give every silhouette the same visual weight.
 */
export const FLEET_V2_ASSET_MANIFEST = {
  DART: asset('dart', offensive('-x', 0.7, '#35d9e5', 0.72), calibrated(0, -1, 16, 0.17)),
  PIKE: asset('pike', offensive('+x', 0.7, '#ff3f52', 0.78), calibrated(0, 0, 0, 0.14)),
  RAMPART: asset('rampart', defensive('+x', 0.7, '#35d9e5', 0.82), calibrated(0, 0, 0, 0.12)),
  WARDEN: asset('warden', defensive('+x', 0.7, '#AD78ED', 0.76), calibrated(1, 0, 0, 0.06)),
  COURIER: asset('courier', cargo('+x', 0.7, 0.74), calibrated(0, 0, 0, 0.12)),

  VIPER: asset('viper', offensive('+x', 1.25, '#CB8C4E', 0.76), calibrated(0, 0, 0, 0.15)),
  TALON: asset('talon', offensive('+x', 1.25, '#B2D837', 0.84), calibrated(0, 0, 0, 0.1)),
  STRONGHOLD: asset('stronghold', defensive('+z', 1.25, '#AD78ED', 0.94), calibrated(0, 0, 0, 0.09)),
  SENTINEL: asset('sentinel', defensive('+z', 1.25, '#3FAEF4', 0.86), calibrated(0, 0, 0, 0.1)),
  WAYFARER: asset('wayfarer', cargo('+x', 1.25, 0.86), calibrated(0, 0, 0, 0.12)),

  TEMPEST: asset('tempest', offensive('+x', 1.85, '#0A75BC', 0.8), calibrated(0, 0, 0, 0.15)),
  BALLISTA: asset('ballista', offensive('+z', 1.50, '#ff3f52', 0.92), calibrated(-10.5, 0, 0, 0.09)),
  LEVIATHAN: asset('leviathan', defensive('+x', 1.85, '#DAAB51', 1.02), calibrated(0, 0, 0, 0.15)),
  PRAETORIAN: asset('praetorian', defensive('+z', 1.85, '#59A9C8', 0.94), calibrated(0, 0, 0, 0.16)),
  ATLAS: asset('atlas', cargo('+z', 1.35, 1), calibrated(-15, 0, 0, 0.12)),
  NULLIFIER: asset('nullifier', {
    facing: '-x',
    scale: 2,
    light: { color: '#ff3f52', intensity: 1.85, distance: 3.2 },
    // #e42f38 — the same colour, as the hex every other trail is authored in.
    trail: { color: '#e42f38', width: 0.9 },
  }, calibrated(12, 0, 0, 0)),
  /*
    D200. Nose on +z, read off the six-side viewer: the claws lead. Tier-three size.
    It flies with a fleet and fires nothing, so it takes a support craft's gentle
    light rather than a warship's — and its own cold blue, the colour its render's
    pod rings already glow, because the cargo green says "hold" and it has none.
  */
  GARBAGE_COLLECTOR: asset('garbage-collector', {
    facing: '+z',
    scale: 1.85,
    light: { color: '#4c9bff', intensity: 1.25, distance: 2.5 * 1.85 },
    trail: { color: '#4c9bff', width: 0.96 },
  }, calibrated(0, 0, 0, 0.12)),

  CATACLYSM: asset('cataclysm', offensive('-x', 3, '#ff3f52', 1.12), calibrated(11.5, 0, 90, 0.13)),
  /*
    D196'S THREE. Scale sits inside the tier-4 band the two originals already set
    (Cataclysm 3.0, Citadel 2.5) rather than above it, so D165's "no hull is drawn
    smaller than one of a lower tier" holds and none of them out-masses the two
    hulls the tier was built around. Drive colours are COLD, which is what
    `visual-design.md` reserves for an ordinary combat hull — amber, red and
    strategic red are spoken for — and the Argosy takes the cargo green every hold
    in the game already flies.
  */
  // Owner review reversed the first quarter-turn: all three supplied models have
  // their visible nose on -X. Keeping the correction in `facing` fixes every
  // flight scene instead of layering a convoy-only rotation over the symptom.
  CORSAIR: asset('corsair', offensive('-x', 2.7, '#35d9e5', 1.06), calibrated(0, 0, 0, 0.14)),
  CITADEL: asset('citadel', defensive('-z', 2.5, '#3BB9F1', 1.18), calibrated(-13, 180, 0, 0.21)),
  PALADIN: asset('paladin', defensive('-x', 2.6, '#AD78ED', 1.1), calibrated(0, 0, 0, 0.13)),
  ARGOSY: asset('argosy', cargo('-x', 2.4, 1.14), calibrated(0, 0, 0, 0.12)),
} as const satisfies Record<MobileHullId, FleetV2Asset>;

/** The small representative Fleet V2 cast used by the public landing scene. */
export const FLEET_V2_LANDING_MODELS = {
  dart: FLEET_V2_ASSET_MANIFEST.DART.model,
  pike: FLEET_V2_ASSET_MANIFEST.PIKE.model,
  rampart: FLEET_V2_ASSET_MANIFEST.RAMPART.model,
  courier: FLEET_V2_ASSET_MANIFEST.COURIER.model,
} as const;
