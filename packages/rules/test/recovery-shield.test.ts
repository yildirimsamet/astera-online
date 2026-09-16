import { describe, expect, it } from 'vitest';
import {
  ABUSE,
  RESOURCE_VALUE,
  earnsRecoveryShield,
  effectiveAttackProtection,
  extendRecoveryShield,
  newcomerShieldUntil,
  recoveryLossHours,
  recoveryShieldUntil,
  resourceValue,
  type Resources,
} from '../src/index.js';

/**
 * THE SHIELD A HEAVY DEFEAT BUYS. Owner instruction, 2026-09-14/15.
 *
 * *"Ağır bir PvP kaybından sonra 4 saatlik saldırı koruması ver; korunan oyuncu
 * başka bir oyuncuya saldırmayı seçerse korumayı kaldır."* The pure half of that
 * lives here: what counts as heavy, how long the window is, and how it composes
 * with the first-day shield. Everything about launches, locks and who is actually
 * attacking is the server's, and `apps/server/test/recovery-shield.test.ts` holds it.
 *
 * HEAVY IS MEASURED IN THE COMMANDER'S OWN PRODUCTION HOURS. Owner's design, and
 * the second one: the first shipped rule measured a share of the struck world's
 * raidable stock against a floor of total STORAGE, and live measurement found both
 * halves wrong. Storage is a ceiling nobody reaches — the median commander sits at
 * 24% of it — so the floor meant something different for every player, and a
 * commander caught with an empty store could lose everything they had and clear
 * nothing. Worse, the rule could not see a FLEET at all, while the median defender
 * of a lost battle loses 100% of the ships standing on the world.
 */

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 8, 15, 12, 0, 0);
const NOTHING: Resources = { alloy: 0, crystal: 0, deuterium: 0 };

/** A commander whose works turn out this much an hour, across every world. */
const PRODUCTION: Resources = { alloy: 1_000, crystal: 500, deuterium: 20 };
/** What one hour of that is worth on the game's own 32:16:1 scale. */
const PER_HOUR = resourceValue(PRODUCTION);
/** Alloy alone worth exactly N hours of it. */
const alloyWorthHours = (hours: number): Resources =>
  ({ alloy: (PER_HOUR * hours) / RESOURCE_VALUE.alloy, crystal: 0, deuterium: 0 });

