import { and, asc, eq, gt, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import {
  applyDose,
  fleetCount,
  missionSegments,
  segmentsDoseBp,
  shipDamageApplies,
  wingLethalAtMs,
  TRAVEL,
  type DamageLots,
  type Fleet,
  type HullId,
  type RadiationSource,
  type Segment,
  type Vec3,
} from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db, Queryable, Tx } from '../db/client.js';
import { clanWarContributions, missions, planets, radiationSources, seasons, units } from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { notify } from './notifications.js';
import { GameError, recomputePlayerWealth } from './planet.js';

/**
 * RADIATION ON THE SERVER. Owner decisions K3 · K4, 2026-09-29 (`plan.md` F9).
 *
 * The rows are data; the dose is `@astera/rules`' `radiation.ts`, the one copy the
 * client forecasts with too. A flight takes its dose when it lands, over its whole path,
 * each source counted only for the window it stood — so a cloud lit or ended mid-flight
 * is already right, and nothing has to be settled on a timer.
 *
 * WHAT A CLOUD FINISHED LEAVES `units`; WHAT IT ONLY HURT IS WRITTEN ON THE FLIGHT'S
 * `damage`, where the Repair Station reads it at the landing like any battle damage.
 *
 * THE RULESET GATE IS HERE, where the damage is made (plan I6): a season dealt before
 * ship damage settles nothing, whatever rows exist.
 */

type SourceRow = typeof radiationSources.$inferSelect;
type MissionRow = typeof missions.$inferSelect;
type WaveRow = typeof clanWarContributions.$inferSelect;

const asSource = (row: SourceRow): RadiationSource => ({
  id: row.id,
  mode: row.mode,
  center: { x: row.x, y: row.y, z: row.z },
  radius: row.radius,
  intensityPctPerMinute: row.intensityPctPerMinute,
  activeFromMs: row.activeFrom.getTime(),
  activeUntilMs: row.activeUntil?.getTime() ?? null,
});

/** Every source this season ever had, ended ones included: a flight may have crossed them. */
export async function sourcesForSeason(tx: Queryable, seasonId: string): Promise<RadiationSource[]> {
  const rows = await tx.select().from(radiationSources)
    .where(eq(radiationSources.seasonId, seasonId))
    .orderBy(asc(radiationSources.createdAt), asc(radiationSources.id));
  return rows.map(asSource);
}

/** A flight's path on the worlds' true centres, the recall's turn included. */
export async function missionPath(tx: Queryable, mission: MissionRow): Promise<Segment[]> {
  const [origin] = await tx.select({ x: planets.x, y: planets.y, z: planets.z }).from(planets)
    .where(eq(planets.id, mission.originPlanetId));
  const [target] = await tx.select({ x: planets.x, y: planets.y, z: planets.z }).from(planets)
    .where(eq(planets.id, mission.targetPlanetId));
  if (!origin || !target) throw new Error(`flight ${mission.id} lost an endpoint`);
  return missionSegments({
    origin,
    target,
    departAtMs: mission.departAt.getTime(),
    arriveAtMs: mission.arriveAt.getTime(),
    recalledAtMs: mission.recalledAt?.getTime() ?? null,
    recallFrom: mission.recallFrom ?? null,
  });
}

export interface FlightDose {
  /** What is still flying. */
  fleet: Fleet;
  /** What it carries in damage now, battle damage and dose together. */
  damage: DamageLots;
  /** What the clouds finished. Empty when nothing was. */
  destroyed: Fleet;
  /** The dose taken, in whole basis points of a full hull; 0 when nothing changed. */
  doseBp: number;
}

/**
 * THE DOSE ONE HOLDER'S SHIPS TOOK ON ONE PATH, SETTLED.
 *
 * Generic over where the ships are parked, because a flight's ships sit under the
 * mission id and a clan wave's under its contribution's own location. The caller
 * writes `damage` back on its own row.
 */
export async function settleFlightRadiation(tx: Tx, input: {
  seasonId: string;
  rulesetVersion: number;
  path: readonly Segment[];
  planetId: string;
  location: string;
  damage: DamageLots | null;
}): Promise<FlightDose> {
  const rows = await tx.select().from(units)
    .where(and(eq(units.planetId, input.planetId), eq(units.location, input.location)));
  const fleet: Fleet = {};
  for (const row of rows) if (row.count > 0) fleet[row.hull] = row.count;
  const untouched: FlightDose = { fleet, damage: input.damage ?? [], destroyed: {}, doseBp: 0 };
  if (!shipDamageApplies(input.rulesetVersion)) return untouched;

  const sources = await sourcesForSeason(tx, input.seasonId);
  if (sources.length === 0) return untouched;
  const dose = segmentsDoseBp(input.path, sources);
  if (dose === 0) return untouched;

  const outcome = applyDose(fleet, input.damage, dose);
  for (const [hull, lost] of Object.entries(outcome.destroyed) as [HullId, number][]) {
    const left = (fleet[hull] ?? 0) - lost;
    const row = and(eq(units.planetId, input.planetId), eq(units.hull, hull), eq(units.location, input.location));
    if (left > 0) await tx.update(units).set({ count: left }).where(row);
    else await tx.delete(units).where(row);
  }
  return { fleet: outcome.fleet, damage: outcome.lots, destroyed: outcome.destroyed, doseBp: dose };
}

