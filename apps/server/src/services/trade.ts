import { and, eq } from 'drizzle-orm';
import {
  TRADE,
  TRANSFER_CARGO_HULLS,
  distance,
  fleetCount,
  fleetEntries,
  fleetSpeed,
  fleetSpeedMult,
  fleetTravelExact,
  interceptOrbit,
  missionFuel,
  quoteTrade,
  tradeShipActive,
  tradeShipPosition,
  transferCargoCapacity,
  type Fleet,
  type Resources,
  type TradeRate,
  type Vec3,
} from '@astera/rules';
import type { Db, Tx } from '../db/client.js';
import type { Clock } from '../clock.js';
import { addMinutes, atMinute } from '../clock.js';
import { tradeRuns, units } from '../db/schema.js';
import { publish, publishShard } from '../stream/bus.js';
import { assertFreeBay } from './flight.js';
import { assertFuel } from './fuel.js';
import { tradeShipOccurrence } from './galaxyEvents.js';
import { validateTransferFleet } from './movement.js';
import { notify } from './notifications.js';
import { safeHomePlanet } from './ownership.js';
import { planetView, type PlanetView } from './planetView.js';
import { schedule } from '../worker/queue.js';
import { pendingThreads, type PendingThread } from './session.js';
import { techOf } from './researchState.js';
import {
  GameError,
  assertSeasonOpenThrough,
  assertWorldOperational,
  loadLocked,
  orbitOf,
  recomputePlayerWealth,
  recomputeWealth,
  saveResources,
  setUnits,
} from './planet.js';

/**
 * TİCARET KONVOYU — SENDING A CONVOY TO THE MERCHANT. D156.
 *
 * The fourth target class and the first one you DEAL with rather than take from.
 * Structurally it is a raid that cannot lose: a flight bay (D28), prepaid fuel for
 * both legs (D136), an origin world reading `AWAY` for the whole trip, a
 * rendezvous solved once against a moving target and then FROZEN — all charged by
 * the same helpers `pirateRaid.ts` uses, because a lane that were cheaper than the
 * others would be a reason to stop using them.
 *
 * WHAT IS DELIBERATELY ABSENT, and each absence is a decision:
 *
 *   · NO COMBAT, EVER. There is no fight at the rendezvous, so `run.fleet` is what
 *     is aboard on both legs — no losses, no live `units` re-read, no report.
 *   · NO QUOTA, NO FEE, NO PER-WORLD CONVOY LIMIT — owner instruction. There is
 *     deliberately no unique index on `(planet_id, occurrence_id)`: hold size, a
 *     bay and prepaid fuel are the brakes, and they are the brakes the rest of the
 *     game already runs on. A fourth would only make the decision less legible.
 *   · NO DOMINION and NO CHRONICLE ENTRY. Nothing was taken from anybody.
 *   · NO FOG GATE ON THE TARGET. The merchant is an ANNOUNCED public moment and
 *     its orbit is published to every commander in the galaxy (`activeGalaxyEvents`),
 *     so unlike a pirate there is no sight to buy and none to check. The CONVOY is
 *     still an ordinary craft and answers to the three zones like every other one —
 *     see `traffic.ts`.
 *
 * THE DECISION THIS FEATURE EXISTS TO CREATE IS THE HOLD. `quoteTrade` states
 * `requiredHold` as `max(outboundVolume, returnVolume)` and this file refuses
 * against that figure: a thousand Deuterium is ninety thousand units and buys
 * ninety thousand Alloy, so the wing that carries the offer out is nowhere near the
 * wing that brings the haul home. Sizing a convoy against what it is CARRYING
 * rather than against what it is FETCHING is the mistake the whole quote exists to
 * prevent, and `CARGO_CAPACITY` is where the game says so.
 */

export type TradeRunRow = typeof tradeRuns.$inferSelect;

/**
 * The convoy parked against this run. `units.location` is namespaced, like mining
 * (`mine:<id>`) and a pirate raid (`pirate:<id>`), so nothing that reads mission
 * ids can mistake it for one — and so `fleetTruthFor` reads the origin as `AWAY`.
 */
export const tradeLocation = (runId: string): string => `trade:${runId}`;