describe('what counts as a heavy defeat', () => {
  it('states the bar as hours of the defender’s own production', () => {
    expect(ABUSE.recoveryLossHours).toBe(8);
    // 2026-09-16: the window grew to six hours and the bar did not move with it —
    // the owner lengthened the protection, not the definition of a heavy defeat.
    expect(ABUSE.recoveryShieldHours).toBe(6);
  });

  /**
   * THE LOSS IS ONE FIGURE, NOT TWO COMPARED SEPARATELY.
   *
   * Owner's design: *"bu ikisinden birisi kalkan kazanması için yeterli olur"* —
   * either half being enough is satisfied by adding them, because a sum is never
   * smaller than its larger part. Adding also answers the case neither test could
   * on its own: a defeat that took six hours of ore AND six hours of ships is a
   * twelve-hour defeat, and a rule that compared the two halves separately would
   * call it two small ones.
   */
  it('adds what was carried off to what was destroyed', () => {
    const loot = alloyWorthHours(3);
    const fleet = alloyWorthHours(5);
    expect(recoveryLossHours(loot, NOTHING, PRODUCTION)).toBeCloseTo(3, 9);
    expect(recoveryLossHours(NOTHING, fleet, PRODUCTION)).toBeCloseTo(5, 9);
    expect(recoveryLossHours(loot, fleet, PRODUCTION)).toBeCloseTo(8, 9);
  });

  it('grants at exactly the bar and refuses a whisker below it', () => {
    const at = alloyWorthHours(ABUSE.recoveryLossHours);
    expect(earnsRecoveryShield({ lootLost: at, fleetLost: NOTHING, production: PRODUCTION }))
      .toBe(true);
    const under = { ...at, alloy: at.alloy * 0.999 };
    expect(earnsRecoveryShield({ lootLost: under, fleetLost: NOTHING, production: PRODUCTION }))
      .toBe(false);
  });

  /** Either half alone clears it, which is the owner's "ikisinden birisi yeterli". */
  it('grants on a fleet wipe that carried nothing away', () => {
    expect(earnsRecoveryShield({
      lootLost: NOTHING,
      fleetLost: alloyWorthHours(9),
      production: PRODUCTION,
    })).toBe(true);
  });

  /**
   * THE DIVISION BY ZERO THE FIRST DESIGN WOULD HAVE HAD, AND WHY IT IS GONE.
   *
   * Dividing each resource by its OWN production and taking the slowest is the
   * intuitive reading of "how long to rebuild this", and it breaks on the live
   * field: `profileIncome` gives deuterium `4 x L^1.2` against alloy's `100 x
   * L^1.3`, and a commander with no Deuterium Plant produces exactly none. Measured
   * on 97 live battles, 36 of them had the defender losing deuterium they cannot
   * make — an infinite rebuild time, and therefore a free shield on any raid that
   * touched the tank.
   *
   * Both sides are converted through `resourceValue` instead — the game's own
   * 32:16:1 scale, where a unit of deuterium is already worth 32 alloy. The
   * denominator is then the whole works and can only be zero for a commander who
   * holds no world at all.
   */
  it('prices a resource the defender cannot produce rather than dividing by zero', () => {
    const noPlant: Resources = { alloy: 1_000, crystal: 500, deuterium: 0 };
    const fuelOnly: Resources = { alloy: 0, crystal: 0, deuterium: 100 };
    const hours = recoveryLossHours(fuelOnly, NOTHING, noPlant);
    expect(Number.isFinite(hours)).toBe(true);
    expect(hours).toBeCloseTo(
      resourceValue(fuelOnly) / resourceValue(noPlant),
      9,
    );
    // And it is still expensive, because deuterium is worth 32 alloy a unit.
    expect(hours).toBeGreaterThan(0);
  });

  it('refuses a battle that cost nothing, and a commander who produces nothing', () => {
    expect(earnsRecoveryShield({ lootLost: NOTHING, fleetLost: NOTHING, production: PRODUCTION }))
      .toBe(false);
    expect(recoveryLossHours(alloyWorthHours(50), NOTHING, NOTHING)).toBe(0);
    expect(earnsRecoveryShield({
      lootLost: alloyWorthHours(50),
      fleetLost: NOTHING,
      production: NOTHING,
    })).toBe(false);
  });

  it('refuses nonsense rather than rounding it into a grant', () => {
    const bad: Resources[] = [
      { alloy: Number.NaN, crystal: 0, deuterium: 0 },
      { alloy: Infinity, crystal: 0, deuterium: 0 },
      { alloy: -1, crystal: 0, deuterium: 0 },
    ];
    for (const value of bad) {
      expect(earnsRecoveryShield({ lootLost: value, fleetLost: NOTHING, production: PRODUCTION }),
        JSON.stringify(value)).toBe(false);
      expect(earnsRecoveryShield({ lootLost: NOTHING, fleetLost: value, production: PRODUCTION }),
        JSON.stringify(value)).toBe(false);
      expect(earnsRecoveryShield({
        lootLost: alloyWorthHours(50), fleetLost: NOTHING, production: value,
      }), JSON.stringify(value)).toBe(false);
    }
    expect(recoveryLossHours({ alloy: Number.NaN, crystal: 0, deuterium: 0 }, NOTHING, PRODUCTION))
      .toBe(0);
  });

  /**
   * THE BAR SCALES WITH THE COMMANDER, WHICH IS THE WHOLE POINT OF THE UNIT.
   *
   * A beginner and a developed commander are asked for the same number of HOURS,
   * so the absolute figure the developed one has to lose is larger by exactly the
   * ratio of their works. No second ladder is kept in step with the Core, and a
   * commander caught with an empty store is judged on what the defeat cost them
   * rather than on a ceiling they were nowhere near.
   */
  it('asks a bigger commander for a proportionally bigger loss', () => {
    const small: Resources = { alloy: 200, crystal: 100, deuterium: 2 };
    const large: Resources = { alloy: 4_000, crystal: 2_000, deuterium: 60 };
    const loss = { alloy: 20_000, crystal: 0, deuterium: 0 };
    expect(earnsRecoveryShield({ lootLost: loss, fleetLost: NOTHING, production: small }))
      .toBe(true);
    expect(earnsRecoveryShield({ lootLost: loss, fleetLost: NOTHING, production: large }))
      .toBe(false);
    expect(recoveryLossHours(loss, NOTHING, small))
      .toBeCloseTo(recoveryLossHours(loss, NOTHING, large) * (resourceValue(large) / resourceValue(small)), 6);
  });
});

