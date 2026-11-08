import { expect, it } from 'vitest';
import { analyticsPropertiesSchema, analyticsEventSchema } from '../src/api/analyticsSchemas.js';
import { starterFunnelSchema } from '../src/api/adminSchemas.js';
import { analyticsAdminSchema } from '../src/api/analyticsAdminSchemas.js';
it('accepts starter scene ids without stretching the FlightSchool step range', () => {
  expect(analyticsPropertiesSchema.parse({ trainingVersion: 'starter-tutorial.v1', scene: 'orderExtractor3' })).toEqual({ trainingVersion: 'starter-tutorial.v1', scene: 'orderExtractor3' });
  expect(analyticsPropertiesSchema.safeParse({ step: 12 }).success).toBe(false);
  expect(analyticsEventSchema.shape.name.safeParse('training_scene_visible').success).toBe(true);
});
it('validates starter funnel counts and scene dropoff', () => {
  const report = { accounts: 2, sessions: 3, returnedAccounts: 1, steps: [{ scene: 'mine', accounts: 1, dropoff: 1 }], push: { asked: 1, granted: 1, denied: 0 }, crates: { accounts: 1, opened: 2 },
    chain: { accepted: 2, resolved: 2, viewed: 1, decided: 1 }, mining: { returned: 2, gained: 1, wasted: 1 } };
  expect(starterFunnelSchema.parse(report)).toEqual(report);
  expect(starterFunnelSchema.safeParse({ ...report, sessions: -1 }).success).toBe(false);
  expect(starterFunnelSchema.safeParse({ ...report, chain: { ...report.chain, viewed: 0.5 } }).success).toBe(false);
});
it('validates the sign-up cohort the admin report carries', () => {
  const window = { mature: 3, returned: 2, pending: 0 };
  const signups = { accounts: 4, measured: 3, d1: window, d3: window, d7: window };
  expect(analyticsAdminSchema.shape.signups.parse(signups)).toEqual(signups);
  expect(analyticsAdminSchema.shape.signups.safeParse({ ...signups, measured: -1 }).success).toBe(false);
});
