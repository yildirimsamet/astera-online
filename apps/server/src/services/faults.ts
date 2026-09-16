import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  DEBRIS,
  FAULT,
  drawFaults,
  faultsPossible,
  hasFault,
  nextFaultGapMinutes,
  seededFrom,
  type FaultKind,
  type FaultSet,
  type Rng,
} from '@astera/rules';
import type { Queryable, Tx } from '../db/client.js';
import { buildings, debrisFields, planetFaults, planets, scheduledEvents } from '../db/schema.js';
import { schedule } from '../worker/queue.js';
import type { Handler } from '../worker/handlers.js';
import { publishShard } from '../stream/bus.js';
import { notify } from './notifications.js';
import { GameError, loadLocked } from './planet.js';
import { rescheduleLoyaltyWatch } from './loyalty.js';
import { refreshSensorEpoch } from './sensorHistory.js';

/**
 * KOLONİ ARIZALARI — the server side. `docs/colony-faults-plan.md`.
 *
 * WHAT IS *NOT* HERE IS THE POINT. Five of the eight faults are enforced by the code
 * that owns the thing they stop, because that code is the only place the rule can be
 * complete:
 *
 *   · the three production outages → `advanceEconomy`, the lazy tick every
 *     transaction in the game runs;
 *   · `VAULT_LEAK` → the same tick, plus the flush that turns what bled into a field;
 *   · `SHIPYARD_REVOLT` → `assertFreeBay`, the one reservation every departure makes;
 *   · `TELESCOPE_FAULT` → `sensorPosts`, the one place a level becomes a radius;
 *   · `PROSPECTOR_FAULT` → the two mining launches.
 *
 * A central switchboard that re-stated any of those would be a second opinion about a
 * rule that already has an owner, and second opinions in this codebase drift.
 *
 * What lives here is the one rule with TWO readers and no natural owner between them.
 */

/**
 * IS THIS WORLD'S DEFENCE ANSWERING? `CORE_OUTAGE`.
 *
 * False means the Aegis is dark and the ground emplacements have no fire control. The
 * ships standing at home are unaffected — a crew does not need the Command Core to fly
 * — so this is never the whole answer to "can this world defend itself", only to "is
 * the hardware up".
 *
 * TWO CALLERS, AND THEY WOULD OTHERWISE DISAGREE. An ordinary raid resolves in
 * `worker/handlers.ts`; a Death Star strike resolves in `strategic.ts` and reports how
 * much shield it destroyed. With the Core out that report would claim to have burnt
 * through a dome that was never lit, which is the intel layer describing a fight that
 * did not happen.
 *
 * IT IS A SILENCE, NOT A LOSS. Repair the Core and the shield is back at whatever it
 * had regenerated to; nothing here writes the column down.
 */
export const defenceOnline = (faults: FaultSet): boolean => !hasFault(faults, 'CORE_OUTAGE');

/* ── the lifecycle ───────────────────────────────────────────────────── */

/**
 * SCHEDULE THE NEXT THING TO GO WRONG HERE.
 *
 * One pending `fault_spawn` per colony, for ever: it fires, writes a fault (or finds
 * nothing left to break) and books itself again. There is no per-planet timer and no
 * sweep — the queue IS the timer, which is the same bargain every other dated moment
 * in this game makes.
 *
 * `dedupeKey` IS WHAT MAKES A REDELIVERY HARMLESS. A worker that commits and dies
 * before `complete()` has its row returned by the reaper and handled again; without a
 * key the second run would book a SECOND spawn timer and the colony would break twice
 * as fast for the rest of the season, silently and for ever. Keyed on the event that
 * caused it, the second insert collides and does nothing.
 *
 * The very first timer on a world has no causing event, so it keys on the planet: a
 * colony reaching Core 6 twice — a re-read, a retried build completion — must not end
 * up with two.
 */
