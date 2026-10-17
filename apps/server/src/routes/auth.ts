import { InvalidSessionError } from '../auth/tokens.js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { countryCodeSchema, loginBody, registerBody } from '../auth/credentials.js';
import { authenticate, findAccount, registerAccount } from '../services/account.js';
import { currentPlacement } from '../services/servers.js';
import { latestSeasonResult } from '../services/season.js';
import { GameError } from '../services/planet.js';
import { isAdminAccount } from '../services/admin.js';
import { accounts } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import type { CountryCode } from '@astera/rules';

const REFRESH_COOKIE = 'bs_refresh';

const setRefresh = (reply: FastifyReply, token: string, days: number): void => {
  void reply.setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: days * 24 * 60 * 60,
  });
};

/**
 * Mint both tokens, hang the refresh one on the reply, and describe the session.
 *
 * EXPORTED BECAUSE TWO ROUTES OPEN A SESSION NOW. Registering does, and so does
 * the onboarding claim (D56) — which registers, joins a galaxy and replays an
 * opening in one call, precisely so a player who has just committed does not then
 * watch three round trips before their world appears. A second copy of this would
 * be a second place the cookie's flags can drift from the first.
 */
export async function openSession(
  app: FastifyInstance,
  reply: FastifyReply,
  account: { id: string; username: string; displayName: string; country: CountryCode; authVersion?: number; loginEmail?: string },
): Promise<{
  accountId: string;
  username: string;
  displayName: string;
  country: CountryCode;
  accessToken: string;
  loginEmail?: string;
}> {
  const [access, refresh] = await Promise.all([
    app.tokens.issueAccess(account.id, account.authVersion ?? 0),
    app.tokens.issueRefresh(account.id, account.authVersion ?? 0),
  ]);
  setRefresh(reply, refresh, app.tokens.refreshDays);
  return {
    accountId: account.id,
    username: account.username,
    displayName: account.displayName,
    country: account.country,
    accessToken: access,
    ...(account.loginEmail === undefined ? {} : { loginEmail: account.loginEmail }),
  };
}

/**
 * IDENTITY IS A NAME AND A PASSWORD. D21.
 *
 * The guest door is gone. It existed to satisfy the Return Test — a player looking
 * at their own planet inside sixty seconds — and it bought that at the price of an
 * account that lived in one browser's cookie jar. A season is fourteen days long,
 * and a commander who opens the game on their laptop and finds a stranger's empire
 * has not been given a fast start; they have been given somebody else's game.
 *
 * Short access token in memory, long refresh token in an httpOnly cookie.
 * Account versions fence credential changes without a per-device session store.
 */