/**
 * When the convoy stops being alongside and turns for home.
 *
 * The same shape as a raid's ten-second engagement, and for the same reason: a
 * swap that resolved instantly would have no moment to draw, and a public event
 * with nothing to watch is a menu entry rather than a moment. Exported because
 * `traffic.ts` has to draw the hold and the tests have to advance past it — one
 * definition, never two.
 */
export const dockEndsAt = (arriveAt: Date): Date =>
  new Date(arriveAt.getTime() + TRADE.dockSeconds * 1000);

export interface TradeOrder {
  occurrenceId: string;
  fleet: Fleet;
  give: Resources;
  want: Resources;
}

export interface TradeLaunch {
  runId: string;
  occurrenceId: string;
  fleet: Fleet;
  give: Resources;
  want: Resources;
  /** The occurrence's rate, frozen on the row. What was quoted is what is paid. */
  rate: TradeRate;
  departAt: Date;
  arriveAt: Date;
  flightMinutes: number;
  intercept: Vec3;
  /** Deuterium taken for both legs at launch, and never refunded. D136. */
  fuel: number;
  /**
   * The mission strip and the world, read INSIDE the launching transaction. D53.
   *
   * A mutation answers with the same authoritative view its GET would, so the
   * convoy is drawn on the frame the response lands rather than one round trip
   * later — and an older read already in flight cannot land afterwards and erase
   * it.
   */
  pending: PendingThread[];
  planet: PlanetView;
}

async function fleetOfRun(tx: Tx, planetId: string, runId: string): Promise<Fleet> {
  const rows = await tx
    .select()
    .from(units)
    .where(and(eq(units.planetId, planetId), eq(units.location, tradeLocation(runId))));
  const fleet: Fleet = {};
  for (const row of rows) if (row.count > 0) fleet[row.hull] = row.count;
  return fleet;
}

async function clearRunUnits(tx: Tx, planetId: string, runId: string): Promise<void> {
  await tx
    .delete(units)
    .where(and(eq(units.planetId, planetId), eq(units.location, tradeLocation(runId))));
}

/**
 * Send a convoy to the merchant.
 *
 * The order of refusals is the order that gives the truest answer first, which is
 * `launchPirateRaid`'s order and not an arbitrary one: structure before semantics,
 * the world before the target, the BAY before the rendezvous — there is no point
 * finding a meeting point for a launch that has nowhere to launch from (D28, in
 * mining's order) — and the arithmetic of the swap before the arithmetic of the
 * flight, because a player fixes a bad swap by typing and fixes a bad flight by
 * building.
 */
