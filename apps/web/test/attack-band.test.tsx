import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ABUSE, coreTier } from '@astera/rules';
import { outOfBandAbove, ownPeakCore } from '../src/lib/band.js';
import type { GalaxyPlanet } from '../src/api/schemas.js';

/**
 * THE ONE HALF OF THE ATTACK BAND FOG LETS THE CLIENT PROVE. Owner instruction.
 *
 * D168 refuses a raid unless the two COMMANDERS' development tiers are within
 * `ABUSE.tierBand`, measured on the tallest Core each holds anywhere. D168's own
 * note records what that costs: the rule is invisible until the refusal, so a
 * commander picks a fleet, presses launch and is told no.
 *
 * THE CLIENT CANNOT SIMPLY COMPUTE IT, AND THE REASON IS D127. `routes/galaxy.ts`
 * redacts every world outside the caller's own Telescope reach down to an id and a
 * position — no `coreLevel`, no controller. So the client's reading of another
 * commander's peak is a LOWER BOUND: they may hold a taller Core somewhere nobody
 * has looked. The caller's OWN peak is exact, because their worlds always resolve.
 *
 * That asymmetry decides exactly what may be drawn, and it is not a preference:
 *
 *   · SEEN ALREADY TOO FAR ABOVE → the true peak can only be higher, so the gap
 *     can only grow. The refusal is CERTAIN and the control may state it.
 *   · SEEN TOO FAR BELOW → the true peak may be anywhere above what is visible,
 *     so the fight may well be legal. Nothing may be drawn; a control that
 *     refused here would invent a rule out of the caller's own ignorance.
 *
 * Which is why this file tests one direction and asserts the other stays silent.
 */

const world = (over: Partial<GalaxyPlanet> = {}): GalaxyPlanet => ({
  id: 'w1',
  name: 'Grimhold',
  owner: 'Sable',
  position: { x: 0, y: 0, z: 0 },
  coreTier: 1,
  coreLevel: 1,
  intel: 'RESOLVED' as const,
  state: { kind: 'NORMAL' as const },
  satellites: [],
  shielded: false,
  isSelf: false,
  ...over,
});

/** A resolved world belonging to a named commander, at a given Core. */
const theirs = (playerId: string, coreLevel: number, id = `t-${playerId}-${String(coreLevel)}`) =>
  world({
    id,
    coreLevel,
    coreTier: coreTier(coreLevel),
    controller: { kind: 'PLAYER', playerId, displayName: 'Sable' },
  });

const mine = (coreLevel: number, id = `m-${String(coreLevel)}`) =>
  world({ id, coreLevel, coreTier: coreTier(coreLevel), isSelf: true });

/**
 * A colony of the caller's, IN THE SHAPE THE SERVER SENDS IT. `routes/galaxy.ts`
 * sets `isSelf` on the capital alone; every other world the caller holds arrives
 * with `isSelf: false`, `isOwned: true` and the caller as its controller.
 */
const myColony = (coreLevel: number, id = `mc-${String(coreLevel)}`) =>
  world({
    id,
    coreLevel,
    coreTier: coreTier(coreLevel),
    isOwned: true,
    controller: { kind: 'PLAYER', playerId: 'me', displayName: 'Me' },
  });

describe('the certain half of the band', () => {
  it('refuses a target whose visible world is already two tiers up', () => {
    const target = theirs('them', 13);           // tier 5
    expect(outOfBandAbove([mine(4), target], target)).toBe(true); // me tier 2
  });

  it('allows the neighbouring tier, which is the whole point of a band of one', () => {
    const target = theirs('them', 7);            // tier 3
    expect(outOfBandAbove([mine(4), target], target)).toBe(false); // me tier 2
  });

  it('allows an equal tier', () => {
    const target = theirs('them', 5);
    expect(outOfBandAbove([mine(4), target], target)).toBe(false);
  });

  /** The rule reads the COMMANDER, so another of their worlds can settle it. */
  it('counts every visible world the target’s commander holds, not the one aimed at', () => {
    const target = theirs('them', 1, 'small');   // the world in front of you is tier 1
    const elsewhere = theirs('them', 16);        // …its owner also holds tier 6
    expect(outOfBandAbove([mine(4), target, elsewhere], target)).toBe(true);
  });

  /** And the caller's own peak is their tallest world, not the one they launch from. */
  it('measures the caller on their tallest world', () => {
    const target = theirs('them', 13);           // tier 5
    // A tier 2 capital alone would refuse; the tier 4 colony makes it legal.
    expect(outOfBandAbove([mine(4, 'cap'), mine(12, 'colony'), target], target)).toBe(false);
  });
});

describe('the caller, measured on every world they hold', () => {
  /**
   * THE BUG THIS PINS. The capital was the only world read as the caller's, so a
   * commander whose colony out-built their capital was told "too developed" about a
   * target the server would have let them raid.
   */
  it('counts a colony the way the server sends it', () => {
    const target = theirs('them', 16);           // tier 6
    // The tier 4 capital alone would refuse; the tier 5 colony makes it legal.
    expect(outOfBandAbove([mine(12, 'cap'), myColony(13), target], target)).toBe(false);
  });

  it('says nothing about the caller’s own colony', () => {
    const target = myColony(18, 'tall');
    expect(outOfBandAbove([mine(1), target], target)).toBe(false);
  });

  it('reads the caller’s peak across capital and colonies, and never a rival’s', () => {
    expect(ownPeakCore([mine(4), myColony(13), theirs('them', 20)])).toBe(13);
    expect(ownPeakCore([mine(16), myColony(2)])).toBe(16);
  });

  /** Nothing of the caller's own on the disc is a payload still loading, not tier 1. */
  it('has no peak to state before the caller’s worlds arrive', () => {
    expect(ownPeakCore([theirs('them', 9)])).toBeNull();
    expect(ownPeakCore([])).toBeNull();
  });
});

