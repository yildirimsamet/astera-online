import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MOON, type Fleet } from '@astera/rules';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { battleReports, missions, moons, notifications, seasons, units } from '../src/db/schema.js';
import { launchProbe } from '../src/services/intel.js';
import { launchAttack } from '../src/services/mission.js';
import { retargetAttack } from '../src/services/moonMovement.js';
import { recallFlight } from '../src/services/movement.js';
import { pendingThreads } from '../src/services/session.js';
import { MOON_LOCATION } from '../src/services/unitLocation.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  fuelUp, giveInstrument, giveSatellite, giveUnits, grant, levelWorld, seedWorld, setLevel, settledAt, testDb, testEnv, type Fixture,
} from './helpers.js';

/*
  F3b (S13, S24; plan §6.8, V2, V7, E1): until the battle starts, the attacker may switch a raid between a
  world's planet and its moon. The switch closes at the arrival instant, needs a moon, waits five seconds
  after the last one, and a defender whose radar already caught the raid sees the new body at once.
*/
const silent = pino({ level: 'silent' });

describe('switching a raid between planet and moon', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  const WING: Fleet = { DART: 40 };

  beforeEach(async () => {
    f = await seedWorld(2, 20_090);
    [mine, theirs] = f.planetIds as [string, string];
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 8);
      await setLevel(f.db, id, 'SHIPYARD', 4);
    }
    await f.db.insert(moons).values({ planetId: theirs, rarity: 'EPIC', origin: 'BUILT', visualSeed: 3, bornAt: f.clock.now() });
    await levelWorld(f.db, f.planetIds);
    f.clock.advance(250);
    await giveUnits(f.db, mine, WING);
    await fuelUp(f.db, mine);
    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    app = built.app;
    close = built.close;
    await app.ready();
  });
  afterEach(async () => { await close(); });
  afterAll(async () => { const { close: closeDb } = await testDb(); await closeDb(); });

  const raid = () => launchAttack(f.db, mine, theirs, WING, f.clock);
  const bodyOf = async (missionId: string) =>
    (await f.db.select({ body: missions.targetBody }).from(missions).where(eq(missions.id, missionId)))[0]?.body;

  it('moves the battle to the moon, over the API, and back again after five seconds', async () => {
    await f.db.insert(units).values({ planetId: theirs, ownerPlayerId: f.playerIds[1]!, hull: 'PIKE', location: MOON_LOCATION, count: 2 });
    const launch = await raid();
    const authorization = `Bearer ${await new TokenService('test-secret-that-is-long-enough', 15, 30).issueAccess(f.accountIds[0]!)}`;
    const res = await app.inject({ method: 'POST', url: `/api/missions/${launch.missionId}/target-body`, headers: { authorization }, payload: { body: 'MOON' } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: launch.missionId, targetBody: 'MOON' });

    await expect(retargetAttack(f.db, f.playerIds[0]!, launch.missionId, 'PLANET', f.clock)).rejects.toMatchObject({ code: 'RETARGET_TOO_SOON' });
    f.clock.advance(MOON.retargetSpacingSeconds / 60);
    await retargetAttack(f.db, f.playerIds[0]!, launch.missionId, 'PLANET', f.clock);
    f.clock.advance(MOON.retargetSpacingSeconds / 60);
    await retargetAttack(f.db, f.playerIds[0]!, launch.missionId, 'MOON', f.clock);

    f.clock.set(settledAt(launch.arriveAt));
    await new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent).tick();
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, launch.missionId));
    expect(report).toMatchObject({ targetBody: 'MOON', defenderFleet: { PIKE: 2 } });
  });

  it('accepts a switch a millisecond before arrival and refuses it at arrival (E1)', async () => {
    const launch = await raid();
    f.clock.set(new Date(launch.arriveAt.getTime() - 1));
    await retargetAttack(f.db, f.playerIds[0]!, launch.missionId, 'MOON', f.clock);
    expect(await bodyOf(launch.missionId)).toBe('MOON');
    f.clock.set(launch.arriveAt);
    await expect(retargetAttack(f.db, f.playerIds[0]!, launch.missionId, 'PLANET', f.clock)).rejects.toMatchObject({ code: 'RETARGET_CLOSED' });
    expect(await bodyOf(launch.missionId)).toBe('MOON');
  });

  it('refuses what is not the caller’s own raid in the air, and a world without a moon', async () => {
    const launch = await raid();
    await expect(retargetAttack(f.db, f.playerIds[1]!, launch.missionId, 'MOON', f.clock)).rejects.toMatchObject({ code: 'PLANET_NOT_OWNED' });
    await f.db.delete(moons).where(eq(moons.planetId, theirs));
    await expect(retargetAttack(f.db, f.playerIds[0]!, launch.missionId, 'MOON', f.clock)).rejects.toMatchObject({ code: 'NO_MOON' });
    await f.db.insert(moons).values({ planetId: theirs, rarity: 'EPIC', origin: 'BUILT', visualSeed: 3, bornAt: f.clock.now() });

    await recallFlight(f.db, launch.missionId, f.clock, f.playerIds[0]!);
    await expect(retargetAttack(f.db, f.playerIds[0]!, launch.missionId, 'MOON', f.clock)).rejects.toMatchObject({ code: 'NOT_RETARGETABLE' });

    await grant(f.db, mine, 20_000, 10_000);
    const probe = await launchProbe(f.db, mine, theirs, f.clock);
    await expect(retargetAttack(f.db, f.playerIds[0]!, probe.missionId, 'MOON', f.clock)).rejects.toMatchObject({ code: 'NOT_RETARGETABLE' });
  });

  it('shows the body to a defender whose radar caught the raid, on the strip and in the warning (S24)', async () => {
    await giveSatellite(f.db, theirs, 'UPLINK');
    await giveInstrument(f.db, theirs, 'RADAR', 5);
    const launch = await raid();
    const incoming = async () => (await pendingThreads(f.db, theirs, f.clock.now())).find((row) => row.kind === 'incoming');

    f.clock.set(new Date(launch.arriveAt.getTime() - 30_000));
    const before = await incoming();
    expect(before, 'the radar has not caught the raid').toBeDefined();
    expect(before?.targetBody).toBeUndefined();
    await retargetAttack(f.db, f.playerIds[0]!, launch.missionId, 'MOON', f.clock);
    expect((await incoming())?.targetBody).toBe('MOON');
    // The attacker's own strip says where its raid is aimed, too.
    const own = (await pendingThreads(f.db, mine, f.clock.now())).find((row) => row.id === launch.missionId);
    expect(own?.targetBody).toBe('MOON');

    // The timed warning names the body it was aimed at when it fired.
    await new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent).tick();
    const [warning] = await f.db.select({ payload: notifications.payload }).from(notifications)
      .where(and(eq(notifications.playerId, f.playerIds[1]!), eq(notifications.kind, 'incoming_fleet')));
    expect(warning?.payload).toMatchObject({ targetBody: 'MOON' });
  });
});