export async function launchTrade(
  db: Db,
  planetId: string,
  order: TradeOrder,
  clock: Clock,
  expectedPlayerId?: string,
): Promise<TradeLaunch> {
  // Structure first: EMPTY_FLEET, BAD_FLEET, GROUND_UNIT — one statement of them,
  // shared with the transfer lane rather than restated here.
  validateTransferFleet(order.fleet);
  const requested: Fleet = {};
  for (const [hull, count] of fleetEntries(order.fleet)) {
    if (count > 0) requested[hull] = count;
  }

  return db.transaction(async (tx) => {
    const origin = await loadLocked(tx, planetId, clock, { expectedPlayerId });
    assertWorldOperational(origin);

    for (const [hull, count] of fleetEntries(requested)) {
      const available = origin.homeFleet[hull] ?? 0;
      if (available < count) {
        throw new GameError('NOT_ENOUGH_SHIPS', `Not enough ${hull} at home`, 400, {
          hull,
          available,
        });
      }
    }

    const tech = await techOf(tx, origin.playerId);
    const speed = fleetSpeed(requested, tech) * fleetSpeedMult(origin.orbit);
    if (!(speed > 0)) throw new GameError('IMMOBILE_FLEET', 'That convoy cannot travel');

    /*
      ONE REFUSAL FOR EVERY WAY THE MERCHANT IS NOT THERE.

      No such row, another galaxy's row, an Asteroid Shower, a window that has
      closed and a window that has not opened are five different facts on the
      server and exactly one fact from the seat: the appointment is not open.
      Answering them separately would also make this route a probe for whether
      another shard has a merchant up. 409, because the order is legal and the
      world is what has moved.
    */
    const spec = await tradeShipOccurrence(tx, origin.seasonId, order.occurrenceId);
    if (!spec || !tradeShipActive(spec, origin.nowMinutes)) {
      throw new GameError('TRADE_WINDOW_CLOSED', 'There is no merchant out there', 409);
    }

    // Before the rendezvous solve. D28, in mining's order.
    await assertFreeBay(tx, planetId, origin.buildings.CORE);

    /*
      A CONVOY WITH NO CARRIER HAS NO HOLD.

      Warships may ride along and add nothing but bulk, fuel and bay pressure —
      the same shape `TransferSheet` already has, and the same refusal, because
      "resources need a transport hull" is one sentence in this game and not two.
    */
    const hold = transferCargoCapacity(requested);
    if (!TRANSFER_CARGO_HULLS.some((id) => (requested[id] ?? 0) > 0)) {
      throw new GameError('TRANSFER_NEEDS_CARGO_HULL', 'Resources need a transport hull', 400);
    }

    /*
      THE QUOTE IS THE RULES PACKAGE'S ANSWER AND IS NOT RE-DERIVED HERE.

      `quoteTrade` runs on every keystroke of the composer and once more inside
      this transaction, and it REPORTS rather than throws so the screen can say why
      the button is dark. The reason travels in the refusal's params so the client
      can print the same sentence it was already printing before the launch.
    */
    const quote = quoteTrade(order.give, order.want, spec.rate);
    if (quote.refusal !== null) {
      throw new GameError('BAD_TRADE', 'That swap is not one the merchant takes', 400, {
        reason: quote.refusal,
      });
    }

    /*
      THE HOLD IS SIZED BY THE LEG THAT NEEDS THE MOST ROOM — WHICH IS USUALLY THE
      WAY HOME. This is the decision the feature is built on: a small offer that
      buys a large haul must fly out in a convoy big enough to carry the haul back.
    */
    if (quote.requiredHold > hold) {
      throw new GameError('CARGO_CAPACITY', 'The convoy cannot carry that trade', 400, {
        required: quote.requiredHold,
        capacity: hold,
      });
    }

    if (
      origin.alloy < order.give.alloy
      || origin.crystal < order.give.crystal
      || origin.deuterium < order.give.deuterium
    ) {
      throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough resources');
    }

    const hit = interceptOrbit(
      origin,
      speed,
      (minutes) => tradeShipPosition(spec, minutes),
      spec.expiresAt,
      origin.nowMinutes,
    );
    if (!hit) {
      throw new GameError(
        'CANNOT_INTERCEPT',
        'The merchant will be gone before your convoy could reach it',
        409,
      );
    }

    /*
      FUEL FOR BOTH LEGS, AT LAUNCH, AND THE THIRD ARGUMENT IS THE WHOLE POINT. D136.

      The convoy flies home from the rendezvous to the world it left, so the two
      legs are the same straight line and `legs: 2` is exact. `assertFuel`'s
      committed figure is what stops a commander paying the merchant in deuterium
      and then flying on the same tank — the bug `launchTransfer` shipped once,
      which wrote a NEGATIVE store that nothing downstream defends against.
    */
    const reach = distance(origin, hit.at);
    const fuel = missionFuel(requested, reach, 2);
    assertFuel(fuel, origin.deuterium, order.give.deuterium);

    const arriveAt = atMinute(origin.seasonStart, hit.meetsAtMinutes);
    const homeMinutes = fleetTravelExact(reach, requested, fleetSpeedMult(origin.orbit), tech);
    assertSeasonOpenThrough(origin, addMinutes(dockEndsAt(arriveAt), homeMinutes));

    const [run] = await tx
      .insert(tradeRuns)
      .values({
        seasonId: origin.seasonId,
        occurrenceId: order.occurrenceId,
        planetId,
        // The convoy follows its COMMANDER home, not the pad. D150; see the column.
        ownerPlayerId: origin.playerId,
        fleet: requested,
        give: order.give,
        want: order.want,
        // Frozen at launch: what was quoted on the screen is what the return pays.
        rate: spec.rate,
        /*
          SOLVED ONCE AND STORED, NEVER RE-DERIVED. Re-solving later would let the
          merchant's own motion move a flight already in the air onto a new course,
          and a player watching their convoy cross the disc would see it jump. The
          POSITION of the convoy is still never stored — it is interpolated from
          this point and two instants, which is the difference that matters.
        */
        interceptX: hit.at.x,
        interceptY: hit.at.y,
        interceptZ: hit.at.z,
        departAt: origin.now,
        arriveAt,
      })
      .returning();
    if (!run) throw new Error('trade run insert returned no row');

    const remaining: Fleet = { ...origin.homeFleet };
    for (const [hull, count] of fleetEntries(requested)) {
      remaining[hull] = (remaining[hull] ?? 0) - count;
    }
    await setUnits(tx, planetId, remaining, 'home');
    await setUnits(tx, planetId, requested, tradeLocation(run.id));

    // The offer and the fuel leave together, in one write, so no intermediate
    // state exists in which one has been paid and the other has not.
    await saveResources(tx, planetId, {
      alloy: origin.alloy - order.give.alloy,
      crystal: origin.crystal - order.give.crystal,
      deuterium: origin.deuterium - order.give.deuterium - fuel,
    });

    await schedule(tx, {
      seasonId: origin.seasonId,
      kind: 'trade_arrival',
      refId: run.id,
      resolveAt: dockEndsAt(arriveAt),
    });

    /*
      PUBLISHED INSIDE THE TRANSACTION — NOTIFY only fires on commit, so this is
      both safe and the only place it can go. `launch` is the shard kind every
      client already routes to `traffic`: a convoy is a craft in the air and that
      is the read it moves. The private topic wakes this commander's OTHER devices;
      the tab that made the call already has the answer above.
    */
    await publishShard(tx, origin.seasonId, 'launch');
    await publish(tx, origin.playerId, 'private:trade');
    await recomputePlayerWealth(tx, origin.playerId);

    return {
      runId: run.id,
      occurrenceId: order.occurrenceId,
      fleet: requested,
      give: order.give,
      want: order.want,
      rate: spec.rate,
      departAt: origin.now,
      arriveAt,
      flightMinutes: hit.flightMinutes,
      intercept: hit.at,
      fuel,
      // Deliberately sequential on this one transaction connection: each is the
      // projection its own GET uses, and no second request can race the launch.
      pending: await pendingThreads(tx, planetId, origin.now),
      planet: await planetView(tx, planetId, clock),
    };
  });
}

