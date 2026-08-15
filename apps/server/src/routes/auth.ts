import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { accounts } from '../db/schema.js';
import { GameError } from '../services/planet.js';

const REFRESH_COOKIE = 'bs_refresh';

const guestBody = z.object({
  displayName: z.string().trim().min(1).max(24).optional(),
});

/** A pool of names so a guest arrives already feeling like somebody. */
const CALLSIGNS = [
  'Vantage', 'Kestrel', 'Quillon', 'Bellwether', 'Orrery', 'Cinder',
  'Lodestar', 'Halcyon', 'Vesper', 'Thistle', 'Marrow', 'Tessellate',
];

export function registerAuthRoutes(app: FastifyInstance): void {
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
   * Create an account with no form to fill in.
   *
   * Idempotency is intentionally NOT applied here: every call is meant to mint a
   * fresh guest. Clients hold the refresh cookie to come back to the same one.
   */
  app.post('/api/auth/guest', async (req, reply) => {
    const body = guestBody.parse(req.body ?? {});
    const name =
      body.displayName ??
      `${CALLSIGNS[Math.floor(Math.random() * CALLSIGNS.length)]!}-${Math.floor(Math.random() * 900 + 100)}`;

    const [account] = await app.db.insert(accounts).values({ displayName: name }).returning();

    const [access, refresh] = await Promise.all([
      app.tokens.issueAccess(account!.id),
      app.tokens.issueRefresh(account!.id),
    ]);
    setRefresh(reply, refresh, 30);
    return { accountId: account!.id, displayName: account!.displayName, accessToken: access };
  });

  /** Exchange the long-lived cookie for a fresh access token. */
  app.post('/api/auth/refresh', async (req, reply) => {
    const cookie = req.cookies[REFRESH_COOKIE];
    if (!cookie) throw new GameError('NO_SESSION', 'No session cookie', 401);

    let accountId: string;
    try {
      accountId = await app.tokens.verify(cookie, 'refresh');
    } catch {
      throw new GameError('BAD_SESSION', 'Session is invalid or expired', 401);
    }

    const [account] = await app.db.select().from(accounts).where(eq(accounts.id, accountId));
    if (!account) throw new GameError('BAD_SESSION', 'Session is invalid or expired', 401);

    const [access, refresh] = await Promise.all([
      app.tokens.issueAccess(accountId),
      app.tokens.issueRefresh(accountId),
    ]);
    setRefresh(reply, refresh, 30);
    return { accountId, displayName: account.displayName, accessToken: access };
  });

  app.get('/api/auth/me', { preHandler: requireAuth }, async (req) => {
    const [account] = await app.db
      .select()
      .from(accounts)
      .where(eq(accounts.id, req.accountId!));
    if (!account) throw new GameError('BAD_SESSION', 'Session is invalid', 401);
    return { accountId: account.id, displayName: account.displayName };
  });
}

/**
 * Require a valid access token.
 *
 * Refresh tokens are rejected here by the `typ` check inside `verify` — without
 * that, a thirty-day cookie would double as an API credential.
 */
export async function requireAuth(req: FastifyRequest): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new GameError('UNAUTHENTICATED', 'Sign in first', 401);
  }
  try {
    req.accountId = await req.server.tokens.verify(header.slice(7), 'access');
  } catch {
    throw new GameError('UNAUTHENTICATED', 'Sign in first', 401);
  }
}
