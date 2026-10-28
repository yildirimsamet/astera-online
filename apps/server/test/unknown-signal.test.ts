import { randomUUID } from 'node:crypto';
import { pino } from 'pino';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as bus from '../src/stream/bus.js';
import { forceSeasonEnd, onSeasonEnd, HANDLERS } from '../src/worker/handlers.js';
import { startVacation, endVacation, vacationStatus } from '../src/services/vacation.js';
import { COSMETICS, HULLS, distance, repairPct, shipHpRepairCost, rollUnknownSignalOutcome, type UnknownSignalOutcome } from '@astera/rules';
import { FixedClock } from '../src/clock.js';
import { botProfiles, buildOrders, cosmeticEntitlements, hpRadiationSources, notifications, planets, players, scheduledEvents, seasons, shards, shipDamageLots, unknownSignals, unknownSignalState, units } from '../src/db/schema.js';
import { EventWorker } from '../src/worker/loop.js';
import { pendingThreads } from '../src/services/session.js';
import {
  backfillUnknownSignals, devUnknownSignal, dispatchUnknownSignal, recallUnknownSignal,
  resolveUnknownSignalArrival, resolveUnknownSignalExpire, resolveUnknownSignalReturn,
  resolveUnknownSignalSpawn, unknownSignalsForPlayer,
  repairUnknownSignals,
} from '../src/services/unknownSignal.js';
import { baysInUse } from '../src/services/flight.js';
import { loadLocked } from '../src/services/planet.js';
import { busy, commanderRows, demolish } from '../src/services/reclaim.js';
import { transferCommander } from '../src/services/commanderTransfer.js';
import { registerAccount } from '../src/services/account.js';
import { joinSeason } from '../src/services/player.js';
import { ensureWaitingSeason } from '../src/services/waitingServers.js';
import { applyBuildCompletion } from '../src/services/buildQueue.js';
import { transferPlanetControl } from '../src/services/ownership.js';
import { maintenanceAction } from '../src/services/maintenance.js';
import { startRepair } from '../src/services/repair.js';
import { giveUnits, grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

afterAll(async () => { const { close } = await testDb(); await close(); });
const fleet = { DART: 1, COURIER: 1 };
let f: Fixture;
let playerId: string;
let originId: string;
const row = async (id: string) => (await f.db.select().from(unknownSignals).where(eq(unknownSignals.id, id)))[0]!;
const nowSignal = (outcome: UnknownSignalOutcome['kind'] = 'RESOURCES') => devUnknownSignal(f.db, playerId, outcome, f.clock, 'test');
const launch = (id: string, key = randomUUID()) => dispatchUnknownSignal(f.db, playerId, id, originId, fleet, key, f.clock);
const arrive = async (id: string) => {
  f.clock.set((await row(id)).arriveAt!);
  await f.db.transaction(tx => resolveUnknownSignalArrival(tx, id, f.clock));
};
const land = async (id: string) => {
  f.clock.set((await row(id)).returnAt!);
  await f.db.transaction(tx => resolveUnknownSignalReturn(tx, id, f.clock));
};

beforeEach(async () => {
  f = await seedWorld(2);
  playerId = f.playerIds[0]!;
  originId = f.planetIds[0]!;
  await giveUnits(f.db, originId, { DART: 4, PIKE: 1, COURIER: 4 });
  await grant(f.db, originId, 10_000, 5000);
});

/*
  Owner, 2026-10-20: the commander of a first game (the three-day shield) meets their first
  signal within 2–10 minutes, and it never holds pirates. Every later signal is ordinary.
*/
describe('a first game\'s first signal', () => {
  const firstGame = async () => {
    const account = await registerAccount(f.db, { username: 'FirstPilot', password: 'correct-horse-battery' }, true);
    return (await joinSeason(f.db, account.id, f.seasonId, f.clock)).playerId;
  };
  const spawn = async (id: string) => {
    const [state] = await f.db.select().from(unknownSignalState).where(eq(unknownSignalState.playerId, id));
    f.clock.set(state!.nextAt!);
    await f.db.transaction(tx => resolveUnknownSignalSpawn(tx, id, state!.nextAt!, f.clock));
    const [open] = await f.db.select().from(unknownSignals).where(and(eq(unknownSignals.playerId, id), eq(unknownSignals.status, 'open')));
    return open!;
  };

  it('appears within 2–10 minutes, pirate-free, and the next one is ordinary', async () => {
    const id = await firstGame();
    const joinedAt = f.clock.now().getTime();
    const [state] = await f.db.select().from(unknownSignalState).where(eq(unknownSignalState.playerId, id));
    const gap = (state!.nextAt!.getTime() - joinedAt) / 60_000;
    expect(gap).toBeGreaterThanOrEqual(2);
    expect(gap).toBeLessThanOrEqual(10);
    const first = await spawn(id);
    expect(first.pirateFree).toBe(true);
    expect((await unknownSignalsForPlayer(f.db, id, f.clock)).signals[0]).toMatchObject({ id: first.id, pirateFree: true });
    const [next] = await f.db.select().from(unknownSignalState).where(eq(unknownSignalState.playerId, id));
    const after = (next!.nextAt!.getTime() - first.appearedAt.getTime()) / 60_000;
    expect(after).toBeGreaterThanOrEqual(120);
    expect(after).toBeLessThanOrEqual(240);
    expect((await spawn(id)).pirateFree).toBe(false);
  });

  it('keeps the gift for the first signal that actually appears when the first discovery is skipped', async () => {
    const id = await firstGame();
    const [state] = await f.db.select().from(unknownSignalState).where(eq(unknownSignalState.playerId, id));
    f.clock.set(new Date(state!.nextAt!.getTime() + 90 * 60_000));
    await f.db.transaction(tx => resolveUnknownSignalSpawn(tx, id, state!.nextAt!, f.clock));
    expect(await f.db.select().from(unknownSignals).where(eq(unknownSignals.playerId, id))).toHaveLength(0);
    expect((await spawn(id)).pirateFree).toBe(true);
  });

  it('gives an ordinary commander an ordinary first signal', async () => {
    expect((await spawn(playerId)).pirateFree).toBe(false);
  });

  it('turns a seed that would ambush into a reward, and the fleet comes home', async () => {
    const signal = await nowSignal('PIRATES');
    await f.db.update(unknownSignals).set({ pirateFree: true }).where(eq(unknownSignals.id, signal.id));
    await launch(signal.id);
    await arrive(signal.id);
    const resolved = await row(signal.id);
    expect(resolved.outcome?.kind).not.toBe('PIRATES');
    expect(resolved.status).toBe('returning');
    expect(resolved.outcome).toEqual(rollUnknownSignalOutcome(resolved.seed, 1, [], false));
  });
});

describe('unknown signal personal scheduling', () => {
  it('registers a new commander for 120–240 minutes, with no signal yet', async () => {
    const [state] = await f.db.select().from(unknownSignalState).where(eq(unknownSignalState.playerId, playerId));
    expect(state).toBeDefined();
    const gap = (state!.nextAt!.getTime() - f.clock.now().getTime()) / 60_000;
    expect(gap).toBeGreaterThanOrEqual(120);
    expect(gap).toBeLessThanOrEqual(240);
    expect(await unknownSignalsForPlayer(f.db, playerId, f.clock)).toEqual({ signals: [] });
  });

  it('backfills existing eligible people once over 0–120 minutes without resetting their chain', async () => {
    await f.db.delete(unknownSignalState);
    await f.db.delete(scheduledEvents).where(eq(scheduledEvents.kind, 'unknown_signal_spawn'));
    expect(await backfillUnknownSignals(f.db, f.clock)).toBe(2);
    const before = await f.db.select().from(unknownSignalState);
    expect(await backfillUnknownSignals(f.db, f.clock)).toBe(0);
    expect(await f.db.select().from(unknownSignalState)).toEqual(before);
    for (const state of before) {
      const gap = (state.nextAt!.getTime() - f.clock.now().getTime()) / 60_000;
      expect(gap).toBeGreaterThanOrEqual(0);
      expect(gap).toBeLessThanOrEqual(120);
    }
  });

  it.each([1, 4, 7])('spawns at eligible peak Core %i, expires after 60 minutes and schedules from appearance', async level => {
    await setLevel(f.db, originId, 'CORE', level);
    const [state] = await f.db.select().from(unknownSignalState).where(eq(unknownSignalState.playerId, playerId));
    f.clock.set(state!.nextAt!);
    await f.db.transaction(tx => resolveUnknownSignalSpawn(tx, playerId, state!.nextAt!, f.clock));
    const visible = await unknownSignalsForPlayer(f.db, playerId, f.clock);
    expect(visible.signals).toHaveLength(1);
    const signal = await row(visible.signals[0]!.id);
    expect(signal.seed).not.toContain(playerId);
    expect(signal.expiresAt.getTime() - signal.appearedAt.getTime()).toBe(60 * 60_000);
    const [capital] = await f.db.select().from(planets).where(eq(planets.id, originId));
    expect(distance(signal, capital!)).toBeGreaterThanOrEqual(400);
    expect(distance(signal, capital!)).toBeLessThanOrEqual(2700);
    const [next] = await f.db.select().from(unknownSignalState).where(eq(unknownSignalState.playerId, playerId));
    const gap = (next!.nextAt!.getTime() - signal.appearedAt.getTime()) / 60_000;
    expect(gap).toBeGreaterThanOrEqual(120);
    expect(gap).toBeLessThanOrEqual(240);
  });

  it('makes duplicate/concurrent spawn deliveries harmless and enforces one open signal in the database', async () => {
    const [state] = await f.db.select().from(unknownSignalState).where(eq(unknownSignalState.playerId, playerId));
    f.clock.set(state!.nextAt!);
    await Promise.all([1, 2].map(() => f.db.transaction(tx => resolveUnknownSignalSpawn(tx, playerId, state!.nextAt!, f.clock))));
    const signals = await f.db.select().from(unknownSignals).where(eq(unknownSignals.playerId, playerId));
    expect(signals).toHaveLength(1);
    await expect(f.db.insert(unknownSignals).values({
      playerId, seasonId: f.seasonId, seed: 'duplicate', x: 500, y: 0, z: 0,
      appearedAt: f.clock.now(), expiresAt: new Date(f.clock.now().getTime() + 60_000),
    })).rejects.toThrow();
  });

  it('does not resurrect an offline expired signal after a delayed worker', async () => {
    const [state] = await f.db.select().from(unknownSignalState).where(eq(unknownSignalState.playerId, playerId));
    const due = state!.nextAt!;
    f.clock.set(new Date(due.getTime() + 90 * 60_000));
    await f.db.transaction(tx => resolveUnknownSignalSpawn(tx, playerId, due, f.clock));
    expect((await unknownSignalsForPlayer(f.db, playerId, f.clock)).signals).toHaveLength(0);
    const [next] = await f.db.select().from(unknownSignalState).where(eq(unknownSignalState.playerId, playerId));
    expect(next!.nextAt!.getTime()).toBeGreaterThan(due.getTime());
  });

  it.each(['tier4', 'vacation', 'waiting', 'frozen', 'bot'] as const)('skips %s correctly', async reason => {
    const [state] = await f.db.select().from(unknownSignalState).where(eq(unknownSignalState.playerId, playerId));
    const due = state!.nextAt!;
    f.clock.set(due);
    if (reason === 'tier4') await setLevel(f.db, originId, 'CORE', 10);
    if (reason === 'vacation') {
      const quote = await vacationStatus(f.db, playerId, f.clock, 1);
      await startVacation(f.db, playerId, 1, quote.fingerprint, randomUUID(), f.clock);
    }
    if (reason === 'waiting') await f.db.update(shards).set({ role: 'WAITING' });
    if (reason === 'frozen') await f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, f.seasonId));
    if (reason === 'bot') await f.db.insert(botProfiles).values({ accountId: f.accountIds[0]!, ordinal: 1, persona: 'BALANCED', nextActionAt: due, createdAt: due });
    await f.db.transaction(tx => resolveUnknownSignalSpawn(tx, playerId, due, f.clock));
    expect((await unknownSignalsForPlayer(f.db, playerId, f.clock)).signals).toHaveLength(0);
    const [next] = await f.db.select().from(unknownSignalState).where(eq(unknownSignalState.playerId, playerId));
    if (reason === 'tier4' || reason === 'bot' || reason === 'frozen') expect(next!.nextAt).toBeNull();
    else expect(next!.nextAt!.getTime()).toBeGreaterThan(due.getTime());
  });

  it('expires only open signals, never a squadron already flying', async () => {
    const signal = await nowSignal();
    await launch(signal.id);
    f.clock.advance(61);
    await f.db.transaction(tx => resolveUnknownSignalExpire(tx, signal.id, f.clock));
    expect((await row(signal.id)).status).toBe('outbound');
  });
});

