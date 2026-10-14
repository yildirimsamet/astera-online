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
  hangarCapacity,
  hangarCeiling,
  hangarLoad,
  instrumentCost,
  productionMult,
  planetSkinById,
  satelliteCost,
  satelliteSlots,
  shieldHp,
  storageCap,
  vaultProtects,
  SILENT_SPACE,
  silentSpaceDueAt,
  type BuildingId,
  type Fleet,
  dockLocation,
  clanDefenseApplies,
} from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Tx } from '../db/client.js';
import { buildOrders, galaxyEventOccurrences, intergalacticConvoyRuns, players, strategicAssets } from '../db/schema.js';
import { baysOf } from './flight.js';
import { loadPlanetViewState, GameError, type LockedPlanet } from './planet.js';
import { asTech, buildResearchView, loadResearchViewData } from './researchState.js';
import { dockLotsOf, dockView, shipsOfLots } from './shipDamage.js';
import { colonyStanding } from './ownership.js';
import { buildDefencePostureView } from './defencePosture.js';
import { activeClanMembership } from './clanCombat.js';
import { clanSupportBayView } from './clanSupportView.js';
import {
  activeResearchOrders,
  researchOrderView,
} from './researchQueue.js';

/**
 * Capture private response facts under the existing transaction locks, then render
 * without a database handle. Mutation callers must capture AFTER their writes;
 * reusing their arithmetic LockedPlanet can omit changed units or queue rows.
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

function departureOf(
  player: Pick<typeof players.$inferSelect, 'lastProgressAt' | 'joinedAt' | 'mainEnteredAt'> | undefined,
  p: Pick<LockedPlanet, 'silentSpace' | 'seasonEndsAt'>,
): Date | null {
  if (!player || p.silentSpace) return null;
  const at = silentSpaceDueAt({
    lastProgressAt: player.lastProgressAt?.getTime() ?? null,
    joinedAt: player.joinedAt.getTime(),
    mainEnteredAt: (player.mainEnteredAt ?? player.joinedAt).getTime(),
  });
  return at < p.seasonEndsAt.getTime() ? new Date(at) : null;
}

/** Shared only across worlds in one transaction, never across requests or writes. */
async function loadCommanderViewData(tx: Tx, p: LockedPlanet) {
  const [[player], researchData, researchQueue, colonies, membership] = await Promise.all([
    tx.select().from(players).where(eq(players.id, p.playerId)),
    loadResearchViewData(tx, p.playerId),
    activeResearchOrders(tx, p.playerId),
    colonyStanding(tx, p.playerId),
    clanDefenseApplies(p.rulesetVersion) ? activeClanMembership(tx, p.playerId) : null,
  ]);
  const queuedResearch = new Map(researchData.rows.map(row => [row.projectId, row.level]));
  for (const order of researchQueue) {
    queuedResearch.set(order.projectId, Math.max(queuedResearch.get(order.projectId) ?? 0, order.level));
  }
  return { playerId: p.playerId, seasonId: p.seasonId, player, researchData, researchQueue,
    colonies, hasMembership: membership !== null, queuedResearch };
}