/**
 * THE CONVOY REACHES THE MERCHANT, DOCKS, AND TURNS FOR HOME.
 *
 * NOTHING IS EXCHANGED IN THE WORLD HERE. The offer left the origin's store at
 * launch and the haul is frozen on the row, so there is no counterparty to settle
 * against and no second transaction to make consistent — which is exactly why this
 * lane can never lose a fleet the way a battle can.
 *
 * Idempotent by the same mechanism every other handler uses: the status transition
 * IS the claim, so an event delivered twice finds the run already claimed and does
 * nothing. The ten-second dock is a real server window, not an animation — this
 * event is scheduled at `dockEndsAt(arriveAt)`, and `traffic.ts` draws the convoy
 * holding alongside for the whole of it.
 */
export async function resolveTradeArrival(
  tx: Tx,
  runId: string,
  clock: Clock,
): Promise<void> {
  const claimed = await tx
    .update(tradeRuns)
    .set({ status: 'returning' })
    .where(and(eq(tradeRuns.id, runId), eq(tradeRuns.status, 'outbound')))
    .returning();
  const run = claimed[0];
  if (!run) return;

  const aboard = await fleetOfRun(tx, run.planetId, runId);
  if (fleetCount(aboard) === 0) {
    // Nothing to fly home. It cannot happen on this lane — there is no combat —
    // but a run with no craft must never be left drawing a flight or holding a bay.
    await tx.update(tradeRuns).set({ status: 'done', homeAt: null }).where(eq(tradeRuns.id, runId));
    await publishShard(tx, run.seasonId, 'arrival');
    await recomputePlayerWealth(tx, run.ownerPlayerId);
    return;
  }

  /*
    THE RETURN LEG IS PRICED AT THE COMMANDER'S CURRENT PACE, NOT THE LAUNCH'S.

    `trade_runs` carries no `tech` column and deliberately should not: D137 freezes
    doctrine at launch because doctrine decides a FIGHT, and there is no fight
    here. Propulsion is not combat research, takes no share of the 25% product
    ceiling and is not probe-visible (D152), so reading it live costs nothing and
    is what the mining lane already does with its own homeward leg.
  */
  const tech = await techOf(tx, run.ownerPlayerId);
  const meet = { x: run.interceptX, y: run.interceptY, z: run.interceptZ };
  const origin = await loadLocked(tx, run.planetId, clock);
  const back = fleetTravelExact(
    distance(meet, origin),
    aboard,
    fleetSpeedMult(await orbitOf(tx, run.planetId)),
    tech,
  );
  /*
    ANCHORED ON THE ROW'S OWN INSTANTS, NEVER ON THE CLOCK THAT WOKE THE WORKER.
    A poll that fires a second late must not make the flight home a second longer,
    or the leg the disc draws and the leg the queue is waiting on disagree.
  */
  const homeAt = addMinutes(dockEndsAt(run.arriveAt), back);

  await tx.update(tradeRuns).set({ homeAt }).where(eq(tradeRuns.id, runId));
  await schedule(tx, {
    seasonId: run.seasonId,
    kind: 'trade_return',
    refId: runId,
    resolveAt: homeAt,
  });
  await publishShard(tx, run.seasonId, 'arrival');
  await publish(tx, run.ownerPlayerId, 'private:trade');
  await recomputePlayerWealth(tx, run.ownerPlayerId);
}

