import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BUILDING_IDS,
  GROUND_HULLS,
  INSTRUMENT_IDS,
  ALL_HULLS,
  type BuildingId,
  type InstrumentId,
} from '@blindspace/rules';
import {
  BUILDING_ART,
  HULL_ART,
  buildingArt,
  groundArt,
  instrumentArt,
  nextBuildingArt,
  nextGroundArt,
  nextInstrumentArt,
  tierOf,
} from '../src/ui/assets.js';

/**
 * THE 2D ART, AND THE ONE FAILURE IT HAS.
 *
 * `model.test.ts` guards the models; nothing guarded the images, and they fail the
 * same way: a path is a plain string, a typo or a renamed file is a 404 the console
 * swallows, and what the player sees is an empty well next to a price. It looks
 * exactly like a thing that was never given art, which is what half of these rows
 * genuinely were until the renders arrived — so nobody would have looked twice.
 *
 * Every path this file produces is therefore resolved against `public/`, which is
 * what the browser actually fetches.
 */

const served = (url: string): string => resolve(process.cwd(), 'public', url.replace(/^\//, ''));

/** Every tier a levelled item can be in, and a level that lands in each of them. */
const LEVELS_PER_TIER: readonly [1 | 2 | 3, number[]][] = [
  [1, [0, 1, 2]],
  [2, [3, 4]],
  [3, [5, 9, 40]],
];

describe('the tier ladder', () => {
  it('puts a level in the tier its table says', () => {
    for (const [tier, levels] of LEVELS_PER_TIER) {
      for (const level of levels) {
        expect(tierOf(level), `L${String(level)} should be tier ${String(tier)}`).toBe(tier);
      }
    }
  });
});

describe('the building renders', () => {
  /**
   * FIVE BUILDINGS, NONE OF THEM BLANK. The Shipyard was the last `null` in this
   * table and drew a line-art mark on the busiest tab in the game.
   */
  it('give every building a picture at every tier', () => {
    for (const id of BUILDING_IDS) {
      for (const [, levels] of LEVELS_PER_TIER) {
        for (const level of levels) {
          const url = buildingArt(id, level);
          expect(url, `${id} has no render at L${String(level)}`).not.toBeNull();
          expect(existsSync(served(url ?? '')), `${id} L${String(level)} → ${String(url)}`).toBe(
            true,
          );
        }
      }
    }
    expect(Object.keys(BUILDING_ART)).toHaveLength(BUILDING_IDS.length);
  });

  it('resolves the untiered fallback table too', () => {
    for (const [id, url] of Object.entries(BUILDING_ART)) {
      expect(url, `BUILDING_ART.${id} is blank`).not.toBeNull();
      expect(existsSync(served(url ?? '')), `BUILDING_ART.${id} → ${String(url)}`).toBe(true);
    }
  });

  /**
   * A LADDER THAT LIGHTS UP. The Shipyard used to have one look, so `ItemSheet`
   * listed it as a building that never changes; it tiers now, and the sheet's
   * `TIERED_BUILDINGS` has to agree or the rung that brings new hardware arrives
   * unmarked.
   */
  it('promise the next tier only where the picture actually changes', () => {
    const tiering: BuildingId[] = ['CORE', 'VAULT', 'SHIPYARD'];
    for (const id of tiering) {
      expect(nextBuildingArt(id, 1), `${id} L1→L2 stays inside tier 1`).toBeNull();
      expect(nextBuildingArt(id, 2), `${id} L2→L3 crosses into tier 2`).toBe(buildingArt(id, 3));
      expect(nextBuildingArt(id, 4), `${id} L4→L5 crosses into tier 3`).toBe(buildingArt(id, 5));
      expect(nextBuildingArt(id, 9), `${id} is at the top of its ladder`).toBeNull();
    }
    // The two that wear the resource they produce never promise anything.
    for (const id of ['REFINERY', 'EXTRACTOR'] as const) {
      for (const level of [1, 2, 4, 9]) expect(nextBuildingArt(id, level)).toBeNull();
    }
  });
});

describe('the instrument renders', () => {
  /** The Veil was the one instrument drawn rather than rendered. It is not now. */
  it('give every instrument a picture at every tier', () => {
    for (const id of INSTRUMENT_IDS) {
      for (const [, levels] of LEVELS_PER_TIER) {
        for (const level of levels) {
          const url = instrumentArt(id, level);
          expect(url, `${id} has no render at L${String(level)}`).not.toBeNull();
          expect(existsSync(served(url ?? '')), `${id} L${String(level)} → ${String(url)}`).toBe(
            true,
          );
        }
      }
    }
  });

  it('give each instrument three distinct renders', () => {
    for (const id of INSTRUMENT_IDS) {
      const seen = new Set(LEVELS_PER_TIER.map(([, levels]) => instrumentArt(id, levels[0] ?? 0)));
      expect(seen.size, `${id} repeats a render across tiers`).toBe(3);
    }
  });

  /** Four instruments, four sets of art. A shared file is a borrow (D25). */
  it('never lends one instrument the render of another', () => {
    const owners = new Map<string, InstrumentId>();
    for (const id of INSTRUMENT_IDS) {
      for (const [, levels] of LEVELS_PER_TIER) {
        const url = instrumentArt(id, levels[0] ?? 0) ?? '';
        const other = owners.get(url);
        expect(other ?? id, `${id} and ${String(other)} share ${url}`).toBe(id);
        owners.set(url, id);
      }
    }
  });

  it('promise the next tier only where the picture actually changes', () => {
    for (const id of INSTRUMENT_IDS) {
      expect(nextInstrumentArt(id, 1)).toBeNull();
      expect(nextInstrumentArt(id, 2)).toBe(instrumentArt(id, 3));
      expect(nextInstrumentArt(id, 4)).toBe(instrumentArt(id, 5));
      expect(nextInstrumentArt(id, 6)).toBeNull();
    }
  });
});

/**
 * A GROUND BATTERY IS THE ONE LADDER READ OFF A COUNT.
 *
 * The two guns have three renders each and no level, so their tier comes from how
 * many are standing. The risk this guards is the off-by-one that would make the
 * row advertise the battery you already own as the one you are about to buy.
 */
describe('the ground gun renders', () => {
  it('give both guns a picture at every size of battery', () => {
    for (const id of GROUND_HULLS) {
      for (const standing of [1, 2, 3, 4, 5, 12, 60]) {
        const url = groundArt(id, standing);
        expect(existsSync(served(url)), `${id} × ${String(standing)} → ${url}`).toBe(true);
      }
    }
  });

  it('climbs a tier at three guns and again at five', () => {
    for (const id of GROUND_HULLS) {
      expect(groundArt(id, 1)).toBe(groundArt(id, 2));
      expect(groundArt(id, 3)).toBe(groundArt(id, 4));
      expect(groundArt(id, 5)).toBe(groundArt(id, 30));
      expect(new Set([groundArt(id, 1), groundArt(id, 3), groundArt(id, 5)]).size).toBe(3);
    }
  });

  /** The two guns are opposite classes (D27) and must never wear one another's art. */
  it('keeps the heavy gun and the light gun apart', () => {
    for (const standing of [1, 3, 5]) {
      expect(groundArt('BASTION', standing)).not.toBe(groundArt('THORN', standing));
    }
  });

  /**
   * The anticipation hook, and the exact boundary it fires on: two guns standing
   * means the NEXT one changes the emplacement; three means it does not.
   */
  it('shows what one more gun would build, only when it would change', () => {
    for (const id of GROUND_HULLS) {
      expect(nextGroundArt(id, 0), 'an empty plate is not promised a new tier').toBeNull();
      expect(nextGroundArt(id, 1)).toBeNull();
      expect(nextGroundArt(id, 2)).toBe(groundArt(id, 3));
      expect(nextGroundArt(id, 3)).toBeNull();
      expect(nextGroundArt(id, 4)).toBe(groundArt(id, 5));
      expect(nextGroundArt(id, 5)).toBeNull();
      expect(nextGroundArt(id, 40)).toBeNull();
    }
  });
});

describe('the hull renders', () => {
  /**
   * The two ground guns were the last `null`s here, on the grounds that a turret
   * drawn as a ship claims it can leave. They have turret art now, so the table is
   * total — and a caller that only knows a hull id gets the tier-1 emplacement.
   */
  it('resolve for every hull, ground guns included', () => {
    for (const id of ALL_HULLS) {
      const url = HULL_ART[id];
      expect(url, `${id} has no render`).not.toBeNull();
      expect(existsSync(served(url ?? '')), `HULL_ART.${id} → ${String(url)}`).toBe(true);
    }
  });

  it('agrees with the first tier of the battery ladder', () => {
    for (const id of GROUND_HULLS) {
      expect(HULL_ART[id]).toBe(groundArt(id, 1));
    }
  });
});
