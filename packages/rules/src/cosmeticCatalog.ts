import { PLANET_SKIN_IDS, type PlanetSkinId } from './cosmetics.js';
import type { HullId, MobileHullId } from './types.js';

export const COSMETIC_CATEGORIES = ['PLANET', 'RING', 'SHIP', 'PROBE', 'MINER', 'ENGINE', 'FLAG'] as const;
export type CosmeticCategory = typeof COSMETIC_CATEGORIES[number];
export const SHIP_SKIN_IDS = ['ship-red-dragon', 'ship-scorpion', 'ship-shark', 'ship-stingray'] as const;
export type ShipSkinId = typeof SHIP_SKIN_IDS[number];
export type ShipCosmeticEquipment = Partial<Record<MobileHullId, ShipSkinId>>;
export type CosmeticEquipment = Partial<Record<Exclude<CosmeticCategory, 'SHIP'>, CosmeticId>> & { SHIP?: ShipCosmeticEquipment };
export const EFFECT_SKIN_IDS = ['ring-aurora', 'ring-helios', 'ring-singularity', 'ring-saturn', 'ring-prism', 'ring-inferno', 'ring-nebula',
  'engine-aurora', 'engine-helios', 'engine-singularity', 'engine-titan', 'engine-tempest', 'engine-prism',
  'flag-vanguard', 'flag-orbit', 'flag-bastion', 'flag-meridian', 'flag-aurora', 'flag-helios', 'flag-singularity', 'flag-reaper', 'flag-ravager', 'flag-serpent', 'flag-phoenix', 'flag-ironfang',
  'flag-sovereign', 'flag-kraken', 'flag-oni', 'flag-voideye', 'flag-valkyrie', 'flag-scarab', 'flag-stag', 'flag-horizon', 'flag-tiger', 'flag-scorpion',
  'probe-ufo'] as const;
export const EXTRA_COSMETIC_IDS = [...EFFECT_SKIN_IDS, ...SHIP_SKIN_IDS] as const;
export const COSMETIC_IDS = [...PLANET_SKIN_IDS, ...EXTRA_COSMETIC_IDS] as const;
export type CosmeticId = typeof COSMETIC_IDS[number];
export type EffectSkinId = typeof EFFECT_SKIN_IDS[number];
export type CosmeticStyle = 'aurora' | 'helios' | 'singularity' | 'titan' | 'vanguard' | 'orbit' | 'ufo' | 'reaper' | 'ravager' | 'serpent' | 'phoenix' | 'ironfang'
  | 'saturn' | 'prism' | 'inferno' | 'nebula' | 'tempest' | 'bastion' | 'meridian'
  | 'sovereign' | 'kraken' | 'oni' | 'voideye' | 'valkyrie' | 'scarab' | 'stag' | 'horizon' | 'tiger' | 'scorpion';
