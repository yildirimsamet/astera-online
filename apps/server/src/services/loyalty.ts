import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import {
  FAULT,
  HULLS,
  MULTI_WORLD,
  advanceLoyalty,
  faultsPossible,
  hashSeed,
  minutesUntilLoyalty,
  minutesUntilLoyaltyZero,
  nextLoyaltyMilestone,
} from '@astera/rules';
import type { Queryable, Tx } from '../db/client.js';
import {
  buildOrders,
  buildings,
  neutralPlanetState,
  planetFaults,
  planets,
  scheduledEvents,
  seasonTelemetrySegments,
  units,
} from '../db/schema.js';
import { schedule } from '../worker/queue.js';
import type { Handler } from '../worker/handlers.js';
import { loadLocked } from './planet.js';
import { refreshSensorEpoch } from './sensorHistory.js';
import { notify } from './notifications.js';

/**
 * SADAKAT VE KOPUŞ. `docs/colony-faults-plan.md` §4-5.
 *
 * A colony that is left broken stops belonging to its commander. Loyalty falls while
 * faults stand — faster the more of them there are — and at zero the world secedes and
 * goes NEUTRAL, buildings and stock standing, for whoever gets there first.
 *
 * THIS RE-OPENS D179, WHICH REMOVED THE ONLY OTHER WAY A WORLD WAS EVER HANDED BACK TO
 * NOBODY. `ownership.ts` still carries the note. It is the owner's decision, and what
 * it costs is everything D167 had to pay for and D179 stopped paying: the fleet, the
 * flights in the air, the queue, the colony count, the caretaker row, and a commander
 * who has to be told.
 *
 * ONE PENDING EVENT CARRIES THE WHOLE DESCENT. `colony_secession` fires at the next
 * figure the world will reach — 50, 25, 10, then 0 — announces it and books the next.
 * Four stops, one row per colony, no sweep and no per-planet timer.
 */

/** 0-2 tier for a fallen world's caretaker garrison, read off what it grew into. */
const tierForCore = (coreLevel: number): 1 | 2 | 3 =>
  (coreLevel <= 9 ? 1 : coreLevel <= 15 ? 2 : 3);

/**
 * BOOK THE NEXT THING THIS WORLD'S LOYALTY WILL DO.
 *
 * Silent when nothing is falling: a world with no faults is climbing back to full and
 * has no dated moment ahead of it. The existing watch is cleared either way, because a
 * repair makes every instant the old row named wrong.
 */
export async function scheduleLoyaltyWatch(
  tx: Queryable,
  input: { seasonId: string; planetId: string; loyalty: number; activeCount: number; now: Date },
): Promise<void> {
  await tx.delete(scheduledEvents).where(and(
    eq(scheduledEvents.kind, 'colony_secession'),
    eq(scheduledEvents.refId, input.planetId),
    eq(scheduledEvents.status, 'pending'),
  ));
  const target = nextLoyaltyMilestone(input.loyalty, input.activeCount);
  if (target === null) return;
  const minutes = minutesUntilLoyalty(input.loyalty, input.activeCount, target);
  if (minutes === null) return;
  await schedule(tx, {
    seasonId: input.seasonId,
    kind: 'colony_secession',
    refId: input.planetId,
    payload: { target },
    resolveAt: new Date(input.now.getTime() + minutes * 60_000),
  });
}

/**
 * Re-book after the fault set changed, reading the world for itself.
 *
 * Called from both ends of a fault's life. Every fault that arrives or leaves moves
 * every instant ahead of this world, so a watch that was not re-booked would announce
 * a figure the world had already passed or would never reach.
 */
export async function rescheduleLoyaltyWatch(
  tx: Tx,
  input: { seasonId: string; planetId: string; now: Date },
): Promise<void> {
  const [world] = await tx.select().from(planets).where(eq(planets.id, input.planetId));
  if (!world) return;
  const [levels, active] = await Promise.all([
    tx.select().from(buildings).where(eq(buildings.planetId, input.planetId)),
    tx.select({ kind: planetFaults.kind }).from(planetFaults)
      .where(eq(planetFaults.planetId, input.planetId)),
  ]);
  const core = levels.find((row) => row.type === 'CORE')?.level ?? 0;
  if (!faultsPossible({ kind: world.kind, coreLevel: core, plantLevel: 0 })) return;
  await scheduleLoyaltyWatch(tx, {
    seasonId: input.seasonId,
    planetId: input.planetId,
    loyalty: world.loyalty,
    activeCount: active.length,
    now: input.now,
  });
}

/**
 * THE WORLD REACHES A FIGURE. `colony_secession`.
 *
 * Above zero it is a warning and a re-booking; at zero it is the end of the colony. One
 * handler for both because they are one descent, and splitting them would need the two
 * halves to agree about a loyalty figure they each read separately.
 */
