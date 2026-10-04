import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import {
  CLAN_SUPPORT,
  HULLS,
  NON_COMBATANT_HULLS,
  UNAIDED,
  clanDefenseApplies,
  coreTier,
  distance,
  fleetCount,
  fleetSpeed,
  fleetSpeedMult,
  fleetTravelExact,
  hangarCapacity,
  hangarLoad,
  hpRadiationApplies,
  postureFromToggles,
  supportFuel,
  supportTravelMinutes,
  withinTierBand,
  type Fleet,
  type HullId,
  type PostureToggles,
  type TechLevels,
} from '@astera/rules';
import { addMinutes, type Clock } from '../clock.js';
import type { Db, Queryable, Tx } from '../db/client.js';
import {
  accounts,
  clanMemberships,
  clanSupportWaves,
  missions,
  planets,
  players,
  seasons,
  units,
  type ClanSupportReturnReason,
} from '../db/schema.js';
import {
  ROOM_HOLDING,
  supportRoomOf,
  viewWaves,
  type ClanSupportWaveView,
  type SupportRoom,
  type WaveRow,
} from './clanSupportView.js';
import { turnMissionHome } from './movement.js';
import { missionPath, radiationChanged, settleFlightRadiation, tellRadiationLoss } from './radiation.js';
import { dockNotice, landShips, type DockReport } from './shipDamage.js';
import { publishPrivate, publishShard } from '../stream/bus.js';
import { schedule } from '../worker/queue.js';
import { senderShieldUntil } from './clanAid.js';
import { activeClanMembership } from './clanCombat.js';
import { assertDeparturesAllowed, baysOf } from './flight.js';
import { fuelAvailable } from './fuel.js';
import { notify } from './notifications.js';
import { capitalPlanet, lockWorlds, safeHomePlanet } from './ownership.js';
import {
  GameError,
  assertWorldOperational,
  loadLocked,
  orbitOf,
  recomputePlayerWealth,
  saveResources,
  setUnits,
  totalUnitsOf,
  type LockedPlanet,
} from './planet.js';
import { planetView, type PlanetView } from './planetView.js';
import { peakCoreLevels } from './player.js';
import { techOf } from './researchState.js';
import { fleetChangesWatch, publishWatchChanges } from './watchEvents.js';

/**
 * KLAN SAVUNMA DESTEĞİ — the server half. Owner decisions, 2026-10-01
 * (`docs/clan-defense-support-plan.md`).
 *
 * LOCK ORDER, everywhere this feature takes more than one lock:
 *
 *   season → planets (by id) → clan_support_waves (by id) → clans → players (by id)
 *
 * Waves sit between planets and clans so a membership change — which must take the
 * clan and its players — can settle its support BEFORE it touches either, and a battle
 * can lock the host world, then the waves standing in its line, then the ledgers.
 */

/**
 * SAVE ONE WORLD'S TWO TOGGLES. Owner K4.
 *
 * The retreat and clan support are exclusive; "both on" is refused rather than
 * resolved, because the client never sends it and a server that guessed which one
 * was meant would decide a fight for the player. Support needs a clan (any member —
 * an adapting newcomer is exactly who needs help). Leaving SUPPORT sends every wave
 * at, or flying to, this world home: the commander chose the retreat over their
 * guests, and a line cannot both lift and hold clanmates.
 */
export async function setDefencePosture(
  tx: Tx,
  input: { planetId: string; playerId: string; toggles: PostureToggles; clock: Clock },
): Promise<{ planet: Awaited<ReturnType<typeof planetView>>; returnedWaves: number }> {
  const planet = await loadLocked(tx, input.planetId, input.clock, { expectedPlayerId: input.playerId });
  if (!clanDefenseApplies(planet.rulesetVersion)) {
    throw new GameError('CLAN_SUPPORT_UNAVAILABLE', 'Clan defence arrives with a new season', 404);
  }
  if (input.toggles.escape && input.toggles.support) {
    throw new GameError('POSTURE_CONFLICT', 'The retreat and clan support cannot both be on', 400);
  }
  const posture = postureFromToggles(input.toggles);
  if (posture === 'SUPPORT' && await activeClanMembership(tx, input.playerId) === null) {
    throw new GameError('NOT_IN_CLAN', 'Clan support needs a clan', 403);
  }
  let returnedWaves = 0;
  if (posture !== planet.defencePosture) {
    await tx.update(planets).set({ defencePosture: posture }).where(eq(planets.id, input.planetId));
    if (planet.defencePosture === 'SUPPORT') {
      returnedWaves = await returnSupportAtWorld(tx, {
        planetIds: [input.planetId],
        reason: 'HOST_CLOSED',
        now: planet.now,
      });
    }
    // The door opened or closed: every clanmate's Focus rail reads it (`clanPresence.supportOpen`).
    if (posture === 'SUPPORT' || planet.defencePosture === 'SUPPORT') {
      await tellClanOfDoor(tx, input.playerId);
    }
  }
  return { planet: await planetView(tx, input.planetId, input.clock), returnedWaves };
}

/** Every other current member of this commander's clan refetches the galaxy's clan presence. */
async function tellClanOfDoor(tx: Tx, playerId: string): Promise<void> {
  const membership = await activeClanMembership(tx, playerId);
  if (membership === null) return;
  const mates = await tx.select({ playerId: clanMemberships.playerId }).from(clanMemberships)
    .where(and(eq(clanMemberships.clanId, membership.clanId), isNull(clanMemberships.leftAt)));
  for (const mate of mates) {
    if (mate.playerId !== playerId) await publishPrivate(tx, mate.playerId, 'posture');
  }
}

/* ── sending a wave ─────────────────────────────────────────────── */