export interface TradeDelivery {
  runId: string;
  ships: number;
  delivered: Resources;
}

/**
 * THE CONVOY GETS HOME AND THE HAUL LANDS.
 *
 * A RETURN FOLLOWS ITS COMMANDER, NEVER THE PAD. D150. The squadron is parked at
 * the world it left and that world may have changed hands while it was away —
 * ownership follows `ownerPlayerId` and delivery follows `safeHomePlanet`, which
 * falls back to the capital, which cannot be captured and is therefore always an
 * answer. Reading the destination off `planets.controller_player_id` instead
 * handed the whole flight to whoever had just taken the pad.
 *
 * The haul lands in STORAGE: it was bought, not produced, so the collector has
 * nothing to do with it. It lands even over any capacity, for the D133 reason a
 * captured hull does — no cap deletes what a return leg brings; caps block new
 * ingress only.
 */
export async function resolveTradeReturn(
  tx: Tx,
  runId: string,
  clock: Clock,
): Promise<TradeDelivery | null> {
  const claimed = await tx
    .update(tradeRuns)
    .set({ status: 'done' })
    .where(and(eq(tradeRuns.id, runId), eq(tradeRuns.status, 'returning')))
    .returning();
  const run = claimed[0];
  if (!run) return null;

  const storagePlanetId = run.planetId;
  const destinationPlanetId = await safeHomePlanet(tx, run.ownerPlayerId, storagePlanetId);
  const home = await loadLocked(tx, destinationPlanetId, clock);
  const returning = await fleetOfRun(tx, storagePlanetId, runId);

  const merged: Fleet = { ...home.homeFleet };
  for (const [hull, count] of fleetEntries(returning)) {
    merged[hull] = (merged[hull] ?? 0) + count;
  }
  await clearRunUnits(tx, storagePlanetId, runId);
  await setUnits(tx, destinationPlanetId, merged, 'home', run.ownerPlayerId);

  const haul = run.want;
  await saveResources(tx, destinationPlanetId, {
    alloy: home.alloy + haul.alloy,
    crystal: home.crystal + haul.crystal,
    deuterium: home.deuterium + haul.deuterium,
  });

  /*
    Wealth counts units by the world they sit on, so a captor was carrying the
    parked stack on their books for the whole flight. Both commanders are settled.
  */
  await recomputePlayerWealth(tx, run.ownerPlayerId);
  if (destinationPlanetId !== storagePlanetId) await recomputeWealth(tx, storagePlanetId);

  await notify(tx, {
    playerId: run.ownerPlayerId,
    kind: 'fleet_returned',
    payload: {
      trip: 'trade',
      ships: fleetCount(returning),
      lootAlloy: haul.alloy,
      lootCrystal: haul.crystal,
      lootDeuterium: haul.deuterium,
    },
    at: home.now,
    refId: run.id,
  });
  await publishShard(tx, run.seasonId, 'arrival');
  await publish(tx, run.ownerPlayerId, 'private:trade');

  return { runId, ships: fleetCount(returning), delivered: haul };
}