export const onColonySecession: Handler = async ({ db, clock }, event) => {
  const planetId = event.refId;
  if (!planetId) return;
  await db.transaction(async (tx) => {
    const [world] = await tx.select().from(planets).where(eq(planets.id, planetId)).for('update');
    if (!world?.controllerPlayerId || world.kind !== 'COLONY') return;

    // Brings loyalty to `now` along with the ore; the figure below is never stale.
    const locked = await loadLocked(tx, planetId, clock, { requireLive: false });
    const loyalty = advanceLoyalty(locked.loyalty, locked.faults.length, 0);

    if (loyalty > 0) {
      const target = typeof event.payload?.target === 'number' ? event.payload.target : null;
      if (target !== null && loyalty <= target + 1e-6) {
        await notify(tx, {
          playerId: locked.playerId,
          kind: 'colony_loyalty_warning',
          at: clock.now(),
          /*
            THE EVENT IS THE IDENTITY, and `refId` being a uuid column is why.

            It was null, which PostgreSQL treats as distinct from every other null — so a
            redelivered event (worker killed between COMMIT and `complete()`, reaper
            returns the row) wrote the warning a second time. Keying on the world instead
            would have gone too far the other way: the unique index is (player, kind,
            refId), so one world could only ever warn ONCE in a season and the reader
            would never see 25% or 10%. One event fires one threshold, so the event id is
            exactly the grain this needs.
          */
          refId: event.id,
          payload: {
            planetId,
            planetName: locked.name,
            loyalty: Math.round(loyalty),
            faults: locked.faults.length,
            minutesLeft: Math.round(minutesUntilLoyaltyZero(loyalty, locked.faults.length) ?? 0),
          },
        });
      }
      await scheduleLoyaltyWatch(tx, {
        seasonId: event.seasonId,
        planetId,
        loyalty,
        activeCount: locked.faults.length,
        now: clock.now(),
      });
      return;
    }

    await secedeColony(tx, planetId, clock.now(), event.id);
  });
};

/**
 * THE COLONY STOPS BEING ANYBODY'S.
 *
 * Deliberately NOT `transferPlanetControl`: that primitive hands a world from one
 * commander to another and every line of it assumes a new owner exists. This is the
 * other shape, the one D179 deleted, and the differences are the whole of it — a
 * caretaker row has to be created, the garrison changes hands while the fleet does not,
 * and nobody gains anything.
 *
 * WHAT IT IS NOT IS A SCORE EVENT. D2: Dominion is exactly zero-sum and only combat
 * generates it. Neglect took this world from its commander and gave it to no one, so
 * crediting anybody would be creating score from nothing. What the commander loses is
 * WEALTH, which the world stops counting the moment it stops being theirs.
 */