export interface SupportRefusal {
  code: string;
  message: string;
  params?: Record<string, string | number>;
}

export interface SupportInput {
  senderPlayerId: string;
  originPlanetId: string;
  hostPlanetId: string;
  fleet: Fleet;
  clock: Clock;
}

interface SupportContext {
  origin: LockedPlanet;
  hostPlayerId: string;
  clanId: string;
  tech: Awaited<ReturnType<typeof techOf>>;
  distance: number;
  fuel: number;
  bulk: number;
  travelMinutes: number;
  returnMinutes: number;
  arriveAt: Date;
  stationUntil: Date;
  seasonClipped: boolean;
  room: SupportRoom;
  band: { ok: boolean; mine: number; theirs: number };
  bays: { used: number; total: number };
  personalHangar: { used: number; total: number };
  senderShieldUntil: Date | null;
  refusals: SupportRefusal[];
}

/** Structural checks that no amount of waiting fixes; thrown, never listed. */
function assertSupportFleet(fleet: Fleet): void {
  for (const [hull, n] of Object.entries(fleet) as [HullId, number][]) {
    if (!Number.isInteger(n) || n < 0) {
      throw new GameError('BAD_FLEET', `Bad ship count for ${hull}`, 400, { hull });
    }
    if (n === 0) continue;
    if (HULLS[hull].ground) {
      throw new GameError('GROUND_UNIT', `${HULLS[hull].name}s cannot travel`, 400, { hull });
    }
    if (NON_COMBATANT_HULLS.includes(hull)) {
      throw new GameError('CLAN_SUPPORT_NONCOMBATANT', 'A support wave is a fighting line', 400, { hull });
    }
  }
  if (fleetCount(fleet) === 0) throw new GameError('EMPTY_FLEET', 'Send at least one ship', 400);
  if (fleetSpeed(fleet, UNAIDED.tech) <= 0) {
    throw new GameError('IMMOBILE_FLEET', 'That fleet cannot travel', 400);
  }
}

/**
 * EVERYTHING THE QUOTE AND THE DISPATCH BOTH HAVE TO KNOW, computed once, under the
 * locks of both worlds and the sender's capital — the same gatherer for both, so the
 * screen can never offer a wave the server then refuses.
 */
async function gatherSupport(tx: Tx, input: SupportInput): Promise<SupportContext> {
  const refusals: SupportRefusal[] = [];
  const refuse = (code: string, message: string, params?: Record<string, string | number>): void => {
    refusals.push({ code, message, ...(params ? { params } : {}) });
  };
  if (input.originPlanetId === input.hostPlanetId) {
    throw new GameError('CLAN_SUPPORT_SELF', 'Support goes to a clanmate, not to your own worlds', 400);
  }
  assertSupportFleet(input.fleet);

  const capital = await capitalPlanet(tx, input.senderPlayerId);
  const worlds = await lockWorlds(tx, [capital.id, input.originPlanetId, input.hostPlanetId]);
  const origin = await loadLocked(tx, input.originPlanetId, input.clock, {
    expectedPlayerId: input.senderPlayerId,
  });
  if (!clanDefenseApplies(origin.rulesetVersion)) {
    throw new GameError('CLAN_SUPPORT_UNAVAILABLE', 'Clan defence arrives with a new season', 404);
  }
  assertWorldOperational(origin);
  const host = worlds.get(input.hostPlanetId);
  if (!host || host.kind === 'NEUTRAL' || host.controllerPlayerId === null) {
    throw new GameError('CLAN_SUPPORT_TARGET', 'Choose a world a clanmate holds', 404);
  }
  if (host.controllerPlayerId === input.senderPlayerId) {
    throw new GameError('CLAN_SUPPORT_SELF', 'Support goes to a clanmate, not to your own worlds', 400);
  }
  for (const [hull, n] of Object.entries(input.fleet) as [HullId, number][]) {
    if ((origin.homeFleet[hull] ?? 0) < n) {
      throw new GameError('NOT_ENOUGH_SHIPS', `Not enough ${hull} at home`, 400, { hull });
    }
  }

  const now = origin.now;
  const [sender, recipient] = await Promise.all([
    activeClanMembership(tx, input.senderPlayerId),
    activeClanMembership(tx, host.controllerPlayerId),
  ]);
  if (sender === null) throw new GameError('NOT_IN_CLAN', 'Clan support needs a clan', 403);
  if (recipient?.clanId !== sender.clanId) {
    refuse('CLAN_SUPPORT_MEMBERSHIP', 'Support is only for current clanmates');
  } else if (sender.matureAt > now) {
    refuse('CLAN_SUPPORT_MEMBER_IMMATURE', 'Your membership is still settling in', {
      until: sender.matureAt.toISOString(),
    });
  }
  const shieldUntil = await senderShieldUntil(tx, input.senderPlayerId, now);
  if (shieldUntil !== null) {
    refuse('SHIELDED_SENDER', 'Ships cannot leave a commander still under the newcomer shield', {
      until: shieldUntil.toISOString(),
      context: 'ships',
    });
  }
  if (host.defencePosture !== 'SUPPORT') {
    refuse('CLAN_SUPPORT_CLOSED', 'That world is not taking clan support');
  }

  const peaks = await peakCoreLevels(tx, [input.senderPlayerId, host.controllerPlayerId]);
  const mine = peaks.get(input.senderPlayerId) ?? 1;
  const theirs = peaks.get(host.controllerPlayerId) ?? 1;
  const band = { ok: withinTierBand(mine, theirs), mine: coreTier(mine), theirs: coreTier(theirs) };
  if (!band.ok) {
    refuse('CLAN_SUPPORT_TIER_BAND', 'Support stays inside the host’s tier band', {
      mine: band.mine,
      theirs: band.theirs,
    });
  }

  const bulk = hangarLoad(input.fleet);
  const room = await supportRoomOf(tx, host.id);
  if (room.used + room.reserved + bulk > room.total) {
    refuse('CLAN_SUPPORT_ROOM_FULL', 'That world’s support bay has no room for this wave', {
      used: room.used + room.reserved,
      total: room.total,
    });
  }

  const bays = await baysOf(tx, origin.planetId, origin.buildings.CORE);
  try {
    assertDeparturesAllowed(origin.planetId, origin.faults);
  } catch (error) {
    if (!(error instanceof GameError)) throw error;
    refuse(error.code, error.message);
  }
  if (bays.used >= bays.total) {
    refuse('NO_FREE_BAY', `All ${String(bays.total)} flight bays are in use`, { used: bays.used, total: bays.total });
  }

  const tech = await techOf(tx, input.senderPlayerId);
  const dist = distance(origin, host);
  const fuel = supportFuel(input.fleet, dist);
  if (fuelAvailable(origin.deuterium) < fuel) {
    refuse('INSUFFICIENT_FUEL', 'Not enough deuterium to fly there and back', {
      needed: fuel,
      have: Math.floor(fuelAvailable(origin.deuterium)),
    });
  }
  const pace = { boost: fleetSpeedMult(origin.orbit), tech };
  const travelMinutes = supportTravelMinutes(fleetTravelExact(dist, input.fleet, pace));
  const returnMinutes = supportTravelMinutes(fleetTravelExact(dist, input.fleet, pace));
  if (!Number.isFinite(travelMinutes)) throw new GameError('IMMOBILE_FLEET', 'That fleet cannot travel', 400);
  const arriveAt = addMinutes(now, travelMinutes);

  const [season] = await tx.select({ endsAt: seasons.endsAt }).from(seasons)
    .where(eq(seasons.id, origin.seasonId));
  if (!season) throw new GameError('SEASON_NOT_FOUND', 'No such season', 404);
  const fullStay = addMinutes(arriveAt, CLAN_SUPPORT.stationHours * 60);
  const lastLeave = addMinutes(season.endsAt, -returnMinutes);
  if (lastLeave < arriveAt) {
    refuse('CLAN_SUPPORT_SEASON_TOO_SHORT', 'This galaxy ends before that wave could get home');
  }
  const stationUntil = fullStay <= lastLeave ? fullStay : (lastLeave > arriveAt ? lastLeave : arriveAt);

  const owned = await totalUnitsOf(tx, origin.planetId);
  return {
    origin,
    hostPlayerId: host.controllerPlayerId,
    clanId: sender.clanId,
    tech,
    distance: dist,
    fuel,
    bulk,
    travelMinutes,
    returnMinutes,
    arriveAt,
    stationUntil,
    seasonClipped: stationUntil < fullStay,
    room,
    band,
    bays,
    personalHangar: { used: hangarLoad(owned), total: hangarCapacity(origin.buildings.HANGAR) },
    senderShieldUntil: shieldUntil,
    refusals,
  };
}

