import { randomUUID } from 'node:crypto';
import { COMMUNITY_POLICY_VERSION } from '@astera/rules';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { accounts, communityPolicyAcceptances } from '../src/db/schema.js';
import { seedWorld, testEnv, type Fixture } from './helpers.js';

export const TOKENS = new TokenService('test-secret-that-is-long-enough', 15, 30);

/** A person who has never played: unlike `makeAccount`, no first season is on record. */
export async function freshAccount(f: Fixture, name = 'Newcomer'): Promise<{ id: string; username: string; token: string }> {
  const username = `${name.toLowerCase()}_${randomUUID().slice(0, 8)}`;
  const [account] = await f.db.insert(accounts).values({ username, passwordHash: 'not-a-real-hash', displayName: name, firstGameShieldAvailable: true }).returning();
  await f.db.insert(communityPolicyAcceptances).values({ accountId: account!.id, version: COMMUNITY_POLICY_VERSION, locale: 'en', acceptedAt: f.clock.now() });
  return { id: account!.id, username, token: await TOKENS.issueAccess(account!.id) };
}

/** A live main galaxy, one settled commander in it, and the door to the starter galaxy open. */
export async function starterWorld(over: Record<string, string> = {}) {
  const f = await seedWorld(1);
  const built = buildApp({
    db: f.db, clock: f.clock, logger: pino({ level: 'silent' }),
    env: testEnv({ STARTER_GALAXY_ENABLED: 'true', ...over }),
  });
  await built.app.ready();
  return { f, built, app: built.app };
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

export const accountRow = async (f: Fixture, id: string) =>
  (await f.db.select().from(accounts).where(eq(accounts.id, id)))[0]!;
