import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ABUSE, coreTier } from '@astera/rules';
import { outOfBandAbove } from '../src/lib/band.js';
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
});
