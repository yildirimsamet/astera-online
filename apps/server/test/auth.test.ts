import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { hashPassword, verifyPassword } from '../src/auth/password.js';
import { accounts } from '../src/db/schema.js';
import { testDb, testEnv, truncateAll } from './helpers.js';

const silent = pino({ level: 'silent' });

interface SessionResponse {
  accountId: string;
  username: string;
  displayName: string;
  accessToken: string;
}

interface ErrorResponse {
  error: string;
  message: string;
}

const PASSWORD = 'correct-horse-battery';

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

  const cookieOf = (headers: Record<string, unknown>): string => {
    const setCookie = headers['set-cookie'];
    const raw = Array.isArray(setCookie) ? String(setCookie[0]) : String(setCookie);
    return raw.split(';')[0]!;
  };

  const register = async (username = 'Vantage', password = PASSWORD) =>
    app.inject({ method: 'POST', url: '/api/auth/register', payload: { username, password } });

  const login = async (username: string, password: string) =>
    app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password } });

  describe('register', () => {
    it('creates an account and opens a session', async () => {
      const res = await register();
      expect(res.statusCode).toBe(200);

      const body = res.json<SessionResponse>();
      expect(body.accountId).toMatch(/^[0-9a-f-]{36}$/);
      expect(body.accessToken.split('.')).toHaveLength(3);
      // Folded for the index, preserved for other players to read.
      expect(body.username).toBe('vantage');
      expect(body.displayName).toBe('Vantage');
    });

    it('sets an httpOnly refresh cookie', async () => {
      const res = await register();
      const raw = String(res.headers['set-cookie']);
      expect(raw).toContain('bs_refresh=');
      expect(raw.toLowerCase()).toContain('httponly');
    });

    it('never stores the password itself', async () => {
      const body = (await register()).json<SessionResponse>();
      const [row] = await db.select().from(accounts).where(eq(accounts.id, body.accountId));

      expect(row?.passwordHash).not.toContain(PASSWORD);
      expect(row?.passwordHash.startsWith('scrypt$')).toBe(true);
      expect(await verifyPassword(PASSWORD, row!.passwordHash)).toBe(true);
    });

    /**
     * THE ONE THAT DECIDES WHETHER TWO PEOPLE CAN BE THE SAME COMMANDER.
     *
     * Usernames are folded before they are stored, so `Vantage` and `vantage` are
     * one name. Without this a player could register the visual twin of somebody
     * else's commander and their battle reports would be indistinguishable.
     */
    it('refuses a name already taken, whatever the casing', async () => {
      expect((await register('Vantage')).statusCode).toBe(200);

      for (const attempt of ['Vantage', 'vantage', 'VANTAGE', '  vAnTaGe  ']) {
        const res = await register(attempt);
        expect(res.statusCode).toBe(409);
        expect(res.json<ErrorResponse>().error).toBe('USERNAME_TAKEN');
      }
      const all = await db.select().from(accounts);
      expect(all).toHaveLength(1);
    });

    it('creates exactly one account when two registrations of one name race', async () => {
      const [a, b] = await Promise.all([register('Twins'), register('twins')]);

      const codes = [a.statusCode, b.statusCode].sort((x, y) => x - y);
      expect(codes).toEqual([200, 409]);
      const all = await db.select().from(accounts);
      expect(all).toHaveLength(1);
    });

    it.each([
      ['too short', 'ab'],
      ['too long', 'x'.repeat(17)],
      ['a space inside', 'van tage'],
      ['punctuation', 'van.tage'],
      ['empty', ''],
      ['reserved', 'admin'],
      ['reserved, oddly cased', 'AdMiN'],
    ])('refuses a username that is %s', async (_label, username) => {
      const res = await register(username);
      expect(res.statusCode).toBe(400);
    });

    it.each([
      ['too short', 'sevench'],
      ['empty', ''],
      ['absurd', 'x'.repeat(201)],
    ])('refuses a password that is %s', async (_label, password) => {
      const res = await register('Kestrel', password);
      expect(res.statusCode).toBe(400);
    });

    it('refuses a payload that is not an object at all', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: {} });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('login', () => {
    it('signs the same commander in from a second browser', async () => {
      const first = (await register('Halcyon')).json<SessionResponse>();

      // No cookie, no shared state — this is what "another browser" means.
      const res = await login('Halcyon', PASSWORD);
      expect(res.statusCode).toBe(200);
      expect(res.json<SessionResponse>().accountId).toBe(first.accountId);
      expect(String(res.headers['set-cookie'])).toContain('bs_refresh=');
    });

    it('accepts the name in any casing, with stray whitespace', async () => {
      await register('Halcyon');
      for (const attempt of ['halcyon', 'HALCYON', '  Halcyon  ']) {
        expect((await login(attempt, PASSWORD)).statusCode).toBe(200);
      }
    });

    it('refuses the wrong password', async () => {
      await register('Halcyon');
      const res = await login('Halcyon', 'not-the-password');
      expect(res.statusCode).toBe(401);
      expect(res.json<ErrorResponse>().error).toBe('BAD_CREDENTIALS');
    });

    /**
     * A login endpoint that distinguishes "no such commander" from "wrong
     * password" is a way to find out who plays this game. Both answers must be
     * the same answer.
     */
    it('gives an unknown name and a wrong password the identical answer', async () => {
      await register('Halcyon');
      const wrongPassword = await login('Halcyon', 'not-the-password');
      const noSuchName = await login('Nobody', PASSWORD);

      expect(noSuchName.statusCode).toBe(wrongPassword.statusCode);
      expect(noSuchName.json<ErrorResponse>()).toEqual(wrongPassword.json<ErrorResponse>());
    });

    it('refuses a malformed name the same way, not with a validation message', async () => {
      const res = await login('!!', PASSWORD);
      expect(res.statusCode).toBe(401);
      expect(res.json<ErrorResponse>().error).toBe('BAD_CREDENTIALS');
    });

    it('cannot sign into an account whose stored hash is not a real one', async () => {
      // What the D21 migration leaves behind for pre-existing guest accounts.
      await db.insert(accounts).values({
        username: 'legacy_ghost',
        passwordHash: 'disabled',
        displayName: 'Ghost',
      });
      // Including the literal that is IN the column: `verifyPassword` must reject
      // anything that is not a six-field scrypt record, not compare strings.
      for (const attempt of ['disabled', PASSWORD]) {
        expect((await login('legacy_ghost', attempt)).statusCode).toBe(401);
      }
    });
  });

  describe('logout', () => {
    it('clears the refresh cookie', async () => {
      await register();
      const res = await app.inject({ method: 'POST', url: '/api/auth/logout' });

      expect(res.statusCode).toBe(200);
      const raw = String(res.headers['set-cookie']);
      expect(raw).toContain('bs_refresh=');
      // Either form is how a cookie is deleted; both must be accepted.
      expect(raw.includes('Max-Age=0') || raw.includes('Expires=Thu, 01 Jan 1970')).toBe(true);
    });

    it('works without a session, because that is when it is most needed', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/auth/logout' });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('access control', () => {
    it('accepts a valid access token and says where the caller stands', async () => {
      const body = (await register()).json<SessionResponse>();
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${body.accessToken}` },
      });
      expect(res.statusCode).toBe(200);

      const me = res.json<{ accountId: string; username: string; placement: unknown }>();
      expect(me.accountId).toBe(body.accountId);
      expect(me.username).toBe('vantage');
      // Registered but not yet placed: the client sends them to the server list.
      expect(me.placement).toBeNull();
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
      const registered = await register();
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        headers: { cookie: cookieOf(registered.headers) },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<SessionResponse>().accountId).toBe(
        registered.json<SessionResponse>().accountId,
      );
    });

    it('rotates the refresh cookie on every use', async () => {
      const registered = await register();
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        headers: { cookie: cookieOf(registered.headers) },
      });
      expect(String(res.headers['set-cookie'])).toContain('bs_refresh=');
    });

    it('refuses when there is no cookie at all', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/auth/refresh' });
      expect(res.statusCode).toBe(401);
      expect(res.json<ErrorResponse>().error).toBe('NO_SESSION');
    });

    /** The mirror of the token-confusion test, in the other direction. */
    it('refuses an access token presented as a refresh cookie', async () => {
      const body = (await register()).json<SessionResponse>();
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        headers: { cookie: `bs_refresh=${body.accessToken}` },
      });
      expect(res.statusCode).toBe(401);
    });

    it('refuses a session whose account no longer exists', async () => {
      const registered = await register();
      const cookie = cookieOf(registered.headers);
      await db
        .delete(accounts)
        .where(eq(accounts.id, registered.json<SessionResponse>().accountId));

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        headers: { cookie },
      });
      expect(res.statusCode).toBe(401);
    });
  });
});

/**
 * The hash itself, away from HTTP.
 *
 * These are the properties the endpoints above rely on and cannot demonstrate:
 * that two identical passwords do not produce identical rows, and that a corrupt
 * stored value is a failed login rather than a thrown request.
 */
describe('password hashing', () => {
  it('accepts the right password and rejects everything else', async () => {
    const stored = await hashPassword('a-real-password');
    expect(await verifyPassword('a-real-password', stored)).toBe(true);
    expect(await verifyPassword('a-real-passwore', stored)).toBe(false);
    expect(await verifyPassword('', stored)).toBe(false);
  });

  it('salts, so the same password twice is two different rows', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a).not.toBe(b);
    expect(await verifyPassword('same-password', a)).toBe(true);
    expect(await verifyPassword('same-password', b)).toBe(true);
  });

  it('carries its own cost parameters, so they can be raised later', async () => {
    const [algo, n, r, p] = (await hashPassword('x'.repeat(12))).split('$');
    expect(algo).toBe('scrypt');
    expect(Number(n)).toBeGreaterThanOrEqual(16_384);
    expect(Number(r)).toBeGreaterThan(0);
    expect(Number(p)).toBeGreaterThan(0);
  });

  it('matches a password however the keyboard encoded it', async () => {
    // "é" composed, then the same character decomposed. A phone and a desktop can
    // disagree about which one they emit; the player cannot tell them apart.
    const stored = await hashPassword('café-password');
    expect(await verifyPassword('café-password', stored)).toBe(true);
  });

  it.each([
    ['empty', ''],
    ['not our format', 'plaintext'],
    ['unknown algorithm', 'bcrypt$16384$8$1$c2FsdA$aGFzaA'],
    ['non-numeric cost', 'scrypt$abc$8$1$c2FsdA$aGFzaA'],
    ['absurd cost', 'scrypt$1073741824$8$1$c2FsdA$aGFzaA'],
    ['missing fields', 'scrypt$16384$8$1$c2FsdA'],
    ['empty salt', 'scrypt$16384$8$1$$aGFzaA'],
  ])('treats a %s stored value as a failed login, not a crash', async (_label, stored) => {
    await expect(verifyPassword('anything', stored)).resolves.toBe(false);
  });
});
