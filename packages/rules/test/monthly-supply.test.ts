import { describe, expect, it } from 'vitest';
import { generateAsteroidSchedule, generatePirateSchedule, mulberry32, HULLS, DEBRIS, SERVERS } from '../src/index.js';
import { monthlySupply } from '../src/monthly-supply.js';

const resources = ['alloy', 'crystal', 'deuterium'] as const;
describe('finite monthly external supply', () => {
  it('caps each day independently, including every possible captured pirate hull and its debris', () => {
    for (const seed of [1, 42, 951]) {
      const rocks = generateAsteroidSchedule(mulberry32(seed));
      const pirates = generatePirateSchedule(mulberry32(seed));
      expect(rocks.length).toBeGreaterThan(0);
      expect(pirates.length).toBeGreaterThan(0);
      pirates.forEach((p, i) => { expect(p.index).toBe(i); });
      for (let day = 0; day < 30; day++) {
        const mining = monthlySupply('mining', day, SERVERS.capacity);
        const piracy = monthlySupply('pirates', day, SERVERS.capacity);
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
  it('scales communal supply with seats and never creates a thirty-first day', () => {
    for (const kind of ['mining', 'pirates'] as const) {
      expect(monthlySupply(kind, 29, 1000).alloy / monthlySupply(kind, 29, 300).alloy).toBeCloseTo(1000 / 300);
      expect(monthlySupply(kind, 30, 300)).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
    }
    expect(() => monthlySupply('mining', 0, -1)).toThrow();
  });
});
