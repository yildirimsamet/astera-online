import { describe, expect, it } from 'vitest';
import {
  combatOutcomeTable,
  combatValue,
  exactPowerRange,
  fleetCargo,
  missionFuel,
  pirateHoard,
  pirateStats,
  readPowerRange,
  type Fleet,
} from '@astera/rules';
import {
  hopeless,
  isBully,
  planPirateRaid,
  planWorldRaid,
  raidingWing,
  ratioForLoss,
  researchOf,
  type Nerve,
  type WallReading,
} from '../src/services/bots/judgement.js';
import { BOTS, BOT_PERSONAS } from '../src/services/bots/personas.js';

/**
 * A BOT READS THE SAME RULER A PERSON DOES, AND ONLY FLIES WHAT IT CAN WIN.
 * Owner report, 2026-09-19: *"Hayvan gibi filosu olan oyuncuya saçma sapan 1-2 tane
 * gemi gönderip duruyorlar."*
 *
 * Combat v3 (owner 2026-10-25): the launch sheet's ruler is the matchup power ratio the
 * probe's ranges allow (`readPowerRange`), and the owner's outcome table says what a side
 * loses at a ratio. A bot flies only where the worst ratio the reading allows — padded by
 * `wallMargin` — costs no more of the wing than its habit pays, and where the haul pays
 * for the fuel.
 */

const bold: Nerve = { need: 'BREAKS', maxLoss: 1, lootOverFuel: 0 };
const careful: Nerve = { need: 'CLEARS', maxLoss: 1, lootOverFuel: 0 };
const none = { low: 0, high: 0 };

const reading = (over: Partial<WallReading> = {}): WallReading => ({
  defence: { low: 0, high: 0 },
  stock: { low: 50_000, high: 60_000 },
  shield: { low: 0, high: 0 },
  classReading: null,
  research: {},
  domeCeiling: 0,
  ...over,
});

const fleet: Fleet = { DART: 40, WARDEN: 10 };
const base = { fleet, tech: {}, distance: 900, deuterium: 1_000_000 };

/** The worst ratio a wing holds against a host line of `value`, padded as the bot pads it. */
const worst = (wing: Fleet, value: number): number =>
  readPowerRange({ fleet: wing, tech: {} }, [{ value: { low: value, high: value }, research: {} }], none)!.ratio.low / BOTS.wallMargin;
/** The host value at which this wing's padded worst ratio is exactly `ratio`. */
const wallAt = (wing: Fleet, ratio: number): number => {
  let low = 1, high = 10_000_000;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (worst(wing, mid) > ratio) low = mid; else high = mid;
  }
  return low;
};

describe('the loss a habit pays, as a ratio', () => {
  it('reads the owner’s table: the least ratio at which the stronger side loses no more than that', () => {
    const table = combatOutcomeTable();
    expect(ratioForLoss(1)).toBe(1);
    expect(ratioForLoss(table.find((row) => row.ratio === 2)!.strongLoses.high)).toBeCloseTo(2, 9);
    expect(ratioForLoss(0.2)).toBeGreaterThan(2);
    expect(ratioForLoss(0.2)).toBeLessThan(2.5);
    expect(ratioForLoss(0.45)).toBeGreaterThan(1.6);
    expect(ratioForLoss(0.45)).toBeLessThan(1.8);
    expect(ratioForLoss(0)).toBe(Infinity);
  });

  it('asks more of a careful habit than of the raider', () => {
    expect(ratioForLoss(BOT_PERSONAS.BUILDER.nerve.maxLoss)).toBeGreaterThan(ratioForLoss(BOT_PERSONAS.RAIDER.nerve.maxLoss));
  });
});