export async function scheduleNextFaultSpawn(
  tx: Queryable,
  input: { seasonId: string; planetId: string; now: Date; cause?: string; rng: Rng },
): Promise<void> {
  await schedule(tx, {
    seasonId: input.seasonId,
    kind: 'fault_spawn',
    refId: input.planetId,
    ...(input.cause === undefined ? {} : { dedupeKey: `fault-spawn:${input.cause}` }),
    resolveAt: new Date(input.now.getTime() + nextFaultGapMinutes(input.rng) * 60_000),
  });
}

/**
 * ARM A COLONY THAT HAS JUST BECOME BREAKABLE. Called when a Core reaches the gate.
 *
 * Silent on a world that cannot break and on one already armed, so it is safe to call
 * from anywhere that might have changed either — which is the point: the alternative
 * is remembering to arm it at each of them.
 */
export async function armFaults(
  tx: Queryable,
  input: { seasonId: string; planetId: string; kind: 'CAPITAL' | 'COLONY' | 'NEUTRAL'; coreLevel: number; now: Date },
): Promise<void> {
  if (!faultsPossible({ kind: input.kind, coreLevel: input.coreLevel, plantLevel: 0 })) return;
  /*
    A PENDING TIMER IS THE GUARD, NOT A DEDUPE KEY — AND THIS WAS A BUG.

    The first version keyed on `fault-spawn:arm:<planetId>`, which reads as idempotent
    and is not: `events_dedupe_key_idx` is a plain unique index, so a COMPLETED event
    holds its key for the rest of the season. A colony that seceded and was settled again
    would climb back past Core 6, collide with the key its previous life left behind, and
    never break again — permanently, silently, and only on worlds that had already been
    lost once.

    Every caller holds the planet row lock (`applyBuildCompletion` takes one before this,
    and so does every other path that can change a Core), so reading the pending timer and
    acting on it cannot race itself.
  */
  const [active] = await tx
    .select({ id: scheduledEvents.id })
    .from(scheduledEvents)
    .where(and(
      eq(scheduledEvents.kind, 'fault_spawn'),
      eq(scheduledEvents.refId, input.planetId),
      inArray(scheduledEvents.status, ['pending', 'processing']),
    ))
    .limit(1);
  if (active) return;
  await scheduleNextFaultSpawn(tx, {
    seasonId: input.seasonId,
    planetId: input.planetId,
    now: input.now,
    rng: seededFrom('fault-arm', input.planetId, input.now.getTime()),
  });
}

/**
 * WHAT ONE COLONY IS CURRENTLY RUNNING, as the scheduler needs to see it.
 *
 * Deliberately NOT `loadLocked`: this runs inside the worker with the planet row
 * already locked by the caller, and it needs three figures rather than a whole world.
 */
export async function faultStateOf(
  tx: Tx,
  planetId: string,
): Promise<{ kind: 'CAPITAL' | 'COLONY' | 'NEUTRAL'; coreLevel: number; plantLevel: number; active: FaultKind[] } | null> {
  const [world] = await tx.select({ kind: planets.kind }).from(planets).where(eq(planets.id, planetId));
  if (!world) return null;
  const [levels, active] = await Promise.all([
    tx.select().from(buildings).where(eq(buildings.planetId, planetId)),
    tx.select({ kind: planetFaults.kind }).from(planetFaults).where(eq(planetFaults.planetId, planetId)),
  ]);
  const levelOf = (type: string): number => levels.find((row) => row.type === type)?.level ?? 0;
  return {
    kind: world.kind,
    coreLevel: levelOf('CORE'),
    plantLevel: levelOf('DEUTERIUM_PLANT'),
    active: active.map((row) => row.kind),
  };
}

/**
 * SCHEDULE THE NEXT MOMENT WHAT HAS BLED BECOMES A FIELD ANYBODY CAN SEE.
 *
 * Lives for exactly as long as the `VAULT_LEAK` does: armed when the fault is written,
 * re-armed by each flush, dropped by the repair.
 *
 * WHY THIS IS AN EVENT AND THE ACCRUAL IS NOT. What leaks accrues lazily and costs
 * nothing; what it BECOMES is a public landmark that decays in forty minutes and
 * belongs to whoever reaches it first. Written only when the owner next opens the game,
 * a day of leakage would appear as one fresh pile nobody could have raced for — the
 * neighbour would never see the leak at all, and the decay clock would be a lie. This
 * is the exact class the architecture reserves for the queue: a moment that has to
 * happen even though nobody is watching.
 */