export interface ClanSupportQuote {
  refusals: SupportRefusal[];
  arriveAt: string;
  travelMinutes: number;
  returnMinutes: number;
  fuel: number;
  bays: { used: number; total: number };
  hostRoom: SupportRoom & { after: number };
  band: { ok: boolean; mine: number; theirs: number };
  stationUntil: string;
  seasonClipped: boolean;
  /** Unchanged by the send: the ships keep their place in the sender's own Hangar (K2). */
  personalHangar: { used: number; total: number };
  senderShieldUntil: string | null;
}

/**
 * WHAT THIS WAVE WOULD COST AND WHETHER IT MAY GO, deciding nothing. The dispatch
 * recomputes every figure under its own locks.
 */
export async function quoteClanSupport(db: Db, input: SupportInput): Promise<ClanSupportQuote> {
  return db.transaction(async (tx) => {
    const context = await gatherSupport(tx, input);
    return {
      refusals: context.refusals,
      arriveAt: context.arriveAt.toISOString(),
      travelMinutes: context.travelMinutes,
      returnMinutes: context.returnMinutes,
      fuel: context.fuel,
      bays: context.bays,
      hostRoom: {
        ...context.room,
        after: context.room.used + context.room.reserved + context.bulk,
      },
      band: context.band,
      stationUntil: context.stationUntil.toISOString(),
      seasonClipped: context.seasonClipped,
      personalHangar: context.personalHangar,
      senderShieldUntil: context.senderShieldUntil?.toISOString() ?? null,
    };
  });
}

/**
 * SEND ONE WAVE. Owner decisions K1–K8.
 *
 * The ships leave `home` for a location of the wave's own on the ORIGIN world — so
 * they keep counting in the sender's Hangar and never in the host's — and the round
 * trip's fuel is paid now, once. The host hears that help is coming.
 */
