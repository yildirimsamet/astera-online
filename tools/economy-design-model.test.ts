import { profileHull } from '../packages/rules/src/economy-profile.js';
import { expect, it } from 'vitest';
import { designIncome, designInvoice, designHull, designRoundTrip, designSeason, designRenewal,
  designBuilding, designResearch, designFleetTarget, designEffort, designSpeed } from './economy-design-model.js';
import { ALL_HULLS, HULLS, RESEARCH_PROJECTS } from '../packages/rules/src/index.js';

it('measures reporting effort in independent reference resource-hours, never merchant prices', () => {
  const income = designIncome(6);
  expect(designEffort(income)).toBeCloseTo(3);
  expect(designEffort({ alloy: income.alloy * 2, crystal: 0, deuterium: 0 })).toBeCloseTo(2);
  expect(designSpeed({ SHIP_PROPULSION: 4 })).toBe(1.5);
  expect(designSpeed({})).toBe(1);
  expect(() => designRoundTrip(1250, NaN, 0)).toThrow();
  expect(() => designRoundTrip(1250, 15, 0.5)).toThrow();
});

/**
 * PRODUCTION IS THE ONLY BRAKE. D184 removed the Hangar and the fleet ceiling with
 * it, so a target bounded by a CAPACITY was measuring a wall that no longer exists —
 * and `worldStats` stopped publishing the figure, which is how it surfaced. What
 * bounds a fleet now is what the budget hours can buy, exactly as D184 states.
 */
it('grows the military target with affordable production and retains old hulls without ordering obsolete replacements', () => {
  const owned = { DART: 2, VIPER: 8 }, before = structuredClone(owned);
  const small = designFleetTarget({ alloy: 1000, crystal: 500, deuterium: 30 }, owned, 4, 24);
  const large = designFleetTarget({ alloy: 2500, crystal: 1250, deuterium: 30 }, owned, 4, 24);
  expect(small.DART).toBeUndefined(); expect(small.VIPER).toBeUndefined();
  expect(large.CATACLYSM).toBeGreaterThan(small.CATACLYSM ?? 0);
  expect(owned).toEqual(before);
  expect(designFleetTarget({ alloy: 0, crystal: 0, deuterium: 0 }, owned, 4, 24)).toEqual({});
});

/** No ceiling means MORE production always buys more fleet — there is nothing to hit. */
it('never stops growing the target, however large the production', () => {
  const owned = {};
  const rich = designFleetTarget({ alloy: 250_000, crystal: 125_000, deuterium: 3_000 }, owned, 4, 24);
  const richer = designFleetTarget({ alloy: 500_000, crystal: 250_000, deuterium: 6_000 }, owned, 4, 24);
  expect(richer.CATACLYSM!).toBeGreaterThan(rich.CATACLYSM!);
});

it('prices a recipe from separate resource-hours without an exchange rate', () => {
  expect(designInvoice({ alloy: 100, crystal: 40, deuterium: 5 },
    { alloy: 2, crystal: 3, deuterium: 0 })).toEqual({ alloy: 200, crystal: 120, deuterium: 0 });
  expect(() => designInvoice({ alloy: 100, crystal: 40, deuterium: 5 },
    { alloy: -1, crystal: 3, deuterium: 0 })).toThrow();
});

it('keeps human rhythms and hull recipes fixed while stretching post-opening development', () => {
  const a = designSeason(14), b = designSeason(30);
  expect(b.firstFleetMinutes).toEqual(a.firstFleetMinutes);
  expect(b.worksHours).toBe(12); expect(b.maxResearchSpeed).toBe(1.5);
  expect(b.t3Days[0]).toBeGreaterThan(a.t3Days[0]);
  expect(b.t4Days).toEqual([15, 120 / 7]);
  expect(() => designSeason(0)).toThrow();
  expect(designBuilding('REFINERY', 1, 30)).toEqual(designBuilding('REFINERY', 1, 14));
  expect(designBuilding('REFINERY', 12, 30).cost.alloy).toBeGreaterThan(designBuilding('REFINERY', 12, 14).cost.alloy);
});

it('derives unresearched role flights from the requested roundtrip and caps research at fifty percent speed', () => {
  expect(designRoundTrip(1250, 15, 0)).toBeCloseTo(15, 12);
  expect(designRoundTrip(1250, 25, 0)).toBeCloseTo(25, 12);
  expect(designRoundTrip(1250, 15, 4)).toBeCloseTo(10.055555555555555, 12);
  expect(designRoundTrip(1250, 15, 50)).toBe(designRoundTrip(1250, 15, 4));
});

it('retains real hull identities and roles, including Atlas as cargo rather than a fictional T4 combat ship', () => {
  const before = structuredClone(HULLS);
  for (const id of ALL_HULLS) {
    const h = designHull(id);
    expect(h.id).toBe(id); expect(h.tier).toBe(HULLS[id].tier);
    expect(h.cls).toBe(HULLS[id].cls); expect(h.profile).toBe(HULLS[id].profile);
    expect(h.bulk).toBeGreaterThan(0);
    expect(h.workMinutes).toBeGreaterThan(0);
    for (const key of ['alloy', 'crystal', 'deuterium'] as const) expect(h[key]).toBeGreaterThanOrEqual(0);
  }
  expect(designHull('ATLAS').atk).toBe(0);
  expect(designHull('ATLAS').cargo).toBeGreaterThan(designHull('WAYFARER').cargo);
  expect(HULLS).toEqual(before);
});

it('charges fuel in addition to replacement and exposes the limiting resource', () => {
  const r = designRenewal({ alloy: 100, crystal: 20, deuterium: 5 },
    { alloy: 10, crystal: 10, deuterium: 1 }, 3, 0.2, 10, 0.3);
  expect(r.replacement.alloy).toBeCloseTo(60);
  expect(r.fuel).toBe(30); expect(r.required.deuterium).toBeCloseTo(33);
  expect(r.requiredShare.deuterium).toBeCloseTo(33 / 24);
  expect(r.fits).toBe(false); expect(r.limitingResource).toBe('deuterium');
});

it('generates positive continuous production and legal monotone research invoices for every real project', () => {
  expect(designIncome(0)).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
  for (let level = 1; level <= 20; level++) {
    const a = designIncome(level), b = designIncome(level - 1);
    expect(a.alloy).toBeGreaterThan(b.alloy); expect(a.crystal).toBeGreaterThan(b.crystal);
  }
  for (const p of Object.values(RESEARCH_PROJECTS)) {
    let previous = { alloy: 0, crystal: 0, deuterium: 0 };
    for (let level = 1; level <= p.maxLevel; level++) {
      const q = designResearch(p.id, level, 14);
      for (const k of ['alloy', 'crystal', 'deuterium'] as const) expect(q.cost[k]).toBeGreaterThanOrEqual(previous[k]);
      expect(q.minutes).toBeGreaterThan(0); previous = q.cost;
    }
    expect(() => designResearch(p.id, p.maxLevel + 1, 14)).toThrow();
  }
});

it('uses the actual monthly hull recipes in the isolated model', () => {
  for (const id of Object.keys(HULLS) as (keyof typeof HULLS)[]) expect(designHull(id)).toEqual(profileHull(HULLS[id]));
});
