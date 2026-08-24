import { describe, expect, it } from 'vitest';
import type { MiningFieldView, MiningStatusView } from '../src/api/schemas.js';
import { mergeMiningViews } from '../src/api/queries.js';

const field: MiningFieldView = {
  asteroids: [{
    index: 7,
    level: 2,
    ore: 1000,
    oreRemaining: 900,
    crystalShare: 0.2,
    radius: 100,
    period: 10,
    phase: 0,
    y: 0,
    speed: 1,
    appearsAt: 0,
    expiresAt: 20,
    active: true,
    isotopeRich: false,
    deuteriumShare: null,
  }],
  debris: [],
};

const status: MiningStatusView = {
  derrick: false,
  craftSpeed: 330,
  craftHold: 100,
  derrickHold: 150,
  runs: [],
  isotopes: [],
};

describe('split mining view', () => {
  it('keeps isotope detail absent without private entitlement', () => {
    expect(mergeMiningViews(field, status)?.asteroids[0]).toMatchObject({
      isotopeRich: false,
      deuteriumShare: null,
    });
  });

  it('adds only the isotope rows authorised by the private response', () => {
    const merged = mergeMiningViews(field, {
      ...status,
      isotopes: [{ index: 7, deuteriumShare: 0.11 }],
    });
    expect(merged?.asteroids[0]).toMatchObject({
      isotopeRich: true,
      deuteriumShare: 0.11,
    });
  });
});
