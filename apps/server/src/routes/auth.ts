import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { loginBody, registerBody } from '../auth/credentials.js';
import { authenticate, findAccount, registerAccount } from '../services/account.js';
import { currentPlacement } from '../services/servers.js';
import { GameError } from '../services/planet.js';

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
  account: { id: string; username: string; displayName: string },
): Promise<{
  accountId: string;
  username: string;
  displayName: string;
  accessToken: string;
}> {
  const [access, refresh] = await Promise.all([
    app.tokens.issueAccess(account.id),
    app.tokens.issueRefresh(account.id),
  ]);
  setRefresh(reply, refresh, app.tokens.refreshDays);
  return {
    accountId: account.id,
    username: account.username,
    displayName: account.displayName,
    accessToken: access,
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
 * Short access token in memory, long refresh token in an httpOnly cookie. Both
 * stateless, no session store.
 */
export function registerAuthRoutes(app: FastifyInstance): void {
  /**
   * REGISTERING IS RATE-LIMITED AS A SIGNUP, NOT AS A LOGIN.
   *
   * It does not take a seat on its own — joining a galaxy is a separate,
   * authenticated call — but it is still the cheapest way to manufacture the
   * accounts that would then take them, and it burns a full scrypt doing it.
   */
  app.post('/api/auth/register', { config: { rateLimit: app.limits.signup } }, async (req, reply) => {
    const body = registerBody.parse(req.body ?? {});
    const account = await registerAccount(app.db, body);
    return openSession(app, reply, account);
  });

  /**
   * THE BRUTE-FORCE SURFACE, AND THE EXPENSIVE ONE.
   *
   * There is no lockout anywhere else in the system and these tokens are
   * stateless, so this ceiling is the whole of the defence against someone
   * working through a password list. It is also the only route where a refusal
   * costs the server as much as an acceptance — see `authenticate`, which hashes
   * a decoy for a name that does not exist so that the two cannot be told apart
   * by a stopwatch.
   */
  app.post('/api/auth/login', { config: { rateLimit: app.limits.auth } }, async (req, reply) => {
    const body = loginBody.parse(req.body ?? {});
    const account = await authenticate(app.db, body);
    return openSession(app, reply, account);
  });

  /**
   * Sign out.
   *
   * Clears the cookie, which is the whole of it: the access token is in the tab's
   * memory and dies with the page. The refresh token itself stays cryptographically
   * valid until it expires — these are stateless JWTs and there is no revocation
   * list. That is a KNOWN LIMITATION, not an oversight: a copy already stolen off
   * the wire is not recovered by asking the browser to forget its own, and a
   * revocation table is a session store, which is what statelessness bought us.
   * It becomes worth building the moment accounts hold anything but a season.
   *
   * Public on purpose. Signing out must work when the access token has already
   * expired, which is precisely when a player is most likely to be trying.
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

    let accountId: string;
    try {
      accountId = await app.tokens.verify(cookie, 'refresh');
    } catch {
      throw new GameError('BAD_SESSION', 'Session is invalid or expired', 401);
    }

    const account = await findAccount(app.db, accountId);
    // A token for an account that no longer exists — a wiped test database, a
    // deleted account — is a dead session, not a server fault.
    if (!account) throw new GameError('BAD_SESSION', 'Session is invalid or expired', 401);

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

    const placement = await currentPlacement(app.db, account.id);
    return {
      accountId: account.id,
      username: account.username,
      displayName: account.displayName,
      placement: placement
        ? {
            shard: placement.shardCode,
            shardName: placement.shardName,
            planetName: placement.planetName,
          }
        : null,
    };
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
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new GameError('UNAUTHENTICATED', 'Sign in first', 401);
  }
  let accountId: string;
  try {
    accountId = await req.server.tokens.verify(header.slice(7), 'access');
  } catch {
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
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return;
  try {
    req.accountId = await req.server.tokens.verify(header.slice(7), 'access');
  } catch {
    // An expired token on a public route is not an error. The caller simply gets
    // the anonymous answer, and the client's refresh path handles the rest.
    return;
  }
  await req.server.presence.touch(req.accountId);
}
