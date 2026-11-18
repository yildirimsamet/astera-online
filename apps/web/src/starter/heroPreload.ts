import { VESSEL_LOOKS, type VesselHull } from '@astera/rules';
import { HERO_SIZES, heroArt, heroSrcSet } from './shipScreen.js';

const fetched = new Set<VesselHull>();

/**
 * THE PLAYER'S OWN SHIP, FETCHED AHEAD OF ITS PAGE (owner phone playtest 2026-11-19): every look of the hull,
 * in the width the page will ask for, while the galaxy is up, so the painting is there when the page opens and
 * when a repair turns it. Once per hull; returns what it asked for.
 */
export function preloadHero(hull: VesselHull): string[] {
  if (fetched.has(hull)) return [];
  fetched.add(hull);
  return VESSEL_LOOKS.map((look) => {
    const image = new Image();
    image.decoding = 'async';
    image.sizes = HERO_SIZES;
    image.srcset = heroSrcSet(hull, look);
    image.src = heroArt(hull, look);
    return image.srcset;
  });
}
