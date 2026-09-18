/**
 * Stable product identities. Account ownership will point at these ids; a recipe
 * may be revised without changing what a commander owns.
 *
 * A skin is one equipped product. Its recipe can use an authored model, add a
 * finish, and eventually include mounted assets. Included assets belong to this
 * skin's appearance; they do not imply a separate entitlement to those assets.
 */
export const PLANET_SKIN_IDS = [
  'planet-lava',
  'planet-ice',
  'planet-toxic',
  'planet-desert',
] as const;

export type PlanetSkinId = (typeof PLANET_SKIN_IDS)[number];
export type PlanetBaseModelId = 'intact-planet' | 'fractured-planet';
export type PlanetPaletteId = 'lava' | 'ice' | 'toxic' | 'desert';
export type PlanetSkinStatus = 'NORMAL' | 'RECOVERY_SHIELD';

/** Only the struck world's still-active recovery boost selects the damaged look. */
export const planetSkinStatus = (recoveryBoostUntil: Date | null, now: Date): PlanetSkinStatus =>
  recoveryBoostUntil !== null && recoveryBoostUntil > now ? 'RECOVERY_SHIELD' : 'NORMAL';

export interface SkinAttachment {
  readonly assetId: string;
  /** A named placement rule resolved by the renderer, not user-authored coordinates. */
  readonly placementId: string;
}

export type PlanetSkinFinish =
  | { readonly kind: 'AUTHORED' }
  | { readonly kind: 'PALETTE'; readonly paletteId: PlanetPaletteId };

export interface PlanetSkinAppearance {
  readonly baseModelId: PlanetBaseModelId;
  readonly finish: PlanetSkinFinish;
  readonly includedAttachments: readonly SkinAttachment[];
}

export interface PlanetSkinDefinition {
  readonly id: PlanetSkinId;
  readonly target: 'PLANET';
  readonly recipeVersion: number;
  readonly recipe: PlanetSkinAppearance & {
    /** Overrides for a world condition; no extra product or entitlement. */
    readonly statusVariants: Readonly<Partial<Record<Exclude<PlanetSkinStatus, 'NORMAL'>, Partial<PlanetSkinAppearance>>>>;
  };
}

const RECOVERY_APPEARANCE = { baseModelId: 'fractured-planet' } as const;

export const PLANET_SKINS = {
  'planet-lava': {
    id: 'planet-lava', target: 'PLANET', recipeVersion: 1,
    recipe: {
      baseModelId: 'intact-planet',
      finish: { kind: 'PALETTE', paletteId: 'lava' },
      includedAttachments: [],
      statusVariants: { RECOVERY_SHIELD: RECOVERY_APPEARANCE },
    },
  },
  'planet-ice': {
    id: 'planet-ice', target: 'PLANET', recipeVersion: 1,
    recipe: {
      baseModelId: 'intact-planet',
      finish: { kind: 'PALETTE', paletteId: 'ice' },
      includedAttachments: [],
      statusVariants: { RECOVERY_SHIELD: RECOVERY_APPEARANCE },
    },
  },
  'planet-toxic': {
    id: 'planet-toxic', target: 'PLANET', recipeVersion: 1,
    recipe: {
      baseModelId: 'intact-planet',
      finish: { kind: 'PALETTE', paletteId: 'toxic' },
      includedAttachments: [],
      statusVariants: { RECOVERY_SHIELD: RECOVERY_APPEARANCE },
    },
  },
  'planet-desert': {
    id: 'planet-desert', target: 'PLANET', recipeVersion: 1,
    recipe: {
      baseModelId: 'intact-planet',
      finish: { kind: 'PALETTE', paletteId: 'desert' },
      includedAttachments: [],
      statusVariants: { RECOVERY_SHIELD: RECOVERY_APPEARANCE },
    },
  },
} as const satisfies Record<PlanetSkinId, PlanetSkinDefinition>;

const SKINS_BY_ID = new Map<string, PlanetSkinDefinition>(
  PLANET_SKIN_IDS.map((id) => [id, PLANET_SKINS[id]]),
);

/** Unknown ids must never become an inherited object property or a visual recipe. */
export const planetSkinById = (id: string): PlanetSkinDefinition | null =>
  SKINS_BY_ID.get(id) ?? null;

/** Selects a look without changing the purchased skin's identity. */
export function planetSkinAppearance(
  id: string,
  status: PlanetSkinStatus,
): PlanetSkinAppearance | null {
  const skin = planetSkinById(id);
  if (!skin) return null;
  const { recipe } = skin;
  const variant = status === 'NORMAL' ? undefined : recipe.statusVariants[status];
  return {
    baseModelId: variant?.baseModelId ?? recipe.baseModelId,
    finish: variant?.finish ?? recipe.finish,
    includedAttachments: variant?.includedAttachments ?? recipe.includedAttachments,
  };
}