export function registerAuthRoutes(app: FastifyInstance, firstGameShieldEnabled = true): void {
  /**
   * REGISTERING IS RATE-LIMITED AS A SIGNUP, NOT AS A LOGIN.
   *
   * It does not take a seat on its own — joining a galaxy is a separate,
   * authenticated call — but it is still the cheapest way to manufacture the
   * accounts that would then take them, and it burns a full scrypt doing it.
   */
  app.post('/api/auth/register', { config: { rateLimit: app.limits.signup } }, async (req, reply) => {
    const body = registerBody.parse(req.body ?? {});
    const account = await registerAccount(app.db, body, firstGameShieldEnabled, app.clock.now());
    return openSession(app, reply, account);
  });

  /**
   * Strict IP budget for password guessing. Missing accounts still run scrypt;
   * email-only accounts reject their public username with the same refusal.
   */
  app.post('/api/auth/login', { config: { rateLimit: app.limits.auth } }, async (req, reply) => {
    const body = loginBody.parse(req.body ?? {});
    const account = await authenticate(app.db, body);
    return openSession(app, reply, account);
  });

  /**
   * Local logout clears this browser's cookie. Account-wide credential changes
   * separately increment authVersion, revoking access and refresh credentials.
   * Public so signing out still works after access expiry.
   */
  app.post('/api/auth/logout', (_req, reply) => {
    void reply.clearCookie(REFRESH_COOKIE, { path: '/' });
    return { ok: true };
  });

  /**
   * Exchange the long-lived cookie for a fresh access token.
   *
   * DELIBERATELY ON THE GLOBAL BUCKET rather than the strict auth one. A failed
   * refresh is a JWT signature check and one indexed lookup — nothing like the
   * scrypt a login pays — and the cost of getting this wrong is asymmetric: a
   * ceiling low enough to matter would sign out a household, an office or anyone
   * behind carrier NAT the moment several people played at once.
   */
  app.post('/api/auth/refresh', async (req, reply) => {
    const cookie = req.cookies[REFRESH_COOKIE];
    if (!cookie) throw new GameError('NO_SESSION', 'No session cookie', 401);

    let identity: { accountId: string; version: number };
    try {
      identity = await app.tokens.identity(cookie, 'refresh');
    } catch (error) {
      if (!(error instanceof InvalidSessionError)) throw error;
      throw new GameError('BAD_SESSION', 'Session is invalid or expired', 401);
    }

    const account = await findAccount(app.db, identity.accountId);
    // A token for an account that no longer exists — a wiped test database, a
    // deleted account — is a dead session, not a server fault.
    if (account?.authVersion !== identity.version) throw new GameError('BAD_SESSION', 'Session is invalid or expired', 401);

    return openSession(app, reply, account);
  });

  /**
   * Who am I, and where am I standing?
   *
   * The placement is here rather than on a second call because it decides which
   * screen the client opens on: a commander with a planet goes to their galaxy, a
   * commander without one goes to the server list. Two round trips to answer one
   * question is a visible flash of the wrong screen on a phone.
   */
  app.get('/api/auth/me', { preHandler: requireAuth }, async (req) => {
    const account = await findAccount(app.db, req.accountId!);
    if (!account) throw new GameError('BAD_SESSION', 'Session is invalid', 401);

    const [placement, latestResult, isAdmin] = await Promise.all([
      currentPlacement(app.db, account.id),
      latestSeasonResult(app.db, account.id),
      isAdminAccount(app.db, account.id, app.adminUsernames),
    ]);
    return {
      accountId: account.id,
      username: account.username,
      displayName: account.displayName,
      country: account.country,
      isAdmin,
      placement: placement
        ? {
            shard: placement.shardCode,
            shardName: placement.shardName,
            planetName: placement.planetName,
          }
        : null,
      latestResult,
    };
  });

  app.put('/api/auth/me/country', { preHandler: requireAuth }, async (req) => {
    const { country } = z.object({ country: countryCodeSchema }).strict().parse(req.body ?? {});
    const [updated] = await app.db
      .update(accounts)
      .set({ countryCode: country })
      .where(eq(accounts.id, req.accountId!))
      .returning({ country: accounts.countryCode });
    if (!updated) throw new GameError('BAD_SESSION', 'Session is invalid', 401);
    return updated;
  });
}

/**
 * Require a valid access token.
 *
 * Refresh tokens are rejected here by the `typ` check inside `verify` — without
 * that, a thirty-day cookie would double as an API credential.
 *
 * This is also the single choke point every authenticated request passes through,
 * which is why presence is stamped here (D21) rather than in a global hook that
 * would also fire for the health check and the login form.
 */
export async function requireAuth(req: FastifyRequest): Promise<void> {
  if (req.accountId && req.authVersion !== undefined) {
    await req.server.presence.touch(req.accountId);
    return;
  }
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new GameError('UNAUTHENTICATED', 'Sign in first', 401);
  }
  let accountId: string;
  try {
    const identity = await req.server.tokens.identity(header.slice(7), 'access');
    accountId = identity.accountId;
    req.authVersion = identity.version;
    req.nativeSessionId = identity.nativeSessionId;
  } catch (error) {
    if (!(error instanceof InvalidSessionError)) throw error;
    throw new GameError('UNAUTHENTICATED', 'Sign in first', 401);
  }
  req.accountId = accountId;
  await req.server.presence.touch(accountId);
}

/**
 * Read the caller's identity if they have one, and carry on if they do not.
 *
 * For the server list, which is public — a player has to be able to see the state
 * of the galaxies before deciding whether this game is worth an account — but
 * which says one extra thing to somebody signed in: which galaxy is already theirs.
 */
export async function optionalAuth(req: FastifyRequest): Promise<void> {
  if (req.accountId && req.authVersion !== undefined) {
    await req.server.presence.touch(req.accountId);
    return;
  }
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return;
  try {
    const identity = await req.server.tokens.identity(header.slice(7), 'access');
    req.accountId = identity.accountId;
    req.authVersion = identity.version;
    req.nativeSessionId = identity.nativeSessionId;
  } catch (error) {
    if (!(error instanceof InvalidSessionError)) throw error;
    // An expired token on a public route is not an error. The caller simply gets
    // the anonymous answer, and the client's refresh path handles the rest.
    return;
  }
  await req.server.presence.touch(req.accountId);
}
