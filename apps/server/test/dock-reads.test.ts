import { and, eq, like } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Fleet, HullId } from '@astera/rules';
import { planets, players, probeReports, shipDamageLots, units } from '../src/db/schema.js';
import { transferCommander } from '../src/services/commanderTransfer.js';
import { fleetTruthFor, launchProbe } from '../src/services/intel.js';
import { launchAttack } from '../src/services/mission.js';
import { loadLocked } from '../src/services/planet.js';
import { landShips } from '../src/services/shipDamage.js';
import { ensureWaitingSeason } from '../src/services/waitingServers.js';
import { EventWorker } from '../src/worker/loop.js';
import { giveUnits, grant, levelWorld, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/**
 * A DOCKED SHIP IS ON ITS WORLD AND OUT OF THE GAME. Kalıcı gemi hasarı, `plan.md` F3.
 *
 * Every reader of `units` asks one of three questions: what can fly or fight (`home`),
 * what does this world own (every row), or is its fleet out (every row but `home`). A
 * ship in the Repair Station answers the first no and the second yes — and the third
 * NO: it has not left. The Telescope's "is the fleet home" is the most valuable signal
 * in the game, and one damaged Ballista in the dock must not make a guarded world read
 * as empty.
 */

const silent = pino({ level: 'silent' });

describe('the Repair Station dock, as the rest of the game reads it', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;

  beforeEach(async () => {
    f = await seedWorld(2, 8123);
    mine = f.planetIds[0]!;
    theirs = f.planetIds[1]!;
  });

  afterAll(async () => {
    const { close } = await testDb();
    await close();
  });

  /** Put ships straight into a world's dock, badly damaged. */
  const dock = async (planetId: string, ownerPlayerId: string, fleet: Fleet) => {
    await f.db.transaction((tx) => landShips(tx, {
      planetId,
      ownerPlayerId,
      fleet,
      damage: Object.entries(fleet).map(([hull, count]) => ({ hull: hull as HullId, count, damageBp: 6000 })),
      at: f.clock.now(),
    }));
  };

  it('reads a world with ships in the dock as a world whose fleet is home', async () => {
    await giveUnits(f.db, theirs, { DART: 5 });
    await dock(theirs, f.playerIds[1]!, { BALLISTA: 2 });
    const truth = await fleetTruthFor(f.db, [theirs], f.clock.now());
    expect(truth.get(theirs)?.status).toBe('HOME');
  });

  it('files a probe report that says the fleet is home', async () => {
    await grant(f.db, mine, 50_000, 5_000);
    await setLevel(f.db, mine, 'SHIPYARD', 3);
    await levelWorld(f.db, f.planetIds);
    await giveUnits(f.db, theirs, { DART: 5 });
    await dock(theirs, f.playerIds[1]!, { BALLISTA: 2 });

    const launch = await launchProbe(f.db, mine, theirs, f.clock);
    f.clock.set(launch.arriveAt);
    await new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent).tick();

    const [report] = await f.db.select().from(probeReports);
    expect(report?.fleetHome).toBe(true);
  });

  it('keeps docked ships out of the garrison every launch lane and the defending line read', async () => {
    await giveUnits(f.db, mine, { DART: 3 });
    await dock(mine, f.playerIds[0]!, { BALLISTA: 2 });
    const world = await f.db.transaction((tx) => loadLocked(tx, mine, f.clock));
    expect(world.homeFleet.BALLISTA ?? 0).toBe(0);
    expect(world.homeFleet.DART).toBe(3);
  });

  it('refuses to send a docked ship on a raid', async () => {
    await dock(mine, f.playerIds[0]!, { BALLISTA: 2 });
    await expect(launchAttack(f.db, mine, theirs, { BALLISTA: 1 }, f.clock))
      .rejects.toMatchObject({ code: 'NOT_ENOUGH_SHIPS' });
  });

  it('lets an idle commander with ships in the dock move to Silent Space, dock and all', async () => {
    f.clock.advance(48 * 60);
    await f.db.update(players).set({ lastProgressAt: f.clock.now() }).where(eq(players.id, f.playerIds[1]!));
    await dock(mine, f.playerIds[0]!, { BALLISTA: 2 });

    const target = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
    expect((await transferCommander(f.db, f.playerIds[0]!, target!.id, f.clock)).status).toBe('MOVED');

    const [world] = await f.db.select().from(planets).where(eq(planets.id, mine));
    expect(world?.seasonId).toBe(target!.id);
    expect(await f.db.select().from(shipDamageLots).where(eq(shipDamageLots.planetId, mine))).toHaveLength(1);
    const [docked] = await f.db.select().from(units)
      .where(and(eq(units.planetId, mine), like(units.location, 'dock:%')));
    expect(docked).toMatchObject({ hull: 'BALLISTA', count: 2, ownerPlayerId: f.playerIds[0] });
  });
});
