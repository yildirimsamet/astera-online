import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BUILDING_IDS,
  GROUND_HULLS,
  INSTRUMENT_IDS,
  ALL_HULLS,
  RESEARCH_PROJECT_IDS,
  type BuildingId,
  type InstrumentId,
} from '@astera/rules';
import {
  BUILDING_ART,
  HULL_ART,
  LOGO,
  RESEARCH_ART,
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

/**
 * THE RESEARCH RENDERS, WHICH THIS FILE DID NOT COVER AT ALL.
 *
 * Every other art table here is resolved against `public/` — buildings,
 * instruments, ground guns, hulls, the wordmark — and `RESEARCH_ART` was the one
 * that was not. It went unnoticed while nine of its fifteen rows BORROWED a
 * picture from a table that was covered, so a broken path was impossible by
 * construction. The moment the owner's lab renders landed, fifteen fresh
 * filenames arrived with nothing checking them, and three of them carry spellings
 * that are easy to "fix" into a 404: `bullwark`, `syntesis`, `grind`.
 *
 * A missing research render is not a crash. It is a blank frame beside a price on
 * the one screen where a player is choosing between fifteen things — which is why
 * it needs a test rather than a glance.
 */
describe('the research renders', () => {
  it('give every project a picture that exists', () => {
    for (const id of RESEARCH_PROJECT_IDS) {
      const url = RESEARCH_ART[id];
      expect(url, `${id} has no render`).toBeTruthy();
      expect(existsSync(served(url)), `RESEARCH_ART.${id} → ${url}`).toBe(true);
    }
  });

  /**
   * TWO ROWS WITH ONE PICTURE ARE TWO ROWS THE EYE CANNOT TELL APART.
   *
   * Three projects used to share the Death Star render and five more wore hull or
   * building art belonging to another screen. Only the protocol may wear the
   * weapon now, because the weapon IS what it authorises.
   */
  it('give each project its own render, bar the one that wears its subject', () => {
    const shared = new Map<string, string[]>();
    for (const id of RESEARCH_PROJECT_IDS) {
      shared.set(RESEARCH_ART[id], [...(shared.get(RESEARCH_ART[id]) ?? []), id]);
    }
    const collisions = [...shared.values()].filter((ids) => ids.length > 1);
    expect(collisions, `projects sharing one picture: ${JSON.stringify(collisions)}`)
      .toEqual([]);
  });

  /** And the lab renders come from the lab, not from a hull or a resource table. */
  it('draws the twelve lab projects from the lab folder', () => {
    const borrowed = RESEARCH_PROJECT_IDS.filter((id) => !RESEARCH_ART[id].includes('/lab/'));
    expect(borrowed).toEqual(['DEATH_STAR_PROTOCOL']);
  });
});

describe('the identity', () => {
  /**
   * The wordmark is on the first frame of every session, so a broken path here is
   * not a blank well beside a price — it is the game opening with no name on it.
   *
   * Both files are DERIVED and committed — the supplied art is a glow on a solid
   * black plate, and these are the same pixels with that plate lifted into an alpha
   * channel. Nothing regenerates them on a build, so the only thing standing
   * between a deleted file and a nameless front door is this assertion.
   */
  it('resolves both forms of the mark', () => {
    for (const [form, url] of Object.entries(LOGO)) {
      expect(existsSync(served(url)), `LOGO.${form} → ${url}`).toBe(true);
    }
  });

  /** Every icon the manifest and the document head hand to a browser. */
  it('resolves every installed icon', () => {
    for (const name of [
      'icon-192.png',
      'icon-512.png',
      'icon-512-maskable.png',
      'icon-180.png',
      'favicon-32.png',
      'favicon-64.png',
    ]) {
      expect(existsSync(served(`/icons/${name}`)), name).toBe(true);
    }
  });
});

/**
 * THE SCORE'S FILE, GUARDED THE SAME WAY EVERY OTHER ASSET IS.
 *
 * `music.ts` names a path as a plain string, and a missing or renamed file fails
 * the way every asset in this project fails: silently. There is no empty well to
 * notice here — the game simply plays in silence, which is indistinguishable from
 * a browser that refused autoplay, and that is a real state the player can be in.
 * So nothing would ever be investigated.
 *
 * The path is read out of the module rather than written down twice: a test that
 * asserts its own copy of a constant proves only that it can copy.
 */
describe('the ambient score', () => {
  it('names a file that is actually served', async () => {
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile(resolve(process.cwd(), 'src/lib/music.ts'), 'utf8'),
    );
    const track = /const TRACK = '([^']+)'/.exec(source)?.[1];
    expect(track, 'music.ts no longer declares TRACK the way this test reads it').toBeTruthy();
    expect(existsSync(served(track!)), `${track!} is not in public/`).toBe(true);
  });
});
