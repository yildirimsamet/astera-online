import { describe, expect, it } from 'vitest';
import type { MiningFieldView, MiningStatusView } from '../src/api/schemas.js';
import { mergeMiningViews, miningSceneData } from '../src/api/queries.js';

const field: MiningFieldView = {
  asteroids: [{
    id: 'mJt7YvxMZEC5S7yYQ32SYw',
    level: 2,
    ore: 1000,
    oreRemaining: 900,
    crystalShare: 0.2,
    radius: 100,
    period: 10,
    phase: 0,
    inclination: Math.PI / 3,
    ascendingNode: Math.PI / 4,
    speed: 1,
    appearsAt: 0,
    expiresAt: 20,
    active: true,
    isotopeRich: false,
    deuteriumShare: null,
  }],
  debris: [],
  nextFieldChangeAt: new Date('2026-01-01T00:05:00.000Z'),
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
  it('keeps the successfully loaded field visible when private status is unavailable', () => {
    expect(miningSceneData(field, undefined)).toEqual({
      asteroids: field.asteroids,
      debris: field.debris,
      runs: [],
      mining: undefined,
    });
  });

  it('keeps owned runs visible when the shared field is temporarily unavailable', () => {
    expect(miningSceneData(undefined, status)).toEqual({
      asteroids: [],
      debris: [],
      runs: status.runs,
      mining: undefined,
    });
  });

  it('keeps isotope detail absent without private entitlement', () => {
    expect(mergeMiningViews(field, status)?.asteroids[0]).toMatchObject({
      isotopeRich: false,
      deuteriumShare: null,
    });
  });

  it('keeps a publicly visible anomaly marked while its composition stays private', () => {
    const anomalyField: MiningFieldView = {
      ...field,
      asteroids: [{ ...field.asteroids[0]!, isotopeRich: true, deuteriumShare: null }],
    };
    expect(mergeMiningViews(anomalyField, status)?.asteroids[0]).toMatchObject({
      isotopeRich: true,
      deuteriumShare: null,
    });
  });

  it('adds only the isotope rows authorised by the private response', () => {
    const merged = mergeMiningViews(field, {
      ...status,
      isotopes: [{ id: 'mJt7YvxMZEC5S7yYQ32SYw', deuteriumShare: 0.11 }],
    });
    expect(merged?.asteroids[0]).toMatchObject({
      isotopeRich: true,
      deuteriumShare: 0.11,
    });
  });

  it('never joins isotope knowledge from another hidden asteroid', () => {
    const merged = mergeMiningViews(field, {
      ...status,
      isotopes: [{ id: 'aT0TallyDifferentOpaque', deuteriumShare: 0.25 }],
    });
    expect(merged?.asteroids[0]).toMatchObject({
      isotopeRich: false,
      deuteriumShare: null,
    });
  });

  it('preserves the server-defined next field change', () => {
    expect(mergeMiningViews(field, status)?.nextFieldChangeAt)
      .toEqual(new Date('2026-01-01T00:05:00.000Z'));
  });
});