describe('a raid on a world', () => {
  it('never throws two ships at a wall that dwarfs them', () => {
    const plan = planWorldRaid({
      ...base,
      fleet: { DART: 2 },
      reading: reading({ defence: { low: 400_000, high: 500_000 } }),
      nerve: bold,
    });
    expect(plan).toBeNull();
  });

  it('takes an open world with the smallest wing it offers', () => {
    const plan = planWorldRaid({ ...base, reading: reading(), nerve: careful });
    expect(plan?.wing).toEqual(raidingWing(fleet, BOTS.wingShares[0]!));
  });

  it('commits more of the line only as far as the wall asks', () => {
    const full = raidingWing(fleet, BOTS.wingShares.at(-1)!);
    const smallest = raidingWing(fleet, BOTS.wingShares[0]!);
    const wall = wallAt(full, BOTS.clearRatio * 1.05);
    expect(worst(smallest, wall)).toBeLessThan(BOTS.clearRatio);
    const plan = planWorldRaid({ ...base, reading: reading({ defence: { low: wall * 0.9, high: wall } }), nerve: careful });
    expect(plan).not.toBeNull();
    expect(combatValue(plan!.wing)).toBeGreaterThan(combatValue(smallest));
    expect(combatValue(plan!.wing)).toBeLessThanOrEqual(combatValue(full));
    expect(worst(plan!.wing, wall)).toBeGreaterThanOrEqual(BOTS.clearRatio);
  });

  it('lets a bold habit settle for breaking a wall a careful one would leave alone', () => {
    const full = raidingWing(fleet, BOTS.wingShares.at(-1)!);
    const wall = wallAt(full, (1 + BOTS.clearRatio) / 2);
    const input = { ...base, reading: reading({ defence: { low: wall, high: wall } }) };
    expect(planWorldRaid({ ...input, nerve: careful })).toBeNull();
    expect(planWorldRaid({ ...input, nerve: bold })).not.toBeNull();
  });

  it('never attacks a wall the reading allows to be the stronger', () => {
    const full = raidingWing(fleet, BOTS.wingShares.at(-1)!);
    const wall = wallAt(full, 0.95);
    expect(planWorldRaid({ ...base, reading: reading({ defence: { low: wall, high: wall } }), nerve: bold })).toBeNull();
  });

  /**
   * KLAN SAVUNMA DESTEĞİ: the raid meets the host AND the clanmates standing there, so the
   * probe's separate support reading joins the wall — the same lines the launch sheet reads.
   */
  it('counts the clan support standing at the world into the wall', () => {
    const full = raidingWing(fleet, BOTS.wingShares.at(-1)!);
    const half = wallAt(full, BOTS.clearRatio * 1.6);
    const alone = reading({ defence: { low: half, high: half } });
    expect(planWorldRaid({ ...base, reading: alone, nerve: careful })).not.toBeNull();
    const supported = reading({ defence: { low: half, high: half }, support: { value: { low: half, high: half } } });
    expect(planWorldRaid({ ...base, reading: supported, nerve: careful })).toBeNull();
  });

  it('reads the research the probe brought home into the wall', () => {
    const full = raidingWing(fleet, BOTS.wingShares.at(-1)!);
    const wall = wallAt(full, BOTS.clearRatio * 1.1);
    const plain = reading({ defence: { low: wall, high: wall } });
    expect(planWorldRaid({ ...base, reading: plain, nerve: careful })).not.toBeNull();
    const drilled = reading({ defence: { low: wall, high: wall },
      research: { SHIP_POWER: { low: 4, high: 5 }, SHIP_ARMOR: { low: 4, high: 5 }, SHIP_SHIELDS: { low: 3, high: 4 } } });
    expect(planWorldRaid({ ...base, reading: drilled, nerve: careful })).toBeNull();
  });

  it('refuses a fight that costs more of the wing than the habit pays', () => {
    const defended = reading({ defence: { low: 2_000, high: 2_500 } });
    expect(planWorldRaid({ ...base, reading: defended, nerve: bold })).not.toBeNull();
    expect(planWorldRaid({ ...base, reading: defended, nerve: { ...bold, maxLoss: 0 } })).toBeNull();
  });

  it('stays home when the haul does not pay for the fuel', () => {
    const empty = reading({ stock: { low: 0, high: 400 } });
    expect(planWorldRaid({ ...base, reading: empty, nerve: { ...careful, lootOverFuel: 1 } })).toBeNull();
  });

  it('counts only what the wing can carry toward the haul', () => {
    const plan = planWorldRaid({ ...base, reading: reading({ stock: { low: 10_000_000, high: 10_000_000 } }),
      nerve: careful });
    expect(plan!.expectedLoot).toBe(fleetCargo(plan!.wing, {}));
    expect(plan!.fuel).toBe(missionFuel(plan!.wing, base.distance, 2));
  });

  it('never plans a flight its tank cannot fuel', () => {
    expect(planWorldRaid({ ...base, deuterium: 0, reading: reading(), nerve: careful })).toBeNull();
  });

  it('assumes an unmeasured dome is as strong as the world can hold', () => {
    // A dome shelters the guns under it; with nothing standing it guards nothing.
    const domed = reading({ defence: { low: 2_000, high: 2_500 }, shield: null, domeCeiling: 10_000_000 });
    expect(planWorldRaid({ ...base, reading: domed, nerve: careful })).toBeNull();
    expect(planWorldRaid({ ...base, reading: { ...domed, domeCeiling: 0 }, nerve: careful })).not.toBeNull();
  });

  it('has nothing to send from a pad of miners and guns', () => {
    expect(planWorldRaid({ ...base, fleet: { PROSPECTOR: 3, BASTION: 5 }, reading: reading(), nerve: bold }))
      .toBeNull();
  });
});

describe('the research a record carries', () => {
  it('reads combat v3 windows as they are, older exact levels as one-level windows, a caretaker as none', () => {
    const windows = { SHIP_POWER: { low: 2, high: 3 } };
    expect(researchOf({ kind: 'CAPITAL', research: windows })).toEqual(windows);
    expect(researchOf({ kind: 'COLONY', doctrines: { SHIP_ARMOR: 3 } })).toEqual({ SHIP_ARMOR: { low: 3, high: 3 } });
    expect(researchOf({ kind: 'NEUTRAL' })).toEqual({});
    // Never read: anything the ladders allow, never nothing.
    expect(researchOf({ kind: 'CAPITAL' })).toBeUndefined();
  });
});

