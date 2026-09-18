import type { PlanetSkinId } from '@astera/rules';

/** Merchandising stays separate from ownership and the visual recipe. */
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
} as const satisfies Record<PlanetSkinId, {
  image: string;
  nameKey: string;
  storyKey: string;
  accent: string;
  glow: string;
  edition: string;
}>;

/** Catalogue size as the two-digit edition label the cards already use. */
export const SKIN_EDITION_TOTAL = String(Object.keys(PLANET_SKIN_CATALOG).length).padStart(2, '0');