describe('what fog forbids the control from claiming', () => {
  /**
   * THE FAILURE THIS RULES OUT. A commander with a tall Core whose other worlds
   * are all beyond the caller's Telescope reads as a beginner. Refusing here
   * would be the interface stating a rule out of its own blindness.
   */
  it('says nothing when the visible worlds are far BELOW the caller', () => {
    const target = theirs('them', 1);            // tier 1, all we can see
    expect(outOfBandAbove([mine(16), target], target)).toBe(false); // me tier 6
  });

  it('says nothing about a world whose controller is redacted', () => {
    const target = world({ id: 'dark', intel: 'UNKNOWN' });
    expect(outOfBandAbove([mine(16), target], target)).toBe(false);
  });

  it('says nothing about a neutral world — there is no commander to measure', () => {
    const target = world({ kind: 'NEUTRAL', controller: { kind: 'NEUTRAL', tier: 1 } });
    expect(outOfBandAbove([mine(16), target], target)).toBe(false);
  });

  it('says nothing about the caller’s own world', () => {
    const target = mine(1, 'ownsmall');
    expect(outOfBandAbove([mine(16), target], target)).toBe(false);
  });

  /** With nothing of the caller's own on the disc there is no peak to compare. */
  it('says nothing when the caller holds no visible world', () => {
    const target = theirs('them', 16);
    expect(outOfBandAbove([target], target)).toBe(false);
  });

  /**
   * SOUNDNESS, AS A PROPERTY RATHER THAN AS CASES. Whatever this returns true
   * for, the server must also refuse — the reverse is allowed (fog), never this.
   */
  it('never refuses a pairing the rules would permit', () => {
    for (let myCore = 1; myCore <= 21; myCore += 1) {
      for (let theirCore = 1; theirCore <= 21; theirCore += 1) {
        const target = theirs('them', theirCore);
        if (!outOfBandAbove([mine(myCore), target], target)) continue;
        const legal = Math.abs(coreTier(myCore) - coreTier(theirCore)) <= ABUSE.tierBand;
        expect(legal, `refused a legal fight: ${String(myCore)} vs ${String(theirCore)}`).toBe(false);
      }
    }
  });
});

describe('the refusal fits the control it is written on', () => {
  /**
   * THE ATTACK SLAB'S BUDGET AT 350px, and it is arithmetic rather than taste.
   *
   * The control is `basis-[calc(50%-0.25rem)]` in the rail's wrapping row: 350
   * less the rail's own `px-2` is 359, half of that less the gap is about 175px.
   * `slab-compact` spends 24 on `px-3` and the attack glyph another 22 with its
   * gap, which leaves roughly 129px of `--text-label` uppercase at 0.14em —
   * fifteen characters, and the last of them is already tight.
   *
   * The owner's instruction is that it must not break to a second line, so the
   * budget is stated here rather than discovered on a phone.
   */
  const CEILING = 14;

  it.each(['tr', 'en'])('keeps the refusal to one line (%s)', async (lang) => {
    const i18n = (await import('../src/i18n/index.js')).default;
    await i18n.changeLanguage(lang);
    const text = i18n.t('focus.planet.attackOutOfBandShort');
    expect(text.length, `${lang}: "${text}"`).toBeLessThanOrEqual(CEILING);
    await i18n.changeLanguage('en');
  });

  /** The long form is the accessible name, where there is room to say why. */
  it.each(['tr', 'en'])('still explains itself to a screen reader (%s)', async (lang) => {
    const i18n = (await import('../src/i18n/index.js')).default;
    await i18n.changeLanguage(lang);
    expect(i18n.t('focus.planet.attackOutOfBand').length).toBeGreaterThan(CEILING);
    await i18n.changeLanguage('en');
  });
});

describe('the control carries it', () => {
  const source = readFileSync('src/galaxy/FocusPanel.tsx', 'utf8');

  it('disables the attack when the band already refuses', () => {
    expect(source).toMatch(/disabled=\{[^}]*outOfBand/);
  });

  it('states it on the label and in the accessible name', () => {
    expect(source).toContain('focus.planet.attackOutOfBandShort');
    expect(source).toContain('focus.planet.attackOutOfBand');
  });

  /** The strike answers to the same band on the server, so its control says so too. */
  it('blocks the Death Star strike on the same reading', () => {
    expect(source).toContain('focus.planet.deathStarOutOfBand');
  });
});

describe('the refusal names what it measured', () => {
  /**
   * The server's refusal used to read "that commander's total strength is far above
   * your own". The band never measures strength — it compares the development tier
   * of each commander's most developed world — so a commander told that went
   * looking at fleets. The refusal has to use the word the dossier puts on the
   * figure it actually compares.
   */
  const WORD: Record<string, RegExp> = {
    en: /tier/i,
    tr: /kademe/i,
    de: /stufe/i,
    es: /nivel/i,
    fr: /palier/i,
    ja: /ティア/,
  };

  it.each(Object.keys(WORD))('speaks in development tiers, not strength (%s)', async (lang) => {
    const i18n = (await import('../src/i18n/index.js')).default;
    await i18n.changeLanguage(lang);
    for (const code of ['TIER_BAND', 'TIER_BAND_WEAK'] as const) {
      const text = i18n.t(`errors.${code}`);
      expect(text, `${lang} ${code}: "${text}"`).toMatch(WORD[lang]!);
      expect(text).not.toMatch(/strength|gücü|Stärke|fuerza|puissance|総合力/i);
    }
    expect(i18n.t('focus.planet.deathStarOutOfBand')).not.toBe('focus.planet.deathStarOutOfBand');
    await i18n.changeLanguage('en');
  });
});