describe('the wing', () => {
  /** A raid that cannot carry the haul home is a raid for nothing. */
  it('takes every cargo hull along, whatever share of the line flies', () => {
    const wing = raidingWing({ DART: 10, COURIER: 2, PROSPECTOR: 2, BASTION: 3 }, BOTS.wingShares[0]!);
    expect(wing.COURIER).toBe(2);
    expect(wing.DART).toBe(Math.floor(10 * BOTS.wingShares[0]!));
    expect(wing.PROSPECTOR).toBeUndefined();
    expect(wing.BASTION).toBeUndefined();
  });

  it('flies no transport alone', () => {
    expect(raidingWing({ COURIER: 3 }, 0.9)).toEqual({});
  });
});

describe('what is not worth reading', () => {
  /** A wall several times the wing's own firepower falls to no wall the reading could hold. */
  it('calls a wall hopeless where even the best case leaves the wing the weaker', () => {
    const wing = { DART: 20 };
    const wall = combatValue(wing) * BOTS.hopelessRatio;
    expect(hopeless(wing, wall * 0.5)).toBe(false);
    expect(hopeless(wing, wall + 1)).toBe(true);
    const best = readPowerRange({ fleet: wing, tech: {} }, [{ value: { low: wall, high: wall }, research: {} }], none)!.ratio.high;
    expect(best).toBeLessThan(1);
  });
});

describe('a raid on a pirate', () => {
  it('passes over a crew whose shared reward has already been loaded by earlier raids', () => {
    const plan = planPirateRaid({ ...base, crew: { DART: 2 }, damageMult: 1,
      hoard: { alloy: 0, crystal: 0, deuterium: 0 }, nerve: careful });
    expect(plan).toBeNull();
  });
  const crewOf = (level: 'weak' | 'strong'): Fleet => (level === 'weak' ? { DART: 1 } : { DART: 400, PIKE: 200 });

  it('leaves a crew it cannot beat alone', () => {
    const crew = crewOf('strong');
    expect(planPirateRaid({ ...base, fleet: { DART: 3 }, crew, damageMult: 1, hoard: pirateHoard(crew),
      nerve: bold })).toBeNull();
  });

  /**
   * The crew is known exactly, so its ratio is one figure; its holds fly behind the line and add
   * nothing to it, and they are taken once the line falls (`pirateOverrun`, 2026-10-06).
   */
  it('weighs the crew exactly and sends the smallest wing that clears it', () => {
    const crew: Fleet = { PIKE: 1, COURIER: 2 };
    const damageMult = pirateStats(1).damageMult;
    const plan = planPirateRaid({ ...base, fleet: { DART: 5 }, crew, damageMult, hoard: pirateHoard(crew), nerve: careful });
    const ratio = (wing: Fleet) => exactPowerRange({ fleet: wing, tech: {} }, crew, { tech: {}, damageMult }).ratio.low;
    expect(plan).not.toBeNull();
    expect(ratio(plan!.wing)).toBeGreaterThanOrEqual(BOTS.clearRatio);
    const smaller = BOTS.wingShares.map((share) => raidingWing({ DART: 5 }, share))
      .filter((wing) => (wing.DART ?? 0) > 0 && (wing.DART ?? 0) < plan!.wing.DART!);
    for (const wing of smaller) expect(ratio(wing)).toBeLessThan(BOTS.clearRatio);
  });

  it('takes a crew it clears, with the smallest wing that does', () => {
    const crew = crewOf('weak');
    const plan = planPirateRaid({ ...base, crew, damageMult: 1, hoard: pirateHoard(crew), nerve: careful });
    expect(plan?.wing).toEqual(raidingWing(fleet, BOTS.wingShares[0]!));
  });
});

describe('who counts as a bully', () => {
  it('is somebody who struck people five times in a day', () => {
    expect(BOTS.bullyRaidsPerDay).toBe(5);
    expect(isBully(4)).toBe(false);
    expect(isBully(5)).toBe(true);
    expect(isBully(12)).toBe(true);
  });
});

describe('every habit has a nerve', () => {
  it('lets only the raider settle for breaking a wall', () => {
    expect(BOT_PERSONAS.RAIDER.nerve.need).toBe('BREAKS');
    for (const id of ['BUILDER', 'PROSPECTOR', 'BALANCED'] as const) {
      expect(BOT_PERSONAS[id].nerve.need).toBe('CLEARS');
      expect(BOT_PERSONAS[id].nerve.maxLoss).toBeLessThan(BOT_PERSONAS.RAIDER.nerve.maxLoss);
    }
  });
});