/**
 * Undo a convoy whose event could not be resolved, and hand back what never
 * changed hands. D28 · D46 · D136.
 *
 * WHICH PILE COMES BACK DEPENDS ON THE LEG, which is why the caller matches on the
 * event's own KIND rather than on the run id:
 *
 *   · `trade_arrival` — the convoy never reached the merchant, so the OFFER is
 *     still aboard and comes home with the ships. The haul never existed.
 *   · `trade_return`  — the deal happened, so the HAUL is aboard and comes home.
 *     The offer is gone for good; it was paid.
 *
 * FUEL IS NEVER REFUNDED, on either. D136: no system path asks for more and no
 * cancellation gives any back, and a quote that could be undone is not a decision.
 *
 * DELIVERED THROUGH `safeHomePlanet` like every other return leg, so an abandoned
 * convoy cannot be the one path that pays a captor.
 */
export async function abandonTradeRun(
  db: Db,
  runId: string,
  leg: 'outbound' | 'returning',
  clock: Clock,
): Promise<{ planetId: string; ships: number } | null> {
  return db.transaction(async (tx) => {
    const claimed = await tx
      .update(tradeRuns)
      .set({ status: 'done' })
      .where(and(eq(tradeRuns.id, runId), eq(tradeRuns.status, leg)))
      .returning();
    const run = claimed[0];
    if (!run) return null;

    const destinationPlanetId = await safeHomePlanet(tx, run.ownerPlayerId, run.planetId);
    /**
     * THE LOCK COMES FIRST, AND IT USED NOT TO. D166.
     *
     * This read the destination's `units` rows with a bare `select`, merged the
     * stranded crew into them, wrote the result — and only then took the planet's
     * row lock, for the resources. `setUnits` REPLACES a count rather than adding
     * to it, so two abandons landing on one world both read the same "before", both
     * wrote their own total, and whichever committed second deleted the other's
     * ships. No error and no report: the fleet was simply smaller.
     *
     * `resolveTradeReturn` has always locked first, which is the shape this now
     * matches: `home.homeFleet` is the same read, taken under the lock, so there is
     * no second query and nothing to disagree with. CLAUDE.md's mutation order —
     * lock → advance → validate → mutate — with no exception for housekeeping.
     */
    const home = await loadLocked(tx, destinationPlanetId, clock);
    const stranded = await fleetOfRun(tx, run.planetId, runId);
    const merged: Fleet = { ...home.homeFleet };
    for (const [hull, count] of fleetEntries(stranded)) {
      merged[hull] = (merged[hull] ?? 0) + count;
    }
    await clearRunUnits(tx, run.planetId, runId);
    if (fleetEntries(merged).length > 0) {
      await setUnits(tx, destinationPlanetId, merged, 'home', run.ownerPlayerId);
    }

    const cargo = leg === 'outbound' ? run.give : run.want;
    await saveResources(tx, destinationPlanetId, {
      alloy: home.alloy + cargo.alloy,
      crystal: home.crystal + cargo.crystal,
      deuterium: home.deuterium + cargo.deuterium,
    });

    await recomputePlayerWealth(tx, run.ownerPlayerId);
    if (destinationPlanetId !== run.planetId) await recomputeWealth(tx, run.planetId);

    await notify(tx, {
      playerId: run.ownerPlayerId,
      kind: 'fleet_returned',
      payload: { trip: 'recalled', craft: fleetCount(stranded), craftKind: 'fleet' },
      at: home.now,
      refId: run.id,
    });
    /** The convoy is out of the sky, and every disc has to stop drawing it. D53. */
    await publishShard(tx, run.seasonId, 'arrival');
    await publish(tx, run.ownerPlayerId, 'private:trade');
    return { planetId: destinationPlanetId, ships: fleetCount(stranded) };
  });
}
