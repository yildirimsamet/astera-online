import { and, asc, desc, eq, gt, inArray, isNull, lte, ne } from 'drizzle-orm';
import {
  faultsPossible,
  hasFault,
  minutesUntilLoyaltyZero,
  repairCost,
  INSTRUMENT_IDS,
  SHIELD,
  SATELLITE_IDS,
  buildingCost,
  alloyRate,
  collectorCap,
  crystalRate,
  deuteriumCollectorCap,
  deuteriumRate,
  deuteriumStorageCap,
  dominion,
  groundLoad,
  groundSlots,
  instrumentCost,
  productionMult,
  satelliteCost,
  satelliteSlots,
  shieldHp,
  storageCap,
  vaultProtects,
  type BuildingId,
} from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Tx } from '../db/client.js';
import { buildOrders, galaxyEventOccurrences, intergalacticConvoyRuns, planetFaults, players, strategicAssets } from '../db/schema.js';
import { baysOf } from './flight.js';
import { awayFleet, loadLocked, totalUnitsOf } from './planet.js';
import { researchCoreLevel, researchView } from './researchState.js';
import { colonyStanding } from './ownership.js';
import {
  activeResearchOrders,
  projectedResearchLevels,
  researchOrderView,
} from './researchQueue.js';

/**
 * EVERYTHING A COMMANDER KNOWS ABOUT THEIR OWN WORLD, IN ONE PLACE. D53.
 *
 * This was the body of `GET /api/planet` and nothing else could reach it, which is
 * why every mutation in the game cost TWO round trips: the action, and then the
 * refetch that told the interface what the action had done. On a phone that is
 * three to eight hundred milliseconds of a dead button after a tap — in a game
 * whose whole construction model is "instant on payment, no build timers".
 *
 * So it is a function now, and every mutation returns it. The action and its
 * result arrive together, the client writes the payload straight into the cache,
 * and there is no second request at all.
 *
 * IT IS FREE WHERE IT IS CALLED. A mutation is already inside the transaction and
 * already holds this planet's row lock, so the second `loadLocked` re-locks a row
 * it owns — and its economy advance is a no-op, because the first call moved
 * `lastTickAt` to now and the guard inside it declines to write twice. What is
 * left is four small indexed reads, against a whole HTTP request with its own
 * auth, its own transaction and the same four reads.
 *
 * WHY IT RE-READS RATHER THAN BUILDING FROM THE MUTATION'S OWN OBJECT. The point
 * of this payload is that it is exactly what the next `GET /api/planet` would say.
 * A mutation mutates a `LockedPlanet` in memory for its own arithmetic, but it
 * does not maintain every derived list on it — `buildUnits` writes unit rows and
 * leaves `homeFleet` alone — so building the answer from that object would ship a
 * view that disagrees with the database in a way nothing would catch until the
 * next refetch silently corrected it on screen.
 */
type StrategicRow = typeof strategicAssets.$inferSelect;

const PAD_RANK: Record<StrategicRow['status'], number> = {
  READY: 0,
  BUILDING: 1,
  PAUSED: 2,
  LAUNCHED: Number.MAX_SAFE_INTEGER,
  CONSUMED: Number.MAX_SAFE_INTEGER,
};

/**
 * THE ORDER A PAD FLIES IN. T11.
 *
 * What can launch first, then what finishes first: READY before BUILDING before
 * PAUSED, each by the instant it became (or will become) ready. The stockpile
 * puts two weapons on one pad, so "the weapon" is no longer a single row — and
 * the NEWEST row, which is what this used to report, is exactly the wrong one:
 * a second weapon queued behind a ready one hid it from its owner and from the
 * strike control that reads the head of this list.
 */
function padOrder(a: StrategicRow, b: StrategicRow): number {
  const rank = (row: StrategicRow) => PAD_RANK[row.status];
  const when = (row: StrategicRow) => row.status === 'PAUSED'
    ? row.remainingSeconds ?? 0
    : (row.readyAt ?? row.startedAt).getTime();
  return rank(a) - rank(b) || when(a) - when(b) || a.id.localeCompare(b.id);
}

const strategicView = (row: StrategicRow) => ({
  id: row.id,
  status: row.status,
  readyAt: row.readyAt,
  remainingSeconds: row.remainingSeconds,
});

