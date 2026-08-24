import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { testDb, testEnv, truncateAll } from './helpers.js';

/**
 * A CEILING ON WHAT ONE ADDRESS CAN ASK FOR.
 *
 * The rest of the suite raises these ceilings out of the way (see `testEnv`)
 * because `inject` gives every request the same address and a real ceiling would
 * fail whole files on 429s that have nothing to do with what they test. This file
 * lowers them back to real numbers, because the ceilings exist to stop two very
 * specific things and neither is hypothetical:
 *
 *   · A PASSWORD LIST. Sessions are stateless JWTs and there is no lockout
 *     anywhere else in the system, so the login ceiling IS the defence.
 *   · A SCRIPT TAKING EVERY SEAT. `/api/onboarding/claim` is unauthenticated and
 *     hands out a world in the frontier galaxy. Fifty of those and the only
 *     mitigation the empty-shard risk has is spent.
 */

const silent = pino({ level: 'silent' });

interface ErrorResponse {
  error: string;
  message: string;
  params?: Record<string, number>;
}

const PASSWORD = 'correct-horse-battery';

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('rate limiting', () => {
  let app: FastifyInstance;
  let close: () => Promise<void>;

  const build = async (over: Record<string, string>): Promise<void> => {
    const { db } = await testDb();
    await truncateAll(db);
    const built = buildApp({ env: testEnv(over), logger: silent, db });
    app = built.app;
    close = built.close;
    await app.ready();
  };

  afterEach(async () => {
    await close();
  });

  it('refuses a login once the address has spent its attempts', async () => {
    await build({ RATE_LIMIT_AUTH_MAX: '3' });

    const attempt = (): Promise<LightMyRequestResponse> =>
      app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'nobody', password: PASSWORD },
      });

    // Three wrong passwords are answered as wrong passwords.
    for (let i = 0; i < 3; i++) {
      const res = await attempt();
      expect(res.statusCode).toBe(401);
      expect(res.json<ErrorResponse>().error).toBe('BAD_CREDENTIALS');
    }

    const blocked = await attempt();
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json<ErrorResponse>().error).toBe('RATE_LIMITED');
  });

  /**
   * THE REFUSAL IS SHAPED LIKE EVERY OTHER REFUSAL.
   *
   * The plugin's own body says `error: 'Too Many Requests'`, which the client
   * would read as a machine code and show verbatim — in English, whatever the
   * player reads the game in. A stable code plus the figure the sentence was made
   * from is what `i18n/errors.ts` can say again in Turkish (D55).
   */
  it('answers with a game error code and the seconds to wait', async () => {
    await build({ RATE_LIMIT_AUTH_MAX: '1' });

    await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'nobody', password: PASSWORD },
    });
    const blocked = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'nobody', password: PASSWORD },
    });

    const body = blocked.json<ErrorResponse>();
    expect(body.error).toBe('RATE_LIMITED');
    expect(body.message).not.toContain('Too Many Requests');
    // A figure, not a finished sentence — the client interpolates it.
    expect(body.params?.seconds).toBeGreaterThan(0);
  });

  it('stops one address from taking every seat in the galaxy', async () => {
    await build({ RATE_LIMIT_SIGNUP_MAX: '2' });

    const claim = (name: string): Promise<LightMyRequestResponse> =>
      app.inject({
        method: 'POST',
        url: '/api/onboarding/claim',
        payload: { username: name, password: PASSWORD, intents: [] },
      });

    // Nothing is bootstrapped in this fixture, so the claim itself refuses with
    // NO_FRONTIER — which is the point: the ceiling is counted before the route
    // decides anything, so it holds whether or not a galaxy is open.
    const first = await claim('claimer_one');
    const second = await claim('claimer_two');
    expect(first.statusCode).not.toBe(429);
    expect(second.statusCode).not.toBe(429);

    const third = await claim('claimer_three');
    expect(third.statusCode).toBe(429);
    expect(third.json<ErrorResponse>().error).toBe('RATE_LIMITED');
  });

  /**
   * THE BUCKETS ARE PER ROUTE, and they have to be. One shared counter would mean
   * a player who mistyped a password twice could no longer create an account, and
   * an hour-long signup window would silently become the login window too.
   */
  it('counts signing in and signing up separately', async () => {
    await build({ RATE_LIMIT_AUTH_MAX: '1', RATE_LIMIT_SIGNUP_MAX: '1' });

    await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'nobody', password: PASSWORD },
    });
    const loginBlocked = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'nobody', password: PASSWORD },
    });
    expect(loginBlocked.statusCode).toBe(429);

    // The login bucket is empty; registering must still be possible.
    const register = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'fresh_name', password: PASSWORD },
    });
    expect(register.statusCode).toBe(200);
  });

  /**
   * HEALTH IS EXEMPT, and that is an operational decision rather than a
   * convenience: an uptime monitor and a container healthcheck both call it on a
   * fixed cadence, and a 429 there does not read as "slow down" — it reads as an
   * outage, which is the one alarm this endpoint has to be trusted for.
   */
  it('never rate-limits the health check', async () => {
    await build({ RATE_LIMIT_MAX: '2' });

    for (let i = 0; i < 6; i++) {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
    }
  });

  it('takes an API replica out of health while its LISTEN channel is down', async () => {
    await build({ ROLE: 'api' });

    const down = await app.inject({ method: 'GET', url: '/health' });
    expect(down.statusCode).toBe(503);
    expect(down.json<{ ok: boolean; checks: { stream: string } }>()).toMatchObject({
      ok: false,
      checks: { stream: 'not listening' },
    });

    await app.bus.start();
    const up = await app.inject({ method: 'GET', url: '/health' });
    expect(up.statusCode).toBe(200);
    expect(up.json<{ checks: { stream: string } }>().checks.stream).toBe('ok');
    const metrics = await app.inject({ method: 'GET', url: '/metrics' });
    expect(metrics.statusCode).toBe(200);
    const metricBody = metrics.json<{
      service: { role: string };
      host: { cpu: { cores: number; idleMilliseconds: number; totalMilliseconds: number } };
      runtime: { instanceId: string };
    }>();
    expect(metricBody.service.role).toBe('api');
    expect(metricBody.host.cpu.cores).toBeGreaterThan(0);
    expect(metricBody.host.cpu.totalMilliseconds).toBeGreaterThan(
      metricBody.host.cpu.idleMilliseconds,
    );
    expect(metricBody.runtime.instanceId).toMatch(/^[0-9a-f-]{36}$/);

    const originalRateLimitStatus = app.rateLimitBackend.status.bind(app.rateLimitBackend);
    app.rateLimitBackend.status = () => ({ mode: 'shared', status: 'reconnecting' });
    const limiterDown = await app.inject({ method: 'GET', url: '/health' });
    expect(limiterDown.statusCode).toBe(503);
    expect(limiterDown.json<{ checks: { rateLimit: { status: string } } }>()
      .checks.rateLimit.status).toBe('reconnecting');
    app.rateLimitBackend.status = originalRateLimitStatus;

    await app.bus.stop();
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(503);
  });

  /**
   * THE GLOBAL CEILING IS A NET UNDER EVERYTHING ELSE, so it has to apply to the
   * ordinary public routes too — the ones with no strict bucket of their own.
   */
  it('applies the global ceiling to the routes with no bucket of their own', async () => {
    await build({ RATE_LIMIT_MAX: '2' });

    expect((await app.inject({ method: 'GET', url: '/api/servers' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/servers' })).statusCode).toBe(200);

    const blocked = await app.inject({ method: 'GET', url: '/api/servers' });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json<ErrorResponse>().error).toBe('RATE_LIMITED');
  });
});