export async function sendClanSupport(
  tx: Tx,
  input: SupportInput,
): Promise<{ wave: ClanSupportWaveView; planet: PlanetView }> {
  const context = await gatherSupport(tx, input);
  const first = context.refusals[0];
  if (first) throw new GameError(first.code, first.message, 409, first.params);

  const { origin } = context;
  const [mission] = await tx.insert(missions).values({
    seasonId: origin.seasonId,
    kind: 'clan_support',
    ownerPlayerId: input.senderPlayerId,
    originPlanetId: origin.planetId,
    targetPlanetId: input.hostPlanetId,
    fleet: input.fleet,
    tech: context.tech,
    distance: context.distance,
    fuelPaid: context.fuel,
    departAt: origin.now,
    arriveAt: context.arriveAt,
  }).returning();
  if (!mission) throw new Error('clan support mission insert returned no row');

  const unitLocation = `support:${randomUUID()}`;
  const remaining: Fleet = { ...origin.homeFleet };
  for (const [hull, n] of Object.entries(input.fleet) as [HullId, number][]) {
    remaining[hull] = (remaining[hull] ?? 0) - n;
  }
  await setUnits(tx, origin.planetId, remaining, 'home', input.senderPlayerId);
  await setUnits(tx, origin.planetId, input.fleet, unitLocation, input.senderPlayerId);
  await saveResources(tx, origin.planetId, {
    alloy: origin.alloy,
    crystal: origin.crystal,
    deuterium: origin.deuterium - context.fuel,
  });

  const [wave] = await tx.insert(clanSupportWaves).values({
    seasonId: origin.seasonId,
    clanId: context.clanId,
    senderPlayerId: input.senderPlayerId,
    hostPlayerId: context.hostPlayerId,
    originPlanetId: origin.planetId,
    hostPlanetId: input.hostPlanetId,
    unitLocation,
    fleet: input.fleet,
    reservedBulk: context.bulk,
    fuelPaid: context.fuel,
    outboundMissionId: mission.id,
    sentAt: origin.now,
    arriveAt: context.arriveAt,
  }).returning();
  if (!wave) throw new Error('clan support wave insert returned no row');

  await schedule(tx, {
    seasonId: origin.seasonId,
    kind: 'mission_arrival',
    refId: mission.id,
    resolveAt: context.arriveAt,
  });
  const names = await noticeNames(tx, wave);
  await notify(tx, {
    playerId: context.hostPlayerId,
    kind: 'clan_support_inbound',
    payload: {
      waveId: wave.id,
      senderPlayerId: input.senderPlayerId,
      senderName: names.sender,
      hostPlanetId: input.hostPlanetId,
      hostPlanetName: names.world,
      fleet: input.fleet,
      arriveAt: context.arriveAt.toISOString(),
    },
    at: origin.now,
    refId: wave.id,
  });
  await recomputePlayerWealth(tx, input.senderPlayerId);
  await publishPrivate(tx, input.senderPlayerId, 'support');
  await publishPrivate(tx, context.hostPlayerId, 'support');
  await publishShard(tx, origin.seasonId, 'launch');
  if (fleetChangesWatch(input.fleet)) await publishWatchChanges(tx, [origin.planetId]);

  const [view] = await viewWaves(tx, [wave]);
  if (!view) throw new Error('clan support wave view vanished');
  return { wave: view, planet: await planetView(tx, origin.planetId, input.clock) };
}

/* ── turning a wave for home ────────────────────────────────────── */

type ReturnReason = ClanSupportReturnReason;

/**
 * THE NAMES A NOTICE IS WRITTEN IN, frozen at the moment like every other notice's:
 * a commander who renames later does not rewrite what their clanmate was told.
 */
async function noticeNames(
  tx: Tx,
  wave: Pick<WaveRow, 'senderPlayerId' | 'hostPlayerId' | 'hostPlanetId'>,
): Promise<{ sender: string; host: string; world: string }> {
  const [commanders, [world]] = await Promise.all([
    tx.select({ id: players.id, name: accounts.displayName }).from(players)
      .innerJoin(accounts, eq(accounts.id, players.accountId))
      .where(inArray(players.id, [wave.senderPlayerId, wave.hostPlayerId])),
    tx.select({ name: planets.name }).from(planets).where(eq(planets.id, wave.hostPlanetId)),
  ]);
  const nameOf = (id: string) => commanders.find((row) => row.id === id)?.name ?? '';
  return { sender: nameOf(wave.senderPlayerId), host: nameOf(wave.hostPlayerId), world: world?.name ?? '' };
}

/** Who is told a wave left: everyone it concerns except whoever decided it. */
async function tellDeparture(tx: Tx, wave: WaveRow, reason: ReturnReason, returnAt: Date, now: Date): Promise<void> {
  const names = await noticeNames(tx, wave);
  const payload = {
    waveId: wave.id,
    reason,
    senderPlayerId: wave.senderPlayerId,
    senderName: names.sender,
    hostPlayerId: wave.hostPlayerId,
    hostName: names.host,
    hostPlanetId: wave.hostPlanetId,
    hostPlanetName: names.world,
    returnAt: returnAt.toISOString(),
  };
  if (reason !== 'RECALLED') {
    await notify(tx, { playerId: wave.senderPlayerId, kind: 'clan_support_departed',
      payload: { ...payload, role: 'SENDER' }, at: now, refId: wave.id });
  }
  if (reason !== 'SENT_BACK' && reason !== 'HOST_CLOSED') {
    await notify(tx, { playerId: wave.hostPlayerId, kind: 'clan_support_departed',
      payload: { ...payload, role: 'HOST' }, at: now, refId: wave.id });
  }
}

/** The ships of a wave as they stand now — the battle's survivors once it has fought. */
export async function shipsOf(db: Queryable, wave: WaveRow): Promise<Fleet> {
  const rows = await db.select({ hull: units.hull, count: units.count }).from(units)
    .where(and(eq(units.planetId, wave.originPlanetId), eq(units.location, wave.unitLocation)));
  const fleet: Fleet = {};
  for (const row of rows) if (row.count > 0) fleet[row.hull] = row.count;
  return fleet;
}