describe('unknown signal launch and recall', () => {
  it('does not lock the commander before an origin world already held by another normal action', async () => {
    const signal = await nowSignal();
    let dispatched: Promise<unknown> | undefined;
    try {
      await f.db.transaction(async tx => {
        const [self] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
        await tx.select().from(planets).where(eq(planets.id, originId)).for('update');
        dispatched = launch(signal.id);
        // Wait until dispatch is actually queued behind this world; no timing guess.
        let blocked = false;
        for (let i = 0; i < 200 && !blocked; i++) {
          const [check] = await tx.execute<{ n: number }>(sql`select count(*)::int as n from pg_stat_activity a where ${self!.pid} = any(pg_blocking_pids(a.pid))`);
          blocked = (check?.n ?? 0) > 0;
          if (!blocked) await new Promise(resolve => setTimeout(resolve, 5));
        }
        expect(blocked).toBe(true);
        await tx.select().from(players).where(eq(players.id, playerId)).for('update', { noWait: true });
      });
    } finally { await dispatched; }
  });

  it('serializes expiry against dispatch without spending a fleet after the deadline', async () => {
    const signal = await nowSignal();
    f.clock.set((await row(signal.id)).expiresAt);
    const results = await Promise.allSettled([launch(signal.id), f.db.transaction(tx => resolveUnknownSignalExpire(tx, signal.id, f.clock))]);
    expect(results[0]).toMatchObject({ status: 'rejected', reason: { code: 'UNKNOWN_SIGNAL_EXPIRED' } });
    expect((await row(signal.id)).status).toBe('expired');
    expect(await baysInUse(f.db, originId)).toBe(0);
  });

  it('resolves the recall/arrival boundary once with no recalled reward', async () => {
    const signal = await nowSignal();
    await launch(signal.id);
    f.clock.set((await row(signal.id)).arriveAt!);
    const results = await Promise.allSettled([recallUnknownSignal(f.db, playerId, signal.id, randomUUID(), f.clock),
      f.db.transaction(tx => resolveUnknownSignalArrival(tx, signal.id, f.clock))]);
    expect(results[0]).toMatchObject({ status: 'rejected', reason: { code: 'NOT_RECALLABLE' } });
    expect((await row(signal.id)).status).toBe('returning');
    expect(await f.db.select().from(notifications).where(eq(notifications.kind, 'unknown_signal_result'))).toHaveLength(1);
  });
  it('reserves wounded ships, fuel, one bay and progress; retries commit exactly once', async () => {
    const signal = await nowSignal();
    await f.db.update(units).set({ damage: [{ hull: 'DART', count: 4, damageBp: 4000 }] })
      .where(and(eq(units.planetId, originId), eq(units.location, 'home'), eq(units.hull, 'DART')));
    const key = randomUUID();
    const a = await launch(signal.id, key);
    expect(await launch(signal.id, key)).toEqual(a);
    expect((await row(signal.id)).damage).toEqual([{ hull: 'DART', count: 1, damageBp: 4000, remainderBp: 0 }]);
    expect(await baysInUse(f.db, originId)).toBe(1);
    const [player] = await f.db.select().from(players).where(eq(players.id, playerId));
    expect(player!.lastProgressAt).toEqual(f.clock.now());
  });

  it('allows only one of two concurrent dispatches for the right reason', async () => {
    const signal = await nowSignal();
    const results = await Promise.allSettled([launch(signal.id), launch(signal.id)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(r => r.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason).toMatchObject({ code: 'UNKNOWN_SIGNAL_TAKEN' });
  });

  it('hides another player signal and rejects expired signals and invalid fleets', async () => {
    const signal = await nowSignal();
    await expect(dispatchUnknownSignal(f.db, f.playerIds[1]!, signal.id, f.planetIds[1]!, fleet, randomUUID(), f.clock))
      .rejects.toMatchObject({ code: 'UNKNOWN_SIGNAL_NOT_FOUND' });
    await expect(dispatchUnknownSignal(f.db, playerId, signal.id, originId, { VIPER: 1, COURIER: 1 }, randomUUID(), f.clock))
      .rejects.toMatchObject({ code: 'UNKNOWN_SIGNAL_FLEET' });
    f.clock.set((await row(signal.id)).expiresAt);
    await expect(launch(signal.id)).rejects.toMatchObject({ code: 'UNKNOWN_SIGNAL_EXPIRED' });
  });

  it('clamps a previously opened signal at dispatch tier 3 after reaching tier 4', async () => {
    const signal = await nowSignal();
    await setLevel(f.db, originId, 'CORE', 10);
    await launch(signal.id);
    expect((await row(signal.id)).tierAtDispatch).toBe(3);
  });

  it('recalls only before arrival, gives no reward and returns the original squadron', async () => {
    const signal = await nowSignal();
    await launch(signal.id);
    f.clock.advance(0.1);
    await recallUnknownSignal(f.db, playerId, signal.id, randomUUID(), f.clock);
    expect((await row(signal.id)).status).toBe('recalled');
    await f.db.transaction(tx => resolveUnknownSignalArrival(tx, signal.id, f.clock));
    await land(signal.id);
    expect((await row(signal.id)).outcome).toBeNull();
    expect((await row(signal.id)).status).toBe('done');
    expect(await baysInUse(f.db, originId)).toBe(0);
  });
});

describe('unknown signal rewards', () => {
  it('schedules the next discovery even when the spawn handler exhausts its retry budget', async () => {
    const [state] = await f.db.select().from(unknownSignalState).where(eq(unknownSignalState.playerId, playerId));
    f.clock.set(state!.nextAt!);
    await f.db.update(scheduledEvents).set({ attempts: 4 }).where(and(eq(scheduledEvents.refId, playerId), eq(scheduledEvents.kind, 'unknown_signal_spawn')));
    const original = HANDLERS.unknown_signal_spawn;
    HANDLERS.unknown_signal_spawn = () => Promise.reject(new Error('transient placement failure'));
    try {
      const worker = new EventWorker(f.db, f.clock, { pollMs: 50, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' }));
      await worker.tick();
      const [next] = await f.db.select().from(unknownSignalState).where(eq(unknownSignalState.playerId, playerId));
      expect(next!.nextAt!.getTime()).toBeGreaterThan(state!.nextAt!.getTime());
    } finally { HANDLERS.unknown_signal_spawn = original; }
  });

  it('repairs missing flight events and restarts a missing deployment schedule', async () => {
    const signal = await nowSignal();
    await launch(signal.id);
    await f.db.delete(scheduledEvents).where(eq(scheduledEvents.kind, 'unknown_signal_arrival'));
    await repairUnknownSignals(f.db, f.clock);
    expect(await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, signal.id), eq(scheduledEvents.kind, 'unknown_signal_arrival')))).toHaveLength(1);
    await repairUnknownSignals(f.db, f.clock);
    expect(await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, signal.id), eq(scheduledEvents.kind, 'unknown_signal_arrival')))).toHaveLength(1);
  });

  it('keeps discovery private and anonymously refreshes sensor traffic at flight changes', async () => {
    const shard = vi.spyOn(bus, 'publishShard');
    const personal = vi.spyOn(bus, 'publish');
    try {
      const signal = await nowSignal('ENERGY');
      expect(shard).not.toHaveBeenCalled();
      await launch(signal.id);
      await arrive(signal.id);
      await land(signal.id);
      expect(shard.mock.calls.map(call => call.slice(1))).toEqual([
        [f.seasonId, 'launch'], [f.seasonId, 'arrival'], [f.seasonId, 'arrival'],
      ]);
      expect(personal.mock.calls.every(call => call[1] === playerId)).toBe(true);
    } finally { shard.mockRestore(); personal.mockRestore(); }
  });

  it('shifts energy with vacation while discovery expiry and cadence keep wall time', async () => {
    const signal = await nowSignal();
    await f.db.update(planets).set({ deuterium: 1_000_000, signalBoostUntil: new Date(f.clock.now().getTime() + 3_600_000) }).where(eq(planets.id, originId));
    const original = await row(signal.id);
    const [state] = await f.db.select().from(unknownSignalState).where(eq(unknownSignalState.playerId, playerId));
    const quote = await vacationStatus(f.db, playerId, f.clock);
    expect(quote.blocker).toBeNull();
    const started = await startVacation(f.db, playerId, 1, quote.fingerprint, randomUUID(), f.clock);
    const [capital] = await f.db.select().from(planets).where(eq(planets.id, originId));
    expect(capital!.signalBoostUntil!.getTime()).toBe(original.appearedAt.getTime() + 25 * 3_600_000);
    expect((await row(signal.id)).expiresAt).toEqual(original.expiresAt);
    expect((await f.db.select().from(unknownSignalState).where(eq(unknownSignalState.playerId, playerId)))[0]!.nextAt).toEqual(state!.nextAt);
    f.clock.advance(30);
    await endVacation(f.db, playerId, started.active!.id, f.clock);
    const [back] = await f.db.select().from(planets).where(eq(planets.id, originId));
    expect(back!.signalBoostUntil!.getTime()).toBe(original.appearedAt.getTime() + 90 * 60_000);
  });

  it('blocks vacation while a signal squadron is out', async () => {
    const signal = await nowSignal();
    await launch(signal.id);
    const quote = await vacationStatus(f.db, playerId, f.clock);
    expect(quote.reasons).toContain('VACATION_FLEET');
  });

  it('expires open signals on a forced season close', async () => {
    const signal = await nowSignal();
    await forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);
    expect((await row(signal.id)).status).toBe('expired');
    expect((await f.db.select().from(unknownSignalState).where(eq(unknownSignalState.playerId, playerId)))[0]!.nextAt).toBeNull();
  });

  it('waits for signal flights before a scheduled season snapshot, like pirate raids', async () => {
    const signal = await nowSignal();
    await launch(signal.id);
    const [event] = await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.kind, 'season_end'));
    f.clock.set(event!.resolveAt);
    await onSeasonEnd({ db: f.db, clock: f.clock }, event!);
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    expect(season!.status).toBe('live');
  });

  it('drops all resource loot when only the Courier dies on the homeward leg', async () => {
    await f.db.update(seasons).set({ rulesetVersion: 16 }).where(eq(seasons.id, f.seasonId));
    const signal = await nowSignal();
    await launch(signal.id);
    await arrive(signal.id);
    const current = await row(signal.id);
    await f.db.update(unknownSignals).set({ damage: [{ hull: 'COURIER', count: 1, damageBp: 9999 }] }).where(eq(unknownSignals.id, signal.id));
    const duration = (current.returnAt!.getTime() - current.arriveAt!.getTime()) / 60_000;
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'ZONE', x: 0, y: 0, z: 0,
      radius: 100_000, intensityHpPerMinute: HULLS.COURIER.hp * 0.001 / duration, mode: 'EMIT', activeFrom: f.clock.now() });
    await land(signal.id);
    const [notice] = await f.db.select().from(notifications).where(and(eq(notifications.refId, signal.id), eq(notifications.kind, 'fleet_returned')));
    expect(notice!.payload).toMatchObject({ ships: 1, lootAlloy: 0, lootCrystal: 0, lootDeuterium: 0 });
    expect((await unknownSignalsForPlayer(f.db, playerId, f.clock)).signals.find(s => s.id === signal.id)?.fleet).toEqual({ DART: 1 });
  });

  it('runs spawn, arrival and return through the real worker and exposes an owned flight thread', async () => {
    const signal = await nowSignal();
    await launch(signal.id);
    const threads = await pendingThreads(f.db, originId, f.clock.now());
    expect(threads.find(thread => thread.id === signal.id)).toMatchObject({ kind: 'unknown_signal', recallable: true, leg: 'outbound' });
    f.clock.set((await row(signal.id)).arriveAt!);
    const worker = new EventWorker(f.db, f.clock, { pollMs: 50, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' }));
    expect((await worker.tick()).failed).toBe(0);
    expect((await row(signal.id)).status).toBe('returning');
    f.clock.set((await row(signal.id)).returnAt!);
    expect((await worker.tick()).failed).toBe(0);
    expect((await row(signal.id)).status).toBe('done');
  });

  it('never reveals an outcome if radiation destroys both ships outbound', async () => {
    await f.db.update(seasons).set({ rulesetVersion: 16 }).where(eq(seasons.id, f.seasonId));
    const signal = await nowSignal();
    await launch(signal.id);
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'ZONE', x: 0, y: 0, z: 0,
      radius: 100_000, intensityHpPerMinute: 1_000_000, mode: 'EMIT', activeFrom: f.clock.now() });
    await arrive(signal.id);
    expect(await row(signal.id)).toMatchObject({ status: 'lost', outcome: null, returnAt: null });
    expect(await f.db.select().from(notifications).where(eq(notifications.kind, 'unknown_signal_result'))).toHaveLength(0);
    expect((await row(signal.id)).fleet).toEqual({});
  });

  it('delivers to the commander capital after a launch colony changes hands', async () => {
    const colony = f.planetIds[1]!;
    await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: playerId }).where(eq(planets.id, colony));
    await f.db.update(units).set({ ownerPlayerId: playerId }).where(eq(units.planetId, colony));
    await giveUnits(f.db, colony, fleet);
    await grant(f.db, colony, 5000, 5000);
    const signal = await nowSignal();
    await dispatchUnknownSignal(f.db, playerId, signal.id, colony, fleet, randomUUID(), f.clock);
    await arrive(signal.id);
    await f.db.update(planets).set({ controllerPlayerId: f.playerIds[1]! }).where(eq(planets.id, colony));
    const [capital] = await f.db.select().from(planets).where(eq(planets.id, originId));
    const returning = (await pendingThreads(f.db, originId, f.clock.now())).find(thread => thread.id === signal.id);
    expect(returning?.path?.to).toEqual({ x: capital!.x, y: capital!.y, z: capital!.z });
    expect(await baysInUse(f.db, colony)).toBe(0);
    expect(await baysInUse(f.db, originId)).toBe(1);
    const [before] = await f.db.select().from(units).where(and(eq(units.planetId, originId), eq(units.hull, 'COURIER'), eq(units.location, 'home')));
    await land(signal.id);
    const [after] = await f.db.select().from(units).where(and(eq(units.planetId, originId), eq(units.hull, 'COURIER'), eq(units.location, 'home')));
    expect(after!.count).toBe(before!.count + 1);
    expect(after!.ownerPlayerId).toBe(playerId);
  });

  it('keeps a longer existing energy window and always boosts the capital from a colony flight', async () => {
    const colony = f.planetIds[1]!;
    await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: playerId }).where(eq(planets.id, colony));
    await giveUnits(f.db, colony, fleet);
    await grant(f.db, colony, 5000, 5000);
    const signal = await nowSignal('ENERGY');
    const deadline = new Date(f.clock.now().getTime() + 12 * 3_600_000);
    await f.db.update(planets).set({ signalBoostUntil: deadline }).where(eq(planets.id, originId));
    await dispatchUnknownSignal(f.db, playerId, signal.id, colony, fleet, randomUUID(), f.clock);
    await arrive(signal.id);
    const [capital] = await f.db.select().from(planets).where(eq(planets.id, originId));
    const [origin] = await f.db.select().from(planets).where(eq(planets.id, colony));
    expect(capital!.signalBoostUntil).toEqual(deadline);
    expect(origin!.signalBoostUntil).toBeNull();
  });

  it.each(['fuel', 'ships', 'bays', 'silent'] as const)('honours normal departure refusal: %s', async reason => {
    const signal = await nowSignal();
    if (reason === 'fuel') await f.db.update(planets).set({ deuterium: 0 }).where(eq(planets.id, originId));
    if (reason === 'ships') await giveUnits(f.db, originId, { COURIER: 0 });
    if (reason === 'bays') {
      await f.db.insert(unknownSignals).values(Array.from({ length: 20 }, (_, i) => ({ playerId, seasonId: f.seasonId,
        seed: String(i), x: 500, y: 0, z: 0, status: 'outbound' as const, originPlanetId: originId,
        appearedAt: f.clock.now(), expiresAt: f.clock.now() })));
    }
    if (reason === 'silent') await f.db.update(shards).set({ role: 'WAITING' });
    const codes = { fuel: 'INSUFFICIENT_FUEL', ships: 'NOT_ENOUGH_SHIPS', bays: 'NO_FREE_BAY', silent: 'SILENT_SPACE_LOCKED' };
    await expect(launch(signal.id)).rejects.toMatchObject({ code: codes[reason] });
    expect((await row(signal.id)).status).toBe('open');
  });

  it.each(['RESOURCES', 'ENERGY', 'DERELICT', 'PIRATES', 'SKIN'] as const)('resolves %s once, revealing on arrival and delivering at the correct time', async kind => {
    const signal = await nowSignal(kind);
    await launch(signal.id);
    expect((await row(signal.id)).outcome).toBeNull();
    await arrive(signal.id);
    const resolved = await row(signal.id);
    expect(resolved.outcome?.kind).toBe(kind);
    await f.db.transaction(tx => resolveUnknownSignalArrival(tx, signal.id, f.clock));
    const notices = await f.db.select().from(notifications).where(and(eq(notifications.playerId, playerId), eq(notifications.kind, 'unknown_signal_result')));
    expect(notices).toHaveLength(1);
    if (kind === 'PIRATES') {
      expect(resolved.status).toBe('lost');
      expect(resolved.returnAt).toBeNull();
      expect(await baysInUse(f.db, originId)).toBe(0);
    } else {
      expect(resolved.status).toBe('returning');
      if (kind === 'ENERGY') {
        const [capital] = await f.db.select().from(planets).where(eq(planets.id, originId));
        expect(capital!.signalBoostUntil!.getTime()).toBeGreaterThan(f.clock.now().getTime());
      }
      if (kind === 'SKIN') expect(await f.db.select().from(cosmeticEntitlements)).toHaveLength(1);
      await land(signal.id);
      const delivered = await row(signal.id);
      expect(delivered.status).toBe('done');
      expect(delivered.deliveredAt).toEqual(f.clock.now());
      await f.db.transaction(tx => resolveUnknownSignalReturn(tx, signal.id, f.clock));
      if (kind === 'DERELICT' && delivered.outcome?.kind === 'DERELICT') {
        const [ship] = await f.db.select().from(units).where(and(eq(units.planetId, originId), eq(units.location, 'home'), eq(units.hull, delivered.outcome.hull)));
        expect(ship!.damage).toEqual(expect.arrayContaining([expect.objectContaining({ damageBp: delivered.outcome.damageBp, count: 1 })]));
        expect(HULLS[delivered.outcome.hull].tier).toBeLessThanOrEqual(3);
      }
    }
  });

  it('converts a fully owned skin pool to deterministic resources', async () => {
    const signal = await nowSignal('SKIN');
    await f.db.insert(cosmeticEntitlements).values(COSMETICS.map(item => ({ accountId: f.accountIds[0]!, cosmeticId: item.id, source: 'MANUAL', orderRef: randomUUID() })));
    await launch(signal.id);
    await arrive(signal.id);
    const resolved = await row(signal.id);
    expect(resolved.outcome).toEqual(rollUnknownSignalOutcome(resolved.seed, 1, COSMETICS.map(item => item.id)));
    expect(resolved.outcome?.kind).toBe('RESOURCES');
  });

  it('keeps the signal and its seed out of every other player personal read', async () => {
    const signal = await nowSignal();
    expect((await unknownSignalsForPlayer(f.db, f.playerIds[1]!, f.clock)).signals).toEqual([]);
    const own = JSON.stringify(await unknownSignalsForPlayer(f.db, playerId, f.clock));
    expect(own).not.toContain('seed');
    expect(own).not.toContain((await row(signal.id)).seed);
  });

  it('uses productive time and additive windows in the server lazy tick', async () => {
    await setLevel(f.db, originId, 'REFINERY', 3);
    const start = f.clock.now();
    await f.db.update(planets).set({ bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0,
      lastTickAt: start, recoveryBoostUntil: new Date(start.getTime() + 3_600_000),
      signalBoostUntil: new Date(start.getTime() + 3_600_000) }).where(eq(planets.id, originId));
    const boosted = await f.db.transaction(tx => loadLocked(tx, originId, new FixedClock(new Date(start.getTime() + 3_600_000))));
    await f.db.update(planets).set({ bufferAlloy: 0, lastTickAt: start, recoveryBoostUntil: null, signalBoostUntil: null }).where(eq(planets.id, originId));
    const plain = await f.db.transaction(tx => loadLocked(tx, originId, new FixedClock(new Date(start.getTime() + 3_600_000))));
    expect(boosted.bufferAlloy).toBeCloseTo(plain.bufferAlloy * 2.5, 3);
  });

  it('has no dev trigger in production', async () => {
    await expect(devUnknownSignal(f.db, playerId, 'ENERGY', f.clock, 'production')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('unknown signal lifecycle review regressions', () => {
  it('removes a derelict destroyed by return-leg radiation from the actual landing roster', async () => {
    await f.db.update(seasons).set({ rulesetVersion: 16 }).where(eq(seasons.id, f.seasonId));
    const signal = await nowSignal('DERELICT');
    await launch(signal.id); await arrive(signal.id);
    const current = await row(signal.id);
    if (current.outcome?.kind !== 'DERELICT') throw new Error('Expected a derelict');
    const prize = current.outcome.hull;
    await f.db.update(unknownSignals).set({ damage: [{ hull: prize, count: 1, damageBp: 9999 }] }).where(eq(unknownSignals.id, signal.id));
    const duration = (current.returnAt!.getTime() - current.arriveAt!.getTime()) / 60_000;
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'ZONE', x: 0, y: 0, z: 0,
      radius: 100_000, intensityHpPerMinute: HULLS[prize].hp * 0.001 / duration, mode: 'EMIT', activeFrom: f.clock.now() });
    await land(signal.id);
    const returned = await row(signal.id);
    expect(returned.fleet?.[prize] ?? 0).toBe(prize === 'DART' ? 1 : 0);
    const [notice] = await f.db.select().from(notifications).where(and(eq(notifications.refId, signal.id), eq(notifications.kind, 'fleet_returned')));
    expect(notice!.payload).toMatchObject({ ships: 2 });
  });
  it('keeps the discovery state free while a T4 completion is waiting for the commander lock', async () => {
    await setLevel(f.db, originId, 'CORE', 9);
    const [order] = await f.db.insert(buildOrders).values({ planetId: originId, queue: 'CONSTRUCTION', slot: 0, kind: 'BUILDING', subject: 'CORE',
      startedAt: f.clock.now(), readyAt: f.clock.now(), remainingSeconds: 0, cost: { alloy: 0, crystal: 0, deuterium: 0 } }).returning();
    let completing: Promise<boolean> | undefined;
    try {
      await f.db.transaction(async tx => {
        const [self] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
        await tx.select().from(players).where(eq(players.id, playerId)).for('update');
        completing = f.db.transaction(t => applyBuildCompletion(t, order!.id, order!.readyAt.toISOString(), f.clock));
        let blocked = false;
        for (let i = 0; i < 200 && !blocked; i++) {
          const [check] = await tx.execute<{ n: number }>(sql`select count(*)::int as n from pg_stat_activity a where ${self!.pid} = any(pg_blocking_pids(a.pid))`);
          blocked = (check?.n ?? 0) > 0;
          if (!blocked) await new Promise(resolve => setTimeout(resolve, 5));
        }
        expect(blocked).toBe(true);
        await tx.select().from(unknownSignalState).where(eq(unknownSignalState.playerId, playerId)).for('update', { noWait: true });
      });
    } finally { await completing; }
  });
  it('keeps a delayed discovery whose due instant preceded the current vacation', async () => {
    const dueAt = new Date(f.clock.now().getTime() + 10 * 60_000);
    await f.db.update(unknownSignalState).set({ nextAt: dueAt }).where(eq(unknownSignalState.playerId, playerId));
    f.clock.advance(20);
    const quote = await vacationStatus(f.db, playerId, f.clock, 1);
    await startVacation(f.db, playerId, 1, quote.fingerprint, randomUUID(), f.clock);
    f.clock.advance(10);
    await f.db.transaction(tx => resolveUnknownSignalSpawn(tx, playerId, dueAt, f.clock));
    const visible = await unknownSignalsForPlayer(f.db, playerId, f.clock);
    expect(visible.signals).toHaveLength(1);
    expect(visible.signals[0]!.appearedAt).toEqual(dueAt);
  });
  it('does not create a delayed signal whose due instant fell inside an already ended vacation', async () => {
    const dueAt = new Date(f.clock.now().getTime() + 10 * 60_000);
    await f.db.update(unknownSignalState).set({ nextAt: dueAt }).where(eq(unknownSignalState.playerId, playerId));
    const quote = await vacationStatus(f.db, playerId, f.clock, 1);
    const vacation = await startVacation(f.db, playerId, 1, quote.fingerprint, randomUUID(), f.clock);
    f.clock.advance(30);
    await endVacation(f.db, playerId, vacation.active!.id, f.clock);
    await f.db.transaction(tx => resolveUnknownSignalSpawn(tx, playerId, dueAt, f.clock));
    expect((await unknownSignalsForPlayer(f.db, playerId, f.clock)).signals).toHaveLength(0);
  });
  it.each(['upgrade', 'capture'] as const)('permanently stops discovery on reaching T4 through a colony %s, even if the colony is lost before the next spawn', async source => {
    await setLevel(f.db, originId, 'CORE', 1);
    const colony = f.planetIds[1]!;
    await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: source === 'upgrade' ? playerId : f.playerIds[1]! }).where(eq(planets.id, colony));
    await setLevel(f.db, colony, 'CORE', source === 'upgrade' ? 9 : 10);
    const signal = await nowSignal();
    if (source === 'upgrade') {
      const [order] = await f.db.insert(buildOrders).values({ planetId: colony, queue: 'CONSTRUCTION', slot: 0, kind: 'BUILDING', subject: 'CORE',
        startedAt: f.clock.now(), readyAt: f.clock.now(), remainingSeconds: 0, cost: { alloy: 0, crystal: 0, deuterium: 0 } }).returning();
      await f.db.transaction(tx => applyBuildCompletion(tx, order!.id, order!.readyAt.toISOString(), f.clock));
    } else {
      await f.db.transaction(tx => transferPlanetControl(tx, { targetPlanetId: colony, newPlayerId: playerId,
        expectedControllerPlayerId: f.playerIds[1]!, now: f.clock.now(), protectedUntil: f.clock.now() }));
    }
    await f.db.transaction(tx => transferPlanetControl(tx, { targetPlanetId: colony, newPlayerId: f.playerIds[1]!,
      expectedControllerPlayerId: playerId, now: f.clock.now(), protectedUntil: f.clock.now() }));
    const [state] = await f.db.select().from(unknownSignalState).where(eq(unknownSignalState.playerId, playerId));
    expect(state!.nextAt).toBeNull();
    expect((await row(signal.id)).status).toBe('open');
  });
  it('lands a damaged T3 prize for a T1 commander despite a full Hangar and missing research, without builtEver credit', async () => {
    await f.db.update(seasons).set({ rulesetVersion: 16 }).where(eq(seasons.id, f.seasonId));
    await setLevel(f.db, originId, 'CORE', 1);
    await setLevel(f.db, originId, 'SHIPYARD', 0);
    await giveUnits(f.db, originId, { CITADEL: 10_000 });
    const signal = await nowSignal('DERELICT');
    let seed: string | undefined;
    for (let i = 0; i < 10_000; i++) {
      const candidate = `review:t3-prize:${String(i)}`;
      const rolled = rollUnknownSignalOutcome(candidate, 1, []);
      if (rolled.kind === 'DERELICT' && HULLS[rolled.hull].tier === 3) { seed = candidate; break; }
    }
    if (!seed) throw new Error('Expected a T1 → T3 prize seed');
    await f.db.update(unknownSignals).set({ seed }).where(eq(unknownSignals.id, signal.id));
    const [before] = await f.db.select().from(planets).where(eq(planets.id, originId));
    await launch(signal.id); await arrive(signal.id); await land(signal.id);
    const found = (await row(signal.id)).outcome;
    if (found?.kind !== 'DERELICT') throw new Error('Expected a derelict');
    const [ship] = await f.db.select().from(units).where(and(eq(units.planetId, originId), eq(units.location, 'home'), eq(units.hull, found.hull)));
    expect(ship!.count).toBe(1);
    expect(ship!.damage).toEqual(expect.arrayContaining([expect.objectContaining({ count: 1, damageBp: found.damageBp })]));
    expect((await f.db.select().from(planets).where(eq(planets.id, originId)))[0]!.builtEver).toEqual(before!.builtEver);
    const groups = [{ hull: found.hull, count: 1, damageBp: found.damageBp }];
    await maintenanceAction(f.db, playerId, originId, 'DOCK', { source: 'HOME', groups }, randomUUID(), f.clock);
    const [lot] = await f.db.select().from(shipDamageLots).where(and(eq(shipDamageLots.planetId, originId), eq(shipDamageLots.hull, found.hull)));
    const repaired = await startRepair(f.db, originId, { lotIds: [lot!.id] }, f.clock, playerId, randomUUID());
    const [order] = await f.db.select().from(buildOrders).where(eq(buildOrders.id, repaired.orderId));
    expect(order!.cost).toEqual(shipHpRepairCost(groups, repairPct({})));
  });
  it.each(['ordinary', 'overlap', 'disrupted', 'full'] as const)('preserves the earned energy window when a capital tick precedes a delayed arrival: %s', async scenario => {
    const signal = await nowSignal('ENERGY');
    await launch(signal.id);
    const flight = await row(signal.id);
    const arrival = flight.arriveAt!;
    const result = rollUnknownSignalOutcome(flight.seed, 1, []);
    if (result.kind !== 'ENERGY') throw new Error('Expected energy scenario');
    const until = new Date(arrival.getTime() + result.hours * 3_600_000);
    const oldUntil = scenario === 'overlap' ? new Date(arrival.getTime() + 5 * 60_000) : null;
    const [snapshot] = await f.db.update(planets).set({ lastTickAt: arrival, bufferAlloy: scenario === 'full' ? 1_000_000 : 0,
      bufferCrystal: 0, bufferDeuterium: 0, signalBoostUntil: until,
      disruptedUntil: scenario === 'disrupted' ? new Date(arrival.getTime() + 10 * 60_000) : null,
    }).where(eq(planets.id, originId)).returning();
    f.clock.set(new Date(arrival.getTime() + 15 * 60_000));
    const expected = await f.db.transaction(tx => loadLocked(tx, originId, f.clock));
    await f.db.update(planets).set({ ...snapshot!, id: undefined, signalBoostUntil: oldUntil }).where(eq(planets.id, originId));
    await f.db.transaction(tx => loadLocked(tx, originId, f.clock));
    await f.db.transaction(tx => resolveUnknownSignalArrival(tx, signal.id, f.clock));
    const actual = await f.db.transaction(tx => loadLocked(tx, originId, f.clock));
    // Alloy/Crystal buffers are PostgreSQL REAL. The delayed path persists an
    // extra intermediate tick, so compare within two float32 rounding errors.
    expect(Math.abs(actual.bufferAlloy - expected.bufferAlloy))
      .toBeLessThanOrEqual(Math.max(1, Math.abs(expected.bufferAlloy)) * 2 ** -22);
    expect(Math.abs(actual.bufferCrystal - expected.bufferCrystal))
      .toBeLessThanOrEqual(Math.max(1, Math.abs(expected.bufferCrystal)) * 2 ** -22);
    expect(actual.bufferDeuterium).toBeCloseTo(expected.bufferDeuterium, 5);
    expect(actual.signalBoostUntil).toEqual(until);
  });

  it('can recall after radiation has destroyed the entire squadron', async () => {
    await f.db.update(seasons).set({ rulesetVersion: 16 }).where(eq(seasons.id, f.seasonId));
    const signal = await nowSignal();
    await launch(signal.id);
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'ZONE', x: 0, y: 0, z: 0,
      radius: 100_000, intensityHpPerMinute: 1_000_000, mode: 'EMIT', activeFrom: f.clock.now() });
    f.clock.advance(0.1);
    expect(await recallUnknownSignal(f.db, playerId, signal.id, randomUUID(), f.clock)).toEqual({ signalId: signal.id, returnAt: null });
    expect((await row(signal.id)).status).toBe('lost');
    expect(await baysInUse(f.db, originId)).toBe(0);
  });

  it('retries a skin grant against a purchase committed while arrival was waiting on uniqueness', async () => {
    const signal = await nowSignal('SKIN');
    await launch(signal.id);
    f.clock.set((await row(signal.id)).arriveAt!);
    const first = rollUnknownSignalOutcome((await row(signal.id)).seed, 1, []);
    if (first.kind !== 'SKIN') throw new Error('Skin scenario must select a skin');
    let arriving: Promise<void> | undefined;
    try {
      await f.db.transaction(async tx => {
        const [self] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
        await tx.insert(cosmeticEntitlements).values({ accountId: f.accountIds[0]!, cosmeticId: first.cosmeticId, source: 'PURCHASE', orderRef: randomUUID() });
        arriving = f.db.transaction(t => resolveUnknownSignalArrival(t, signal.id, f.clock));
        let blocked = false;
        for (let i = 0; i < 200 && !blocked; i++) {
          const [check] = await tx.execute<{ n: number }>(sql`select count(*)::int as n from pg_stat_activity a where ${self!.pid} = any(pg_blocking_pids(a.pid))`);
          blocked = (check?.n ?? 0) > 0;
          if (!blocked) await new Promise(resolve => setTimeout(resolve, 5));
        }
        expect(blocked).toBe(true);
      });
    } finally { await arriving; }
    const result = (await row(signal.id)).outcome;
    expect(result?.kind).toBe('SKIN');
    expect(result).not.toEqual(first);
    expect(await f.db.select().from(cosmeticEntitlements)).toHaveLength(2);
  });

  it('returns from a colony that became neutral before arrival', async () => {
    const colony = f.planetIds[1]!;
    await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: playerId }).where(eq(planets.id, colony));
    await giveUnits(f.db, colony, fleet);
    await grant(f.db, colony, 5000, 5000);
    const signal = await nowSignal();
    await dispatchUnknownSignal(f.db, playerId, signal.id, colony, fleet, randomUUID(), f.clock);
    await f.db.update(planets).set({ kind: 'NEUTRAL', controllerPlayerId: null }).where(eq(planets.id, colony));
    await arrive(signal.id);
    expect((await row(signal.id)).status).toBe('returning');
    await land(signal.id);
    expect((await row(signal.id)).status).toBe('done');
  });
  it('blocks reclaim even if a flight currently has no parked units', async () => {
    const signal = await nowSignal();
    await launch(signal.id);
    await f.db.delete(units).where(eq(units.location, `unknown-signal:${signal.id}`));
    expect(await f.db.transaction(async tx => busy(tx, [originId], playerId,
      await commanderRows(tx, [originId], playerId), f.clock.now()))).toBe(true);
  });

  it('cleans spawn and expiry events when removing a quiet commander', async () => {
    const signal = await nowSignal();
    await f.db.transaction(async tx => demolish(tx, [originId], playerId, await commanderRows(tx, [originId], playerId)));
    expect(await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.refId, playerId))).toHaveLength(0);
    expect(await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.refId, signal.id))).toHaveLength(0);
    expect(await f.db.select().from(unknownSignalState).where(eq(unknownSignalState.playerId, playerId))).toHaveLength(0);
  });

  it('retires the old discovery and moves its cadence to the new galaxy', async () => {
    const signal = await nowSignal();
    f.clock.advance(48 * 60);
    const target = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
    expect((await transferCommander(f.db, playerId, target!.id, f.clock)).status).toBe('MOVED');
    expect((await row(signal.id)).status).toBe('expired');
    const [state] = await f.db.select().from(unknownSignalState).where(eq(unknownSignalState.playerId, playerId));
    expect(state!.seasonId).toBe(target!.id);
    expect(state!.nextAt!.getTime()).toBeGreaterThan(f.clock.now().getTime());
    const [event] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, playerId), eq(scheduledEvents.kind, 'unknown_signal_spawn')));
    expect(event!.seasonId).toBe(target!.id);
  });

  it('does not move an airborne signal with missing units to another galaxy', async () => {
    const signal = await nowSignal();
    await launch(signal.id);
    await f.db.delete(units).where(eq(units.location, `unknown-signal:${signal.id}`));
    f.clock.advance(48 * 60);
    const target = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
    expect((await transferCommander(f.db, playerId, target!.id, f.clock)).status).toBe('FLIGHT');
  });

  it('uses the still-owned capital for radiation on a redirected homeward route', async () => {
    const colony = f.planetIds[1]!;
    await f.db.update(seasons).set({ rulesetVersion: 16 }).where(eq(seasons.id, f.seasonId));
    await f.db.update(planets).set({ x: 0, y: 0, z: 0 }).where(eq(planets.id, originId));
    await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: playerId, x: 4000, y: 0, z: 0 }).where(eq(planets.id, colony));
    await giveUnits(f.db, colony, fleet);
    await grant(f.db, colony, 5000, 5000);
    const signal = await nowSignal();
    await f.db.update(unknownSignals).set({ x: 0, y: 1000, z: 0 }).where(eq(unknownSignals.id, signal.id));
    await dispatchUnknownSignal(f.db, playerId, signal.id, colony, fleet, randomUUID(), f.clock);
    await arrive(signal.id);
    await f.db.update(planets).set({ controllerPlayerId: f.playerIds[1]! }).where(eq(planets.id, colony));
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'ZONE', x: 0, y: 0, z: 0,
      radius: 500, intensityHpPerMinute: 1_000_000, mode: 'EMIT', activeFrom: f.clock.now() });
    await land(signal.id);
    const [notice] = await f.db.select().from(notifications).where(and(eq(notifications.refId, signal.id), eq(notifications.kind, 'fleet_returned')));
    expect(notice!.payload).toMatchObject({ ships: 0, lootAlloy: 0, lootCrystal: 0, lootDeuterium: 0 });
  });

  it('returns a recalled squadron at the surviving fleet speed after the slower warship is lost', async () => {
    await f.db.update(seasons).set({ rulesetVersion: 16 }).where(eq(seasons.id, f.seasonId));
    const signal = await nowSignal();
    await launch(signal.id);
    const original = await row(signal.id);
    const elapsed = (original.arriveAt!.getTime() - original.departAt!.getTime()) / 4;
    await f.db.update(unknownSignals).set({ damage: [{ hull: 'DART', count: 1, damageBp: 9999 }] }).where(eq(unknownSignals.id, signal.id));
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'ZONE', x: 0, y: 0, z: 0,
      radius: 100_000, intensityHpPerMinute: HULLS.DART.hp * 0.001 / (elapsed / 60_000), mode: 'EMIT', activeFrom: f.clock.now() });
    f.clock.set(new Date(original.departAt!.getTime() + elapsed));
    await recallUnknownSignal(f.db, playerId, signal.id, randomUUID(), f.clock);
    const recalled = await row(signal.id);
    expect(recalled.fleet).toEqual({ COURIER: 1 });
    expect(recalled.returnAt!.getTime() - f.clock.now().getTime()).toBeLessThan(elapsed - 1);
  });
});
