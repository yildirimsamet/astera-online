import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/env.js';

const base = {
  DATABASE_URL: 'postgres://test/arena_test',
  JWT_SECRET: 'test-secret-that-is-long-enough',
};

describe('arena feature flags', () => {
  it('keeps the arena and development tools disabled by default', () => {
    expect(loadEnv(base)).toMatchObject({ ARENA_ENABLED: false, ARENA_DEV: false });
  });

  it.each(['ARENA_ENABLED', 'ARENA_DEV'])('parses %s explicitly instead of coercing the string false', (key) => {
    expect(loadEnv({ ...base, [key]: 'false' })).toMatchObject({ [key]: false });
    expect(loadEnv({ ...base, [key]: 'true' })).toMatchObject({ [key]: true });
  });

  it.each(['1', 'yes', '', 'FALSE'])('rejects the malformed boolean %j', (value) => {
    expect(() => loadEnv({ ...base, ARENA_ENABLED: value })).toThrow(/ARENA_ENABLED/);
    expect(() => loadEnv({ ...base, ARENA_DEV: value })).toThrow(/ARENA_DEV/);
  });

  it('refuses development tools in a production process', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production', ARENA_DEV: 'true' }))
      .toThrow(/ARENA_DEV.*production/);
  });

  it('reads the arena pilot list as canonical usernames, empty by default', () => {
    expect(loadEnv(base).ARENA_PILOTS).toEqual([]);
    expect(loadEnv({ ...base, ARENA_PILOTS: ' Alice, bob ,,' }).ARENA_PILOTS).toEqual(['alice', 'bob']);
    expect(loadEnv({ ...base, ARENA_PILOTS: '*' }).ARENA_PILOTS).toEqual(['*']);
  });

  it('accepts the separate arena process role next to the existing ones', () => {
    for (const ROLE of ['api', 'worker', 'both', 'arena']) {
      expect(loadEnv({ ...base, ROLE }).ROLE).toBe(ROLE);
    }
    expect(() => loadEnv({ ...base, ROLE: 'socket' })).toThrow(/ROLE/);
  });
});
