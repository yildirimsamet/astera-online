import { randomUUID } from 'node:crypto';
import { pino } from 'pino';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { planets, players, seasons, strategicAssets } from '../src/db/schema.js';
import { buildRadiationBomb, launchRadiationBomb, resolveRadiationBomb } from '../src/services/radiationBomb.js';
import { EventBus } from '../src/stream/bus.js';
import { TEST_DATABASE_URL, grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/**
 * A BOMB'S HIT IS A PUBLIC MOMENT, SO IT IS ANNOUNCED LIKE ONE. Owner, 2026-10-16:
 * *"Radyasyon bombası füzelerinin patlama animasyonları gözükmüyor (telescope dışında bile
 * olsa patlama animasyonları gözükmeli)."*
 *
 * The hit used to go out as `shard:world`, which clients batch for up to thirty seconds
 * because a world changing shape is rarely urgent — so everybody but the two commanders
 * read the new radiation source long after its three-second detonation had played.
 * `shard:impact` is the kind a Death Star's hit already uses: read at once, by everyone.
 */

const silent = pino({ level: 'silent' });
let f: Fixture;
beforeEach(async () => {
  f = await seedWorld(2);
  await f.db.update(seasons).set({ radiationBombStartsAt: f.clock.now(), rulesetVersion: 18 }).where(eq(seasons.id, f.seasonId));
  for (const id of f.planetIds) {
    await setLevel(f.db, id, 'CORE', 13);
    await setLevel(f.db, id, 'SHIPYARD', 5);
    await grant(f.db, id, 500000, 500000);
    await f.db.update(planets).set({ deuterium: 500000 }).where(eq(planets.id, id));
  }
  await f.db.update(players).set({ newcomerShieldUntil: null, recoveryShieldUntil: null });
});
afterAll(async () => { await (await testDb()).close(); });

async function strike(protectTarget: boolean): Promise<string[]> {
  const built = await buildRadiationBomb(f.db, f.planetIds[0]!, 2, f.clock, f.playerIds[0]);
  await f.db.update(strategicAssets).set({ status: 'READY' }).where(eq(strategicAssets.id, built.assetId));
  const sent = await launchRadiationBomb(f.db, {
    playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, target: { kind: 'PLANET', id: f.planetIds[1]! },
    level: 2, key: randomUUID(), acknowledgeShieldLoss: true, clock: f.clock,
  });
  if (protectTarget) {
    await f.db.update(players).set({ newcomerShieldUntil: new Date(new Date(sent.arriveAt).getTime() + 60000) })
      .where(eq(players.id, f.playerIds[1]!));
  }
  const bus = new EventBus(TEST_DATABASE_URL, silent);
  await bus.start();
  const kinds: string[] = [];
  const stop = bus.subscribeShard(f.seasonId, (event) => kinds.push(event.kind));
  try {
    f.clock.set(new Date(sent.arriveAt));
    await resolveRadiationBomb(f.db, sent.flightId, f.clock);
    await new Promise((resolve) => setTimeout(resolve, 300));
    return kinds;
  } finally {
    stop();
    await bus.stop();
  }
}

it('announces a hit as an impact everyone reads at once', async () => {
  expect(await strike(false)).toContain('shard:impact');
});

it('announces nothing to watch when the bomb meets a protected world', async () => {
  expect(await strike(true)).not.toContain('shard:impact');
});
