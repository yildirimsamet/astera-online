import {
  planetSkinAppearance,
  type PlanetBaseModelId,
  type PlanetPaletteId,
  type PlanetSkinStatus,
  type SkinAttachment,
} from '@astera/rules';

type Rgb = readonly [number, number, number];

/** Numeric colours are linear RGB, matching the palette shader in the POC. */
export interface PlanetPalette {
  readonly ramp: readonly [Rgb, Rgb, Rgb];
  readonly recolor: number;
  readonly crustDark: Rgb;
  readonly crustLight: Rgb;
  readonly crackShade: number;
  readonly rimColor: Rgb;
  readonly roughness: number;
}

export interface PlanetModelTuning {
  readonly heat: number;
  readonly threshold: number;
  readonly spread: number;
  readonly rimStrength: number;
}

const MODEL_URLS: Record<PlanetBaseModelId, string> = {
  'intact-planet': '/assets/models/test_planet_modal.glb',
  'fractured-planet': '/assets/models/patlamis_gezegen_2.glb',
};

/** The crack mask is read from each model's own base colour map. */
const MODEL_TUNING: Record<PlanetBaseModelId, PlanetModelTuning> = {
  'intact-planet': { heat: 2.4, threshold: 0.28, spread: 3, rimStrength: 0.8 },
  'fractured-planet': { heat: 1.6, threshold: 0.5, spread: 1.5, rimStrength: 0.6 },
};

/** First-release looks, measured and tuned in stash@{2}'s planet test page. */
const PALETTES: Record<PlanetPaletteId, PlanetPalette> = {
  lava: {
    ramp: [[0.42, 0.03, 0], [1, 0.3, 0.02], [1, 0.78, 0.34]],
    recolor: 0, crustDark: [0, 0, 0], crustLight: [0, 0, 0],
    crackShade: 0.2, rimColor: [1, 0.32, 0.06], roughness: 1.7,
  },
  ice: {
    ramp: [[0, 0.06, 0.22], [0.08, 0.5, 1], [0.7, 0.95, 1]],
    recolor: 1, crustDark: [0.1, 0.16, 0.26], crustLight: [0.62, 0.74, 0.9],
    crackShade: 0.35, rimColor: [0.35, 0.7, 1], roughness: 0.7,
  },
  toxic: {
    ramp: [[0.02, 0.16, 0], [0.28, 1, 0.04], [0.82, 1, 0.45]],
    recolor: 0.85, crustDark: [0.03, 0.02, 0.05], crustLight: [0.2, 0.16, 0.26],
    crackShade: 0.2, rimColor: [0.35, 1, 0.2], roughness: 1.4,
  },
  desert: {
    ramp: [[0.25, 0.08, 0.01], [0.7, 0.3, 0.06], [1, 0.7, 0.35]],
    recolor: 1, crustDark: [0.3, 0.14, 0.05], crustLight: [0.9, 0.6, 0.3],
    crackShade: 0.55, rimColor: [0.95, 0.55, 0.25], roughness: 1.8,
  },
};

export interface PlanetSkinVisual {
  readonly modelUrl: string;
  readonly finish:
    | { readonly kind: 'AUTHORED' }
    | { readonly kind: 'PALETTE'; readonly palette: PlanetPalette; readonly tuning: PlanetModelTuning };
  readonly includedAttachments: readonly SkinAttachment[];
}

/** Null leaves the existing planet PNG as the safe fallback. */
export function planetSkinVisual(id: string, status: PlanetSkinStatus = 'NORMAL'): PlanetSkinVisual | null {
  const recipe = planetSkinAppearance(id, status);
  if (!recipe) return null;
  const tuned = MODEL_TUNING[recipe.baseModelId];
  return {
    modelUrl: MODEL_URLS[recipe.baseModelId],
    finish: recipe.finish.kind === 'AUTHORED'
      ? { kind: 'AUTHORED' }
      : {
          kind: 'PALETTE',
          palette: PALETTES[recipe.finish.paletteId],
          tuning: recipe.finish.paletteId === 'desert'
            ? { ...tuned, heat: 0, rimStrength: 0.45 }
            : tuned,
        },
    includedAttachments: recipe.includedAttachments,
  };
}

/** One mesh/material per product and condition; keep unknown ids on the PNG path. */
export function partitionPlanetSkins<T extends { id: string; skin?: { id: string; status: PlanetSkinStatus } }>(
  nodes: readonly T[],
): {
  png: T[];
  models: { skinId: string; status: PlanetSkinStatus; nodes: T[] }[];
} {
  const png: T[] = [];
  const byLook = new Map<string, { skinId: string; status: PlanetSkinStatus; nodes: T[] }>();
  for (const node of nodes) {
    const skin = node.skin;
    if (!skin || !planetSkinVisual(skin.id, skin.status)) {
      png.push(node);
      continue;
    }
    const key = `${skin.id}:${skin.status}`;
    const group = byLook.get(key);
    if (group) group.nodes.push(node);
    else byLook.set(key, { skinId: skin.id, status: skin.status, nodes: [node] });
  }
  return { png, models: [...byLook.values()] };
}