/**
 * A MISSION'S DOSE, SETTLED AT ITS LANDING, and its row brought up to date: `fleet` is
 * what arrives and `damage` what it carries. Hands the row back so the caller goes on
 * with what actually arrived, never with the copy it claimed.
 */
export async function settleMissionRadiation(
  tx: Tx,
  mission: MissionRow,
  where: { storagePlanetId?: string; rulesetVersion: number; location?: string },
): Promise<FlightDose & { mission: MissionRow }> {
  const location = where.location ?? mission.id;
  /*
    WHERE THE SHIPS ARE PARKED, when the caller does not know. A rerouted transfer keeps
    its craft on the row of the world it first left, whatever its endpoints now say, so
    the parking is found by the one thing that never moves: owner and location.
  */
  const planetId = where.storagePlanetId ?? (await tx.select({ planetId: units.planetId }).from(units)
    .where(and(eq(units.ownerPlayerId, mission.ownerPlayerId), eq(units.location, location)))
    .limit(1))[0]?.planetId;
  if (planetId === undefined) {
    return { fleet: {}, damage: mission.damage ?? [], destroyed: {}, doseBp: 0, mission };
  }
  const settled = await settleFlightRadiation(tx, {
    seasonId: mission.seasonId,
    rulesetVersion: where.rulesetVersion,
    path: shipDamageApplies(where.rulesetVersion) ? await missionPath(tx, mission) : [],
    planetId,
    location,
    damage: mission.damage,
  });
  if (settled.doseBp === 0) return { ...settled, mission };
  const damage = settled.damage.length > 0 ? [...settled.damage] : null;
  await tx.update(missions).set({ fleet: settled.fleet, damage }).where(eq(missions.id, mission.id));
  // Wealth counts what a commander owns, and a finished ship is owned no more.
  if (Object.keys(settled.destroyed).length > 0) await recomputePlayerWealth(tx, mission.ownerPlayerId);
  return { ...settled, mission: { ...mission, fleet: settled.fleet, damage } };
}

/** Who hears of a loss, about which flight, and where it was headed. */
export interface LossWitness {
  playerId: string;
  refId: string;
  toPlanetId: string;
}

/** A mission's own commander; a flight called back was headed home. */
export const flightWitness = (mission: MissionRow): LossWitness => ({
  playerId: mission.ownerPlayerId,
  refId: mission.id,
  toPlanetId: mission.recalledAt !== null ? mission.originPlanetId : mission.targetPlanetId,
});

/**
 * THE ONLY WORD OF SHIPS A CLOUD FINISHED. Told to the commander who flew them and to
 * nobody else: no one saw it happen. A clan wave's commander is the wave's, not the
 * coordinator who owns the strike mission.
 */
export async function tellRadiationLoss(tx: Tx, to: LossWitness, dose: FlightDose, at: Date): Promise<void> {
  const lost = Object.values(dose.destroyed).reduce((sum, n) => sum + n, 0);
  if (lost === 0) return;
  const [world] = await tx.select({ name: planets.name }).from(planets).where(eq(planets.id, to.toPlanetId));
  await notify(tx, {
    playerId: to.playerId,
    kind: 'radiation_lost',
    payload: {
      lost,
      left: Object.values(dose.fleet).reduce((sum, n) => sum + n, 0),
      toPlanetId: to.toPlanetId,
      toPlanetName: world?.name ?? null,
    },
    at,
    refId: to.refId,
  });
}

/**
 * ONE CLAN WAVE'S DOSE OVER ONE LEG, written on the wave. Klan Ortak Savaşı.
 *
 * A wave's ships never leave the world they launched from in `units` — they sit under
 * its own location for the whole war — and its damage rides on the contribution row,
 * so a wave is settled like a flight with its own parking and its own `damage`.
 */
