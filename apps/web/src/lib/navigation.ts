import {
  HULLS,
  MOBILE_HULLS,
  TRADE,
  distance,
  exposureMinutes,
  fleetCargo,
  fleetCount,
  fleetPace,
  fleetSpeedMult,
  fleetTravelExact,
  interceptOrbit,
  missionFuel,
  transferCargoCapacity,
  travelMinutes,
  type Fleet,
  type FlightModifiers,
  type HullId,
  type MobileHullId,
  type OrbitElements,
  type ResearchProjectId,
  type SatelliteSet,
  type TechLevels,
  type Vec3,
} from '@astera/rules';

/**
 * The launch preview.
 *
 * Prediction only — the server recomputes all of it inside the transaction — but
 * it has to be exact, because it is the number the decision is made on. It uses
 * the same rule functions the server does, so "exposed for 28 minutes" means the
 * same thing on both sides of the wire.
 */
export interface Route {
  distance: number;
  oneWayMinutes: number;
  exposureMinutes: number;
  cargo: number;
  /**
   * Deuterium this launch burns, both legs, charged before it leaves. T6.
   *
   * Off `missionFuel`, the same function the server charges with — the whole point
   * of a pure rule is that the quote and the charge cannot disagree. A screen that
   * offered a launch the server then refused for fuel would be the exact failure
   * D53 forbids: predicting an outcome that is not certain.
   */
  fuel: number;
  /** Units still standing at home the moment this fleet leaves. */
  homeDefenceAfter: number;
  /**
   * WHERE THE OUTBOUND LEG ENDS, when that is not an address. D155.
   *
   * Absent for a world: a world IS its coordinates, it is drawn on the disc with a
   * label under it, and the target of the launch is the thing the player tapped.
   * A pirate is on a closed orbit, so the fleet flies to a point the pirate has
   * not reached yet — which the disc has to draw or the launch reads as a squadron
   * setting off in an unrelated direction (D124).
   */
  rendezvous?: { x: number; y: number; z: number };
}

/**
 * WHAT IS STILL STANDING AT HOME THE MOMENT THIS FLEET LEAVES.
 *
 * One definition, three readers: both route planners quote it, and the launch
 * sheet needs it even when there is no route to quote — nothing selected yet, or a
 * rendezvous the chosen wing cannot make. A second copy of this arithmetic is a
 * garrison figure that disagrees with itself on the same screen.
 *
 * Ground guns never leave, so they are added rather than subtracted from.
 */
export const homeDefenceAfter = (homeFleet: Fleet, ground: Fleet, sending: Fleet): number =>
  Math.max(0, fleetCount(homeFleet) - fleetCount(sending)) + fleetCount(ground);

/**
 * WHAT THE LAUNCH SHEET PROMISES, AND IT HAS TO BE WHAT THE SERVER WILL DO. D180.
 *
 * `mods` replaced a bare `tech`, and the reason is a bug that shipped for as long
 * as propulsion has existed. This function took the commander's ladders, handed
 * them to `fleetCargo`, and then computed the FLIGHT without them — quoting the
 * catalogue speed of a commander with no research and no Beacon. At the top of the
 * ladder that is DOUBLE the real minutes, on the one screen where a player commits
 * a fleet they cannot recall.
 *
 * ONE ARGUMENT CARRIES BOTH USES so they cannot come apart again: whatever answers
 * "how fast" also answers "how much", and a caller cannot supply one and forget
 * the other.
 */
export function planRoute(
  origin: Vec3,
  target: Vec3,
  sending: Fleet,
  homeFleet: Fleet,
  ground: Fleet,
  mods: FlightModifiers,
): Route {
  const dist = distance(origin, target);
  const oneWay = fleetPace(sending, mods) > 0 ? fleetTravelExact(dist, sending, mods) : 0;

  return {
    distance: dist,
    oneWayMinutes: oneWay,
    exposureMinutes: exposureMinutes(oneWay),
    cargo: fleetCargo(sending, mods.tech),
    fuel: missionFuel(sending, dist, 2),
    homeDefenceAfter: homeDefenceAfter(homeFleet, ground, sending),
  };
}

