import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/env.js';

/**
 * THE SIGNUP CEILING'S DEFAULT. 2026-09-12, owner instruction: *"3 kat arttır"*.
 *
 * Six an hour per address was catching real players: mobile carriers put many
 * phones behind one public address (CGNAT), so a household or a campus shared one
 * bucket. Tripled to eighteen — still useless to a script taking every seat.
 * `ratelimit.test.ts` holds the behaviour; this holds the number.
 */
describe('signup rate limit default', () => {
  it('allows eighteen accounts an hour per address unless a deployment says otherwise', () => {
    expect(loadEnv({ DATABASE_URL: 'postgres://test' }).RATE_LIMIT_SIGNUP_MAX).toBe(18);
    expect(loadEnv({ DATABASE_URL: 'postgres://test', RATE_LIMIT_SIGNUP_MAX: '4' }).RATE_LIMIT_SIGNUP_MAX).toBe(4);
  });

  /** Doubled the same day, owner: *"onu da 2 katı yap"* — the login bucket is shared behind CGNAT too. */
  it('allows forty logins per ten minutes per address unless a deployment says otherwise', () => {
    expect(loadEnv({ DATABASE_URL: 'postgres://test' }).RATE_LIMIT_AUTH_MAX).toBe(40);
    expect(loadEnv({ DATABASE_URL: 'postgres://test', RATE_LIMIT_AUTH_MAX: '7' }).RATE_LIMIT_AUTH_MAX).toBe(7);
  });
});
