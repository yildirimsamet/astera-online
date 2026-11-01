import { describe, expect, it } from 'vitest';
import { ALL_HULLS, HULLS } from '../src/hulls.js';
import { RESEARCH_PROJECT_IDS } from '../src/types.js';
import { RESEARCH_MAX_LEVEL } from '../src/research.js';
import {
  LEGACY_CATALOGUE,
  LEGACY_MIN_SEASON_MS,
  legacySeasonEligible,
  legacyTiers,
  legacyUnionMilliseconds,
  legacyLoyalSeason,
  legacyResearchMastered,
  legacyRankDegree,
  legacyAwardRarity,
} from '../src/legacy.js';

const DAY = 86_400_000;

describe('commander legacy eligibility', () => {
  it('excludes an entire shortened season below twelve real days, including its last millisecond', () => {
    expect(LEGACY_MIN_SEASON_MS).toBe(12 * DAY);
    expect(legacySeasonEligible(100, 100 + 12 * DAY - 1)).toBe(false);
    expect(legacySeasonEligible(100, 100 + 12 * DAY)).toBe(true);
    expect(legacySeasonEligible(100, 100 + 60 * DAY)).toBe(true);
    expect(legacySeasonEligible(100, 99)).toBe(false);
    expect(() => legacySeasonEligible(0, Number.NaN)).toThrow();
  });

  it('retains every crossed career tier, without rounding fractional or invalid counters', () => {
    expect(legacyTiers([1, 3, 5, 10], 5)).toEqual([1, 2, 3]);
    expect(legacyTiers([10, 30, 50, 100], 9)).toEqual([]);
    expect(legacyTiers([10, 30, 50, 100], 100)).toEqual([1, 2, 3, 4]);
    for (const value of [-1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => legacyTiers([1], value)).toThrow();
    }
  });

  it('has a separate production plaque for every ship, including mining craft, and none for ground guns', () => {
    const plaques = LEGACY_CATALOGUE.filter(row => row.metric.startsWith('SHIPS_BUILT:'));
    expect(plaques.map(row => row.metric).sort()).toEqual(ALL_HULLS
      .filter(hull => !HULLS[hull].ground).map(hull => `SHIPS_BUILT:${hull}`).sort());
    for (const plaque of plaques) expect(plaque.goals).toEqual([100, 1_000, 10_000]);
    expect(new Set(LEGACY_CATALOGUE.map(row => row.id)).size).toBe(LEGACY_CATALOGUE.length);
    expect(LEGACY_CATALOGUE.some(row => /CHAT|SUPPORT_BATTLE|BULLY/.test(row.metric))).toBe(false);
  });

  it('keeps neutral colonisation and enemy colony neutralisation as different achievements', () => {
    expect(LEGACY_CATALOGUE.find(row => row.id === 'colony-hunter')?.metric).toBe('COLONIES_NEUTRALISED');
    expect(LEGACY_CATALOGUE.find(row => row.id === 'colony-pioneer')?.metric).toBe('NEUTRAL_COLONIES');
    expect(LEGACY_CATALOGUE.find(row => row.id === 'clan-comrade')?.goals).toEqual([1, 5, 20, 50]);
  });

  it('counts overlapping monument duty once, preserves subsecond fragments and accepts delayed evidence', () => {
    const spans = [{ from: 1_000, to: 4_500 }, { from: 2_000, to: 6_000 },
      { from: 7_000, to: 7_500 }, { from: 6_000, to: 7_000 }];
    expect(legacyUnionMilliseconds(spans)).toBe(6_500);
    expect(legacyUnionMilliseconds([...spans].reverse())).toBe(6_500);
    expect(legacyUnionMilliseconds([...spans, ...spans])).toBe(6_500);
    expect(spans[0]).toEqual({ from: 1_000, to: 4_500 });
    expect(legacyUnionMilliseconds([])).toBe(0);
    expect(() => legacyUnionMilliseconds([{ from: 5, to: 4 }])).toThrow();
  });

  it('requires first-day participation and 80 percent distinct active season days', () => {
    const activeDays = Array.from({ length: 48 }, (_, i) => i);
    expect(legacyLoyalSeason({ startsAt: 0, closesAt: 60 * DAY, joinedAt: DAY - 1, activeDays })).toBe(true);
    expect(legacyLoyalSeason({ startsAt: 0, closesAt: 60 * DAY, joinedAt: DAY, activeDays })).toBe(false);
    expect(legacyLoyalSeason({ startsAt: 0, closesAt: 60 * DAY, joinedAt: 0, activeDays: activeDays.slice(1) })).toBe(false);
    expect(legacyLoyalSeason({ startsAt: 0, closesAt: 60 * DAY, joinedAt: 0,
      activeDays: [...activeDays.slice(1), 0, 0, 60, 61, -1] })).toBe(true);
    expect(legacyLoyalSeason({ startsAt: 0, closesAt: 60 * DAY, joinedAt: 0,
      activeDays: Array.from({ length: 100 }, () => 0) })).toBe(false);
    expect(legacyLoyalSeason({ startsAt: 0, closesAt: 11 * DAY, joinedAt: 0, activeDays })).toBe(false);
    expect(legacyLoyalSeason({ startsAt: 0, closesAt: 12 * DAY, joinedAt: 0,
      activeDays: Array.from({ length: 10 }, (_, i) => i) })).toBe(true);
  });

  it('requires the maximum of every research project in the same seasonal record', () => {
    const levels = { ...RESEARCH_MAX_LEVEL };
    expect(legacyResearchMastered(levels)).toBe(true);
    expect(legacyResearchMastered({})).toBe(false);
    const first = RESEARCH_PROJECT_IDS[0];
    expect(legacyResearchMastered({ ...levels, [first]: levels[first] - 1 })).toBe(false);
  });

  it('uses the visible rank without promoting commanders or combining the two ladders', () => {
    expect(legacyRankDegree(1, 10)).toBe('CHAMPION');
    expect(legacyRankDegree(2, 10)).toBe('SILVER');
    expect(legacyRankDegree(3, 10)).toBe('BRONZE');
    expect(legacyRankDegree(4, 10)).toBe('TOP_TEN');
    expect(legacyRankDegree(10, 10)).toBe('TOP_TEN');
    expect(legacyRankDegree(11, 10)).toBeNull();
    expect(legacyRankDegree(1, 0)).toBeNull();
    expect(legacyRankDegree(1, -1)).toBeNull();
  });
});