export async function planetView(tx: Tx, planetId: string, clock: Clock) {
  const p = await loadLocked(tx, planetId, clock, { requireLive: false });
  /**
   * TWO KINDS OF ASSET, TWO KEYS. T12.
   *
   * This read was `limit 1` over the whole table, written when a world could only
   * ever hold a Death Star. T10 put the interceptor charge in the same table, so
   * from the moment a charge became buildable the newest row won — and a charge
   * started after a weapon reported itself as the weapon, hiding a READY Death
   * Star from its own owner and from the launch control that reads this field.
   */
  const strategicOfType = (type: 'DEATH_STAR' | 'INTERCEPTOR') => tx
    .select()
    .from(strategicAssets)
    .where(and(
      eq(strategicAssets.planetId, planetId),
      eq(strategicAssets.type, type),
      inArray(strategicAssets.status, ['BUILDING', 'PAUSED', 'READY']),
    ))
    .orderBy(desc(strategicAssets.startedAt), desc(strategicAssets.id));
  const [[player], weapons, [interceptor], queued, researchQueue, colonies] = await Promise.all([
    tx.select().from(players).where(eq(players.id, p.playerId)),
    strategicOfType('DEATH_STAR'),
    // `maxCharges` is one, so the newest charge is the only charge.
    strategicOfType('INTERCEPTOR').limit(1),
    tx
      .select()
      .from(buildOrders)
      .where(and(eq(buildOrders.planetId, planetId), eq(buildOrders.status, 'BUILDING')))
      .orderBy(asc(buildOrders.queue), asc(buildOrders.slot)),
    activeResearchOrders(tx, p.playerId),
    colonyStanding(tx, p.playerId),
  ]);
  const pad = weapons.toSorted(padOrder);

  /**
   * THE RATES THE ECONOMY ACTUALLY RUNS AT — Foundry included. D52a.
   *
   * `advanceEconomy` fills the works to `collectorCap(rate × productionMult)` and
   * `collect` fills storage to `storageCap(rate × productionMult)`, and every
   * figure below used to be computed from the BARE rate. With a Foundry in orbit
   * (×1.06) the real ceiling is six per cent above the published one, so
   * `bufferAlloy` legitimately exceeded `bufferAlloyCap` — the Works widget pinned
   * at 100% and Signals announced "the works have stopped, production is being
   * thrown away" while production was in fact still running. Storage read over
   * 100% of its stated cap after a collect, for the same reason.
   *
   * It also under-sold the satellite it exists to price: a player who had just
   * bought a Foundry saw the same per-hour figure they had before.
   *
   * One boosted rate, used for all six. `productionMult` is the single source —
   * anything that derives a cap or a rate from a level must go through it.
   */
  const boost = productionMult(p.orbit);
  const nominalPerHourAlloy = alloyRate(p.buildings.REFINERY) * boost;
  const nominalPerHourCrystal = crystalRate(p.buildings.EXTRACTOR) * boost;
  /**
   * The floor is HOURS OF PRODUCTION, so it needs the producing levels as well as
   * the Vault's. It reads the unboosted rate on purpose: a Foundry lifts the store
   * without lifting the floor, so a bigger planet is slightly more exposed.
   */
  // What the plant makes, boosted like everything else the works produce. T5.
  const nominalPerHourDeuterium = deuteriumRate(p.buildings.DEUTERIUM_PLANT) * boost;
  /*
    THE VIEW PUBLISHES WHAT IS RUNNING, NOT WHAT THE HARDWARE COULD MAKE.

    `advanceEconomy` has always applied the outage, but these three figures stayed
    nominal. The browser projects the Works from them between reads, so it visibly
    manufactured ore the server would never credit and kept the inflow animation
    running over a dark refinery. Capacity remains nominal below: repairing a plant
    resumes the same vessels; an outage does not shrink them.
  */
  const perHourAlloy = hasFault(p.faults, 'REFINERY_OUTAGE') ? 0 : nominalPerHourAlloy;
  const perHourCrystal = hasFault(p.faults, 'EXTRACTOR_OUTAGE') ? 0 : nominalPerHourCrystal;
  const perHourDeuterium = hasFault(p.faults, 'PLANT_OUTAGE') ? 0 : nominalPerHourDeuterium;

  const vaultCapacity = vaultProtects(
    p.buildings.VAULT,
    p.buildings.REFINERY,
    p.buildings.EXTRACTOR,
    p.buildings.DEUTERIUM_PLANT,
  );
  const vaultProtected = {
    alloy: Math.min(Math.floor(p.alloy), vaultCapacity.alloy),
    crystal: Math.min(Math.floor(p.crystal), vaultCapacity.crystal),
    deuterium: Math.min(Math.floor(p.deuterium), vaultCapacity.deuterium),
  };
  const shieldMax = shieldHp(p.effectiveInstruments.AEGIS ?? 0);
  /**
   * The levels the construction queue will have reached once it drains. T7.
   *
   * Levels rather than a set of ids, because a project can be a ladder: what the
   * screen needs to know is not "will this be done" but "which rung will it be on",
   * and the two questions only look alike while every ceiling is one. The order's
   * `count` carries its target level.
   */
  const queuedResearch = await projectedResearchLevels(tx, p.playerId, researchQueue);
  const [activeConvoy] = await tx.select({ id: intergalacticConvoyRuns.id })
    .from(intergalacticConvoyRuns)
    .where(and(
      eq(intergalacticConvoyRuns.planetId, planetId),
      ne(intergalacticConvoyRuns.status, 'done'),
    ))
    .limit(1);
  /**
   * THIS WORLD HAS ALREADY SPENT ITS ONE STRIKE AT THE CONVOY THAT IS UP. D201.
   *
   * A world may strike each occurrence exactly once, ever — the DB says so with a
   * unique index on `(planet_id, occurrence_id)` — and a crossing lasts two hours
   * while a round trip rarely lasts one. So the ordinary case is a commander whose
   * fleet is safely home, inside the same window, looking at a control that has
   * nothing left to spend. Publishing only `convoyLaunchLocked` (which clears the
   * moment the fleet lands) re-armed that control and let them pick a wing, read a
   * quote and commit, to be answered with `CONVOY_ALREADY_RAIDED`.
   *
   * A rule the player cannot SEE is not a usable rule (D124), so the state travels
   * with the world rather than living only in the refusal. It names no occurrence
   * and no run: it is one boolean about the convoy that is public right now.
   */
  const [spentConvoy] = await tx.select({ id: intergalacticConvoyRuns.id })
    .from(intergalacticConvoyRuns)
    .innerJoin(
      galaxyEventOccurrences,
      eq(galaxyEventOccurrences.id, intergalacticConvoyRuns.occurrenceId),
    )
    .where(and(
      eq(intergalacticConvoyRuns.planetId, planetId),
      // An abandoned outbound run released its ration; the control stays live.
      isNull(intergalacticConvoyRuns.abandonedAt),
      lte(galaxyEventOccurrences.startsAt, p.now),
      gt(galaxyEventOccurrences.endsAt, p.now),
    ))
    .limit(1);

  // Every craft this world owns, home or away — both ceilings are ownership rules.
  const owned = await totalUnitsOf(tx, planetId);

  return {
    planet: {
      id: p.planetId,
      name: p.name,
      kind: p.kind,
      position: { x: p.x, y: p.y, z: p.z },
      alloy: Math.floor(p.alloy),
      crystal: Math.floor(p.crystal),
      deuterium: Math.floor(p.deuterium),
      alloyCap: storageCap(nominalPerHourAlloy, p.buildings.VAULT),
      crystalCap: storageCap(nominalPerHourCrystal, p.buildings.VAULT),
      deuteriumCap: deuteriumStorageCap(
        nominalPerHourDeuterium,
        nominalPerHourCrystal,
        p.buildings.VAULT,
      ),
      alloyPerHour: Math.round(perHourAlloy),
      nominalAlloyPerHour: Math.round(nominalPerHourAlloy),
      /*
        THE RATE THE HUD WAS HARD-CODING TO ZERO. T5.

        `StatusBar` printed `rate={0}` for deuterium because the resource had no
        production — true then, false since the refinery. Left alone, a commander
        with a plant watches the figure climb while the readout beside it says
        nothing is being made, and the "full in ..." warning every other resource
        gets can never fire.
      */
      deuteriumPerHour: Math.round(perHourDeuterium),
      crystalPerHour: Math.round(perHourCrystal),
      nominalCrystalPerHour: Math.round(nominalPerHourCrystal),
      nominalDeuteriumPerHour: Math.round(nominalPerHourDeuterium),
      /**
       * The works: what is waiting to be collected, and the ceiling it stops at
       * (D16). Both are needed on the client, because the interface has to say
       * "full in 3h 20m" before it can say "FULL — you are wasting 160/h", and
       * only the second of those is a reason to open the game right now.
       */
      bufferAlloy: Math.floor(p.bufferAlloy),
      bufferCrystal: Math.floor(p.bufferCrystal),
      bufferDeuterium: Math.floor(p.bufferDeuterium),
      bufferAlloyCap: collectorCap(nominalPerHourAlloy),
      bufferCrystalCap: collectorCap(nominalPerHourCrystal),
      bufferDeuteriumCap: deuteriumCollectorCap(
        nominalPerHourDeuterium,
        nominalPerHourCrystal,
      ),
      /**
       * WHAT IS ACTUALLY SAFE, AS ONE FIGURE. D61.
       *
       * The floor is a pair now, and the screen asks a single question: how much of
       * what I am holding can nobody take. That is `min(held, floor)` on each side
       * added together — not the floor itself, which would claim protection over
       * crystal a planet does not have.
       *
       * It also makes the arithmetic the interface was already doing correct.
       * `PlanetHero` reads `alloy + crystal - vaultFloor` as the exposed amount;
       * against a single flat floor that OVERSTATED the risk, because the rule
       * deducted that floor from each resource and the screen deducted it once.
       */
      vaultFloor:
        vaultProtected.alloy + vaultProtected.crystal + vaultProtected.deuterium,
      /** Exact per-resource protection. The aggregate above remains for old verdict logic. */
      vaultProtected,
      vaultCapacity,
      shield: Math.floor(p.shield),
      shieldMax,
      shieldPerHour: Math.round(shieldMax * SHIELD.regenPerHour),
      disruptedUntil: p.disruptedUntil,
      recoveryUntil: p.recoveryUntil,
      protectedUntil: p.protectedUntil,
      /**
       * THE STRUCK WORLD WORKS DOUBLE UNTIL THIS INSTANT. 2026-09-16.
       *
       * Null the moment it has passed, so a surface never has to compare it to a
       * clock to decide whether to draw the boost — and the works projection on the
       * client reads the same instant to fill the vessels at the boosted pace.
       */
      productionBoostUntil: p.recoveryBoostUntil !== null && p.recoveryBoostUntil > p.now
        ? p.recoveryBoostUntil
        : null,
    },
    buildings: p.buildings,
    nextCosts: Object.fromEntries(
      (Object.keys(p.buildings) as BuildingId[]).map((b) => [b, buildingCost(b, p.buildings[b])]),
    ),
    /** The four on the ground, with their levels. D25. */
    instruments: p.instruments,
    effectiveInstruments: p.effectiveInstruments,
    /**
     * What the next level of each instrument costs, priced by the server.
     *
     * The client could compute this — `instrumentCost` is a pure function it
     * already imports — but every other price on this payload is authoritative
     * and a screen that mixes the two is one modifier away from showing a number
     * the purchase endpoint will refuse.
     */
    instrumentCosts: Object.fromEntries(
      INSTRUMENT_IDS.map((i) => [i, instrumentCost(i, p.instruments[i] ?? 0)]),
    ),
    /** What is in orbit, and how much room there is. D25. */
    orbit: p.storedOrbit,
    effectiveOrbit: p.orbit,
    orbitSlots: satelliteSlots(p.buildings.CORE),
    satelliteCosts: Object.fromEntries(SATELLITE_IDS.map((sat) => [sat, satelliteCost(sat)])),
    /** Two immediate seasonal projects; discovery is derived, never stored. D93/D94. */
    research: await researchView(tx, p, queuedResearch),
    /** The Core that gates and times research on EVERY world: the capital's. D209. */
    researchCore: await researchCoreLevel(tx, p.playerId),
    /** One commander lane, identical whichever controlled world funded the view. */
    researchQueue: researchQueue.map(researchOrderView),
    /**
     * WHAT IS BROKEN, AND WHAT PUTTING IT RIGHT COSTS. Koloni arızaları.
     *
     * Read again here rather than taken from `loadLocked`, which carries only the
     * KINDS. Five of the eight are enforced at a flight bay, a battle or a sensor post
     * and none of those needs a repair timestamp; making every transaction in the game
     * carry one so a screen could draw it is the wrong way round. This is a screen
     * read, and a screen read may pay for its own query.
     *
     * THE PRICE IS SERVER-SIDE, like every other price on this payload. The client
     * imports `repairCost` and could work it out, but a surface that mixes computed
     * and authoritative figures is one modifier away from quoting a number the repair
     * endpoint will refuse.
     */
    faults: (await tx.select().from(planetFaults).where(eq(planetFaults.planetId, planetId)))
      .map((fault) => ({
        id: fault.id,
        kind: fault.kind,
        startedAt: fault.startedAt,
        cost: repairCost(fault.kind, p.buildings.CORE),
        /**
         * NULL UNTIL SOMEBODY PAYS, and it never goes back to null. There is no cancel:
         * the strip draws three lanes and none of them carries a way out.
         */
        repair: fault.repairReadyAt && fault.repairSlot !== null
          ? { slot: fault.repairSlot, readyAt: fault.repairReadyAt }
          : null,
      })),
    /**
     * HOW MUCH OF THIS WORLD IS STILL YOURS, and how long that lasts.
     *
     * NULL WHERE IT CANNOT MOVE — a capital, or a colony below the Core gate. A bar
     * that can only ever read full is furniture, and this screen has no room for
     * furniture at 350 wide.
     *
     * `minutesLeft` is the half that makes it a DECISION rather than a readout. The
     * commander does not need to know they are at 34%; they need to know they have
     * eleven hours, because that is the figure "do I fix this now or after work" is
     * answered with. Null while nothing is falling.
     */
    loyalty: faultsPossible({
      kind: p.kind,
      coreLevel: p.buildings.CORE,
      plantLevel: p.buildings.DEUTERIUM_PLANT,
    })
      ? { value: p.loyalty, minutesLeft: minutesUntilLoyaltyZero(p.loyalty, p.faults.length) }
      : null,
    /** Absolute instants keep every client on the same queue clock. D4. */
    queues: {
      CONSTRUCTION: queued
        .filter((order) => order.queue === 'CONSTRUCTION' && order.kind !== 'RESEARCH')
        .map(buildOrderView),
      YARD: queued.filter((order) => order.queue === 'YARD').map(buildOrderView),
    },
    /** The head of `deathStars`: the weapon that can fly soonest. */
    strategic: pad[0] ? strategicView(pad[0]) : null,
    /** Every weapon on this world's pad, in `padOrder`. Up to the stockpile's two. T11. */
    deathStars: pad.map(strategicView),
    /** The anti-strategic charge, which is its own asset and its own answer. T10. */
    interceptor: interceptor ? strategicView(interceptor) : null,
    colonies,
    fleet: p.homeFleet,
    ground: p.ground,
    /**
     * Your own craft that are currently off the planet.
     *
     * `fleet` is what is standing on the ground, so it is the wrong number to
     * count anything a player OWNS against — and `PROSPECTOR.max` is a rule about
     * ownership. Without this the build sheet would offer another Prospector to
     * somebody whose two were away mining, and the server would refuse it: a
     * control that lies about what it will do.
     *
     * Yours only, and no fog question arises — it is your own planet's units.
     */
    fleetAway: await awayFleet(tx, planetId),
    /**
     * How much this planet has in the air, and how much it may. D28.
     *
     * Counted here rather than derived on the client, because the client cannot
     * see other people's craft and would have to guess — and because the count is
     * already free: this handler holds the planet lock that `assertFreeBay` reads
     * under.
     */
    flight: await baysOf(tx, planetId, p.buildings.CORE),
    convoyLaunchLocked: activeConvoy !== undefined,
    convoyOccurrenceSpent: spentConvoy !== undefined,
    /**
     * BOTH CEILINGS AND BOTH LOADS. T4 · T4b.
     *
     * Sent so the order screen can refuse a hull BEFORE it is pressed. A control
     * that offers a ship the server will reject is a control that lies about what
     * it does, and the Prospector cap already established the shape: the client
     * greys the option and prints the figures rather than discovering the rule
     * through a toast.
     *
     * The load is counted over every unit row this world owns — `fleet` is only
     * what is standing on the ground, and the ceiling is a rule about ownership.
     * Without that, a world whose guns were somehow away would be offered room it
     * does not have. D184 left one ceiling here; the fleet no longer has one.
     */
    capacity: {
      ground: groundSlots(p.buildings.CORE),
      groundUsed: groundLoad(owned),
    },
    /**
     * WHETHER THE COMMANDER HOLDING THIS WORLD IS NEW. Owner instruction.
     *
     * A world claimed through the Academy carries the step it was claimed at;
     * every world that existed before onboarding, and every established
     * commander's, carries null. The client uses it for one thing — whether the
     * written coaching card applies at all (`SituationGuide`) — and it has to come
     * from here rather than from the device, because a device flag would put the
     * beginner's card in front of a season-old commander on a new phone.
     */
    academyStep: p.academyStep,
    score: {
      wealth: player?.wealth ?? 0,
      dominion: dominion({
        taken: player?.dominionTaken ?? 0,
        lost: player?.dominionLost ?? 0,
      }),
    },
  };
}

function buildOrderView(order: typeof buildOrders.$inferSelect) {
  return {
    id: order.id,
    queue: order.queue,
    slot: order.slot,
    kind: order.kind,
    subject: order.subject,
    count: order.count,
    startedAt: order.startedAt,
    finishesAt: order.readyAt,
    cost: order.cost,
  };
}

export type PlanetView = Awaited<ReturnType<typeof planetView>>;
