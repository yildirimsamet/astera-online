import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { honorObservations, players, scheduledEvents, seasons, units } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { observeHonorOwner } from '../src/services/honorReference.js';
import { addHpRadiationSource } from '../src/services/radiation.js';
import { EventWorker } from '../src/worker/loop.js';
import { giveUnits, seedWorld, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let home: string;
let owner: string;
beforeEach(async () => {
  f = await seedWorld(2);
  home = f.planetIds[1]!;
  owner = f.playerIds[1]!;
  await f.db.update(seasons).set({ radiationBombStartsAt: f.clock.now(), rulesetVersion: 18 }).where(eq(seasons.id, f.seasonId));
  await f.db.update(players).set({ newcomerShieldUntil: null, recoveryShieldUntil: null });
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock));
});
afterAll(async () => { await (await testDb()).close(); });

it('a late radiation casualty timer still settles after the same commander recorded a newer Honor inventory', async () => {
  await giveUnits(f.db, home, { PIKE: 4, RAMPART: 2 });
  await addHpRadiationSource(f.db, { seasonId: f.seasonId, anchor: { kind: 'PLANET', planetId: home },
    radius: 1, intensityHpPerMinute: 12.5, mode: 'EMIT', label: 'Operator source', activeFrom: f.clock.now() }, f.clock);
  const [timer] = await f.db.select().from(scheduledEvents).where(and(
    eq(scheduledEvents.kind, 'planet_radiation_boundary'), eq(scheduledEvents.refId, home), eq(scheduledEvents.status, 'pending')));
  expect(timer).toBeDefined();
  // Pikes die at the timer. Before the worker reaches it, an earlier event of the
  // same commander (e.g. a yard completion elsewhere) records a newer inventory.
  const due = timer!.resolveAt.getTime();
  await giveUnits(f.db, home, { RAMPART: 1 });
  await f.db.transaction(tx => observeHonorOwner(tx, owner, new Date(due + 500)));
  f.clock.set(new Date(due + 1000));
  await new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' })).tick();
  const [after] = await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.id, timer!.id));
  expect(after?.lastError ?? null).toBeNull();
  expect(after?.status).toBe('done');
  const pikes = await f.db.select().from(units).where(and(eq(units.planetId, home), eq(units.hull, 'PIKE')));
  expect(pikes.reduce((sum, row) => sum + row.count, 0)).toBe(0);
  const observed = await f.db.select().from(honorObservations).where(eq(honorObservations.playerId, owner));
  expect(observed.every(row => row.at.getTime() <= f.clock.now().getTime())).toBe(true);
});

it('a commander inventory read after a newer committed observation is stamped no earlier than it, never rejected', async () => {
  const start = f.clock.now().getTime();
  // Two transactions read their clocks first; the later clock takes the player lock first.
  await giveUnits(f.db, home, { RAMPART: 1 });
  await f.db.transaction(tx => observeHonorOwner(tx, owner, new Date(start + 2000)));
  await giveUnits(f.db, home, { RAMPART: 2 });
  await f.db.transaction(tx => observeHonorOwner(tx, owner, new Date(start + 1000)));
  const rows = await f.db.select().from(honorObservations).where(eq(honorObservations.playerId, owner));
  const latest = rows.toSorted((a, b) => a.at.getTime() - b.at.getTime() || a.id - b.id).at(-1)!;
  expect(latest.at.getTime()).toBe(start + 2000);
  expect(latest.navy).toBeGreaterThan(rows.find(row => row.at.getTime() === start + 2000 && row.id !== latest.id)!.navy);
});