export async function scheduleLeakFlush(
  tx: Queryable,
  input: { seasonId: string; planetId: string; now: Date; cause: string },
): Promise<void> {
  /*
    THE KEY IS ALWAYS A ROW ID — the fault that started the leak, or the flush event that
    is booking the next one. Both are unique for the life of the database, which is what
    a permanent unique index requires; see `armFaults` for the version of this that was
    keyed on a planet and quietly stopped working for any world that changed hands.
  */
  await schedule(tx, {
    seasonId: input.seasonId,
    kind: 'vault_leak_flush',
    refId: input.planetId,
    dedupeKey: `leak-flush:${input.cause}`,
    resolveAt: new Date(input.now.getTime() + FAULT.leakFlushMinutes * 60_000),
  });
}

/** Cancel whatever this world still has booked for a fault that is being put right. */
export async function dropPendingFaultEvents(
  tx: Queryable,
  planetId: string,
  kinds: readonly ('vault_leak_flush' | 'fault_spawn')[],
): Promise<void> {
  await tx.delete(scheduledEvents).where(and(
    eq(scheduledEvents.refId, planetId),
    eq(scheduledEvents.status, 'pending'),
    inArray(scheduledEvents.kind, [...kinds]),
  ));
}

/**
 * WHERE THE INTERFACE SHOULD LAND WHEN SOMEBODY TAPS THE NOTIFICATION.
 *
 * Carried in the payload rather than worked out on the client, for the reason every
 * other figure on a payload is: the client's copy would be a second table to keep in
 * step, and the failure — a notification that opens the wrong tab — is silent.
 *
 * THE ITEM IS THE THING THE PLAYER ALREADY KNOWS. A `CORE_OUTAGE` puts the Aegis out,
 * but the broken hardware is the Command Core and the Core is what the sheet marks;
 * pointing at the Aegis would name a working instrument. `PROSPECTOR_FAULT` points at
 * the craft rather than at the Derrick, because a world may have no Derrick at all.
 */
export const FAULT_LOCATION: Record<FaultKind, { group: string; itemId: string }> = {
  REFINERY_OUTAGE: { group: 'grow', itemId: 'REFINERY' },
  EXTRACTOR_OUTAGE: { group: 'grow', itemId: 'EXTRACTOR' },
  PLANT_OUTAGE: { group: 'grow', itemId: 'DEUTERIUM_PLANT' },
  VAULT_LEAK: { group: 'grow', itemId: 'VAULT' },
  CORE_OUTAGE: { group: 'grow', itemId: 'CORE' },
  TELESCOPE_FAULT: { group: 'orbit', itemId: 'TELESCOPE' },
  SHIPYARD_REVOLT: { group: 'reach', itemId: 'SHIPYARD' },
  PROSPECTOR_FAULT: { group: 'reach', itemId: 'PROSPECTOR' },
};

/**
 * THE NEXT THING GOES WRONG. `fault_spawn`.
 *
 * DETERMINISTIC FROM THE EVENT ID, and that is the whole of its idempotence. A
 * redelivered event draws the same fault from the same pool, and `planet_faults`'
 * unique index turns the second insert into nothing; it books the next timer under the
 * same dedupe key, so that collides too. No status to flip, no claim to take.
 */
