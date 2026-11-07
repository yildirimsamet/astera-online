/**
 * THE SHIP GALAXIES, FROM A SHELL. Plan §7. Dry-run unless `--yes`; there is no route to any of this.
 *
 *   pnpm starter status
 *   pnpm starter bootstrap
 *   pnpm starter land-all [--yes]
 *   STARTER_RESET_CONFIRM=RESET pnpm starter reset [--yes]
 *   CAPACITY_SEED_CONFIRM=ASTERA_STAGING_ONLY CAPACITY_PASSWORD=... pnpm starter seed-capacity --yes --users 200
 */
import { parseArgs } from 'node:util';
import { randomInt } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { COMMUNITY_POLICY_VERSION } from '@astera/rules';
import { hashPassword } from '../auth/password.js';
import { systemClock } from '../clock.js';
import { createDb } from '../db/client.js';
import { accounts, communityPolicyAcceptances, vessels } from '../db/schema.js';
import { loadDotEnv, loadEnv } from '../env.js';
import { starterAdminView } from '../services/starter/admin.js';
import { enlistVessel } from '../services/starter/enlist.js';
import { bootstrapStarterGalaxy, landAllShips, resetStarter } from '../services/starter/ops.js';
import { assertDisposableDatabase } from './capacityGuard.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { yes: { type: 'boolean', default: false }, users: { type: 'string', default: '100' } },
});
const [command] = positionals.filter(word => word !== '--');
loadDotEnv();
const env = loadEnv();
const { db, close } = createDb(env.DATABASE_URL, { max: 4, applicationName: 'astera-starter-cli' });
const say = (body: unknown): void => { console.log(JSON.stringify(body, null, 2)); };

/** In the capacity guard's own pattern, past the range `capacity:seed` uses. */
const shipLogin = (index: number): string => `cap${String(5000 + index)}`;

/** The accounts a `--scenario starter` run logs in as: on a ship from the start, mid-ladder, fleet at home. */
async function seedCapacity(users: number): Promise<void> {
  assertDisposableDatabase(env.DATABASE_URL, { yes: values.yes, confirm: process.env.CAPACITY_SEED_CONFIRM });
  const password = process.env.CAPACITY_PASSWORD;
  if (!password || password.length < 8) throw new Error('CAPACITY_PASSWORD must contain at least 8 characters.');
  const passwordHash = await hashPassword(password);
  const salt = randomInt(1, 1_000_000);
  for (let index = 0; index < users; index += 1) {
    const username = shipLogin(index);
    const [account] = await db.insert(accounts).values({ username, displayName: `Ship ${String(salt)}-${String(index + 1)}`, passwordHash, firstGameShieldAvailable: true })
      .onConflictDoUpdate({ target: accounts.username, set: { passwordHash } }).returning({ id: accounts.id });
    await db.insert(communityPolicyAcceptances).values({ accountId: account!.id, version: COMMUNITY_POLICY_VERSION, locale: 'en', acceptedAt: systemClock.now() }).onConflictDoNothing();
    await enlistVessel(db, account!.id, systemClock);
  }
  const seeded = await db.select({ id: accounts.id }).from(accounts).where(inArray(accounts.username, Array.from({ length: users }, (_, index) => shipLogin(index))));
  for (const { id } of seeded) {
    await db.update(vessels).set({ modules: { REFINERY: 3, EXTRACTOR: 2, SURVEY: 2, SHIPYARD: 1, HANGAR: 1 }, alloy: 5000, crystal: 5000, deuterium: 200 }).where(eq(vessels.accountId, id));
  }
  say({ seeded: seeded.length });
}

try {
  switch (command) {
    case 'status': say(await starterAdminView(db, systemClock)); break;
    case 'bootstrap': say(await bootstrapStarterGalaxy(db, systemClock)); break;
    case 'land-all': {
      const result = await landAllShips(db, systemClock, { apply: values.yes });
      say({ ...result, dryRun: !values.yes });
      if (result.failed.length > 0) process.exitCode = 1;
      break;
    }
    case 'reset': {
      if (values.yes && process.env.STARTER_RESET_CONFIRM !== 'RESET') throw new Error('Set STARTER_RESET_CONFIRM=RESET: this deletes every ship.');
      say({ ...await resetStarter(db, { apply: values.yes }), dryRun: !values.yes });
      break;
    }
    case 'seed-capacity': await seedCapacity(Number(values.users)); break;
    default: throw new Error('Usage: starter status | bootstrap | land-all [--yes] | reset [--yes] | seed-capacity --yes --users N');
  }
} finally {
  await close();
}
