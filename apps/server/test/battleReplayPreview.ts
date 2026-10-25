/** Local review fixture only. Never run against a shared game or test database. */
import { writeFile } from 'node:fs/promises';
import { pino } from 'pino';
import { eq } from 'drizzle-orm';
import { seedWorld, testEnv, testDb, setLevel, giveInstrument, giveUnits, grant, fuelUp, settledAt } from './helpers.js';
import { MULTI_WORLD, shieldHp } from '@astera/rules';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { launchAttack } from '../src/services/mission.js';
import { EventWorker } from '../src/worker/loop.js';
import { battleReports, planets, seasons } from '../src/db/schema.js';

if (!process.env.DATABASE_URL?.endsWith('/astera_replay_20261025_test')) throw new Error('Dedicated replay test DB required');
const f = await seedWorld(3, 20261025), logger = pino({ level: 'silent' });
await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.rulesetVersion }).where(eq(seasons.id, f.seasonId));
for (const id of f.planetIds) { await setLevel(f.db, id, 'CORE', 8); await fuelUp(f.db, id); }
await giveInstrument(f.db, f.planetIds[1]!, 'AEGIS', 5);
await grant(f.db, f.planetIds[1]!, 40000, 4000);
await giveUnits(f.db, f.planetIds[1]!, { BASTION: 4, HARPOON: 2, THORN: 2, DART: 12, COURIER: 2 });
const fleet = { DART: 68, NULLIFIER: 3, COURIER: 3 };
await giveUnits(f.db, f.planetIds[0]!, fleet);
f.clock.advance(250);
await f.db.update(planets).set({ shield: shieldHp(5) * .75, defencePosture: 'HOLD' }).where(eq(planets.id, f.planetIds[1]!));
const launched = await launchAttack(f.db, f.planetIds[0]!, f.planetIds[1]!, fleet, f.clock);
f.clock.set(settledAt(launched.arriveAt));
await new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, logger).tick();
const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, launched.missionId));
if (!report) throw new Error('Real mission did not settle');
const tokens = new TokenService('test-secret-that-is-long-enough', 120, 30);
const built = buildApp({ env: testEnv(), logger, db: f.db, clock: f.clock });
await built.app.listen({ host: '127.0.0.1', port: 5191 });
await writeFile('/tmp/astera-real-replay-preview.json', JSON.stringify({ missionId: launched.missionId, reportId: report.id,
  tokens: await Promise.all(f.accountIds.map(id => tokens.issueAccess(id))), playerIds: f.playerIds, seasonId: f.seasonId }));
process.on('SIGTERM', () => {
  void built.close().then(async () => { await (await testDb()).close(); process.exit(0); })
    .catch((error: unknown) => { console.error(error); process.exit(1); });
});
console.log('Isolated real battle preview ready on port 5191');
