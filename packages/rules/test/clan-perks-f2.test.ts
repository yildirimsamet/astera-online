import { describe, expect, it } from 'vitest';
import {
  CLAN,
  CLAN_LEVEL_MAX,
  CLAN_PERK_LADDER,
  CLAN_VICTORY_WRECK_SHARE,
  clanVictoryWreck,
  clanTagTier,
  CLAN_SUPPORT,
  SILENT_SPACE,
  advanceEconomy,
  alloyRate,
  collectorCap,
  crystalRate,
  deuteriumRate,
  clanAidTravelMinutes,
  clanAlarmUnlocked,
  clanCorridorMinutes,
  clanFirstLegMinutes,
  clanSupportStationHours,
  clanCorridorMultiplier,
  clanPerksUnlockedAt,
  clanRefineryBonus,
  clanStationHours,
} from '../src/index.js';

/**
 * KLAN PERKLERİ — F2, owner decisions 2026-11-10 (`docs/klan-perkleri-f2-plan-2026-11-10.md`).
 *
 *   L1 corridor ×2 (from founding) · L2 alarm · L3 ×3 · L4 station 18 h · L5 ×4 ·
 *   L6 refinery +1 %/member · L7 ×5 · L8 station 24 h · L9 refinery +2 %/member · L10 banner.
 */

describe('F2 ladder — one table, ten rungs', () => {
  it('names one perk per rung, in the owner’s order', () => {
    expect(CLAN_PERK_LADDER.map((rung) => [rung.level, rung.perk, rung.value])).toEqual([
      [1, 'CORRIDOR', 2],
      [2, 'ALARM', 1],
      [3, 'CORRIDOR', 3],
      [4, 'STATION', 18],
      [5, 'CORRIDOR', 4],
      [6, 'REFINERY', 0.01],
      [7, 'CORRIDOR', 5],
      [8, 'STATION', 24],
      [9, 'REFINERY', 0.02],
      [10, 'BANNER', 1],
    ]);
    expect(CLAN_PERK_LADDER.at(-1)?.level).toBe(CLAN_LEVEL_MAX);
  });

  it('lists what a level has unlocked, every lower rung included', () => {
    expect(clanPerksUnlockedAt(1).map((rung) => rung.level)).toEqual([1]);
    expect(clanPerksUnlockedAt(4).map((rung) => rung.level)).toEqual([1, 2, 3, 4]);
    expect(clanPerksUnlockedAt(10)).toHaveLength(10);
  });
});

describe('F2 corridor — the first leg of every clanmate flight', () => {
  it('starts at ×2 the day a clan is founded and climbs ×3 / ×4 / ×5 at L3 / L5 / L7', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(clanCorridorMultiplier)).toEqual([2, 2, 3, 3, 4, 4, 5, 5, 5, 5]);
  });

  it('replaces the aid lane’s ×1.1 on the first leg rather than stacking on it', () => {
    expect(clanCorridorMinutes(120, 1)).toBe(60);
    expect(clanCorridorMinutes(120, 7)).toBe(24);
    // The return leg keeps today's clan lane.
    expect(clanAidTravelMinutes(120)).toBeCloseTo(120 / CLAN.aidSpeedMultiplier);
  });

  it('never runs a negative or non-finite flight', () => {
    expect(clanCorridorMinutes(-5, 3)).toBe(0);
    expect(clanCorridorMinutes(Number.NaN, 3)).toBe(0);
  });

  it('keeps a fleet that cannot fly at all unable to arrive, as the ×1.1 lane does', () => {
    // An immobile fleet's ordinary flight never ends; the corridor must not turn that into "instantly".
    expect(clanCorridorMinutes(Number.POSITIVE_INFINITY, 3)).toBe(Number.POSITIVE_INFINITY);
    expect(clanFirstLegMinutes(Number.POSITIVE_INFINITY, 3)).toBe(clanAidTravelMinutes(Number.POSITIVE_INFINITY));
  });
});

describe('F2 perks only where the clan has a level', () => {
  // A clan of a season dealt before the joint war has no level (null): it keeps every old rule.
  it('flies the first leg on the corridor with a level, on the old ×1.1 lane without one', () => {
    expect(clanFirstLegMinutes(120, 3)).toBe(40);
    expect(clanFirstLegMinutes(110, null)).toBeCloseTo(100);
  });

  it('stands a wave the old 12 h without a level', () => {
    expect(clanSupportStationHours(8)).toBe(24);
    expect(clanSupportStationHours(null)).toBe(12);
  });
});

describe('F2 alarm and station', () => {
  it('unlocks the alarm at L2', () => {
    expect(clanAlarmUnlocked(1)).toBe(false);
    expect(clanAlarmUnlocked(2)).toBe(true);
    expect(clanAlarmUnlocked(10)).toBe(true);
  });

  it('keeps a wave 12 h, 18 h from L4 and 24 h from L8', () => {
    expect([1, 3, 4, 7, 8, 10].map(clanStationHours)).toEqual([12, 12, 18, 18, 24, 24]);
    expect(clanStationHours(1)).toBe(CLAN_SUPPORT.stationHours);
  });
});