/**
 * One row of `/api/pirates`' per-hull rendezvous table.
 *
 * `HullId` rather than `MobileHullId` because that is what the payload is typed
 * as: the server only ever publishes hulls that can fly, but the schema parses the
 * whole catalogue and narrowing here would be this file asserting something the
 * wire does not guarantee. The lookup is by identity, so a hull that could not fly
 * simply never matches.
 */
export interface PirateReach {
  hull: HullId;
  minutes: number;
  distance: number;
  /** The meeting point itself, so the sheet can put it on the disc. D155. */
  at: { x: number; y: number; z: number };
}

/**
 * THE SAME PREVIEW, AGAINST A TARGET THAT MOVES. D150.
 *
 * A world sits still, so `planRoute` solves its own leg out of two coordinates. A
 * pirate is on a closed orbit and the outbound leg is a RENDEZVOUS — a numerical
 * solve against a moving target, and two implementations of that produce two
 * different minutes, one of which the player read and the other of which the
 * launch used. `/api/pirates` solves it once, per hull standing at the world, and
 * this reads the answer.
 *
 * A FLEET FLIES AT ITS SLOWEST SHIP, so the row that matters is the slowest hull
 * SELECTED — not the slowest at home, and not an average. A hull with no row at
 * all cannot reach this pirate, which is the same answer `launchPirateRaid` gives
 * (`CANNOT_INTERCEPT`), so an absent row is `null` here rather than a guess. That
 * is what stops the sheet quoting an ETA for a launch the server will refuse.
 *
 * AND THE TWO LEGS ARE NOT THE SAME LENGTH, which is why `exposureMinutes` — the
 * world sheet's `oneWay * 2` — may not be reused. Flying out is a chase and can
 * include waiting for the orbit to come round; flying home is a straight line back
 * from the meeting point. Doubling the chase would overstate a long one and
 * understate a short one on the last surface before a fleet stops being
 * recallable.
 *
 * BOTH LEGS ARE NOW QUOTED AT THE COMMANDER'S REAL PACE. D180. This note used to
 * say the return was "the same client-side approximation `planRoute` makes for a
 * world — catalogue speeds, no Beacon, no Propulsion", which described the bug
 * rather than a decision: `planRoute` was wrong, and consistency with it was
 * inflating the one figure this sheet exists to state honestly. The OUTBOUND
 * minute is still better than a local solve — it is the server's own answer to a
 * rendezvous with a moving target — and the way home is now solved with the same
 * modifiers the server will use.
 */
export function planPirateRoute(
  reach: readonly PirateReach[],
  sending: Fleet,
  homeFleet: Fleet,
  ground: Fleet,
  mods: FlightModifiers,
): Route | null {
  const slowest = slowestHullIn(sending);
  if (slowest === null) return null;
  const quoted = reach.find((entry) => entry.hull === slowest);
  if (quoted === undefined) return null;

  return {
    distance: quoted.distance,
    oneWayMinutes: quoted.minutes,
    exposureMinutes: quoted.minutes + fleetTravelExact(quoted.distance, sending, mods),
    cargo: fleetCargo(sending, mods.tech),
    fuel: missionFuel(sending, quoted.distance, 2),
    homeDefenceAfter: homeDefenceAfter(homeFleet, ground, sending),
    // The slowest selected ship's own meeting point — the one the wing flies to.
    rendezvous: quoted.at,
  };
}

