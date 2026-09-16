import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { FAULT, repairCost, repairMinutes, seededFrom } from '@astera/rules';
import { atMinute, type Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import { planetFaults, planets } from '../db/schema.js';
import { schedule } from '../worker/queue.js';
import type { Handler } from '../worker/handlers.js';
import { publish, publishShard } from '../stream/bus.js';
import { assertWorldOperational, GameError, loadLocked } from './planet.js';
import { dropPendingFaultEvents, flushVaultLeak } from './faults.js';
import { rescheduleLoyaltyWatch } from './loyalty.js';
import { refreshSensorEpoch } from './sensorHistory.js';

/**
 * ARIZA ONARIMI — three lanes, running at once, and none of them can be called off.
 * `docs/colony-faults-plan.md` §6.
 *
 * IT IS NOT `build_orders` AND THAT WAS THE FIRST DECISION. That queue is SERIAL by
 * design (D4: the next order waits for the head) and it is CANCELLABLE. Repairs are
 * neither. Sharing the table would have put a flag on every read of it and left two
 * kinds of work in one lane with opposite rules — the sort of two-answer question this
 * codebase keeps paying for. The repair lives on the fault row instead, guarded by a
 * partial unique index cut to exactly the shape `build_orders` uses for its own slots.
 *
 * THERE IS NO CANCEL ENDPOINT, deliberately and by owner instruction. Five to fifteen
 * minutes is short enough that a way out would cost more screen than it saved, and the
 * absence is the interface's clearest statement about what starting one means.
 */

export interface FaultRepairStarted {
  faultId: string;
  slot: number;
  readyAt: Date;
  cost: { alloy: number; crystal: number; deuterium: number };
}

/**
 * Pay for a repair and start it.
 *
 * THE WHOLE THING IS ONE TRANSACTION AROUND THE PLANET ROW LOCK, so the four ways this
 * can be raced all resolve the same way: two taps on the same fault, four taps on four
 * faults, a repair racing the spawn that would have written a ninth, and a repair
 * racing a raid that empties the vault it is about to be paid from.
 */
export async function startFaultRepair(
  db: Db,
  planetId: string,
  faultId: string,
  clock: Clock,
  playerId: string,
): Promise<FaultRepairStarted> {
  return db.transaction(async (tx) => {
    // Advances the world first, so the stock this is about to spend is the stock the
    // player is actually holding — and so a leaking vault's bleed is counted before the
    // repair that stops it.
    const origin = await loadLocked(tx, planetId, clock, { expectedPlayerId: playerId });
    assertWorldOperational(origin);

    const [fault] = await tx.select().from(planetFaults)
      .where(and(eq(planetFaults.id, faultId), eq(planetFaults.planetId, planetId)))
      .for('update');
    if (!fault) throw new GameError('FAULT_NOT_FOUND', 'Nothing here is broken like that', 404);
    if (fault.repairReadyAt !== null) {
      throw new GameError('FAULT_ALREADY_REPAIRING', 'A crew is already on that one', 409);
    }

    /*
      THE FREE LANE IS CHOSEN HERE AND CONFIRMED BY THE INDEX.

      Reading the taken slots and picking a free one is a check-then-act, and two taps
      inside the same millisecond would both read the same gap. The partial unique index
      is what actually decides it: the loser's insert fails and its transaction rolls
      back with nothing spent. This is the same shape `assertFreeBay` and the build
      queue both use, for the same reason.
    */
    const busy = await tx.select({ slot: planetFaults.repairSlot }).from(planetFaults)
      .where(and(eq(planetFaults.planetId, planetId), isNotNull(planetFaults.repairReadyAt)));
    const taken = new Set(busy.map((row) => row.slot));
    const slot = [...Array(FAULT.repairSlots).keys()].find((n) => !taken.has(n));
    if (slot === undefined) {
      throw new GameError(
        'FAULT_REPAIR_SLOTS_FULL',
        `All ${String(FAULT.repairSlots)} repair crews are out. One has to finish first.`,
        409,
        { slots: FAULT.repairSlots },
      );
    }

    const cost = repairCost(fault.kind, origin.buildings.CORE);
    if (origin.alloy < cost.alloy || origin.crystal < cost.crystal) {
      throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough to pay the crew', 400, {
        context: 'faultRepair',
        alloy: cost.alloy,
        crystal: cost.crystal,
      });
    }

    const now = clock.now();
    /*
      SEEDED FROM THE FAULT, so the duration is a property of this break rather than of
      the instant somebody pressed the button — two commanders repairing the same kind
      of fault get different answers, and the same fault re-read gives the same one.
    */
    const minutes = repairMinutes(seededFrom('fault-repair', faultId));
    const readyAt = atMinute(now, minutes);

    await tx.update(planets)
      .set({
        alloy: sql`${planets.alloy} - ${cost.alloy}`,
        crystal: sql`${planets.crystal} - ${cost.crystal}`,
      })
      .where(eq(planets.id, planetId));

    await tx.update(planetFaults)
      .set({ repairSlot: slot, repairStartedAt: now, repairReadyAt: readyAt, repairCost: cost })
      .where(eq(planetFaults.id, faultId));

    await schedule(tx, {
      seasonId: origin.seasonId,
      kind: 'fault_repair_complete',
      refId: faultId,
      dedupeKey: `fault-repair:${faultId}`,
      resolveAt: readyAt,
    });

    return { faultId, slot, readyAt, cost };
  });
}

