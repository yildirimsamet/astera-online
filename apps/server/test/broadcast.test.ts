import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { activeAsteroids, generateGalaxy } from '@astera/rules';
import { planets, scheduledEvents } from '../src/db/schema.js';
import { EventBus } from '../src/stream/bus.js';
import { launchAttack } from '../src/services/mission.js';
import { launchProbe } from '../src/services/intel.js';
import { launchMining } from '../src/services/mining.js';
import { buildUnits, installSatellite, raiseInstrument, upgradeBuilding } from '../src/services/build.js';
import { EventWorker } from '../src/worker/loop.js';
import { sweepStranded } from '../src/worker/abandon.js';
import {
  TEST_DATABASE_URL,
  giveUnits,
  grant,
  seedWorld,
  setLevel,
  testDb,
  type Fixture,
} from './helpers.js';

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * THE GALAXY-WIDE BROADCAST, AT ITS PUBLISH SITES. D53.
 *
 * `session.test.ts` proves the channel routes and isolates correctly. This proves
 * the thing that actually decides whether the disc is live: that the mutations
 * which change what OTHER people can see announce themselves, and — the half that
 * is far easier to get wrong — that the ones which do not, do not.
 *
 * THE RULE BEING ENFORCED, in one sentence: a shard event is published exactly
 * when the public payload it points at has changed, and at no other time. Break it
 * in one direction and the disc goes stale again; break it in the other and this
 * channel becomes a timing signal for facts the fog is supposed to hide.
 */