/**
 * BREAK UP TO `count` THINGS ON ONE WORLD, AND DO EVERYTHING A BREAK OWES.
 *
 * THE ONE WRITER OF A FAULT, and there are two reasons to break a world: the clock
 * (`fault_spawn`, one at a time) and a heavy defeat (`FAULT.attackFaults` at once). Both
 * owe the same four things — the row, a leak flush if the vault went, a re-booked loyalty
 * watch, and a notification per fault — and two copies of that list are how one lane
 * starts forgetting a line the other remembered.
 *
 * SILENT WHERE NOTHING CAN BREAK: a capital, a colony below the gate, a world with every
 * eligible fault already standing. It re-reads what is active rather than trusting a
 * caller's snapshot, because a caller holding a `LockedPlanet` read it BEFORE the battle
 * this may be the consequence of.
 *
 * `spawnEventId` IS ONLY FOR THE CLOCK. It is what makes a redelivered spawn a no-op (see
 * its column note), and its unique index admits one row per event — so a two-fault blow
 * passes none and relies on the guard its own lane already has: a battle resolves inside
 * `claimMission`, and a redelivered arrival never reaches this call.
 */
export async function breakFaults(
  tx: Tx,
  input: {
    seasonId: string;
    planetId: string;
    now: Date;
    count: number;
    /** What made this happen, so the same cause always draws the same faults. */
    seed: string;
    spawnEventId?: string;
    /**
     * Whether each fault gets its own notification. The clock's faults do; a battle's do
     * not, by owner decision — they are told in the battle report, where the cause is on
     * the same page as the effect. Defaults to true, so a new caller is loud by default.
     */
    announce?: boolean;
  },
): Promise<FaultKind[]> {
  /*
    ONE SPAWN EVENT CAN ONLY EVER NAME ONE ROW. `planet_faults_spawn_event_idx` is unique,
    so a second insert under the same id is refused by the conflict clause below —
    silently. Asking for two and receiving one, with no error, is the kind of bug nobody
    finds until a balance number looks wrong; this makes the call impossible instead.
  */
  if (input.spawnEventId !== undefined && input.count > 1) {
    throw new Error(
      `breakFaults: a spawnEventId names one fault, but ${String(input.count)} were requested`,
    );
  }
  const state = await faultStateOf(tx, input.planetId);
  if (!state) return [];
  const drawn = drawFaults(
    { kind: state.kind, coreLevel: state.coreLevel, plantLevel: state.plantLevel },
    state.active,
    input.count,
    seededFrom('fault-break', input.seed),
  );

  const written: { id: string; kind: FaultKind }[] = [];
  for (const kind of drawn) {
    /*
      NO TARGET ON THE CONFLICT, because there are two ways this insert can be a repeat
      and both must be silent: the same fault already standing, and this same spawn event
      having already written one. `spawnEventId` is what makes the second true — see its
      column note for why seeding the draw was not enough.
    */
    const [row] = await tx.insert(planetFaults)
      .values({
        planetId: input.planetId,
        kind,
        startedAt: input.now,
        ...(input.spawnEventId === undefined ? {} : { spawnEventId: input.spawnEventId }),
      })
      .onConflictDoNothing()
      .returning({ id: planetFaults.id });
    if (row) written.push({ id: row.id, kind });
  }
  if (written.length === 0) return [];

  // The Core fault changes the public dome: every observer must drop the cached
  // `shielded` silhouette on the same commit that darkens it.
  if (written.some((fault) => fault.kind === 'CORE_OUTAGE')) {
    await publishShard(tx, input.seasonId, 'world');
  }

  /*
    DISCOVERY HISTORY HAS TO CHANGE WITH LIVE REACH.

    `sensorPosts` makes the current view fall back to naked eye, but asteroid and
    pirate discovery is awarded from durable sensor epochs. Leaving the old full-reach
    epoch open meant the broken Telescope kept discovering at full range even while the
    live map correctly drew the smaller circle.
  */
  if (written.some((fault) => fault.kind === 'TELESCOPE_FAULT')) {
    await refreshSensorEpoch(tx, input.planetId, input.now);
  }

  const leak = written.find((fault) => fault.kind === 'VAULT_LEAK');
  if (leak) {
    await scheduleLeakFlush(tx, {
      seasonId: input.seasonId,
      planetId: input.planetId,
      now: input.now,
      cause: leak.id,
    });
  }

  /*
    MORE FAULTS MEANS A STEEPER FALL, so every instant the loyalty watch had booked is now
    wrong. Once per call rather than once per fault: the watch reads the final count, and
    booking it twice would only delete the first booking.
  */
  await rescheduleLoyaltyWatch(tx, {
    seasonId: input.seasonId,
    planetId: input.planetId,
    now: input.now,
  });

  const [world] = await tx
    .select({ owner: planets.controllerPlayerId, name: planets.name })
    .from(planets)
    .where(eq(planets.id, input.planetId));
  if (world?.owner && input.announce !== false) {
    for (const fault of written) {
      await notify(tx, {
        playerId: world.owner,
        kind: 'colony_fault',
        at: input.now,
        // The fault row, so the same break can never be announced twice.
        refId: fault.id,
        payload: {
          planetId: input.planetId,
          planetName: world.name,
          fault: fault.kind,
          ...FAULT_LOCATION[fault.kind],
        },
      });
    }
  }
  return written.map((fault) => fault.kind);
}

