import { eq } from 'drizzle-orm';
import {
  INSTRUMENT_IDS,
  SATELLITE_IDS,
  alloyRate,
  collectorCap,
  crystalRate,
  dominion,
  instrumentCost,
  productionMult,
  satelliteCost,
  satelliteSlots,
  storageCap,
  upgradeCost,
  vaultProtects,
  type BuildingId,
} from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Tx } from '../db/client.js';
import { players } from '../db/schema.js';
import { baysOf } from './flight.js';
import { awayFleet, loadLocked } from './planet.js';

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
export async function planetView(tx: Tx, planetId: string, clock: Clock) {
  const p = await loadLocked(tx, planetId, clock);
  const [player] = await tx.select().from(players).where(eq(players.id, p.playerId));

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
  const perHourAlloy = alloyRate(p.buildings.REFINERY) * boost;
  const perHourCrystal = crystalRate(p.buildings.EXTRACTOR) * boost;

  return {
    planet: {
      id: p.planetId,
      name: p.name,
      position: { x: p.x, y: p.y, z: p.z },
      alloy: Math.floor(p.alloy),
      crystal: Math.floor(p.crystal),
      alloyCap: storageCap(perHourAlloy),
      crystalCap: storageCap(perHourCrystal),
      alloyPerHour: Math.round(perHourAlloy),
      crystalPerHour: Math.round(perHourCrystal),
      /**
       * The works: what is waiting to be collected, and the ceiling it stops at
       * (D16). Both are needed on the client, because the interface has to say
       * "full in 3h 20m" before it can say "FULL — you are wasting 160/h", and
       * only the second of those is a reason to open the game right now.
       */
      bufferAlloy: Math.floor(p.bufferAlloy),
      bufferCrystal: Math.floor(p.bufferCrystal),
      bufferAlloyCap: collectorCap(perHourAlloy),
      bufferCrystalCap: collectorCap(perHourCrystal),
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
        Math.min(Math.floor(p.alloy), vaultProtects(p.buildings.VAULT).alloy) +
        Math.min(Math.floor(p.crystal), vaultProtects(p.buildings.VAULT).crystal),
      shield: Math.floor(p.shield),
      disruptedUntil: p.disruptedUntil,
    },
    buildings: p.buildings,
    nextCosts: Object.fromEntries(
      (Object.keys(p.buildings) as BuildingId[]).map((b) => [b, upgradeCost(p.buildings[b])]),
    ),
    /** The four on the ground, with their levels. D25. */
    instruments: p.instruments,
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
    orbit: p.orbit,
    orbitSlots: satelliteSlots(p.buildings.CORE),
    satelliteCosts: Object.fromEntries(SATELLITE_IDS.map((sat) => [sat, satelliteCost(sat)])),
    fleet: p.homeFleet,
    ground: p.ground,
    /**
     * Your own craft that are currently off the planet.
     *
     * `fleet` is what is standing on the ground, so it is the wrong number to
     * count anything a player OWNS against — and `PROSPECTOR.max` is a rule about
     * ownership. Without this the build sheet would offer a fourth Prospector to
     * somebody whose three were away mining, and the server would refuse it: a
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
    score: {
      wealth: player?.wealth ?? 0,
      dominion: dominion({
        taken: player?.dominionTaken ?? 0,
        lost: player?.dominionLost ?? 0,
      }),
    },
  };
}

export type PlanetView = Awaited<ReturnType<typeof planetView>>;
