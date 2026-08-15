import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { accounts } from '../src/db/schema.js';
import { testDb, testEnv, truncateAll } from './helpers.js';

const silent = pino({ level: 'silent' });

interface GuestResponse {
  accountId: string;
  displayName: string;
  accessToken: string;
}

// The database pool is shared across this whole file, so it is torn down at FILE
// scope. An afterAll inside a describe would close it out from under any describe
// that follows.
afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('auth', () => {
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let db: Awaited<ReturnType<typeof testDb>>['db'];

  beforeEach(async () => {
    ({ db } = await testDb());
    await truncateAll(db);
    const built = buildApp({ env: testEnv(), logger: silent, db });
    app = built.app;
    close = built.close;
    await app.ready();
  });

  afterEach(async () => {
    await close();
  });


  const guest = async (): Promise<{ body: GuestResponse; cookie: string }> => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/guest', payload: {} });
    expect(res.statusCode).toBe(200);
    const setCookie = res.headers['set-cookie'];
    const raw = Array.isArray(setCookie) ? setCookie[0]! : String(setCookie);
    return { body: res.json<GuestResponse>(), cookie: raw.split(';')[0]! };
  };

  describe('guest sign-in', () => {
    it('creates an account with no form to fill in', async () => {
      const { body } = await guest();
      expect(body.accountId).toMatch(/^[0-9a-f-]{36}$/);
      expect(body.accessToken.split('.')).toHaveLength(3);
      expect(body.displayName.length).toBeGreaterThan(0);
    });

    it('sets an httpOnly refresh cookie', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/auth/guest', payload: {} });
      const raw = String(res.headers['set-cookie']);
      expect(raw).toContain('bs_refresh=');
      expect(raw.toLowerCase()).toContain('httponly');
    });

    it('mints a distinct account every time', async () => {
      const a = await guest();
      const b = await guest();
      expect(a.body.accountId).not.toBe(b.body.accountId);
    });

    it('accepts a chosen display name', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/guest',
        payload: { displayName: '  Vex  ' },
      });
      expect(res.json<GuestResponse>().displayName).toBe('Vex');
    });

    it('rejects an empty or oversized display name', async () => {
      for (const displayName of ['', '   ', 'x'.repeat(25)]) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/auth/guest',
          payload: { displayName },
        });
        expect(res.statusCode).toBe(400);
      }
    });
  });

  describe('access control', () => {
    it('accepts a valid access token', async () => {
      const { body } = await guest();
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${body.accessToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ accountId: string }>().accountId).toBe(body.accountId);
    });

    /**
     * THE ONE THAT MATTERS. A refresh token lives in a cookie for thirty days.
     * Without the `typ` check inside verify(), it would double as an API
     * credential — anyone who got the cookie would have a month of API access.
     */
    it('refuses a refresh token used as an access token', async () => {
      const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
      const refresh = await tokens.issueRefresh('11111111-1111-1111-1111-111111111111');

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${refresh}` },
      });
      expect(res.statusCode).toBe(401);
    });

    it('refuses a token signed with a different secret', async () => {
      const foreign = new TokenService('a-completely-different-secret-xx', 15, 30);
      const forged = await foreign.issueAccess('11111111-1111-1111-1111-111111111111');

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${forged}` },
      });
      expect(res.statusCode).toBe(401);
    });

    it('refuses an expired token', async () => {
      const shortLived = new TokenService('test-secret-that-is-long-enough', -1, 30);
      const stale = await shortLived.issueAccess('11111111-1111-1111-1111-111111111111');

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${stale}` },
      });
      expect(res.statusCode).toBe(401);
    });

    it.each([
      ['missing header', undefined],
      ['no Bearer prefix', 'abc.def.ghi'],
      ['empty bearer', 'Bearer '],
      ['garbage', 'Bearer not-a-jwt'],
      ['wrong scheme', 'Basic abc'],
    ])('refuses %s', async (_label, authorization) => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        ...(authorization ? { headers: { authorization } } : {}),
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('refresh', () => {
    it('exchanges the cookie for a fresh access token', async () => {
      const { cookie, body } = await guest();
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        headers: { cookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<GuestResponse>().accountId).toBe(body.accountId);
    });

    it('rotates the refresh cookie on every use', async () => {
      const { cookie } = await guest();
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        headers: { cookie },
      });
      expect(String(res.headers['set-cookie'])).toContain('bs_refresh=');
    });

    it('refuses when there is no cookie at all', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/auth/refresh' });
      expect(res.statusCode).toBe(401);
      expect(res.json<{ error: string }>().error).toBe('NO_SESSION');
    });

    /** The mirror of the token-confusion test, in the other direction. */
    it('refuses an access token presented as a refresh cookie', async () => {
      const { body } = await guest();
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        headers: { cookie: `bs_refresh=${body.accessToken}` },
      });
      expect(res.statusCode).toBe(401);
    });

    it('refuses a session whose account no longer exists', async () => {
      const { cookie, body } = await guest();
      await db.delete(accounts).where(eq(accounts.id, body.accountId));

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        headers: { cookie },
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