/** How long the flight home from the host takes, at the sender's research. */
/** New HP cohorts keep the research with which their carried wounds were earned. */
export async function supportFlightTech(db: Queryable, wave: WaveRow): Promise<TechLevels> {
  const [outbound] = await db.select({ tech: missions.tech, version: seasons.rulesetVersion }).from(missions)
    .innerJoin(seasons, eq(seasons.id, missions.seasonId)).where(eq(missions.id, wave.outboundMissionId));
  if (!outbound) throw new Error(`support ${wave.id} lost its committed mission`);
  return hpRadiationApplies(outbound.version) ? outbound.tech ?? {} : techOf(db, wave.senderPlayerId);
}

async function homewardMinutes(db: Queryable, wave: WaveRow, destinationPlanetId: string, fleet: Fleet): Promise<{
  minutes: number; distance: number; tech: TechLevels;
}> {
  const [from] = await db.select().from(planets).where(eq(planets.id, wave.hostPlanetId));
  const [to] = await db.select().from(planets).where(eq(planets.id, destinationPlanetId));
  if (!from || !to) throw new GameError('PLANET_NOT_FOUND', 'No such planet', 404);
  const span = distance(from, to);
  const tech = await supportFlightTech(db, wave);
  const minutes = supportTravelMinutes(fleetTravelExact(span, fleet, {
    boost: fleetSpeedMult(await orbitOf(db, destinationPlanetId)),
    tech,
  }));
  return { minutes, distance: span, tech };
}

/**
 * THE ONE PLACE A WAVE IS SENT HOME. Recall, send-back, the host closing support,
 * twelve hours up, a tier band left behind, a broken clan and a world changing hands
 * all come through here; what varies is only where the wave is when it is told.
 *
 *   · FLYING OUT — it turns in space, the ordinary recall rule (K7): home in the time
 *     it has flown. A wave already over the host (arrival not yet processed) is left
 *     to its arrival, which re-checks every condition and sends it home from there.
 *   · STANDING AT THE HOST — a return leg from the host, already paid for.
 *   · Already going home, home or lost — nothing; a second call is not an error.
 *
 * The caller holds the host world's lock and the wave row's. Returns the wave as it
 * now stands, or null when nothing changed.
 */
export async function returnWave(tx: Tx, wave: WaveRow, reason: ReturnReason, now: Date): Promise<WaveRow | null> {
  if (wave.status === 'OUTBOUND') {
    if (now.getTime() >= wave.arriveAt.getTime()) return null;
    const [mission] = await tx.select().from(missions)
      .where(eq(missions.id, wave.outboundMissionId)).for('update');
    if (mission?.status !== 'in_flight' || mission.recalledAt !== null) return null;
    const returnAt = await turnMissionHome(tx, mission, now);
    const [turned] = await tx.update(clanSupportWaves)
      .set({ status: 'RETURNING', returnReason: reason, returnAt })
      .where(eq(clanSupportWaves.id, wave.id))
      .returning();
    await tellDeparture(tx, wave, reason, returnAt, now);
    await publishSupport(tx, wave);
    return turned ?? null;
  }
  if (wave.status !== 'STATIONED') return null;

  const fleet = await shipsOf(tx, wave);
  if (fleetCount(fleet) === 0) {
    await loseWave(tx, wave, now);
    return null;
  }
  const destinationPlanetId = await safeHomePlanet(tx, wave.senderPlayerId, wave.originPlanetId);
  const leg = await homewardMinutes(tx, wave, destinationPlanetId, fleet);
  const returnAt = addMinutes(now, leg.minutes);
  const [mission] = await tx.insert(missions).values({
    // A return leg is already paid for: the round trip was charged at dispatch.
    fuelPaid: 0,
    seasonId: wave.seasonId,
    kind: 'clan_support',
    ownerPlayerId: wave.senderPlayerId,
    originPlanetId: wave.hostPlanetId,
    targetPlanetId: destinationPlanetId,
    fleet,
    damage: wave.damage,
    tech: leg.tech,
    distance: leg.distance,
    departAt: now,
    arriveAt: returnAt,
    parentMissionId: wave.outboundMissionId,
  }).returning();
  if (!mission) throw new Error('clan support return insert returned no row');
  await schedule(tx, {
    seasonId: wave.seasonId,
    kind: 'mission_arrival',
    refId: mission.id,
    resolveAt: returnAt,
  });
  const [turned] = await tx.update(clanSupportWaves)
    .set({ status: 'RETURNING', returnReason: reason, returnAt, returnMissionId: mission.id })
    .where(eq(clanSupportWaves.id, wave.id))
    .returning();
  await tellDeparture(tx, wave, reason, returnAt, now);
  await publishSupport(tx, wave);
  await publishShard(tx, wave.seasonId, 'launch');
  return turned ?? null;
}

/** Both people a wave concerns refetch; nothing private rides the stream. */
export async function publishSupport(tx: Tx, wave: Pick<WaveRow, 'senderPlayerId' | 'hostPlayerId'>): Promise<void> {
  await publishPrivate(tx, wave.senderPlayerId, 'support');
  await publishPrivate(tx, wave.hostPlayerId, 'support');
}

/** A wave with no ship left — a cloud or a battle finished it. */
export async function loseWave(tx: Tx, wave: WaveRow, now: Date): Promise<void> {
  await tx.delete(units).where(and(eq(units.planetId, wave.originPlanetId), eq(units.location, wave.unitLocation)));
  await tx.update(clanSupportWaves).set({ status: 'LOST', resolvedAt: now }).where(eq(clanSupportWaves.id, wave.id));
  await recomputePlayerWealth(tx, wave.senderPlayerId);
  await publishSupport(tx, wave);
}