/**
 * THE SAME PREVIEW AGAIN, AGAINST A TARGET THE CLIENT MAY SOLVE ITSELF. D156.
 *
 * A pirate's orbit is its route and stays server-private (D150), so `planPirateRoute`
 * can only READ an answer the server computed. The merchant is the opposite case by
 * owner decision: it is an announced public moment, its orbital elements are on the
 * wire, and `/api/trade` deliberately has no `GET` for a rendezvous. So this solves
 * the meeting here — with the SAME `interceptOrbit` from `@astera/rules` that
 * `launchTrade` runs, off the same elements and the same speed — which is the only
 * thing that makes the client's answer and the server's answer one answer.
 *
 * MIND THE COORDINATE SPACE. `scene.ts` divides by `VIEW.scale` on the way to the
 * disc; the rules package works in game units and so does everything here. The
 * point handed back is a GAME-unit position, which is what `GalaxyCanvas`'s `aim`
 * prop takes and converts once.
 *
 * THE SPEED IS THE SERVER'S OWN EXPRESSION — `fleetPace`, the ladder and the
 * Beacon together. This lane was the only one that got it right; the note here
 * used to add that `planRoute` "deliberately quotes catalogue speeds for a world
 * because a straight line is forgiving of a few per cent", which was a rationalised
 * bug — the error reached a DOUBLING at the top of the propulsion ladder. D180
 * fixed the world lane and every other preview to this lane's standard. A
 * rendezvous was never forgiving of it either: a different speed meets the
 * merchant at a different POINT on its circle, and the disc would draw a mark the
 * launch does not use.
 *
 * `null` means there is no meeting to be had before the window shuts, which is the
 * same refusal `launchTrade` gives (`CANNOT_INTERCEPT`) — so an absent route is a
 * refusal to state rather than a guess to print.
 */
export function planTradeRoute(
  origin: Vec3,
  merchant: { orbit: OrbitElements; expiresAtMinute: number },
  /** Minutes since season start, off `serverNow()`. Never a device clock. */
  nowMinutes: number,
  sending: Fleet,
  homeFleet: Fleet,
  ground: Fleet,
  mods: FlightModifiers,
): Route | null {
  const speed = fleetPace(sending, mods);
  if (!(speed > 0)) return null;

  const hit = interceptOrbit(
    origin,
    speed,
    merchant.orbit,
    merchant.expiresAtMinute,
    nowMinutes,
  );
  if (!hit) return null;

  const reach = distance(origin, hit.at);
  /*
    THE TWO LEGS ARE NOT THE SAME LENGTH, and there is a dock between them.

    Out is a chase and can include waiting for the orbit to come round; home is a
    straight line back from the frozen meeting point, at the same pace. `resolveTradeArrival`
    schedules the return from `dockEndsAt(arriveAt)`, so the world is uncovered for
    all three — quoting only the two flights would understate the bet on the one
    surface where it stops being recallable.
  */
  const home = fleetTravelExact(reach, sending, mods);
  return {
    distance: reach,
    oneWayMinutes: hit.flightMinutes,
    exposureMinutes: hit.flightMinutes + TRADE.dockSeconds / 60 + home,
    /**
     * A CONVOY IS MEASURED IN TRANSPORTS, NOT IN LOOT ROOM. D156 · D166.
     *
     * This read `fleetCargo`, which is a RAID's loot ceiling: it counts every hull.
     * The server sizes a trade run with `transferCargoCapacity` — dedicated
     * transports only — so the field carried a figure nothing would honour.
     *
     * THE ROSTER IS STILL THE DIFFERENCE; THE LADDER NO LONGER IS. Since D180
     * `CARGO_HOLDS` lifts both, so this passes the commander's own tech and quotes
     * the hold the server will actually check against.
     */
    cargo: transferCargoCapacity(sending, mods.tech),
    fuel: missionFuel(sending, reach, 2),
    homeDefenceAfter: homeDefenceAfter(homeFleet, ground, sending),
    rendezvous: hit.at,
  };
}

/**
 * The hull a mixed fleet flies at, by the CATALOGUE speed.
 *
 * Deliberately not the effective one: the panel knows only the catalogue, while
 * every figure on `reach` already carries this world's Beacon and the commander's
 * Propulsion. Matching an effective speed against a catalogue one by nearest
 * difference picked the wrong ship's row as soon as any Propulsion was researched —
 * and because an unreachable speed is left OUT of the table, the match slid onto a
 * FASTER hull's row. Keyed by hull there is nothing to guess.
 */