describe('award metals and rarity describe the same earned degree', () => {
  it('keeps podium order distinct from an ascending career ladder', () => {
    for (const id of ['honor-podium', 'dominion-podium']) {
      expect([1, 2, 3, 4].map(tier => legacyAwardRarity(id, tier)))
        .toEqual(['LEGENDARY', 'EPIC', 'RARE', 'COMMON']);
    }
    expect([1, 2, 3, 4].map(tier => legacyAwardRarity('pirate-hunter', tier)))
      .toEqual(['COMMON', 'RARE', 'EPIC', 'LEGENDARY']);
  });

  it('does not add or remove goals just to fit four metals', () => {
    expect([1, 2, 3].map(tier => legacyAwardRarity('shipwright-dart', tier)))
      .toEqual(['COMMON', 'RARE', 'LEGENDARY']);
    expect([1, 2, 3, 4].map(tier => legacyAwardRarity('monument-warden', tier)))
      .toEqual(['COMMON', 'RARE', 'EPIC', 'LEGENDARY']);
    expect(() => legacyAwardRarity('monument-warden', 5)).toThrow(RangeError);
    expect(legacyAwardRarity('science-horizon', 1)).toBe('LEGENDARY');
    expect(legacyAwardRarity('astera-supporter', 1)).toBe('LEGENDARY');
    expect(legacyAwardRarity('loyal-commander', 1)).toBe('RARE');
    for (const id of ['season-memento', 'year-of-service']) expect(legacyAwardRarity(id, 1)).toBe('COMMON');
    for (const tier of [0, -1, 1.5, 5]) expect(() => legacyAwardRarity('pirate-hunter', tier)).toThrow(RangeError);
    expect(() => legacyAwardRarity('missing-award', 1)).toThrow(RangeError);
  });
});


it('uses the revised commander milestones without changing the other ladders', () => {
  const goals = {
    'colony-hunter': [1, 5, 20, 50], 'colony-pioneer': [1, 5, 20, 50],
    'monument-warden': [3_600, 43_200, 86_400, 259_200],
    'asteroid-hunter': [10, 100, 500, 2_000], 'final-verdict': [1, 5, 20, 50],
    'radiation-master': [1, 10, 50, 100], 'missile-hunter': [1, 5, 20, 50],
    'clan-comrade': [1, 5, 20, 50], 'troublemaker': [1, 10, 50, 100],
  };
  for (const [id, thresholds] of Object.entries(goals)) {
    const entry = LEGACY_CATALOGUE.find(row => row.id === id)!;
    expect(entry.goals, id).toEqual(thresholds);
    for (const [index, threshold] of thresholds.entries()) {
      expect(legacyTiers(entry.goals, threshold - 1)).toHaveLength(index);
      expect(legacyTiers(entry.goals, threshold)).toHaveLength(index + 1);
    }
  }
  expect(LEGACY_CATALOGUE.find(row => row.id === 'pirate-hunter')?.goals).toEqual([10, 30, 50, 100]);
  expect(LEGACY_CATALOGUE.find(row => row.id === 'deep-sight')?.goals).toEqual([10, 100, 1_000]);
  expect(LEGACY_CATALOGUE.find(row => row.id === 'show-off')?.goals).toEqual([1, 3, 5]);
});