/** Put a wave's ships back on the world they land at, through the Repair Station's eyes. */
async function landSupport(
  tx: Tx,
  wave: WaveRow,
  fleet: Fleet,
  destinationPlanetId: string,
  now: Date,
): Promise<DockReport> {
  await tx.delete(units).where(and(eq(units.planetId, wave.originPlanetId), eq(units.location, wave.unitLocation)));
  const report = await landShips(tx, {
    planetId: destinationPlanetId,
    ownerPlayerId: wave.senderPlayerId,
    fleet,
    damage: wave.damage,
    at: now,
  });
  await tx.update(clanSupportWaves).set({ status: 'HOME', resolvedAt: now }).where(eq(clanSupportWaves.id, wave.id));
  await recomputePlayerWealth(tx, wave.senderPlayerId);
  if (fleetChangesWatch(fleet)) await publishWatchChanges(tx, [destinationPlanetId]);
  await publishSupport(tx, wave);
  return report;
}

/** Lock worlds then waves, in the one order, and re-read the waves under their locks. */
export async function lockWaves(tx: Tx, waveIds: readonly string[]): Promise<WaveRow[]> {
  const out: WaveRow[] = [];
  for (const id of [...new Set(waveIds)].sort()) {
    const [row] = await tx.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, id)).for('update');
    if (row) out.push(row);
  }
  return out;
}

async function lockPlanetIds(tx: Tx, planetIds: readonly string[]): Promise<void> {
  for (const id of [...new Set(planetIds)].sort()) {
    await tx.select({ id: planets.id }).from(planets).where(eq(planets.id, id)).for('update');
  }
}

/** One wave by id, for its sender or its host, with the host world and the wave locked. */
async function lockOneWave(tx: Tx, waveId: string): Promise<WaveRow> {
  const [peek] = await tx.select({ hostPlanetId: clanSupportWaves.hostPlanetId })
    .from(clanSupportWaves).where(eq(clanSupportWaves.id, waveId));
  if (!peek) throw new GameError('CLAN_SUPPORT_NOT_FOUND', 'No such wave', 404);
  await lockPlanetIds(tx, [peek.hostPlanetId]);
  const [wave] = await lockWaves(tx, [waveId]);
  if (!wave) throw new GameError('CLAN_SUPPORT_NOT_FOUND', 'No such wave', 404);
  return wave;
}

async function answer(tx: Tx, waveId: string): Promise<{ wave: ClanSupportWaveView }> {
  const [row] = await tx.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, waveId));
  if (!row) throw new GameError('CLAN_SUPPORT_NOT_FOUND', 'No such wave', 404);
  const [view] = await viewWaves(tx, [row]);
  if (!view) throw new Error('clan support wave view vanished');
  return { wave: view };
}

/**
 * THE SENDER TAKES THEIR WAVE BACK — in flight (once, the ordinary recall) or any time
 * after it stands at the host. A wave in the instant of landing is refused for that
 * instant (`CLAN_SUPPORT_LANDING`): the decision window closed when the ships reached
 * the world, and a second later it is standing and may go. Asking twice is not an error.
 */
export async function recallClanSupport(
  tx: Tx,
  input: { playerId: string; waveId: string; clock: Clock },
): Promise<{ wave: ClanSupportWaveView }> {
  const now = input.clock.now();
  const wave = await lockOneWave(tx, input.waveId);
  if (wave.senderPlayerId !== input.playerId) {
    throw new GameError('CLAN_SUPPORT_NOT_OWNED', 'That wave is not yours', 403);
  }
  if (wave.status === 'OUTBOUND' && now.getTime() >= wave.arriveAt.getTime()) {
    throw new GameError('CLAN_SUPPORT_LANDING', 'That wave is landing; recall it once it stands', 409);
  }
  await returnWave(tx, wave, 'RECALLED', now);
  return answer(tx, wave.id);
}

/** THE HOST SENDS A WAVE BACK — "Geri gönder". The sender is told why. */
export async function sendBackClanSupport(
  tx: Tx,
  input: { playerId: string; waveId: string; clock: Clock },
): Promise<{ wave: ClanSupportWaveView }> {
  const now = input.clock.now();
  const wave = await lockOneWave(tx, input.waveId);
  if (wave.hostPlayerId !== input.playerId) {
    throw new GameError('CLAN_SUPPORT_NOT_HOST', 'Only the world’s commander can send a wave back', 403);
  }
  if (wave.status === 'OUTBOUND' && now.getTime() >= wave.arriveAt.getTime()) {
    throw new GameError('CLAN_SUPPORT_LANDING', 'That wave is landing; send it back once it stands', 409);
  }
  await returnWave(tx, wave, 'SENT_BACK', now);
  return answer(tx, wave.id);
}

/**
 * EVERY WAVE AT, OR FLYING TO, THESE WORLDS GOES HOME. The caller holds the worlds'
 * locks. Returns how many waves were turned.
 */
export async function returnSupportAtWorld(
  tx: Tx,
  input: { planetIds: readonly string[]; reason: ReturnReason; now: Date },
): Promise<number> {
  if (input.planetIds.length === 0) return 0;
  const candidates = await tx.select({ id: clanSupportWaves.id }).from(clanSupportWaves)
    .where(and(
      inArray(clanSupportWaves.hostPlanetId, [...input.planetIds]),
      inArray(clanSupportWaves.status, [...ROOM_HOLDING]),
    ));
  let turned = 0;
  for (const wave of await lockWaves(tx, candidates.map((row) => row.id))) {
    if (await returnWave(tx, wave, input.reason, input.now)) turned++;
  }
  return turned;
}

