import { expect, it } from 'vitest';
import { loadEnv } from '../src/env.js';

const base = { DATABASE_URL: 'postgres://test' };

it('keeps the placement pool at two connections unless explicitly configured', () => {
  expect(loadEnv(base).PLACEMENT_POOL_MAX).toBe(2);
  expect(loadEnv({ ...base, PLACEMENT_POOL_MAX: '3' }).PLACEMENT_POOL_MAX).toBe(3);
  expect(loadEnv({ ...base, PLACEMENT_POOL_MAX: '1' }).PLACEMENT_POOL_MAX).toBe(1);
});

it.each(['0', '-1', '1.5', '51', 'NaN', ''])('rejects an invalid placement pool budget: %s', value => {
  expect(() => loadEnv({ ...base, PLACEMENT_POOL_MAX: value })).toThrow(/PLACEMENT_POOL_MAX/);
});
