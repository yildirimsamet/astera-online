import { describe, expect, it } from 'vitest';
import { ARENA_MAX_SEATS } from '@astera/rules/arena';
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

  // Owner 2026-10-23: the room took 8 pilots, a limit from the 3-bot prototype; 100 is the
  // headroom over the 48-pilot room the v6 map is sized for.
  it('seats 100 pilots by default, and reads a whole positive seat count', () => {
    expect(loadEnv(base).ARENA_SEATS).toBe(100);
    expect(loadEnv({ ...base, ARENA_SEATS: '8' }).ARENA_SEATS).toBe(8);
    for (const value of ['0', '-3', '2.5', 'many', String(ARENA_MAX_SEATS + 1)]) expect(() => loadEnv({ ...base, ARENA_SEATS: value })).toThrow(/ARENA_SEATS/);
    expect(loadEnv({ ...base, ARENA_SEATS: String(ARENA_MAX_SEATS) }).ARENA_SEATS).toBe(ARENA_MAX_SEATS);
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