/**
 * A COMMANDER LEFT THEIR CLAN — by leaving, being kicked or the clan dissolving.
 *
 * Called BEFORE the membership path takes its clan and player locks (see the lock order
 * above). Every wave they sent and every wave standing at one of their worlds goes home,
 * and every world of theirs standing at SUPPORT drops back to ESCAPE — the posture a
 * commander who never touched the toggles has — and they are told once.
 */
export async function releaseClanSupport(
  tx: Tx,
  input: { playerIds: readonly string[]; now: Date },
): Promise<void> {
  const playerIds = [...new Set(input.playerIds)].sort();
  if (playerIds.length === 0) return;
  const [worlds, waves] = await Promise.all([
    tx.select({ id: planets.id, name: planets.name, playerId: planets.controllerPlayerId }).from(planets)
      .where(and(inArray(planets.controllerPlayerId, playerIds), eq(planets.defencePosture, 'SUPPORT')))
      .orderBy(planets.id),
    tx.select({ id: clanSupportWaves.id, hostPlanetId: clanSupportWaves.hostPlanetId })
      .from(clanSupportWaves)
      .where(and(
        inArray(clanSupportWaves.status, [...ROOM_HOLDING]),
        or(
          inArray(clanSupportWaves.senderPlayerId, playerIds),
          inArray(clanSupportWaves.hostPlayerId, playerIds),
        ),
      )),
  ]);
  if (worlds.length === 0 && waves.length === 0) return;
  await lockPlanetIds(tx, [...worlds.map((world) => world.id), ...waves.map((wave) => wave.hostPlanetId)]);
  for (const wave of await lockWaves(tx, waves.map((row) => row.id))) {
    await returnWave(tx, wave, 'MEMBERSHIP', input.now);
  }
  if (worlds.length === 0) return;
  const ids = worlds.map((world) => world.id);
  await tx.update(planets).set({ defencePosture: 'ESCAPE' })
    .where(and(inArray(planets.id, ids), eq(planets.defencePosture, 'SUPPORT')));

  const byPlayer = new Map<string, (typeof worlds)[number][]>();
  for (const world of worlds) {
    if (world.playerId === null) continue;
    byPlayer.set(world.playerId, [...(byPlayer.get(world.playerId) ?? []), world]);
  }
  for (const [playerId, reset] of byPlayer) {
    await notify(tx, {
      playerId,
      kind: 'defence_posture_reset',
      payload: { planetIds: reset.map((world) => world.id), planetNames: reset.map((world) => world.name) },
      at: input.now,
      refId: randomUUID(),
    });
  }
}

/* ── the worker's half ─────────────────────────────────────────── */

/** Why a wave over the host may not stand there, or null when it may. */
async function standingRefusal(tx: Tx, wave: WaveRow): Promise<ReturnReason | null> {
  const [host] = await tx.select().from(planets).where(eq(planets.id, wave.hostPlanetId));
  if (host?.controllerPlayerId !== wave.hostPlayerId) return 'WORLD_CHANGED';
  const [sender, recipient] = await Promise.all([
    activeClanMembership(tx, wave.senderPlayerId),
    activeClanMembership(tx, wave.hostPlayerId),
  ]);
  if (sender?.clanId !== wave.clanId || recipient?.clanId !== wave.clanId) return 'MEMBERSHIP';
  if (host.defencePosture !== 'SUPPORT') return 'HOST_CLOSED';
  return null;
}

/**
 * A CLAN SUPPORT LEG LANDED. Routed here by the worker before every generic branch.
 *
 *   · the outbound leg reaching the host — the wave stands, or, if the arrangement
 *     broke while it flew, it turns for home from there untouched;
 *   · the outbound leg turned in flight — it is home;
 *   · the return leg — it is home.
 *
 * Every leg takes its radiation first (ruleset 14); a wave a cloud finishes is lost.
 */
export async function resolveClanSupportLeg(
  tx: Tx,
  mission: typeof missions.$inferSelect,
  now: Date,
): Promise<void> {
  const [peek] = await tx.select({ id: clanSupportWaves.id }).from(clanSupportWaves)
    .where(or(eq(clanSupportWaves.outboundMissionId, mission.id), eq(clanSupportWaves.returnMissionId, mission.id)));
  if (!peek) throw new Error(`clan support mission ${mission.id} has no wave`);
  const [wave] = await lockWaves(tx, [peek.id]);
  if (!wave || wave.status === 'HOME' || wave.status === 'LOST') return;
  const [season] = await tx.select({ rulesetVersion: seasons.rulesetVersion }).from(seasons)
    .where(eq(seasons.id, mission.seasonId));
  const rulesetVersion = season?.rulesetVersion ?? 0;

  const dose = await settleFlightRadiation(tx, {
    seasonId: mission.seasonId,
    rulesetVersion,
    path: await missionPath(tx, mission),
    planetId: wave.originPlanetId,
    location: wave.unitLocation,
    damage: wave.damage,
    tech: mission.tech ?? {},
    fromMs: Math.max(wave.radiationSettledAt?.getTime() ?? mission.departAt.getTime(), mission.departAt.getTime()),
  });
  const damaged: WaveRow = !radiationChanged(dose)
    ? wave
    : { ...wave, damage: dose.damage.length > 0 ? [...dose.damage] : null };
  if (radiationChanged(dose)) {
    await tx.update(clanSupportWaves).set({ damage: damaged.damage, radiationSettledAt: mission.arriveAt }).where(eq(clanSupportWaves.id, wave.id));
  }
  await tellRadiationLoss(tx, { playerId: wave.senderPlayerId, refId: mission.id, toPlanetId: mission.targetPlanetId },
    dose, now);
  if (fleetCount(dose.fleet) === 0) {
    await loseWave(tx, damaged, now);
    return;
  }

  const homeward = mission.id !== wave.outboundMissionId || mission.recalledAt !== null;
  if (homeward) {
    const destination = await safeHomePlanet(tx, wave.senderPlayerId, mission.recalledAt !== null
      ? mission.originPlanetId
      : mission.targetPlanetId);
    const landed = await landSupport(tx, damaged, dose.fleet, destination, now);
    await notify(tx, {
      playerId: wave.senderPlayerId,
      kind: 'fleet_returned',
      payload: { trip: 'support', craft: fleetCount(dose.fleet), craftKind: 'fleet', ...dockNotice(landed) },
      at: now,
      refId: mission.id,
    });
    return;
  }

  if (wave.status !== 'OUTBOUND') return;
  const refusal = await standingRefusal(tx, damaged);
  const [seasonRow] = await tx.select({ endsAt: seasons.endsAt }).from(seasons).where(eq(seasons.id, wave.seasonId));
  const stationedAt = now;
  const destination = await safeHomePlanet(tx, wave.senderPlayerId, wave.originPlanetId);
  const leg = await homewardMinutes(tx, damaged, destination, dose.fleet);
  const fullStay = addMinutes(stationedAt, CLAN_SUPPORT.stationHours * 60);
  const lastLeave = seasonRow ? addMinutes(seasonRow.endsAt, -leg.minutes) : fullStay;
  const expiresAt = fullStay <= lastLeave ? fullStay : (lastLeave > stationedAt ? lastLeave : stationedAt);
  const [standing] = await tx.update(clanSupportWaves)
    .set({ status: 'STATIONED', stationedAt, expiresAt })
    .where(eq(clanSupportWaves.id, wave.id))
    .returning();
  if (!standing) throw new Error('clan support wave vanished on arrival');
  if (refusal !== null) {
    await returnWave(tx, standing, refusal, now);
    return;
  }
  await schedule(tx, {
    seasonId: wave.seasonId,
    kind: 'clan_support_expiry',
    refId: wave.id,
    resolveAt: expiresAt,
  });
  await publishSupport(tx, wave);
}