export interface CosmeticDefinition {
  readonly id: CosmeticId;
  readonly category: CosmeticCategory;
  readonly free: boolean;
  readonly style?: CosmeticStyle;
  readonly model?: string;
  readonly previewModel?: string;
  readonly lodModel?: string;
  readonly hull?: MobileHullId;
  readonly accent: string;
}
const effect = (id: EffectSkinId, category: CosmeticCategory, style: CosmeticStyle, accent: string, free = false): CosmeticDefinition => ({ id, category, style, accent, free });
const ship = (id: ShipSkinId, name: string, hull: MobileHullId, accent: string): CosmeticDefinition => ({
  id, category: 'SHIP', free: false, hull, accent,
  model: `/assets/models/ships/skins/${name}/model.glb`,
  lodModel: `/assets/models/ships/skins/${name}/model_lod.glb`,
  previewModel: `/assets/models/ships/skins/${name}/model_preview.glb`,
});
export const COSMETICS: readonly CosmeticDefinition[] = [
  ...PLANET_SKIN_IDS.map((id): CosmeticDefinition => ({ id, category: 'PLANET', free: false, accent: '#d7b875' })),
  effect('ring-aurora', 'RING', 'aurora', '#68f5d0'),
  effect('ring-helios', 'RING', 'helios', '#ffc56b'),
  effect('ring-singularity', 'RING', 'singularity', '#b8a4ff'),
  effect('ring-saturn', 'RING', 'saturn', '#f1d9a6'),
  effect('ring-prism', 'RING', 'prism', '#c9f3ff'),
  effect('ring-inferno', 'RING', 'inferno', '#ff7a3d'),
  effect('ring-nebula', 'RING', 'nebula', '#ff8fd8'),
  effect('engine-aurora', 'ENGINE', 'aurora', '#68f5d0'),
  effect('engine-helios', 'ENGINE', 'helios', '#ffc56b'),
  effect('engine-singularity', 'ENGINE', 'singularity', '#b8a4ff'),
  effect('engine-titan', 'ENGINE', 'titan', '#ff8f47'),
  effect('engine-tempest', 'ENGINE', 'tempest', '#8fd8ff'),
  effect('engine-prism', 'ENGINE', 'prism', '#e9c8ff'),
  effect('flag-vanguard', 'FLAG', 'vanguard', '#b6c7db', true),
  effect('flag-orbit', 'FLAG', 'orbit', '#80bada', true),
  effect('flag-bastion', 'FLAG', 'bastion', '#a3a99f', true),
  effect('flag-meridian', 'FLAG', 'meridian', '#8f9fb8', true),
  effect('flag-aurora', 'FLAG', 'aurora', '#68f5d0'),
  effect('flag-helios', 'FLAG', 'helios', '#ffc56b'),
  effect('flag-singularity', 'FLAG', 'singularity', '#b8a4ff'),
  effect('flag-reaper', 'FLAG', 'reaper', '#ebd8c1'),
  effect('flag-ravager', 'FLAG', 'ravager', '#ff655c'),
  effect('flag-serpent', 'FLAG', 'serpent', '#b8ef65'),
  effect('flag-phoenix', 'FLAG', 'phoenix', '#ff984f'),
  effect('flag-ironfang', 'FLAG', 'ironfang', '#a8c8e4'),
  effect('flag-sovereign', 'FLAG', 'sovereign', '#f4c95d'),
  effect('flag-kraken', 'FLAG', 'kraken', '#4ff0e0'),
  effect('flag-oni', 'FLAG', 'oni', '#ff4b3e'),
  effect('flag-voideye', 'FLAG', 'voideye', '#d78bff'),
  effect('flag-valkyrie', 'FLAG', 'valkyrie', '#cfe6ff'),
  effect('flag-scarab', 'FLAG', 'scarab', '#57a6ff'),
  effect('flag-stag', 'FLAG', 'stag', '#9ff0ff'),
  effect('flag-horizon', 'FLAG', 'horizon', '#ffb35c'),
  effect('flag-tiger', 'FLAG', 'tiger', '#e8f6ff'),
  effect('flag-scorpion', 'FLAG', 'scorpion', '#ffbf3f'),
  { ...effect('probe-ufo', 'PROBE', 'ufo', '#84e7ff'), model: '/assets/models/probes/probe_ufo.glb', previewModel: '/assets/models/probes/probe_ufo_preview.glb' },
  ship('ship-red-dragon', 'red-dragon', 'CORSAIR', '#ff675d'),
  ship('ship-scorpion', 'scorpion', 'VIPER', '#e6b55b'),
  ship('ship-shark', 'shark', 'CITADEL', '#6ae2ff'),
  ship('ship-stingray', 'stingray', 'LEVIATHAN', '#6aefd8'),
];
const BY_ID = new Map<string, CosmeticDefinition>(COSMETICS.map(item => [item.id, item]));
export const cosmeticById = (id: string): CosmeticDefinition | null => BY_ID.get(id) ?? null;
export const cosmeticsInCategory = (category: CosmeticCategory): readonly CosmeticDefinition[] => COSMETICS.filter(item => item.category === category);
/** Omit ownership to browse the shop; pass it to browse accessible inventory items. */
export const cosmeticCategoriesFor = (owned?: readonly string[]): readonly CosmeticCategory[] => COSMETIC_CATEGORIES.filter(category =>
  COSMETICS.some(item => item.category === category && (owned === undefined || item.free || owned.includes(item.id))));
export const isPlanetCosmetic = (id: CosmeticId): id is PlanetSkinId => cosmeticById(id)?.category === 'PLANET';
export const shipCosmeticForHull = (hull: HullId, id?: string | null): CosmeticDefinition | null => {
  const item = id ? cosmeticById(id) : null;
  return item?.category === 'SHIP' && item.hull === hull ? item : null;
};
export const canEquipCosmetic = (id: string | null, category: CosmeticCategory, owned: readonly string[]): boolean => {
  if (id === null) return true;
  const item = cosmeticById(id);
  return item !== null && item.category === category && (item.free || owned.includes(id));
};