describe('the recovery window', () => {
  it('runs six hours from the instant the battle resolved', () => {
    expect(recoveryShieldUntil(NOW)).toBe(NOW + 6 * HOUR);
  });

  it('extends to the later end rather than adding a second window', () => {
    const first = recoveryShieldUntil(NOW);
    expect(extendRecoveryShield(first, NOW + HOUR)).toBe(NOW + 7 * HOUR);
    expect(extendRecoveryShield(NOW + 9 * HOUR, NOW)).toBe(NOW + 9 * HOUR);
    expect(extendRecoveryShield(null, NOW)).toBe(NOW + 6 * HOUR);
    expect(extendRecoveryShield(Number.NaN, NOW)).toBe(NOW + 6 * HOUR);
  });
});

describe('the two protections, read as one', () => {
  const newcomer = newcomerShieldUntil(NOW);
  const recovery = recoveryShieldUntil(NOW);

  it('is nothing at all when neither column holds a future instant', () => {
    expect(effectiveAttackProtection(null, null, NOW)).toBeNull();
    expect(effectiveAttackProtection(NOW - 1, NOW - 1, NOW)).toBeNull();
    expect(effectiveAttackProtection(undefined, undefined, NOW)).toBeNull();
    expect(effectiveAttackProtection(Number.NaN, Number.NaN, NOW)).toBeNull();
    // The boundary belongs to the galaxy: at the instant it expires, it is gone.
    expect(effectiveAttackProtection(NOW, NOW, NOW)).toBeNull();
  });

  it('answers whichever of the two reaches further', () => {
    expect(effectiveAttackProtection(newcomer, null, NOW))
      .toEqual({ kind: 'NEWCOMER', until: newcomer });
    expect(effectiveAttackProtection(null, recovery, NOW))
      .toEqual({ kind: 'RECOVERY', until: recovery });
    expect(effectiveAttackProtection(newcomer, recovery, NOW))
      .toEqual({ kind: 'NEWCOMER', until: newcomer });
    expect(effectiveAttackProtection(NOW + HOUR, recovery, NOW))
      .toEqual({ kind: 'RECOVERY', until: recovery });
  });

  it('ignores an expired column even when the other is live', () => {
    expect(effectiveAttackProtection(NOW - HOUR, recovery, NOW))
      .toEqual({ kind: 'RECOVERY', until: recovery });
    expect(effectiveAttackProtection(newcomer, NOW - HOUR, NOW))
      .toEqual({ kind: 'NEWCOMER', until: newcomer });
  });

  it('names the first-day shield on an exact tie, because it never comes back', () => {
    expect(effectiveAttackProtection(newcomer, newcomer, NOW))
      .toEqual({ kind: 'NEWCOMER', until: newcomer });
  });
});