/** TWELVE HOURS UP. A wave already turned for home is left alone. */
export async function resolveSupportExpiry(tx: Tx, waveId: string, now: Date): Promise<void> {
  const [peek] = await tx.select({ hostPlanetId: clanSupportWaves.hostPlanetId })
    .from(clanSupportWaves).where(eq(clanSupportWaves.id, waveId));
  if (!peek) return;
  await lockPlanetIds(tx, [peek.hostPlanetId]);
  const [wave] = await lockWaves(tx, [waveId]);
  if (wave?.status !== 'STATIONED' || wave.expiresAt === null) return;
  if (now.getTime() < wave.expiresAt.getTime()) return;
  await returnWave(tx, wave, 'EXPIRED', now);
}

/**
 * A SUPPORT LEG THE WORKER COULD NOT SETTLE. Its mission is already cancelled; the
 * ships go back to the world they left — or the sender's capital — intact, and the
 * wave is home. Nothing in it is ever stranded in a location no screen reads.
 */
export async function abandonClanSupportLeg(
  tx: Tx,
  mission: typeof missions.$inferSelect,
  now: Date,
): Promise<void> {
  const [peek] = await tx.select({ id: clanSupportWaves.id }).from(clanSupportWaves)
    .where(or(eq(clanSupportWaves.outboundMissionId, mission.id), eq(clanSupportWaves.returnMissionId, mission.id)));
  if (!peek) return;
  const [wave] = await lockWaves(tx, [peek.id]);
  if (!wave || wave.status === 'HOME' || wave.status === 'LOST') return;
  const fleet = await shipsOf(tx, wave);
  if (fleetCount(fleet) === 0) {
    await loseWave(tx, wave, now);
    return;
  }
  const destination = await safeHomePlanet(tx, wave.senderPlayerId, wave.originPlanetId);
  await landSupport(tx, wave, fleet, destination, now);
}

/**
 * A WORLD CHANGED HANDS OR SECEDED. Called by `transferPlanetControl` and `secedeColony`
 * with the world locked.
 *
 *   · every wave standing at, or flying to, it goes home — there is nobody it was
 *     defending any more (WORLD_CHANGED) — and its posture returns to ESCAPE;
 *   · every wave that LEFT from it is re-anchored on its sender's capital. The ships'
 *     rows sat under this world, and neither the Hangar count nor the bay count filters
 *     by owner: left there, the new owner would inherit a stranger's ships and bay.
 */
export async function releaseSupportForWorldChange(
  tx: Tx,
  input: { planetId: string; now: Date },
): Promise<void> {
  await tx.update(planets).set({ defencePosture: 'ESCAPE' }).where(eq(planets.id, input.planetId));
  await returnSupportAtWorld(tx, { planetIds: [input.planetId], reason: 'WORLD_CHANGED', now: input.now });
  const leaving = await tx.select({ id: clanSupportWaves.id }).from(clanSupportWaves)
    .where(and(
      eq(clanSupportWaves.originPlanetId, input.planetId),
      inArray(clanSupportWaves.status, ['OUTBOUND', 'STATIONED', 'RETURNING']),
    ));
  for (const wave of await lockWaves(tx, leaving.map((row) => row.id))) {
    const capital = await capitalPlanet(tx, wave.senderPlayerId);
    if (capital.id === wave.originPlanetId) continue;
    await tx.update(units).set({ planetId: capital.id })
      .where(and(eq(units.planetId, wave.originPlanetId), eq(units.location, wave.unitLocation)));
    await tx.update(clanSupportWaves).set({ originPlanetId: capital.id }).where(eq(clanSupportWaves.id, wave.id));
    await publishSupport(tx, wave);
  }
}