describe('F2 refinery — Ortak Ocak', () => {
  it('pays nothing before L6', () => {
    expect(clanRefineryBonus(5, 5)).toBe(0);
  });

  it('adds 1 % per active member at L6, 2 % at L9, at most one per seat', () => {
    expect(clanRefineryBonus(6, 1)).toBeCloseTo(0.01);
    expect(clanRefineryBonus(6, 5)).toBeCloseTo(0.05);
    expect(clanRefineryBonus(8, 3)).toBeCloseTo(0.03);
    expect(clanRefineryBonus(9, 5)).toBeCloseTo(0.10);
    expect(clanRefineryBonus(9, 99)).toBeCloseTo(0.02 * CLAN.maxMembers);
  });

  it('treats an impossible member count as nobody', () => {
    expect(clanRefineryBonus(9, -2)).toBe(0);
    expect(clanRefineryBonus(9, Number.NaN)).toBe(0);
    expect(clanRefineryBonus(9, 2.7)).toBeCloseTo(0.04);
  });
});

describe('F2 levels are checked', () => {
  it.each([0, 11, 1.5, Number.NaN])('refuses level %s', (bad) => {
    expect(() => clanCorridorMultiplier(bad)).toThrow(RangeError);
    expect(() => clanStationHours(bad)).toThrow(RangeError);
    expect(() => clanRefineryBonus(bad, 1)).toThrow(RangeError);
    expect(() => clanAlarmUnlocked(bad)).toThrow(RangeError);
  });
});

/**
 * ORTAK OCAK IN THE LAZY TICK. Like the Silent Space pace, it moves what the works PRODUCE and
 * nothing else: the vessels keep their size, so the bonus fills them sooner, never bigger.
 */
describe('F2 refinery in the economy tick', () => {
  const input = { refineryLevel: 5, extractorLevel: 4, plantLevel: 3, aegisLevel: 0, vaultLevel: 0 };
  const fresh = () => ({
    alloy: 0, crystal: 0, deuterium: 0, bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0,
    shield: 0, lastTickMinutes: 0, disruptedUntilMinutes: 0,
  });

  it('adds the clan share to every rate', () => {
    const lifted = advanceEconomy(fresh(), { ...input, clanBonus: 0.05 }, 60);
    expect(lifted.bufferAlloy).toBeCloseTo(alloyRate(5) * 1.05, 6);
    expect(lifted.bufferCrystal).toBeCloseTo(crystalRate(4) * 1.05, 6);
    expect(lifted.bufferDeuterium).toBeCloseTo(deuteriumRate(3) * 1.05, 6);
  });

  it('reads exactly as before with no share, and stacks with the Silent Space pace', () => {
    expect(advanceEconomy(fresh(), { ...input, clanBonus: 0 }, 60)).toEqual(advanceEconomy(fresh(), input, 60));
    const both = advanceEconomy(fresh(), { ...input, clanBonus: 0.1, pace: SILENT_SPACE.productionPace }, 60);
    expect(both.bufferAlloy).toBeCloseTo(alloyRate(5) * 1.1 * SILENT_SPACE.productionPace, 6);
  });

  it('keeps the same collector ceilings', () => {
    const full = advanceEconomy(fresh(), { ...input, clanBonus: 0.1 }, 60 * 500);
    expect(full.bufferAlloy).toBe(collectorCap(alloyRate(5)));
  });

  it('refuses a share no rung can give', () => {
    for (const bad of [Number.NaN, -0.01, 1, Number.POSITIVE_INFINITY]) {
      expect(() => advanceEconomy(fresh(), { ...input, clanBonus: bad }, 60)).toThrow(RangeError);
    }
  });
});

/** E4 ZAFER KASASI: half of a won supported defence's wreck goes to the clan purse, to its cap. */
describe('F2 victory wreck — the purse’s half', () => {
  const field = { alloy: 1_001, crystal: 600, deuterium: 400 };

  it('moves half of each resource, in whole units, and leaves the rest in orbit', () => {
    const room = { alloy: 10_000, crystal: 10_000, deuterium: 10_000 };
    expect(clanVictoryWreck(field, room)).toEqual({
      purse: { alloy: 500, crystal: 300, deuterium: 200 },
      field: { alloy: 501, crystal: 300, deuterium: 200 },
    });
    expect(CLAN_VICTORY_WRECK_SHARE).toBe(0.5);
  });

  it('stops at the purse cap, and the overflow stays in the field', () => {
    const split = clanVictoryWreck(field, { alloy: 120, crystal: 0, deuterium: 0 });
    expect(split.purse).toEqual({ alloy: 120, crystal: 0, deuterium: 0 });
    expect(split.field).toEqual({ alloy: 881, crystal: 600, deuterium: 400 });
  });

  it('moves nothing for a purse that holds nothing more (top rung, or no level)', () => {
    expect(clanVictoryWreck(field, null)).toEqual({ purse: { alloy: 0, crystal: 0, deuterium: 0 }, field });
  });
});

describe('the clan tag colour by level (owner 2026-11-10)', () => {
  it('is plain below 3, bronze from 3, silver from 6 and gold at the top', () => {
    expect([null, 1, 2, 3, 5, 6, 9, 10].map(clanTagTier))
      .toEqual([null, null, null, 'BRONZE', 'BRONZE', 'SILVER', 'SILVER', 'GOLD']);
  });
});