/**
 * THE REPAIR LANDS: the fault stops existing.
 *
 * Deleting the row IS the repair — there is no "repaired" state to read, because a
 * fault that is over affects nothing and a history of what once broke is not something
 * any surface asks for. It also makes the handler idempotent for free: a redelivered
 * event finds no row and does nothing.
 */
export async function completeFaultRepair(tx: Tx, faultId: string, now: Date): Promise<boolean> {
  const [fault] = await tx.select().from(planetFaults)
    .where(eq(planetFaults.id, faultId))
    .for('update');
  if (!fault) return false;

  if (fault.kind === 'VAULT_LEAK') {
    /*
      WHAT BLED BEFORE THE CREW ARRIVED IS ALREADY GONE, and it goes to orbit rather
      than back into the vault. The alternative — dropping the pending pile on repair —
      would make a well-timed repair refund the last twenty minutes of a leak, which is
      a discount for having been lucky about when the flush last fired.
    */
    await flushVaultLeak(tx, fault.planetId, now, { force: true });
    await dropPendingFaultEvents(tx, fault.planetId, ['vault_leak_flush']);
  }
  await tx.delete(planetFaults).where(eq(planetFaults.id, faultId));
  if (fault.kind === 'TELESCOPE_FAULT') {
    await refreshSensorEpoch(tx, fault.planetId, now);
  }
  /*
    ONE FEWER FAULT MEANS A SHALLOWER FALL — or none at all, and then the watch is
    dropped entirely. A repair that did not re-book this would leave a secession event
    standing at the instant the world WOULD have reached zero had nobody acted, which is
    the one outcome the commander just paid to prevent.
  */
  const [world] = await tx.select({ seasonId: planets.seasonId }).from(planets)
    .where(eq(planets.id, fault.planetId));
  if (world) {
    await rescheduleLoyaltyWatch(tx, { seasonId: world.seasonId, planetId: fault.planetId, now });
    // Repairing the Core relights the public Aegis dome. Invalidate the shared
    // silhouette transactionally, before any client can keep drawing it dark.
    if (fault.kind === 'CORE_OUTAGE') await publishShard(tx, world.seasonId, 'world');
  }
  return true;
}

export const onFaultRepairComplete: Handler = async ({ db, clock }, event) => {
  if (!event.refId) return;
  const faultId = event.refId;
  await db.transaction(async (tx) => {
    const [fault] = await tx.select({
      planetId: planetFaults.planetId,
      repairReadyAt: planetFaults.repairReadyAt,
    }).from(planetFaults)
      .where(eq(planetFaults.id, faultId));
    if (!fault?.repairReadyAt) return;

    const handledAt = clock.now();
    const boundary = fault.repairReadyAt;
    if (boundary > handledAt) {
      throw new Error(`fault repair ${faultId} was delivered before repair_ready_at`);
    }

    let world;
    try {
      /*
        `repair_ready_at` IS THE EFFECTIVE INSTANT, not the worker's wake-up time.

        Settle the broken interval to that boundary, lift the fault there, then settle
        any worker lateness with the repaired world. Using `clock.now()` for the first
        tick extended every outage, leak and loyalty penalty by however late the worker
        happened to be.
      */
      world = await loadLocked(tx, fault.planetId, { now: () => boundary }, { requireLive: false });
    } catch (err) {
      if (err instanceof GameError
        && (err.code === 'PLANET_NOT_FOUND' || err.code === 'PLANET_NOT_OWNED')) return;
      throw err;
    }
    if (!await completeFaultRepair(tx, faultId, boundary)) return;
    if (handledAt > boundary) {
      await loadLocked(tx, fault.planetId, { now: () => handledAt }, { requireLive: false });
    }
    // The open screen also owns an absolute readyAt timer; this wake covers a player
    // looking elsewhere and closes the ordinary timer/worker race, as build completion does.
    await publish(tx, world.playerId, 'fault_repair_complete');
  });
};