describe('the shard broadcast', () => {
  let f: Fixture;
  let bus: EventBus;
  /** Every shard kind seen since the last `clear()`, in order. */
  let heard: string[];
  let off: (() => void) | null = null;

  beforeEach(async () => {
    f = await seedWorld(2);
    bus = new EventBus(TEST_DATABASE_URL, silent);
    await bus.start();
    heard = [];
    off = bus.subscribeShard(f.seasonId, (event) => {
      heard.push(event.kind);
    });
  });

  afterEach(async () => {
    off?.();
    off = null;
    await bus.stop();
  });

  /**
   * NOTIFY is delivered asynchronously on its own connection, so an assertion
   * straight after a commit is racing the socket. This waits for the channel to go
   * quiet rather than for a fixed count, so "nothing was published" and "something
   * was published" are measured the same way and neither can pass by being fast.
   */
  const settle = (ms = 500): Promise<void> => new Promise((r) => setTimeout(r, ms));

  /* ── what a live galaxy has to announce ──────────────────────── */

  it('announces a raid leaving, so the disc shows it at once', async () => {
    await giveUnits(f.db, f.planetIds[0]!, { WASP: 6 });
    await launchAttack(f.db, f.planetIds[0]!, f.planetIds[1]!, { WASP: 5 }, f.clock);
    await settle();
    expect(heard).toContain('shard:launch');
  });

  it('announces a probe leaving — it is a contact like any other', async () => {
    await grant(f.db, f.planetIds[0]!, 5_000);
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 6);
    heard = [];
    await launchProbe(f.db, f.planetIds[0]!, f.planetIds[1]!, f.clock);
    await settle();
    expect(heard).toContain('shard:launch');
  });

  /**
   * Advance until a rock is crossing with enough life left to be worth sending
   * craft at. The field is on the season's own schedule and is empty at minute
   * zero, so a test that did not wait would be testing the fixture.
   */
  const waitForRock = (): number => {
    const spec = generateGalaxy(4242, 60);
    for (let i = 0; i < 400; i += 1) {
      const minutes =
        (f.clock.now().getTime() - new Date('2026-01-01T00:00:00.000Z').getTime()) / 60_000;
      const usable = activeAsteroids(spec.asteroids, minutes).find(
        (a) => a.expiresAt - minutes > 45,
      );
      if (usable) return usable.index;
      f.clock.advance(30);
    }
    throw new Error('no usable asteroid found');
  };

  it('announces a mining run, because a race nobody sees is not a race', async () => {
    await grant(f.db, f.planetIds[0]!, 500_000, 200_000);
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 10);
    await setLevel(f.db, f.planetIds[0]!, 'SHIPYARD', 3);
    await buildUnits(f.db, f.planetIds[0]!, 'PROSPECTOR', 1, f.clock);
    const index = waitForRock();

    await settle();
    heard = [];
    await launchMining(f.db, f.planetIds[0]!, index, 1, f.clock);
    await settle();
    expect(heard).toEqual(['shard:mining']);
  });

  /**
   * THE ONE THE WHOLE PHASE IS FOR.
   *
   * A raid resolving is the most watchable instant in the game and the one that
   * used to arrive latest: the bombardment finished, and every bystander's client
   * held the squadron over a world it had already destroyed until a twenty-second
   * poll happened along. `useArrivals` covered the attacker; nobody covered the
   * other forty-nine people in the galaxy.
   */
  it('announces a raid resolving, to everybody and not just its attacker', async () => {
    await giveUnits(f.db, f.planetIds[0]!, { WASP: 6 });
    const { arriveAt } = await launchAttack(
      f.db,
      f.planetIds[0]!,
      f.planetIds[1]!,
      { WASP: 5 },
      f.clock,
    );

    heard = [];
    f.clock.set(new Date(arriveAt.getTime() + 60_000));
    const worker = new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);
    await worker.tick();
    await settle();
    expect(heard).toContain('shard:arrival');
  });

  it('announces a satellite going up — hardware in orbit is public', async () => {
    await grant(f.db, f.planetIds[0]!, 200_000);
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 9);
    heard = [];
    await installSatellite(f.db, f.planetIds[0]!, 'FOUNDRY', f.clock);
    await settle();
    expect(heard).toEqual(['shard:world']);
  });

  /* ── and what it must stay silent about ──────────────────────── */

  /**
   * A GROUND INSTRUMENT IS PRIVATE, AND SO IS THE FACT THAT ONE WAS RAISED.
   *
   * D15 and D25 keep the four ground instruments off every public payload: whether
   * a world can see you, and whether it can tell you are looking, is exactly what
   * the information game is about. A broadcast timed to a Telescope going up would
   * be the one fact on this channel that a refetch could NOT have shown — which is
   * the precise definition of the leak this channel is designed not to be.
   */
  it('says nothing when a ground instrument is raised', async () => {
    await grant(f.db, f.planetIds[0]!, 200_000);
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 9);
    await installSatellite(f.db, f.planetIds[0]!, 'UPLINK', f.clock);

    // The install publishes, and NOTIFY lands asynchronously — so it has to be
    // allowed to arrive before the log is cleared, or this passes by racing it.
    await settle();
    heard = [];
    await raiseInstrument(f.db, f.planetIds[0]!, 'TELESCOPE', f.clock);
    await raiseInstrument(f.db, f.planetIds[0]!, 'VEIL', f.clock);
    await settle();
    expect(heard).toEqual([]);
  });

  /**
   * `/api/galaxy` publishes `coreTier` — a three-level bucket — and no other fact
   * about a building. So a Refinery reaching L7 changes nothing anybody else can
   * read, and announcing it would be a timing signal plus fifty pointless refetches
   * of the most expensive payload in the game.
   */
  it('says nothing when an upgrade does not change the public silhouette', async () => {
    await grant(f.db, f.planetIds[0]!, 500_000);
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 9);

    heard = [];
    // Both start far below the Core, so neither hits the ceiling and neither
    // appears anywhere in `/api/galaxy`.
    await upgradeBuilding(f.db, f.planetIds[0]!, 'VAULT', f.clock);
    await upgradeBuilding(f.db, f.planetIds[0]!, 'SHIPYARD', f.clock);
    await settle();
    expect(heard).toEqual([]);
  });

  /** And says so exactly once when it does. Core 6 → 7 crosses tier 2 → 3. */
  it('announces the one upgrade that does change it', async () => {
    await grant(f.db, f.planetIds[0]!, 500_000);
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 5);

    heard = [];
    // 5 → 6 stays inside tier 2; 6 → 7 opens tier 3.
    await upgradeBuilding(f.db, f.planetIds[0]!, 'CORE', f.clock);
    await settle();
    expect(heard).toEqual([]);

    await upgradeBuilding(f.db, f.planetIds[0]!, 'CORE', f.clock);
    await settle();
    expect(heard).toEqual(['shard:world']);
  });

  /**
   * BUILDING SHIPS IS NOT A PUBLIC FACT.
   *
   * A hull sitting on a planet appears in no payload anybody else can read — that
   * is the whole reason a Telescope and a probe are worth buying. A broadcast on
   * every build would say "somebody in this galaxy is arming, right now", which is
   * a sentence the fog exists to prevent anybody from getting for free.
   */
  it('says nothing when ships are built', async () => {
    await grant(f.db, f.planetIds[0]!, 200_000);
    await setLevel(f.db, f.planetIds[0]!, 'SHIPYARD', 3);

    heard = [];
    await buildUnits(f.db, f.planetIds[0]!, 'WASP', 10, f.clock);
    await settle();
    expect(heard).toEqual([]);
  });

  /**
   * AND A ROLLED-BACK LAUNCH IS NEVER ANNOUNCED.
   *
   * `publishShard` runs inside the transaction, so NOTIFY fires on COMMIT. A raid
   * refused for a rule violation must not send fifty clients to refetch a fleet
   * that does not exist — and this is the cheapest possible way for that to go
   * wrong, since the refusal happens after some of the work.
   */
  it('does not announce a launch the server refused', async () => {
    await giveUnits(f.db, f.planetIds[0]!, { WASP: 2 });
    heard = [];
    await expect(
      // More ships than the planet holds: refused inside the transaction.
      launchAttack(f.db, f.planetIds[0]!, f.planetIds[1]!, { WASP: 99 }, f.clock),
    ).rejects.toThrow();
    await settle();
    expect(heard).toEqual([]);
  });

  /**
   * A FLIGHT THAT WAS ABANDONED IS STILL A FLIGHT THAT LEFT THE SKY. D53.
   *
   * `sweepStranded` and `abandon` take a mission out of `in_flight`, which drops it
   * out of `galaxyTraffic` — so every other client in the galaxy is drawing a
   * contact that no longer exists. This used to right itself on a twenty-second
   * poll. The poll is now a sixty-second net under the broadcast, so an omission
   * here would have made the rarest failure in the game three times MORE visible
   * than it was before the phase that was meant to fix exactly that.
   */
  it('announces a stranded flight being swept out of the sky', async () => {
    await giveUnits(f.db, f.planetIds[0]!, { WASP: 6 });
    const { missionId } = await launchAttack(
      f.db,
      f.planetIds[0]!,
      f.planetIds[1]!,
      { WASP: 5 },
      f.clock,
    );
    // Its event row is gone, which is the definition of stranded: nothing will
    // ever resolve it and every safety net that reads the EVENT is blind to it.
    await f.db.delete(scheduledEvents).where(eq(scheduledEvents.refId, missionId));
    f.clock.advance(600);

    await settle();
    heard = [];
    expect(await sweepStranded(f.db, f.clock)).toBe(1);
    await settle();
    expect(heard).toContain('shard:arrival');
  });

  /** A galaxy nobody is in still has to be publishable — no subscriber, no throw. */
  it('publishes into an empty galaxy without complaint', async () => {
    const [other] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!));
    expect(other).toBeDefined();
    off?.();
    off = null;
    await giveUnits(f.db, f.planetIds[0]!, { WASP: 6 });
    await expect(
      launchAttack(f.db, f.planetIds[0]!, f.planetIds[1]!, { WASP: 5 }, f.clock),
    ).resolves.toBeDefined();
  });
});
