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
  light: { color: '#ffb43b', intensity: 1.25, distance: 2.5 * scale },
  trail: { color: '#f5a623', width },
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
  DART: asset('dart', offensive('-x', 0.84, '#37d7ff', 0.72), calibrated(0, -1, 16, 0.17)),
  PIKE: asset('pike', offensive('+x', 0.9, '#ff3f52', 0.78), calibrated(0, 0, 0, 0.14)),
  RAMPART: asset('rampart', defensive('+x', 0.94, '#35d9e5', 0.82), calibrated(0, 0, 0, 0.12)),
  WARDEN: asset('warden', defensive('+x', 0.88, '#a855f7', 0.76), calibrated(1, 0, 0, 0.06)),
  COURIER: asset('courier', cargo('+x', 0.92, 0.74), calibrated(0, 0, 0, 0.12)),

  VIPER: asset('viper', offensive('+x', 0.94, '#54e36f', 0.76), calibrated(0, 0, 0, 0.15)),
  TALON: asset('talon', offensive('+x', 1, '#ff782e', 0.84), calibrated(0, 0, 0, 0.1)),
  STRONGHOLD: asset('stronghold', defensive('+z', 1.08, '#2da8ff', 0.94), calibrated(0, 0, 0, 0.09)),
  SENTINEL: asset('sentinel', defensive('+z', 1, '#b95cff', 0.86), calibrated(0, 0, 0, 0.1)),
  WAYFARER: asset('wayfarer', cargo('+x', 1.05, 0.86), calibrated(0, 0, 0, 0.12)),

  TEMPEST: asset('tempest', offensive('+x', 1.04, '#42a5ff', 0.8), calibrated(0, 0, 0, 0.15)),
  BALLISTA: asset('ballista', offensive('+z', 1.12, '#ff8b32', 0.92), calibrated(-10.5, 0, 0, 0.09)),
  LEVIATHAN: asset('leviathan', defensive('+x', 1.2, '#30e2e8', 1.02), calibrated(0, 0, 0, 0.15)),
  PRAETORIAN: asset('praetorian', defensive('+z', 1.13, '#2f9dff', 0.94), calibrated(0, 0, 0, 0.16)),
  ATLAS: asset('atlas', cargo('+z', 1.2, 1), calibrated(-15, 0, 0, 0.12)),
  NULLIFIER: asset('nullifier', {
    facing: '-x',
    scale: 1.08,
    light: { color: '#d946ef', intensity: 1.8, distance: 3.2 },
    trail: { color: '#c026d3', width: 0.9 },
  }, calibrated(12, 0, 0, 0)),

  CATACLYSM: asset('cataclysm', offensive('-x', 1.32, '#ff253f', 1.12), calibrated(11.5, 0, 90, 0.13)),
  CITADEL: asset('citadel', defensive('-z', 1.38, '#35bdf2', 1.18), calibrated(-13, 180, 0, 0.21)),
} as const satisfies Record<MobileHullId, FleetV2Asset>;

/** The small representative Fleet V2 cast used by the public landing scene. */
export const FLEET_V2_LANDING_MODELS = {
  dart: FLEET_V2_ASSET_MANIFEST.DART.model,
  pike: FLEET_V2_ASSET_MANIFEST.PIKE.model,
  rampart: FLEET_V2_ASSET_MANIFEST.RAMPART.model,
  courier: FLEET_V2_ASSET_MANIFEST.COURIER.model,
} as const;
