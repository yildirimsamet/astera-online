import { describe, expect, it } from 'vitest';
import {
  STARTER,
  asteroidTargetPerHour,
  distance,
  fleetCount,
  starterSitePlan,
  starterSlots,
} from '../src/index.js';

describe('the shared sites', () => {
  const plan = starterSitePlan(11, starterSlots(11));
  const wrecks = plan.filter(s => s.kind === 'WRECK');
  const outposts = plan.filter(s => s.kind === 'OUTPOST');

  it('lays out the agreed numbers', () => {
    expect(wrecks.length).toBe(STARTER.sites.wrecks.count);
    expect(outposts.length).toBe(STARTER.sites.outposts.count);
  });

  it('fills each wreck inside its range', () => {
    const [low, high] = STARTER.sites.wrecks.stock;
    for (const wreck of wrecks) {
      expect(wreck.stock).toBeGreaterThanOrEqual(low);
      expect(wreck.stock).toBeLessThanOrEqual(high);
      expect(wreck.guard).toBeNull();
    }
  });

  it('guards each outpost by its level, with a different class among them', () => {
    for (const outpost of outposts) {
      expect(fleetCount(outpost.guard!)).toBe(STARTER.sites.outposts.guards[outpost.level - 1]);
    }
    expect(new Set(outposts.flatMap(o => Object.keys(o.guard!))).size).toBeGreaterThan(1);
    expect(new Set(outposts.map(o => o.level))).toEqual(new Set([1, 2, 3]));
  });

  it('pays more behind a stronger guard', () => {
    for (const outpost of outposts) expect(outpost.stock).toBe(STARTER.sites.outposts.stock[outpost.level - 1]);
    const [one, two, three] = STARTER.sites.outposts.stock;
    expect(one).toBeLessThan(two);
    expect(two).toBeLessThan(three);
  });

  it('stays inside the galaxy, clear of the berths and of each other', () => {
    const slots = starterSlots(11);
    for (const site of plan) {
      expect(Math.hypot(site.x, site.y, site.z)).toBeLessThanOrEqual(STARTER.radius);
      for (const slot of slots) expect(distance(site, slot)).toBeGreaterThan(STARTER.nakedEye / 2);
      for (const other of plan) if (other !== site) expect(distance(site, other)).toBeGreaterThan(STARTER.nakedEye);
    }
  });

  it('is the same for the same seed', () => {
    expect(starterSitePlan(11, starterSlots(11))).toEqual(plan);
  });
});

describe('asteroid supply', () => {
  it('grows with active ships, half a rock each per hour', () => {
    expect(asteroidTargetPerHour(0)).toBe(0);
    expect(asteroidTargetPerHour(1)).toBe(1);
    expect(asteroidTargetPerHour(10)).toBe(5);
    expect(asteroidTargetPerHour(11)).toBe(6);
  });
});