export async function secedeColony(
  tx: Tx,
  planetId: string,
  now: Date,
  notificationRefId: string,
): Promise<boolean> {
  const [world] = await tx.select().from(planets).where(eq(planets.id, planetId)).for('update');
  if (!world?.controllerPlayerId || world.kind !== 'COLONY') return false;
  const owner = world.controllerPlayerId;

  /*
    THE FLEET COMES HOME AND THE GUNS DO NOT. Owner's design, and the line is
    *"the fleet is the bet"*: a commander loses ships to a battle they chose, never to a
    world quietly changing hands. Emplacements are bolted to the ground they defend, so
    they secede with it and become the caretaker's garrison.

    ONLY `home` ROWS ARE TOUCHED. A fleet in the air is stored against its origin with
    its mission as the location, and it still belongs to its commander — `safeHomePlanet`
    is what lands it somewhere that is still theirs. Confiscating it here would destroy
    a fleet mid-flight for a reason its owner could not have seen.
  */
  const standing = await tx.select().from(units)
    .where(and(eq(units.planetId, planetId), eq(units.location, 'home')));
  const mobile = standing.filter((row) => !HULLS[row.hull].ground && row.count > 0);
  if (mobile.length > 0) {
    /*
      THE CAPITAL, READ HERE RATHER THAN THROUGH `ownership.capitalPlanet`.

      That module now imports `faults`, which imports this one — and a three-module cycle
      that happens to work because every entry point is a hoisted function declaration is
      a cycle waiting for somebody to add a const. The query is four lines and this is the
      only thing in the file that wanted it.
    */
    const [home] = await tx.select({ id: planets.id }).from(planets)
      .where(and(eq(planets.controllerPlayerId, owner), eq(planets.kind, 'CAPITAL')));
    if (!home) return false;
    for (const row of mobile) {
      await tx.insert(units)
        .values({ planetId: home.id, ownerPlayerId: owner, hull: row.hull, location: 'home', count: row.count })
        .onConflictDoUpdate({
          target: [units.planetId, units.hull, units.location],
          set: { count: sql`${units.count} + ${row.count}` },
        });
    }
    await tx.delete(units).where(and(
      eq(units.planetId, planetId),
      eq(units.location, 'home'),
      inArray(units.hull, mobile.map((row) => row.hull)),
    ));
  }
  await tx.update(units).set({ ownerPlayerId: null })
    .where(and(eq(units.planetId, planetId), eq(units.location, 'home')));

  // The actor's figures become an immutable segment, exactly as a conquest closes them.
  if (world.statsOwnerPlayerId !== null) {
    await tx.insert(seasonTelemetrySegments).values({
      seasonId: world.seasonId,
      playerId: world.statsOwnerPlayerId,
      sourcePlanetId: planetId,
      telemetry: world.seasonTelemetry,
      closedAt: now,
    });
  }

  /*
    THE CARETAKER ROW — AND THE TIMER THAT MAKES IT MEAN ANYTHING.

    The state row alone was not enough and the gap was invisible: `reinforceNeutral` is
    what keeps a caretaker world whole, and it only ever runs off a `neutral_reinforce`
    event. Written without one, a fallen colony would sit there with whatever
    emplacements its old commander happened to leave and NEVER re-arm — strictly softer
    than a neutral world seeded at season start, and farmable rather than claimable: raid
    it once and nothing ever stands back up.

    Tier 1 has no `reinforcementMinutes` and gets no timer, exactly as a seeded tier 1
    does. A small world that falls stays a small world that fell.
  */
  const [core] = await tx.select().from(buildings)
    .where(and(eq(buildings.planetId, planetId), eq(buildings.type, 'CORE')));
  const tier = tierForCore(core?.level ?? 0);
  const template = MULTI_WORLD.neutral[tier];
  const nextReinforcementAt = template.reinforcementMinutes === null
    ? null
    : new Date(now.getTime() + template.reinforcementMinutes * 60_000);
  await tx.insert(neutralPlanetState).values({
    planetId,
    tier,
    // Deterministic from the world, so a re-run of anything reads the same profile.
    profileSeed: hashSeed('secession', planetId) % 2_147_483_647,
    nextReinforcementAt,
    economyAnchorAt: now,
  }).onConflictDoNothing();
  if (nextReinforcementAt) {
    await schedule(tx, {
      seasonId: world.seasonId,
      kind: 'neutral_reinforce',
      refId: planetId,
      payload: { expectedAt: nextReinforcementAt.toISOString() },
      resolveAt: nextReinforcementAt,
    });
  }

  await tx.update(planets).set({
    kind: 'NEUTRAL',
    controllerPlayerId: null,
    equippedSkinId: null,
    statsOwnerPlayerId: null,
    protectedUntil: null,
    disruptedUntil: null,
    recoveryUntil: null,
    loyalty: FAULT.loyaltyMax,
    pendingLeakAlloy: 0,
    pendingLeakCrystal: 0,
    pendingLeakDeuterium: 0,
    lastTickAt: now,
    seasonTelemetry: {
      produced: { alloy: 0, crystal: 0, deuterium: 0 },
      productiveSeconds: 0,
      shipsBuilt: {},
    },
  }).where(eq(planets.id, planetId));

  /*
    THE QUEUE IS ABANDONED, NOT REFUNDED. What it cost was spent out of this world's own
    store, and the store went with the world. Paying it back into a capital that never
    held it would make losing a colony profitable on the turn it happened.
  */
  await tx.update(buildOrders).set({ status: 'CANCELLED' })
    .where(and(eq(buildOrders.planetId, planetId), eq(buildOrders.status, 'BUILDING')));

  const faultRows = await tx.select({ id: planetFaults.id }).from(planetFaults)
    .where(eq(planetFaults.planetId, planetId));
  if (faultRows.length > 0) {
    /*
      Repair events point at FAULT ids, not at the planet id used by the other three
      fault timers. Deleting only planet-addressed events left every in-flight repair
      behind as a future no-op, contrary to secession's full teardown contract.
    */
    await tx.delete(scheduledEvents).where(and(
      eq(scheduledEvents.kind, 'fault_repair_complete'),
      inArray(scheduledEvents.refId, faultRows.map((fault) => fault.id)),
      ne(scheduledEvents.status, 'done'),
    ));
  }
  await tx.delete(planetFaults).where(eq(planetFaults.planetId, planetId));
  await tx.delete(scheduledEvents).where(and(
    eq(scheduledEvents.refId, planetId),
    ne(scheduledEvents.status, 'done'),
    inArray(scheduledEvents.kind, ['fault_spawn', 'vault_leak_flush', 'colony_secession']),
  ));

  await refreshSensorEpoch(tx, planetId, now);
  await notify(tx, {
    playerId: owner,
    kind: 'colony_lost',
    at: now,
    // One LOSS, not one planet for all time. The same event may be redelivered and
    // must dedupe; the same world may legitimately be lost again after recapture.
    refId: notificationRefId,
    payload: { planetId, planetName: world.name, cause: 'SECESSION' },
  });
  return true;
}