export async function loadPlanetViewData(
  tx: Tx, planetId: string, clock: Clock,
  shared?: Awaited<ReturnType<typeof loadCommanderViewData>>,
  options: { readOnly?: boolean } = {},
) {
  const { planet: p, unitRows, faultRows } = await loadPlanetViewState(tx, planetId, clock, options);
  if (shared && (shared.playerId !== p.playerId || shared.seasonId !== p.seasonId)) {
    throw new GameError('PLACEMENT_CHANGED', 'World ownership changed; refresh and try again', 409);
  }
  /*
    ONE PASS, NOT FIVE. Resource analysis follow-up 2026-10-14.

    Everything below reads the same snapshot and depends only on the world state
    above, so it is issued together and pipelined on this transaction's connection
    instead of waiting for each answer in turn.
  */
  const [commander, assets, queued, [activeConvoy], [spentConvoy], dockLots, flight, clanSupport] = await Promise.all([
    shared ?? loadCommanderViewData(tx, p),
    tx.select().from(strategicAssets).where(and(
      eq(strategicAssets.planetId, planetId),
      inArray(strategicAssets.type, ['DEATH_STAR', 'INTERCEPTOR']),
      inArray(strategicAssets.status, ['BUILDING', 'PAUSED', 'READY']),
    )).orderBy(desc(strategicAssets.startedAt), desc(strategicAssets.id)),
    tx.select().from(buildOrders)
      .where(and(eq(buildOrders.planetId, planetId), eq(buildOrders.status, 'BUILDING')))
      .orderBy(asc(buildOrders.queue), asc(buildOrders.slot)),
    tx.select({ id: intergalacticConvoyRuns.id })
      .from(intergalacticConvoyRuns)
      .where(and(
        eq(intergalacticConvoyRuns.planetId, planetId),
        ne(intergalacticConvoyRuns.status, 'done'),
      ))
      .limit(1),
    /**
     * THIS WORLD HAS ALREADY SPENT ITS ONE STRIKE AT THE CONVOY THAT IS UP. D201.
     *
     * A world may strike each occurrence exactly once, ever — the DB says so with a
     * unique index on `(planet_id, occurrence_id)` — and a crossing lasts three hours
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
    tx.select({ id: intergalacticConvoyRuns.id })
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
      .limit(1),
    dockLotsOf(tx, planetId, unitRows),
    baysOf(tx, planetId, p.buildings.CORE),
    clanSupportBayView(tx, { planetId, rulesetVersion: p.rulesetVersion }),
  ]);
  return { p, commander, assets, queued, activeConvoy, spentConvoy, unitRows, faultRows,
    dockLots, flight, clanSupport };
}

export type PlanetViewData = Awaited<ReturnType<typeof loadPlanetViewData>>;

/** Apply to the transaction promise, so rendering never prolongs its world locks. */
export function buildPlanetResult<T extends { planet: PlanetViewData }>(result: T) {
  const { planet, ...rest } = result;
  return { ...rest, planet: buildPlanetView(planet) };
}

/** No queries or writes: safe to run after the capturing transaction commits. */
export function buildPlanetView(data: PlanetViewData) {
  const { p, commander, assets, queued, activeConvoy, spentConvoy, unitRows, faultRows,
    dockLots, flight, clanSupport } = data;
  const { player, researchData, researchQueue, colonies, hasMembership, queuedResearch } = commander;
  const pad = assets.filter(row => row.type === 'DEATH_STAR').toSorted(padOrder);
  const interceptors = assets.filter(row => row.type === 'INTERCEPTOR').toSorted(padOrder);
  const owned: Fleet = {};
  const fleetAway: Fleet = {};
  for (const row of unitRows) {
    owned[row.hull] = (owned[row.hull] ?? 0) + row.count;
    if (row.count > 0 && row.location !== 'home' && !row.location.startsWith(dockLocation(''))) {
      fleetAway[row.hull] = (fleetAway[row.hull] ?? 0) + row.count;
    }
  }
  const research = buildResearchView(p, researchData, queuedResearch);
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
  // D212: Silent Space halves what runs; every ceiling below keeps reading the rated figure.
  const pace = p.silentSpace ? SILENT_SPACE.productionPace : 1;
  const perHourAlloy = hasFault(p.faults, 'REFINERY_OUTAGE') ? 0 : nominalPerHourAlloy * pace;
  const perHourCrystal = hasFault(p.faults, 'EXTRACTOR_OUTAGE') ? 0 : nominalPerHourCrystal * pace;
  const perHourDeuterium = hasFault(p.faults, 'PLANT_OUTAGE') ? 0 : nominalPerHourDeuterium * pace;

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
  return {
    planet: {
      id: p.planetId,
      // The economy was advanced under this world's lock at this instant.
      snapshotAt: p.now,
      name: p.name,
      skinId: p.equippedSkinId ? planetSkinById(p.equippedSkinId)?.id ?? null : null,
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
      empUntil: p.empUntil,
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
      /**
       * NO TRANSFER MAY LEAVE THIS WORLD UNTIL THIS INSTANT. Faz 2A.3.
       *
       * Published so the transfer sheet can say so BEFORE the commander packs a squadron. A rule
       * that only ever appears as a refusal on commit is a rule the player learns by losing a
       * decision to it, and this one fires at exactly the moment they are in a hurry.
       *
       * Null once it has passed, like the boost above it, so no surface compares it to a clock.
       */
      transferReadyAt: p.transferReadyAt !== null && p.transferReadyAt > p.now
        ? p.transferReadyAt
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
    research,
    /** The Core that gates and times research on EVERY world: the capital's. D209. */
    researchCore: colonies.capitalCore,
    /** One commander lane, identical whichever controlled world funded the view. */
    researchQueue: researchQueue.map(researchOrderView),
    /**
     * WHAT IS BROKEN, AND WHAT PUTTING IT RIGHT COSTS. Koloni arızaları.
     *
     * Reuse the rows captured while advancing the economy under the world lock.
     *
     * THE PRICE IS SERVER-SIDE, like every other price on this payload. The client
     * imports `repairCost` and could work it out, but a surface that mixes computed
     * and authoritative figures is one modifier away from quoting a number the repair
     * endpoint will refuse.
     */
    faults: faultRows
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
     * Capitals have no loyalty. Every colony may lose it in battle, including those
     * below the Core fault gate.
     *
     * `minutesLeft` is the half that makes it a DECISION rather than a readout. The
     * commander does not need to know they are at 34%; they need to know they have
     * eleven hours, because that is the figure "do I fix this now or after work" is
     * answered with. Null while nothing is falling.
     */
    loyalty: p.kind === 'COLONY'
      ? {
          value: p.loyalty,
          minutesLeft: minutesUntilLoyaltyZero(p.loyalty, faultsPossible({
            kind: p.kind,
            coreLevel: p.buildings.CORE,
            plantLevel: p.buildings.DEUTERIUM_PLANT,
          }) ? p.faults.length : 0),
        }
      : null,
    /** Absolute instants keep every client on the same queue clock. D4. */
    queues: {
      CONSTRUCTION: queued
        .filter((order) => order.queue === 'CONSTRUCTION' && order.kind !== 'RESEARCH')
        .map(buildOrderView),
      YARD: queued.filter((order) => order.queue === 'YARD').map(buildOrderView),
      /** The Repair Station's own lane, beside the yard. Kalıcı gemi hasarı. */
      REPAIR: queued.filter((order) => order.queue === 'REPAIR').map(buildOrderView),
    },
    /** The head of `deathStars`: the weapon that can fly soonest. */
    strategic: pad[0] ? strategicView(pad[0]) : null,
    /** Every weapon on this world's pad, in `padOrder`. Up to the stockpile's two. T11. */
    deathStars: pad.map(strategicView),
    /** Compatibility head plus the complete two-charge battery. */
    interceptor: interceptors[0] ? strategicView(interceptors[0]) : null,
    interceptors: interceptors.map(strategicView),
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
    fleetAway,
    /**
     * Your own ships waiting in the Repair Station. Kalıcı gemi hasarı.
     *
     * Owned, so every ownership count on the client (the Hangar room, the Prospector
     * cap) must add them — but neither standing at home nor away, so they are in
     * neither of the two fields above.
     */
    fleetDocked: shipsOfLots(dockLots),
    /**
     * THE REPAIR STATION: what waits in the dock and what repairing it costs. Priced
     * here, like the fault repairs above, so the screen never quotes a figure the repair
     * endpoint would refuse.
     */
    dock: dockView(dockLots, p.buildings.SHIPYARD, asTech(new Map(research.map((row) => [row.id, row.level])))),
    /**
     * How much this planet has in the air, and how much it may. D28.
     *
     * Counted here rather than derived on the client, because the client cannot
     * see other people's craft and would have to guess — and because the count is
     * captured under the same planet lock that `assertFreeBay` reads under.
     */
    flight,
    convoyLaunchLocked: activeConvoy !== undefined,
    convoyOccurrenceSpent: spentConvoy !== undefined,
    /**
     * SILENT SPACE, FROM BOTH SIDES OF THE DOOR. D212.
     *
     * `silentSpace` closes the fight and farm controls before they are pressed and explains
     * the halved rates above. `silentSpaceAt` is when a main-galaxy commander leaves if they
     * order nothing until then; null inside Silent Space and when the season closes first.
     */
    silentSpace: p.silentSpace,
    silentSpaceAt: departureOf(player, p),
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
     * does not have. `hangarCeiling` is the tallest Hangar this Core allows, so the
     * screen can tell "raise the Hangar" from "raise the Core first".
     */
    capacity: {
      hangar: hangarCapacity(p.buildings.HANGAR),
      hangarUsed: hangarLoad(owned),
      hangarCeiling: hangarCeiling(p.buildings.CORE),
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
    /**
     * THE RULE SET THIS WORLD'S SEASON WAS DEALT. Taktik geri çekilme, 2026-09-23.
     *
     * The Defend tab states the fleet-escape threshold only in a season that has the
     * rule, and it reads that here — off its own world — rather than asking for a
     * second payload the planet screen otherwise never needs.
     */
    rulesetVersion: p.rulesetVersion,
    /**
     * THE TWO DEFENCE TOGGLES. Klan Savunma Desteği, owner K4 · 2026-10-01.
     *
     * Null in a season dealt before the rule — the retreat there is automatic and
     * there is nothing to choose. `supportLocked` says why the support toggle is
     * greyed, so the page can tell the commander rather than just refuse.
     */
    defencePosture: buildDefencePostureView({
      posture: p.defencePosture,
      rulesetVersion: p.rulesetVersion,
    }, hasMembership),
    /**
     * THE HANGAR'S "KLAN DESTEĞİ" BAY: what clanmates have standing here or flying in,
     * and the room it has (the world's own Hangar room, owner K1). Null before ruleset 15.
     */
    clanSupport,
    score: {
      wealth: player?.wealth ?? 0,
      dominion: dominion({
        taken: player?.dominionTaken ?? 0,
        lost: player?.dominionLost ?? 0,
      }),
    },
  };
}

/** Transaction-supplied callers (including durable idempotent responses) render inside their transaction. */
export async function planetView(tx: Tx, planetId: string, clock: Clock) {
  return buildPlanetView(await loadPlanetViewData(tx, planetId, clock));
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
