import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { activeAsteroids, PROSPECTOR } from '@astera/rules';
import { miningRuns, planets, units } from '../src/db/schema.js';
import { launchHarvest, launchMining } from '../src/services/mining.js';
import { launchTransfer } from '../src/services/movement.js';
import { EventWorker } from '../src/worker/loop.js';
import { giveDebris, giveUnits, placeAt, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

describe('independent Prospector dispatch', () => {
  let f: Fixture;
  let home: string;
  const worker = () => new EventWorker(f.db, f.clock,
    { pollMs: 1000, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' }));
  const rock = () => {
    for (let i = 0; i < 400; i++) {
      const minutes = (f.clock.now().getTime() - Date.UTC(2026, 0, 1)) / 60_000;
      const live = activeAsteroids(f.asteroids, minutes).find((a) => a.expiresAt - minutes > 45);
      if (live) return live;
      f.clock.advance(30);
    }
    throw new Error('fixture has no usable rock');
  };
  const land = async (id: string) => {
    const [out] = await f.db.select().from(miningRuns).where(eq(miningRuns.id, id));
    f.clock.set(out!.arriveAt);
    await worker().tick();
    const [back] = await f.db.select().from(miningRuns).where(eq(miningRuns.id, id));
    f.clock.set(back!.homeAt!);
    await worker().tick();
    return back!.homeAt!;
  };
  beforeEach(async () => {
    f = await seedWorld(2);
    home = f.planetIds[0]!;
    await setLevel(f.db, home, 'CORE', 10);
    await placeAt(f.db, home, { x: 0, y: 0, z: 0 });
    await giveUnits(f.db, home, { PROSPECTOR: 2 });
  });

  it.each(['asteroid', 'debris'] as const)('can send both craft separately to the same %s', async (kind) => {
    const target = rock();
    const field = await giveDebris(f.db, f.seasonId, home, { alloy: 10_000, crystal: 0, createdAt: f.clock.now() });
    const send = () => kind === 'asteroid'
      ? launchMining(f.db, home, target.index, 1, f.clock)
      : launchHarvest(f.db, home, field.id, 1, f.clock);
    const runs = await Promise.all([send(), send()]);
    expect(new Set(runs.map((run) => run.runId)).size).toBe(2);
    await expect(send()).rejects.toMatchObject({ code: 'NOT_ENOUGH_CRAFT' });
    const parked = await f.db.select().from(units).where(and(eq(units.planetId, home), eq(units.location, 'home'), eq(units.hull, 'PROSPECTOR')));
    expect(parked.reduce((total, row) => total + row.count, 0)).toBe(0);
  });

  it('does not hold the unused craft while a debris craft rests', async () => {
    const target = rock();
    const field = await giveDebris(f.db, f.seasonId, home, { alloy: 10_000, crystal: 0, createdAt: f.clock.now() });
    const debris = await launchHarvest(f.db, home, field.id, 1, f.clock);
    const landedAt = await land(debris.runId);
    await expect(launchMining(f.db, home, target.index, 2, f.clock)).rejects.toMatchObject({
      code: 'PROSPECTORS_RESTING', params: { available: 1 },
    });
    const asteroid = await launchMining(f.db, home, target.index, 1, f.clock);
    expect(asteroid.craft).toBe(1);
    await expect(launchMining(f.db, home, target.index, 1, f.clock)).rejects.toMatchObject({ code: 'PROSPECTORS_RESTING' });
    f.clock.set(new Date(landedAt.getTime() + PROSPECTOR.shortTripCooldownMinutes * 60_000));
    await expect(launchMining(f.db, home, target.index, 1, f.clock)).resolves.toMatchObject({ craft: 1 });
  });

  it('cannot transfer a resting craft to erase its cooldown, but can transfer the unused one', async () => {
    rock();
    await giveUnits(f.db, home, { PROSPECTOR: 2, COURIER: 2 });
    const target = f.planetIds[1]!;
    await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: f.playerIds[0]! }).where(eq(planets.id, target));
    const field = await giveDebris(f.db, f.seasonId, home, { alloy: 10_000, crystal: 0, createdAt: f.clock.now() });
    await land((await launchHarvest(f.db, home, field.id, 1, f.clock)).runId);
    const send = (craft: number) => launchTransfer(f.db, f.playerIds[0]!, home, target,
      { PROSPECTOR: craft, COURIER: 1 }, { alloy: 0, crystal: 0, deuterium: 0 }, f.clock);
    await expect(send(2)).rejects.toMatchObject({ code: 'PROSPECTORS_RESTING', params: { available: 1 } });
    await expect(send(1)).resolves.toBeDefined();
    await expect(send(1)).rejects.toMatchObject({ code: 'PROSPECTORS_RESTING', params: { available: 0 } });
  });

  it('keeps staggered debris cooldowns separate and never spends a resting craft', async () => {
    const target = rock();
    const field = await giveDebris(f.db, f.seasonId, home, { alloy: 10_000, crystal: 0, createdAt: f.clock.now() });
    const first = await launchHarvest(f.db, home, field.id, 1, f.clock);
    const firstHome = await land(first.runId);
    f.clock.advance(0.25);
    const second = await launchHarvest(f.db, home, field.id, 1, f.clock);
    const secondHome = await land(second.runId);
    await expect(launchMining(f.db, home, target.index, 2, f.clock)).rejects.toMatchObject({
      code: 'PROSPECTORS_RESTING', params: { available: 0, readyAt: new Date(secondHome.getTime() + 60_000).toISOString() },
    });
    await expect(launchMining(f.db, home, target.index, 1, f.clock)).rejects.toMatchObject({
      code: 'PROSPECTORS_RESTING', params: { available: 0, readyAt: new Date(firstHome.getTime() + 60_000).toISOString() },
    });
    f.clock.set(new Date(firstHome.getTime() + 60_000));
    const results = await Promise.allSettled([
      launchMining(f.db, home, target.index, 1, f.clock),
      launchMining(f.db, home, target.index, 1, f.clock),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({
      status: 'rejected', reason: { code: 'PROSPECTORS_RESTING', params: { available: 0 } },
    });
    f.clock.set(new Date(secondHome.getTime() + 60_000));
    await expect(launchMining(f.db, home, target.index, 1, f.clock)).resolves.toMatchObject({ craft: 1 });
  });

  it('can reuse the landed debris craft while another craft returns from that asteroid', async () => {
    const target = rock();
    const field = await giveDebris(f.db, f.seasonId, home, { alloy: 10_000, crystal: 0, createdAt: f.clock.now() });
    const asteroid = await launchMining(f.db, home, target.index, 1, f.clock);
    const debris = await launchHarvest(f.db, home, field.id, 1, f.clock);
    // Leave ore for the later craft regardless of this seed's rock/hold sizes.
    await f.db.update(miningRuns).set({ holdEach: 1 }).where(eq(miningRuns.id, asteroid.runId));
    await land(debris.runId);
    f.clock.set(asteroid.arriveAt);
    await worker().tick();
    const [returning] = await f.db.select().from(miningRuns).where(eq(miningRuns.id, asteroid.runId));
    expect(returning!.status).toBe('returning');
    // Keep the first craft in flight, but let the second finish its own rest.
    const [done] = await f.db.select().from(miningRuns).where(eq(miningRuns.id, debris.runId));
    f.clock.set(new Date(Math.max(f.clock.now().getTime(), done!.homeAt!.getTime() + 60_000)));
    expect(returning!.homeAt!.getTime()).toBeGreaterThan(f.clock.now().getTime());
    await expect(launchMining(f.db, home, target.index, 1, f.clock)).resolves.toMatchObject({ craft: 1 });
  });
});
