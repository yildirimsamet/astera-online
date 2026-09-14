import { describe, expect, it } from 'vitest';
import { generateAsteroidSchedule, generatePirateSchedule, mulberry32, HULLS, DEBRIS, PIRATE, SERVERS, pirateAdmissionCost } from '../src/index.js';
import { monthlyPirateSupplyAtRate, monthlySupply } from '../src/monthly-supply.js';

const resources = ['alloy', 'crystal', 'deuterium'] as const;
describe('finite monthly external supply', () => {
  it('caps each day independently, including every possible captured pirate hull and its debris', () => {
    for (const seed of [1, 42, 951]) {
      const rocks = generateAsteroidSchedule(mulberry32(seed));
      // Preserve the original actual-hull-price regression signal independently
      // of the owner-set extra lane. D208's existing price/admission mismatch must
      // remain visible, not be fixed by widening a cap in this density release.
      const establishedLengths: Record<number, number> = { 1: 2902, 42: 2841, 951: 2818 };
      const pirates = generatePirateSchedule(mulberry32(seed)).slice(0, establishedLengths[seed]);
      expect(rocks.length).toBeGreaterThan(0);
      expect(pirates.length).toBeGreaterThan(0);
      pirates.forEach((p, i) => { expect(p.index).toBe(i); });
      for (let day = 0; day < 30; day++) {
        const mining = monthlySupply('mining', day, SERVERS.capacity);
        const piracy = monthlyPirateSupplyAtRate(day, SERVERS.capacity, PIRATE.establishedSpawnPerHour);
        const a = { alloy: 0, crystal: 0, deuterium: 0 };
        const p = { alloy: 0, crystal: 0, deuterium: 0 };
        for (const r of rocks.filter(r => Math.floor(r.appearsAt / 1440) === day)) {
          a.alloy += r.ore * (1 - r.crystalShare - r.deuteriumShare);
          a.crystal += r.ore * r.crystalShare;
          a.deuterium += r.ore * r.deuteriumShare;
        }
        for (const r of pirates.filter(r => Math.floor(r.appearsAt / 1440) === day)) {
          for (const k of resources) {
            p[k] += r.hoard[k];
            for (const [id, count] of Object.entries(r.roster)) {
              p[k] += HULLS[id as keyof typeof HULLS][k] * count * (1 + DEBRIS.share);
            }
          }
        }
        for (const k of resources) {
          expect(a[k], `mining day ${day} ${k}`).toBeLessThanOrEqual(mining[k] + 0.001);
          expect(p[k], `pirates day ${day} ${k}`).toBeLessThanOrEqual(piracy[k] + 0.001);
        }
      }
    }
  });
  it('keeps both lanes inside the proportional frozen-price admission budget every day', () => {
    for (const seed of [1, 42, 951]) {
      const field = generatePirateSchedule(mulberry32(seed));
      for (let day = 0; day < 30; day++) {
        const allowance = monthlySupply('pirates', day, SERVERS.capacity);
        const liability = { alloy: 0, crystal: 0, deuterium: 0 };
        for (const pirate of field.filter(p => Math.floor(p.appearsAt / 1440) === day)) {
          const cost = pirateAdmissionCost(pirate.roster);
          const worth = cost.alloy + cost.crystal + cost.deuterium;
          for (const k of resources) {
            const oldHoard = Math.floor(worth * PIRATE.hoardAdmissionValueMult * PIRATE.hoardShare[k]);
            liability[k] += oldHoard + cost[k] * (1 + DEBRIS.share);
          }
        }
        for (const k of resources) {
          expect(liability[k], `admission day ${day} ${k}`)
            .toBeLessThanOrEqual(allowance[k] / PIRATE.hoardRewardScale + 0.001);
        }
      }
    }
  });
  it('scales communal supply with seats and never creates a thirty-first day', () => {
    for (const kind of ['mining', 'pirates'] as const) {
      expect(monthlySupply(kind, 29, 1000).alloy / monthlySupply(kind, 29, 300).alloy).toBeCloseTo(1000 / 300);
      expect(monthlySupply(kind, 30, 300)).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
    }
    expect(() => monthlySupply('mining', 0, -1)).toThrow();
  });

  /**
   * The allowance is a share of the frozen monthly reference scaled by the lane's
   * candidate rate, so it follows both 2026-09-14 increases: 0.05 x 1.30 x (0.06 /
   * 0.02) is 19.5% of the reference, against mining's 15%. Without the matching
   * headroom the admission cap would simply discard the new lane's targets and the
   * doubling would exist only in the constants.
   */
  it('raises pirate supply with the owner-set spawn increases', () => {
    const rateScale = PIRATE.spawnPerHour / PIRATE.establishedSpawnPerHour;
    expect(rateScale).toBeCloseTo(3, 9);
    for (const resource of resources) {
      const mining = monthlySupply('mining', 12, SERVERS.capacity)[resource];
      const piracy = monthlySupply('pirates', 12, SERVERS.capacity)[resource];
      expect(piracy / mining).toBeCloseTo((0.05 * PIRATE.hoardRewardScale * rateScale) / 0.15, 12);
    }
  });
});