/**
 * THE NEXT THING GOES WRONG. `fault_spawn`.
 *
 * Deterministic from the event id, and idempotent through `spawnEventId`: a redelivered
 * event draws from a pool one fault shorter, lands on a different fault, and collides on
 * the event's own unique key instead of writing it. It books the next timer under a key
 * derived from the same event, so that collides too.
 */
export const onFaultSpawn: Handler = async ({ db, clock }, event) => {
  const planetId = event.refId;
  if (!planetId) return;
  await db.transaction(async (tx) => {
    const state = await faultStateOf(tx, planetId);
    if (!state || !faultsPossible(state)) return;

    const now = clock.now();
    let world;
    try {
      /*
        CLOSE THE CLEAN INTERVAL BEFORE WRITING THE FAULT.

        `lastTickAt` may be hours old. Writing the row first would make the next lazy
        tick apply a fault backwards across all of those clean hours. This lock also
        serialises a spawn with repair and secession, the invariant the lifecycle
        comments already relied on but the clock path did not actually uphold.
      */
      world = await loadLocked(tx, planetId, { now: () => now }, { requireLive: false });
    } catch (err) {
      // A stale timer belonging to a deleted or already-neutral world ends here. It
      // must not keep an immortal timer chain alive on something that cannot break.
      if (err instanceof GameError
        && (err.code === 'PLANET_NOT_FOUND' || err.code === 'PLANET_NOT_OWNED')) return;
      throw err;
    }
    if (!faultsPossible({
      kind: world.kind,
      coreLevel: world.buildings.CORE,
      plantLevel: world.buildings.DEUTERIUM_PLANT,
    })) return;

    /*
      THE TIMER IS RE-ARMED WHATEVER HAPPENS, including when there is nothing left to
      break. A world whose eight faults are all standing is exactly the world a repair
      is about to free a slot on, and a timer that stopped there would need something
      to start it again — which is a sweep, which is what not having one is worth.
    */
    await scheduleNextFaultSpawn(tx, {
      seasonId: event.seasonId,
      planetId,
      now,
      cause: event.id,
      rng: seededFrom('fault-spawn', event.id),
    });
    await breakFaults(tx, {
      seasonId: event.seasonId,
      planetId,
      now,
      count: 1,
      seed: `spawn:${event.id}`,
      spawnEventId: event.id,
    });
  });
};

/**
 * WHAT HAS BLED BECOMES A FIELD. `vault_leak_flush`.
 *
 * `loadLocked` is what advances the leak — the pile this reads is written by the same
 * lazy tick that runs at the top of every transaction — so this handler's only jobs are
 * to move it into orbit and to book the next one.
 *
 * UNDER `DEBRIS.minimum` IT WRITES NOTHING AND KEEPS THE PILE. The floor exists so the
 * disc is not littered with fields worth less than the flight to them; a slow leak
 * simply takes a few more flushes to be worth drawing.
 */
