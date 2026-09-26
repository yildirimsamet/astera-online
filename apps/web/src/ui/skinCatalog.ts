import type { PlanetSkinId } from '@astera/rules';
import { skinAsset } from './skinAssets.js';

/** Merchandising stays separate from ownership and the visual recipe. */
export const SKIN_COLLECTIONS = {
  elemental: {
    ids: ['planet-lava', 'planet-ice', 'planet-toxic', 'planet-desert'],
    nameKey: 'skins.elementalWorlds',
    descriptionKey: 'skins.elementalDescription',
  },
  country: {
    ids: ['planet-turkey', 'planet-germany', 'planet-france', 'planet-spain'],
    nameKey: 'skins.countryWorlds',
    descriptionKey: 'skins.countryDescription',
  },
} as const;

export type SkinCollectionId = keyof typeof SKIN_COLLECTIONS;
export const SKIN_COLLECTION_IDS = ['elemental', 'country'] as const satisfies readonly SkinCollectionId[];

export const PLANET_SKIN_CATALOG = {
  'planet-lava': {
    image: '/assets/images/skins/planet-lava.png',
    nameKey: 'skins.lava',
    storyKey: 'skins.lavaStory',
    accent: '#ff9a50',
    glow: 'rgba(240, 96, 36, 0.35)',
    edition: '01',
  },
  'planet-ice': {
    image: '/assets/images/skins/planet-ice.png',
    nameKey: 'skins.ice',
    storyKey: 'skins.iceStory',
    accent: '#a7e8ff',
    glow: 'rgba(100, 178, 255, 0.32)',
    edition: '02',
  },
  'planet-toxic': {
    image: '/assets/images/skins/planet-toxic.png',
    nameKey: 'skins.toxic',
    storyKey: 'skins.toxicStory',
    accent: '#bbf36b',
    glow: 'rgba(145, 220, 62, 0.28)',
    edition: '03',
  },
  'planet-desert': {
    image: '/assets/images/skins/planet-desert.png',
    nameKey: 'skins.desert',
    storyKey: 'skins.desertStory',
    accent: '#f0bd78',
    glow: 'rgba(231, 164, 83, 0.27)',
    edition: '04',
  },
  'planet-turkey': {
    image: skinAsset('images/skins/planet-turkey.png'),
    nameKey: 'skins.turkey',
    storyKey: 'skins.turkeyStory',
    accent: '#f17b79',
    glow: 'rgba(235, 55, 72, 0.30)',
    edition: '01',
  },
  'planet-germany': {
    image: skinAsset('images/skins/planet-germany.png'),
    nameKey: 'skins.germany',
    storyKey: 'skins.germanyStory',
    accent: '#efc077',
    glow: 'rgba(230, 178, 64, 0.27)',
    edition: '02',
  },
  'planet-france': {
    image: skinAsset('images/skins/planet-france.png'),
    nameKey: 'skins.france',
    storyKey: 'skins.franceStory',
    accent: '#9bbcff',
    glow: 'rgba(91, 137, 245, 0.29)',
    edition: '03',
  },
  'planet-spain': {
    image: skinAsset('images/skins/planet-spain.png'),
    nameKey: 'skins.spain',
    storyKey: 'skins.spainStory',
    accent: '#f3bb6d',
    glow: 'rgba(226, 142, 59, 0.29)',
    edition: '04',
  },
} as const satisfies Record<PlanetSkinId, {
  image: string;
  nameKey: string;
  storyKey: string;
  accent: string;
  glow: string;
  edition: string;
}>;

/** Editions are numbered inside each collection, not across unrelated lines. */
export const skinEditionTotal = (collection: SkinCollectionId): string =>
  String(SKIN_COLLECTIONS[collection].ids.length).padStart(2, '0');
