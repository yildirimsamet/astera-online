import { describe, expect, it } from 'vitest';
import {
  combatValue,
  fleetCargo,
  forecastLines,
  missionFuel,
  pirateHoard,
  pirateStats,
  type Fleet,
} from '@astera/rules';
import {
  hopeless,
  isBully,
  planPirateRaid,
  planWorldRaid,
  raidingWing,
  type Nerve,
  type WallReading,
} from '../src/services/bots/judgement.js';
import { BOTS, BOT_PERSONAS } from '../src/services/bots/personas.js';

/**
 * A BOT READS THE SAME FORECAST A PERSON DOES, AND ONLY FLIES WHAT IT CAN WIN.
 * Owner report, 2026-09-19: *"Hayvan gibi filosu olan oyuncuya saçma sapan 1-2 tane
 * gemi gönderip duruyorlar."*
 *
 * The launch sheet's lines (`forecastLines` / `forecastLoss`, the engine the server
 * grades with) against the probe's bands: the least favourable wall the reading
 * allows must still fall to the wing, the fight must not cost more than the habit
 * will pay, and the haul must be worth the fuel.
 */

const bold: Nerve = { need: 'BREAKS', maxLoss: 1, lootOverFuel: 0 };
const careful: Nerve = { need: 'CLEARS', maxLoss: 1, lootOverFuel: 0 };

const reading = (over: Partial<WallReading> = {}): WallReading => ({
  defence: { low: 0, high: 0 },
  stock: { low: 50_000, high: 60_000 },
  shield: { low: 0, high: 0 },
  unarmed: { low: 0, high: 0 },
  classReading: null,
  doctrines: {},
  domeCeiling: 0,
  ...over,
});

const fleet: Fleet = { DART: 40, WARDEN: 10 };
const base = { fleet, tech: {}, distance: 900, deuterium: 1_000_000 };

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

  it('commits more of the line only as far as the wall asks, and the lines agree', () => {
    const full = raidingWing(fleet, BOTS.wingShares.at(-1)!);
    const smallest = raidingWing(fleet, BOTS.wingShares[0]!);
    // A wall the full wing clears in the worst case and the smallest does not.
    const fullClears = forecastLines(full, { attackerTech: {}, defenderTech: {}, shield: { low: 0, high: 0 },
      unarmed: { low: 0, high: 0 }, wall: { kind: 'UNKNOWN' } }).clears.low;
    const smallClears = forecastLines(smallest, { attackerTech: {}, defenderTech: {}, shield: { low: 0, high: 0 },
      unarmed: { low: 0, high: 0 }, wall: { kind: 'UNKNOWN' } }).clears.low;
    const wall = ((smallClears + fullClears) / 2) / BOTS.wallMargin;
    const plan = planWorldRaid({
      ...base,
      reading: reading({ defence: { low: wall * 0.9, high: wall } }),
      nerve: careful,
    });
    expect(plan).not.toBeNull();
    expect(combatValue(plan!.wing)).toBeGreaterThan(combatValue(smallest));
    expect(combatValue(plan!.wing)).toBeLessThanOrEqual(combatValue(full));
  });

  it('lets a bold habit settle for breaking a wall a careful one would leave alone', () => {
    const full = raidingWing(fleet, BOTS.wingShares.at(-1)!);
    const lines = forecastLines(full, { attackerTech: {}, defenderTech: {}, shield: { low: 0, high: 0 },
      unarmed: { low: 0, high: 0 }, wall: { kind: 'UNKNOWN' } });
    expect(lines.breaks.low).toBeGreaterThan(lines.clears.low);
    const wall = ((lines.clears.low + lines.breaks.low) / 2) / BOTS.wallMargin;
    const input = { ...base, reading: reading({ defence: { low: wall, high: wall } }) };
    expect(planWorldRaid({ ...input, nerve: careful })).toBeNull();
    expect(planWorldRaid({ ...input, nerve: bold })).not.toBeNull();
  });

  /**
   * KLAN SAVUNMA DESTEĞİ: the raid meets the host AND the clanmates standing there, so the
   * probe's separate support reading joins the wall — the same sum the launch sheet draws.
   */
  it('counts the clan support standing at the world into the wall', () => {
    const full = raidingWing(fleet, BOTS.wingShares.at(-1)!);
    const lines = forecastLines(full, { attackerTech: {}, defenderTech: {}, shield: { low: 0, high: 0 },
      unarmed: { low: 0, high: 0 }, wall: { kind: 'UNKNOWN' } });
    const half = (lines.clears.low / BOTS.wallMargin) * 0.6;
    const alone = reading({ defence: { low: half, high: half } });
    expect(planWorldRaid({ ...base, reading: alone, nerve: careful })).not.toBeNull();
    const supported = reading({ defence: { low: half, high: half }, support: { low: half, high: half } });
    expect(planWorldRaid({ ...base, reading: supported, nerve: careful })).toBeNull();
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

describe('what is not worth asking the engine', () => {
  /**
   * A forecast is a few dozen fights, on the worker that lands every raid on time.
   * A wall several times the wing's own firepower falls to no wall shape the
   * reading could hold, so it is refused without asking.
   */
  it('calls a wall hopeless well past anything the best case clears', () => {
    const wing = { DART: 20 };
    const best = forecastLines(wing, { attackerTech: {}, defenderTech: {}, shield: { low: 0, high: 0 },
      unarmed: { low: 0, high: 0 }, wall: { kind: 'UNKNOWN' } }).breaks.high;
    expect(hopeless(wing, best * 0.9)).toBe(false);
    expect(hopeless(wing, combatValue(wing) * BOTS.hopelessRatio + 1)).toBe(true);
    expect(combatValue(wing) * BOTS.hopelessRatio).toBeGreaterThan(best);
  });
});

describe('a raid on a pirate', () => {
  const crewOf = (level: 'weak' | 'strong'): Fleet => (level === 'weak' ? { DART: 1 } : { DART: 400, PIKE: 200 });

  it('leaves a crew it cannot beat alone', () => {
    const crew = crewOf('strong');
    expect(planPirateRaid({ ...base, fleet: { DART: 3 }, crew, damageMult: 1, hoard: pirateHoard(crew),
      nerve: bold })).toBeNull();
  });

  /**
   * A bot reads the pirate as the server settles it: holds that outlive the crew's last warship
   * are taken (`pirateOverrun`, 2026-10-06), so a wing that kills the line clears the pirate.
   */
  it('counts a crew whose holds outlive its line as cleared', () => {
    const crew: Fleet = { RAMPART: 3, COURIER: 2 };
    const plan = planPirateRaid({ ...base, fleet: { DART: 5 }, crew, damageMult: pirateStats(1).damageMult,
      hoard: pirateHoard(crew), nerve: careful });
    expect(plan?.wing).toEqual({ DART: 4 });
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