export const onVaultLeakFlush: Handler = async ({ db, clock }, event) => {
  const planetId = event.refId;
  if (!planetId) return;
  await db.transaction(async (tx) => {
    const [live] = await tx.select({ id: planetFaults.id }).from(planetFaults)
      .where(and(eq(planetFaults.planetId, planetId), eq(planetFaults.kind, 'VAULT_LEAK')));
    if (!live) return;
    /*
      ADVANCE THE WORLD FIRST. `pending_leak_*` is written by the lazy tick and by
      nothing else, so a handler that read the column without running one would find
      whatever was there at the owner's last visit — which on an untouched world is
      zero, for ever. The flush would then run on schedule and move nothing, and the
      leak would only ever reach orbit when its victim opened the game.
    */
    let world;
    try {
      world = await loadLocked(tx, planetId, clock, { requireLive: false });
    } catch (err) {
      if (err instanceof GameError
        && (err.code === 'PLANET_NOT_FOUND' || err.code === 'PLANET_NOT_OWNED')) return;
      throw err;
    }
    // The pre-read above is only a cheap stale-event exit. This check happens after
    // the planet lock, so a repair that won the race cannot be followed by one last
    // flush and a newly armed flush event.
    if (!hasFault(world.faults, 'VAULT_LEAK')) return;
    await flushVaultLeak(tx, planetId, clock.now());
    await scheduleLeakFlush(tx, {
      seasonId: event.seasonId,
      planetId,
      now: clock.now(),
      cause: event.id,
    });
  });
};

/**
 * MOVE ONE WORLD'S ACCRUED LEAK INTO A PUBLIC FIELD. Shared by the flush and the repair.
 *
 * The repair calls it too, so the last minutes of a leak are not quietly forgiven: what
 * had bled by the moment the crew arrived is already gone, and the commander watching
 * the repair finish should see it in orbit rather than back in the vault.
 *
 * MUST RUN AFTER THE WORLD HAS BEEN ADVANCED. It reads `pending_leak_*` off the row and
 * that column is only current as of the last tick — `loadLocked` above every caller is
 * what makes it so.
 */
export async function flushVaultLeak(
  tx: Tx,
  planetId: string,
  now: Date,
  options: { force?: boolean } = {},
): Promise<string | null> {
  const [row] = await tx.select().from(planets).where(eq(planets.id, planetId)).for('update');
  if (!row) return null;
  const pile = {
    alloy: row.pendingLeakAlloy,
    crystal: row.pendingLeakCrystal,
    deuterium: row.pendingLeakDeuterium,
  };
  const total = pile.alloy + pile.crystal + pile.deuterium;
  if (total <= 0) return null;
  if (!options.force && total < DEBRIS.minimum) return null;

  const [field] = await tx.insert(debrisFields).values({
    seasonId: row.seasonId,
    planetId,
    // Beside the anchor, exactly as a battle's wreck is: one position, one code path.
    x: row.x, y: row.y, z: row.z,
    alloy: pile.alloy, crystal: pile.crystal, deuterium: pile.deuterium,
    createdAt: now,
  }).returning({ id: debrisFields.id });

  await tx.update(planets)
    .set({ pendingLeakAlloy: 0, pendingLeakCrystal: 0, pendingLeakDeuterium: 0 })
    .where(eq(planets.id, planetId));
  /*
    THE CEILING IS COUNTED HERE, not at accrual. `FAULT.leakTotalStores` is about what
    one flood COSTS, and what it costs is what left the world — so the tally moves at
    the same moment the ore does, and the pending pile plus this figure is what the
    economy checks its budget against.
  */
  await tx.update(planetFaults)
    .set({
      leakedAlloy: sql`${planetFaults.leakedAlloy} + ${pile.alloy}`,
      leakedCrystal: sql`${planetFaults.leakedCrystal} + ${pile.crystal}`,
      leakedDeuterium: sql`${planetFaults.leakedDeuterium} + ${pile.deuterium}`,
    })
    .where(and(eq(planetFaults.planetId, planetId), eq(planetFaults.kind, 'VAULT_LEAK')));
  // A leak field is a public mining opportunity just like a battle wreck. Without
  // this wake, every neighbour saw it only when the safety-net poll happened.
  await publishShard(tx, row.seasonId, 'mining');
  return field?.id ?? null;
}