function slowestHullIn(sending: Fleet): HullId | null {
  let worst: HullId | null = null;
  for (const hull of MOBILE_HULLS) {
    if ((sending[hull] ?? 0) <= 0) continue;
    if (worst === null || HULLS[hull].speed < HULLS[worst].speed) worst = hull;
  }
  return worst;
}

/**
 * How far away a planet is *for this player right now* — at the speed of the
 * slowest ship they currently have at home. Distance in map units is not a
 * decision; "you would be gone 41 minutes" is.
 *
 * AND "RIGHT NOW" INCLUDES THEIR RESEARCH. D180 — it read the catalogue, so a
 * commander who had doubled their engines was still shown the pace they flew at on
 * day one, on the first surface that tells them whether a world is worth opening a
 * sheet for.
 */
export function reachMinutes(
  origin: Vec3,
  target: Vec3,
  homeFleet: Fleet,
  mods: FlightModifiers,
): number | null {
  const speed = fleetPace(homeFleet, mods);
  if (speed <= 0) return null;
  return travelMinutes(distance(origin, target), speed);
}

/** Reference time for a player with no ships: what a Wasp would take. */
export const waspMinutes = (origin: Vec3, target: Vec3): number =>
  travelMinutes(distance(origin, target), HULLS.DART.speed);

/**
 * What the launch sheet offers.
 *
 * Re-exported from the rules package rather than written out again: a second copy
 * of this list is a hull that gets added to the game and silently never appears in
 * the sheet. D27 added one ground hull and proved how easy that is to miss.
 */
export const MOBILE: readonly MobileHullId[] = MOBILE_HULLS;

/**
 * WHAT A WORLD LENDS EVERY FLEET THAT LEAVES IT — in one place. D180.
 *
 * A wing's real pace is its slowest hull times the commander's `SHIP_PROPULSION`
 * ladder times the BEACON standing over the origin world. The client had both
 * facts in the planet payload all along — `research` and `orbit` — and passed
 * neither, because `fleetTravelExact` let it. Every preview quoted a commander who
 * had bought nothing.
 *
 * THIS IS THE ONLY PLACE THE CLIENT ANSWERS THAT QUESTION. A screen that needs a
 * flight time reads it here rather than composing `techOf` and `fleetSpeedMult`
 * itself, so a surface added next year cannot get half of it — which is precisely
 * how four surfaces got none of it.
 */
export function flightModifiers(
  view: {
    research: readonly { id: ResearchProjectId; level?: number; completed?: boolean }[];
    orbit: SatelliteSet;
    /**
     * What is actually up there right now, when the payload distinguishes it from
     * what the world owns. `?? orbit` is the shape the two call sites that already
     * got this right were using, kept here so it is stated once.
     */
    effectiveOrbit?: SatelliteSet;
  },
): FlightModifiers {
  return {
    boost: fleetSpeedMult(view.effectiveOrbit ?? view.orbit),
    tech: techOf(view),
  };
}

/**
 * The commander's research levels, read off a planet payload. T8.
 *
 * `PlanetView.research` is the one place the client learns them, and every effect
 * function takes this shape — so a screen that wants to quote a rule reads it here
 * rather than reaching into the array itself and getting the question subtly wrong.
 */
export function techOf(
  view: {
    research: readonly { id: ResearchProjectId; level?: number; completed?: boolean }[];
  },
): TechLevels {
  const tech: TechLevels = {};
  for (const project of view.research) {
    /*
      A MISSING `level` MEANS "HELD" WHEN THE PROJECT IS COMPLETE, not "zero".

      The field is optional for a rolling deploy against a server that predates
      levelled research (T7), and `predict.ts` already reads a missing one that way.
      Read as zero here, the launch preview quoted a cargo figure with no Cargo
      Holds in it for the length of the deploy — the two readers of one optional
      field disagreeing about what its absence means.
    */
    const level = project.level ?? (project.completed ? 1 : 0);
    if (level > 0) tech[project.id] = level;
  }
  return tech;
}