export async function settleWaveRadiation(
  tx: Tx,
  wave: WaveRow,
  mission: MissionRow,
  rulesetVersion: number,
): Promise<FlightDose & { wave: WaveRow }> {
  const settled = await settleFlightRadiation(tx, {
    seasonId: mission.seasonId,
    rulesetVersion,
    path: shipDamageApplies(rulesetVersion) ? await missionPath(tx, mission) : [],
    planetId: wave.originPlanetId,
    location: wave.unitLocation,
    damage: wave.damage,
  });
  if (settled.doseBp === 0) return { ...settled, wave };
  const damage = settled.damage.length > 0 ? [...settled.damage] : null;
  await tx.update(clanWarContributions).set({ damage, fleet: settled.fleet })
    .where(eq(clanWarContributions.id, wave.id));
  if (Object.keys(settled.destroyed).length > 0) await recomputePlayerWealth(tx, wave.playerId);
  return { ...settled, wave: { ...wave, damage, fleet: settled.fleet } };
}

/**
 * A ROUTE THAT WOULD FINISH SHIPS IS NEVER FLOWN WITHOUT BEING READ. Plan D10.
 *
 * The launch is refused once with `RADIATION_LETHAL` and the number the cloud would
 * take; the surface shows it, and the commander's acknowledgement comes back here. A
 * cloud that only hurts asks nothing — the forecast line says what it will cost. The
 * leg priced is the one that is known now: out, at the pace chosen, through every
 * source's window, lit or not yet.
 */
export async function assertRadiationSafe(tx: Tx, input: {
  seasonId: string;
  from: Vec3;
  to: Vec3;
  departAt: Date;
  arriveAt: Date;
  fleet: Fleet;
  acknowledged: boolean;
}): Promise<void> {
  if (input.acknowledged) return;
  const [season] = await tx.select({ rulesetVersion: seasons.rulesetVersion }).from(seasons)
    .where(eq(seasons.id, input.seasonId));
  if (!season || !shipDamageApplies(season.rulesetVersion)) return;
  const sources = await sourcesForSeason(tx, input.seasonId);
  if (sources.length === 0) return;
  const dose = segmentsDoseBp(missionSegments({
    origin: input.from,
    target: input.to,
    departAtMs: input.departAt.getTime(),
    arriveAtMs: input.arriveAt.getTime(),
  }), sources);
  const lost = fleetCount(applyDose(input.fleet, null, dose).destroyed);
  if (lost > 0) {
    throw new GameError('RADIATION_LETHAL', 'Radiation on this route would destroy ships', 409, { count: lost });
  }
}

/**
 * THE CLOUDS ON THE MAP. Everything a flight could still be crossing: lit, not yet lit,
 * or ended within the longest a flight can be up (a recalled one flies its outbound time
 * twice), because the client forecasts routes and draws its own fleets' fade with the
 * same dose function the server settles with. A season dealt before the rule shows none:
 * a cloud that does nothing is a lie on the map.
 */
export async function radiationForGalaxy(db: Queryable, seasonId: string, now: Date) {
  const [season] = await db.select({ rulesetVersion: seasons.rulesetVersion }).from(seasons)
    .where(eq(seasons.id, seasonId));
  if (!season || !shipDamageApplies(season.rulesetVersion)) return [];
  const since = new Date(now.getTime() - 2 * TRAVEL.pacedFlightCapMinutes * 60_000);
  const rows = await db.select().from(radiationSources)
    .where(and(
      eq(radiationSources.seasonId, seasonId),
      or(isNull(radiationSources.activeUntil), gt(radiationSources.activeUntil, since)),
    ))
    .orderBy(asc(radiationSources.createdAt), asc(radiationSources.id));
  return rows.map((row) => ({
    id: row.id,
    mode: row.mode,
    center: { x: row.x, y: row.y, z: row.z },
    radius: row.radius,
    intensityPctPerMinute: row.intensityPctPerMinute,
    activeFrom: row.activeFrom,
    activeUntil: row.activeUntil,
  }));
}

/**
 * THE CLOUDS OF A SEASON THAT DEALS THEM, read once per call. Empty before ruleset 14,
 * whatever rows exist: a cloud that does nothing is nothing to draw.
 */
export async function liveRadiationFor(
  tx: Queryable,
  seasonId: string,
  cache: Map<string, RadiationSource[]>,
): Promise<RadiationSource[]> {
  const known = cache.get(seasonId);
  if (known) return known;
  const [season] = await tx.select({ rulesetVersion: seasons.rulesetVersion }).from(seasons)
    .where(eq(seasons.id, seasonId));
  const sources = season && shipDamageApplies(season.rulesetVersion) ? await sourcesForSeason(tx, seasonId) : [];
  cache.set(seasonId, sources);
  return sources;
}

/**
 * WHEN THE CLOUDS FINISH A COMMANDER'S OWN WING IN THE AIR, for the disc to fade it at
 * that moment (D15), or `null` when it lands. The whole path, the recall's turn and the
 * damage carried are the server's to know; the client draws the answer.
 */
