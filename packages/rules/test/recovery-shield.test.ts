import { describe, expect, it } from 'vitest';
import {
  ABUSE,
  earnsRecoveryShield,
  effectiveAttackProtection,
  extendRecoveryShield,
  netRecoveryLossHours,
  newcomerShieldUntil,
  raidProfitHours,
  recoveryLossHours,
  recoveryShieldUntil,
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
/** A loss that takes the same number of hours in all three resource lanes. */
const lossWorthHours = (hours: number): Resources => ({
  alloy: PRODUCTION.alloy * hours,
  crystal: PRODUCTION.crystal * hours,
  deuterium: PRODUCTION.deuterium * hours,
});

/** One defeat inside the lookback and nothing else: the shape the old rule judged. */
const oneDefeat = (input: { lootLost: Resources; fleetLost: Resources; production: Resources }) => ({
  defeats: [{ loot: input.lootLost, fleetLost: input.fleetLost }],
  raids: [],
  production: input.production,
});

describe('what counts as a heavy defeat', () => {
  it('states the bar as hours of the defender’s own production', () => {
    // Owner instruction, 2026-09-18: eight hours of production (was six), six looked back.
    expect(ABUSE.recoveryLossHours).toBe(8);
    expect(ABUSE.recoveryLookbackHours).toBe(6);
    // The recovery window and its loss threshold are independent owner controls.
    expect(ABUSE.recoveryShieldHours).toBe(6);
  });

  /**
   * LOOT AND FLEET COST SHARE THREE RESOURCE CLOCKS.
   *
   * Loot and fleet are first added resource by resource. Each combined resource
   * loss is then divided by that resource's hourly production, and the three
   * recovery times are averaged.
   */
  it('adds what was carried off to what was destroyed', () => {
    const loot = lossWorthHours(2);
    const fleet = lossWorthHours(3);
    expect(recoveryLossHours(loot, NOTHING, PRODUCTION)).toBeCloseTo(2, 9);
    expect(recoveryLossHours(NOTHING, fleet, PRODUCTION)).toBeCloseTo(3, 9);
    expect(earnsRecoveryShield(oneDefeat({ lootLost: loot, fleetLost: NOTHING, production: PRODUCTION })))
      .toBe(false);
    expect(earnsRecoveryShield(oneDefeat({ lootLost: NOTHING, fleetLost: fleet, production: PRODUCTION })))
      .toBe(false);
    expect(recoveryLossHours(loot, fleet, PRODUCTION)).toBeCloseTo(5, 9);
    expect(earnsRecoveryShield(oneDefeat({ lootLost: loot, fleetLost: fleet, production: PRODUCTION })))
      .toBe(false);
    // 2 + 6 = 8 hours: exactly the bar.
    expect(earnsRecoveryShield(oneDefeat({
      lootLost: loot,
      fleetLost: lossWorthHours(6),
      production: PRODUCTION,
    }))).toBe(true);
  });

  it('averages the Alloy, Crystal and Deuterium recovery times separately', () => {
    const uneven: Resources = { alloy: 9_000, crystal: 500, deuterium: 20 };
    // 9 Alloy hours, 1 Crystal hour and 1 Deuterium hour: (9 + 1 + 1) / 3.
    expect(recoveryLossHours(uneven, NOTHING, PRODUCTION)).toBeCloseTo(11 / 3, 9);
  });

  it('grants from the bar itself: six hours exactly is enough', () => {
    const at = lossWorthHours(ABUSE.recoveryLossHours);
    expect(earnsRecoveryShield(oneDefeat({ lootLost: at, fleetLost: NOTHING, production: PRODUCTION })))
      .toBe(true);
    const under = { ...at, alloy: at.alloy - 1 };
    expect(earnsRecoveryShield(oneDefeat({ lootLost: under, fleetLost: NOTHING, production: PRODUCTION })))
      .toBe(false);
  });

  /** Fleet replacement cost alone may clear the average-hours threshold. */
  it('grants on a fleet wipe that carried nothing away', () => {
    expect(earnsRecoveryShield(oneDefeat({
      lootLost: NOTHING,
      fleetLost: lossWorthHours(8),
      production: PRODUCTION,
    }))).toBe(true);
  });

  /**
   * A LOSS IN A RESOURCE THE COMMANDER CANNOT MAKE IS REPRICED, NOT INFINITE.
   * Owner instruction, 2026-09-18.
   *
   * The lane used to read as infinite hours and clear the bar outright, so for a
   * commander without a Deuterium Refinery "six hours of net loss" meant "one unit of
   * deuterium lost". The lost amount is now converted at the 32:16:1 value
   * (`RESOURCE_VALUE`) into the first resource they DO produce — alloy, then
   * crystal — and read on that resource's clock like any other loss.
   */
  it('reprices lost deuterium as alloy when no world makes deuterium', () => {
    const noPlant: Resources = { alloy: 1_000, crystal: 500, deuterium: 0 };
    const fuelOnly: Resources = { alloy: 0, crystal: 0, deuterium: 100 };
    // 100 D = 3,200 alloy = 3.2 hours on the alloy clock, averaged over three clocks.
    expect(recoveryLossHours(fuelOnly, NOTHING, noPlant)).toBeCloseTo(3.2 / 3, 9);
    expect(earnsRecoveryShield(oneDefeat({ lootLost: fuelOnly, fleetLost: NOTHING, production: noPlant })))
      .toBe(false);
  });

  it('still grants when the repriced loss reaches the bar', () => {
    const noPlant: Resources = { alloy: 1_000, crystal: 500, deuterium: 0 };
    // 800 D = 25,600 alloy = 25.6 alloy hours → 8.53 averaged.
    const heavy: Resources = { alloy: 0, crystal: 0, deuterium: 800 };
    expect(recoveryLossHours(heavy, NOTHING, noPlant)).toBeCloseTo(25.6 / 3, 9);
    expect(earnsRecoveryShield(oneDefeat({ lootLost: heavy, fleetLost: NOTHING, production: noPlant })))
      .toBe(true);
  });

  it('adds the repriced amount to what was lost in that resource already', () => {
    const noPlant: Resources = { alloy: 1_000, crystal: 500, deuterium: 0 };
    const loot: Resources = { alloy: 2_000, crystal: 500, deuterium: 50 };
    const fleet: Resources = { alloy: 400, crystal: 0, deuterium: 25 };
    // Alloy: 2,400 + 75 D × 32 = 4,800 → 4.8 h. Crystal: 500 → 1 h. Deuterium: 0 h.
    expect(recoveryLossHours(loot, fleet, noPlant)).toBeCloseTo((4.8 + 1) / 3, 9);
  });

  it('falls back to crystal when alloy is not produced either', () => {
    const crystalOnly: Resources = { alloy: 0, crystal: 500, deuterium: 0 };
    const loss: Resources = { alloy: 1_000, crystal: 0, deuterium: 10 };
    // 1,000 alloy = 500 crystal, 10 D = 160 crystal → 660 / 500 = 1.32 h on one clock.
    expect(recoveryLossHours(loss, NOTHING, crystalOnly)).toBeCloseTo(1.32 / 3, 9);
  });

  it('leaves the net lookback finite, so a profitable raid can offset it', () => {
    const noPlant: Resources = { alloy: 1_000, crystal: 500, deuterium: 0 };
    const check = {
      defeats: [{ loot: { alloy: 0, crystal: 0, deuterium: 600 }, fleetLost: NOTHING }],
      raids: [{ loot: { alloy: 3_000, crystal: 0, deuterium: 0 }, fleetLost: NOTHING }],
      production: noPlant,
    };
    expect(netRecoveryLossHours(check)).toBeCloseTo(6.4 - 1, 9);
    expect(earnsRecoveryShield(check)).toBe(false);
  });

  it('refuses a costless battle and grants for a positive loss with no production', () => {
    expect(earnsRecoveryShield(oneDefeat({ lootLost: NOTHING, fleetLost: NOTHING, production: PRODUCTION })))
      .toBe(false);
    expect(recoveryLossHours(lossWorthHours(50), NOTHING, NOTHING))
      .toBe(Number.POSITIVE_INFINITY);
    expect(earnsRecoveryShield(oneDefeat({
      lootLost: lossWorthHours(50),
      fleetLost: NOTHING,
      production: NOTHING,
    }))).toBe(true);
  });

  it('refuses nonsense rather than rounding it into a grant', () => {
    const bad: Resources[] = [
      { alloy: Number.NaN, crystal: 0, deuterium: 0 },
      { alloy: Infinity, crystal: 0, deuterium: 0 },
      { alloy: -1, crystal: 0, deuterium: 0 },
    ];
    for (const value of bad) {
      expect(earnsRecoveryShield(oneDefeat({ lootLost: value, fleetLost: NOTHING, production: PRODUCTION })),
        JSON.stringify(value)).toBe(false);
      expect(earnsRecoveryShield(oneDefeat({ lootLost: NOTHING, fleetLost: value, production: PRODUCTION })),
        JSON.stringify(value)).toBe(false);
      expect(earnsRecoveryShield(oneDefeat({
        lootLost: lossWorthHours(50), fleetLost: NOTHING, production: value,
      })), JSON.stringify(value)).toBe(false);
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
    const loss = { alloy: 20_000, crystal: 10_000, deuterium: 200 };
    expect(earnsRecoveryShield(oneDefeat({ lootLost: loss, fleetLost: NOTHING, production: small })))
      .toBe(true);
    expect(earnsRecoveryShield(oneDefeat({ lootLost: loss, fleetLost: NOTHING, production: large })))
      .toBe(false);
    expect(recoveryLossHours(loss, NOTHING, small)).toBeGreaterThan(
      recoveryLossHours(loss, NOTHING, large),
    );
  });
});

/**
 * EVERY DEFEAT IN THE LOOKBACK, LESS WHAT THE COMMANDER'S OWN RAIDS EARNED.
 * Owner instruction, 2026-09-18.
 *
 * *"Ufak ufak saldırı yemeye devam ederse oyuncu hiç gelişme şansı bulamıyor."* A
 * commander bled by five raids that each stayed under the bar lost more than one who
 * took a single heavy one, and got nothing. So the question is asked of the whole
 * window: every defeat in the last six hours, minus the PROFIT of every raid this
 * commander made on another commander in the same six hours. A raid that lost money
 * subtracts nothing — *"birine saldırırsa ve zarar ederse umrumuzda değil."*
 */
describe('what the last six hours cost, net', () => {
  const defeat = (hours: number) => ({ loot: lossWorthHours(hours), fleetLost: NOTHING });
  const raid = (lootHours: number, lostHours: number) => ({
    loot: lossWorthHours(lootHours),
    fleetLost: lossWorthHours(lostHours),
  });

  it('adds small defeats until together they clear the bar', () => {
    const check = {
      defeats: [defeat(2), defeat(2), defeat(2), defeat(2)], raids: [], production: PRODUCTION,
    };
    expect(netRecoveryLossHours(check)).toBeCloseTo(8, 9);
    expect(earnsRecoveryShield(check)).toBe(true);
    expect(earnsRecoveryShield({ ...check, defeats: [defeat(2), defeat(2), defeat(2)] })).toBe(false);
  });

  it('subtracts the profit of the commander’s own raids', () => {
    const check = { defeats: [defeat(5), defeat(5)], raids: [raid(3, 1)], production: PRODUCTION };
    // 10 hours lost, one raid netted 3 − 1 = 2 hours: 8 left, exactly the bar.
    expect(netRecoveryLossHours(check)).toBeCloseTo(8, 9);
    expect(earnsRecoveryShield(check)).toBe(true);
    expect(earnsRecoveryShield({ ...check, raids: [raid(3, 1), raid(1, 0)] })).toBe(false);
  });

  it('ignores a raid that lost more than it carried home', () => {
    const check = { defeats: [defeat(8)], raids: [raid(1, 5), raid(0, 3)], production: PRODUCTION };
    expect(netRecoveryLossHours(check)).toBeCloseTo(8, 9);
    expect(earnsRecoveryShield(check)).toBe(true);
  });

  it('judges a raid’s profit on the same three clocks as the loss', () => {
    // 3000 Alloy home for ships worth 1000 Crystal: (3 − 2 + 0) / 3 of an hour.
    const mixed = {
      loot: { alloy: 3_000, crystal: 0, deuterium: 0 },
      fleetLost: { alloy: 0, crystal: 1_000, deuterium: 0 },
    };
    expect(raidProfitHours(mixed, PRODUCTION)).toBeCloseTo(1 / 3, 9);
    expect(raidProfitHours(raid(1, 4), PRODUCTION)).toBeCloseTo(-3, 9);
  });

  it('never reports a negative loss: profit beyond the damage is simply no shield', () => {
    const check = { defeats: [defeat(2)], raids: [raid(10, 0)], production: PRODUCTION };
    expect(netRecoveryLossHours(check)).toBe(0);
    expect(earnsRecoveryShield(check)).toBe(false);
    expect(netRecoveryLossHours({ defeats: [], raids: [], production: PRODUCTION })).toBe(0);
  });

  it('lets a raid offset an unproducible loss once it is repriced', () => {
    const noPlant: Resources = { alloy: 1_000, crystal: 500, deuterium: 0 };
    const check = {
      defeats: [{ loot: { alloy: 0, crystal: 0, deuterium: 100 }, fleetLost: NOTHING }],
      raids: [raid(50, 0)],
      production: noPlant,
    };
    // 100 D repriced is ~1.07 h; a fifty-hour raid profit more than covers it.
    expect(netRecoveryLossHours(check)).toBe(0);
  });

  /**
   * A HAUL OF FUEL THE RAIDER CANNOT MAKE IS STILL PROFIT. 2026-09-18.
   *
   * It used to price at zero, so a commander without a Deuterium Refinery who looted
   * deuterium all evening could still read as a net loser and take a shield they had
   * not earned. It is repriced exactly as the loss side is.
   */
  it('reprices a fuel haul the raider cannot make, so it offsets the loss', () => {
    const noPlant: Resources = { alloy: 1_000, crystal: 500, deuterium: 0 };
    // 300 D = 9,600 alloy = 9.6 alloy hours → 3.2 averaged.
    expect(raidProfitHours({ loot: { alloy: 0, crystal: 0, deuterium: 300 }, fleetLost: NOTHING }, noPlant))
      .toBeCloseTo(3.2, 9);
    // A heavy defeat (6.4 h) minus that haul is under the bar: no shield.
    const check = {
      defeats: [{ loot: { alloy: 0, crystal: 0, deuterium: 600 }, fleetLost: NOTHING }],
      raids: [{ loot: { alloy: 0, crystal: 0, deuterium: 300 }, fleetLost: NOTHING }],
      production: noPlant,
    };
    expect(netRecoveryLossHours(check)).toBeCloseTo(3.2, 9);
    expect(earnsRecoveryShield(check)).toBe(false);
  });

  it('reprices a raid that lost unproducible fuel as a cost, never below zero overall', () => {
    const noPlant: Resources = { alloy: 1_000, crystal: 500, deuterium: 0 };
    // Carried 3,000 alloy home, burned 100 D of hulls: (3,000 − 3,200) / 1,000 / 3.
    expect(raidProfitHours({
      loot: { alloy: 3_000, crystal: 0, deuterium: 0 },
      fleetLost: { alloy: 0, crystal: 0, deuterium: 100 },
    }, noPlant)).toBeCloseTo(-0.2 / 3, 9);
  });

  it('drops a corrupt row instead of letting it poison the rest', () => {
    const corrupt = { loot: { alloy: Number.NaN, crystal: 0, deuterium: 0 }, fleetLost: NOTHING };
    const check = { defeats: [defeat(6), corrupt], raids: [corrupt], production: PRODUCTION };
    expect(netRecoveryLossHours(check)).toBeCloseTo(6, 9);
    expect(raidProfitHours(corrupt, PRODUCTION)).toBe(0);
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