export function flightFadeAt(
  mission: Pick<MissionRow, 'fleet' | 'damage' | 'departAt' | 'arriveAt' | 'recalledAt' | 'recallFrom'>,
  ends: { origin: Vec3; target: Vec3 },
  sources: readonly RadiationSource[],
): Date | null {
  if (sources.length === 0) return null;
  const at = wingLethalAtMs(missionSegments({
    origin: ends.origin,
    target: ends.target,
    departAtMs: mission.departAt.getTime(),
    arriveAtMs: mission.arriveAt.getTime(),
    recalledAtMs: mission.recalledAt?.getTime() ?? null,
    recallFrom: mission.recallFrom ?? null,
  }), sources, mission.fleet, mission.damage);
  return at === null ? null : new Date(at);
}

/* ── the operator's door (K4: test sources only) ───────────────── */

const point = z.object({ x: z.number().finite(), y: z.number().finite(), z: z.number().finite() });
const sourceInput = z.object({
  seasonId: z.string().uuid(),
  anchor: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('ZONE'), at: point }),
    z.object({ kind: z.literal('PLANET'), planetId: z.string().uuid() }),
  ]),
  radius: z.number().finite().positive(),
  intensityPctPerMinute: z.number().finite().nonnegative(),
  mode: z.enum(['EMIT', 'SHELTER']),
  label: z.string().max(80),
  activeFrom: z.date().optional(),
  activeUntil: z.date().nullable().optional(),
});
export type RadiationSourceInput = z.input<typeof sourceInput>;

/**
 * A CLOUD, PLACED. On a world's centre as it stands now, or on a point in space; live
 * from `activeFrom` (default now). Clients are told to read the galaxy again.
 */
export async function addRadiationSource(db: Db, input: RadiationSourceInput, clock: Clock): Promise<SourceRow> {
  const parsed = sourceInput.safeParse(input);
  if (!parsed.success) throw new GameError('RADIATION_BAD_SOURCE', parsed.error.issues[0]?.message ?? 'bad source');
  const source = parsed.data;
  return db.transaction(async (tx) => {
    const [season] = await tx.select({ rulesetVersion: seasons.rulesetVersion }).from(seasons)
      .where(eq(seasons.id, source.seasonId));
    if (!season) throw new GameError('RADIATION_BAD_SOURCE', 'No such season');
    if (!shipDamageApplies(season.rulesetVersion)) {
      throw new GameError('RADIATION_UNAVAILABLE', 'This season has no radiation', 403);
    }
    let at = source.anchor.kind === 'ZONE' ? source.anchor.at : null;
    if (source.anchor.kind === 'PLANET') {
      const [world] = await tx.select({ x: planets.x, y: planets.y, z: planets.z }).from(planets)
        .where(and(eq(planets.id, source.anchor.planetId), eq(planets.seasonId, source.seasonId)));
      if (!world) throw new GameError('RADIATION_BAD_SOURCE', 'No such world in that season');
      at = world;
    }
    if (!at) throw new Error('unreachable: an anchor has a position');
    const [row] = await tx.insert(radiationSources).values({
      seasonId: source.seasonId,
      anchorKind: source.anchor.kind,
      anchorId: source.anchor.kind === 'PLANET' ? source.anchor.planetId : null,
      x: at.x, y: at.y, z: at.z,
      radius: source.radius,
      intensityPctPerMinute: source.intensityPctPerMinute,
      mode: source.mode,
      activeFrom: source.activeFrom ?? clock.now(),
      activeUntil: source.activeUntil ?? null,
      label: source.label,
    }).returning();
    if (!row) throw new Error('radiation source insert returned no row');
    await publishShard(tx, source.seasonId, 'world');
    return row;
  });
}

/** Ended, never deleted: a flight that crossed it still settles against it. Idempotent. */
export async function endRadiationSource(db: Db, id: string, clock: Clock): Promise<SourceRow> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(radiationSources).where(eq(radiationSources.id, id)).for('update');
    if (!row) throw new GameError('NOT_FOUND', 'No such radiation source', 404);
    const now = clock.now();
    if (row.activeUntil !== null && row.activeUntil <= now) return row;
    const [ended] = await tx.update(radiationSources).set({ activeUntil: now })
      .where(eq(radiationSources.id, id)).returning();
    if (!ended) throw new Error(`radiation source ${id} vanished while it was ended`);
    await publishShard(tx, row.seasonId, 'world');
    return ended;
  });
}

export async function listRadiationSources(db: Queryable, seasonId: string): Promise<SourceRow[]> {
  return db.select().from(radiationSources)
    .where(eq(radiationSources.seasonId, seasonId))
    .orderBy(asc(radiationSources.createdAt), asc(radiationSources.id));
}
