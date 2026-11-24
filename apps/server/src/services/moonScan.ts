import { and, desc, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import { MOON, distance, fleetSizeClass, gozcuSees, hangarLoad, scanPierces, scanRange } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import { missions, moonScans, moons, planets, probeWorldMemories, type MoonScanRow } from '../db/schema.js';
import { assertFuel } from './fuel.js';
import { rememberWorld } from './intel.js';
import { seasonHasMoons } from './moon.js';
import { lockWorlds } from './ownership.js';
import { GameError, assertWorldOperational, loadLocked, saveResources } from './planet.js';
import { markProgress } from './waitingRoom.js';

/** The flights a Gözcü can see (S33): players' fleets. Probes, mining and strategic strikes never show. */
const SEEN_KINDS = ['attack', 'transfer', 'clan_transfer', 'clan_war', 'clan_support', 'settlement', 'return'] as const;

/**
 * GÖZCÜ (S14, S15, S20, S33, S53; plan §6.12). A photograph of every route into and out of a world in this
 * moon's range, at this instant: direction, the other world, the arrival and a rough size — never the kind;
 * the scanner guesses the intent. A flight leaving or landing on any moon is cloaked unless this moon is
 * Legendary. Silent: nobody on the routes is told. The worlds on them become known to the scanner.
 */
export async function scanFromMoonTx(
  tx: Tx, playerId: string, planetId: string, targetPlanetId: string, clock: Clock,
): Promise<{ id: string; scannedAt: Date; pierced: boolean; rows: MoonScanRow[] }> {
  await lockWorlds(tx, [planetId]);
  const world = await loadLocked(tx, planetId, clock);
  if (world.playerId !== playerId) throw new GameError('PLANET_NOT_OWNED', 'This world is not yours', 403);
  assertWorldOperational(world);
  const now = world.now;
  if (!await seasonHasMoons(tx, world.seasonId)) throw new GameError('MOONS_DISABLED', 'This galaxy has no moons', 409);
  const [moon] = await tx.select().from(moons).where(eq(moons.planetId, planetId));
  if (!moon) throw new GameError('NO_MOON', 'This world has no moon', 409);
  if (moon.closedUntil && moon.closedUntil > now) throw new GameError('MOON_CLOSED', 'A struck moon’s Gözcü is shut', 409);
  const [target] = await tx.select({ id: planets.id, seasonId: planets.seasonId, x: planets.x, y: planets.y, z: planets.z })
    .from(planets).where(eq(planets.id, targetPlanetId));
  if (target?.seasonId !== world.seasonId) throw new GameError('PLANET_NOT_FOUND', 'No such world here', 404);
  if (distance(world, target) > scanRange(moon.rarity)) throw new GameError('OUT_OF_RANGE', 'That world is beyond this moon’s reach', 409, { context: 'gozcu' });
  const [recent] = await tx.select({ id: moonScans.id }).from(moonScans).where(and(
    eq(moonScans.scannerPlanetId, planetId),
    gt(moonScans.scannedAt, new Date(now.getTime() - MOON.scanSpacingSeconds * 1_000)),
  )).limit(1);
  if (recent) throw new GameError('SCAN_TOO_SOON', 'The moon is still turning to the next world', 409);
  const fuel = MOON.scanCost.deuterium;
  assertFuel(fuel, world.deuterium, 0);
  await saveResources(tx, planetId, { alloy: world.alloy, crystal: world.crystal, deuterium: world.deuterium - fuel });

  const pierced = scanPierces(moon.rarity);
  const flights = await tx.select().from(missions).where(and(
    eq(missions.status, 'in_flight'),
    inArray(missions.kind, [...SEEN_KINDS]),
    or(eq(missions.targetPlanetId, targetPlanetId), eq(missions.originPlanetId, targetPlanetId)),
  ));
  const rows: MoonScanRow[] = [];
  for (const flight of flights) {
    if (!gozcuSees(flight, pierced)) continue;
    // A turned flight is heading back to the world it left (K8).
    const turned = flight.recalledAt !== null;
    const to = turned ? flight.originPlanetId : flight.targetPlanetId;
    const from = turned ? flight.targetPlanetId : flight.originPlanetId;
    rows.push({
      direction: to === targetPlanetId ? 'IN' : 'OUT',
      otherPlanetId: to === targetPlanetId ? from : to,
      arriveAt: flight.arriveAt.toISOString(),
      size: fleetSizeClass(hangarLoad(flight.fleet)),
    });
  }
  rows.sort((a, b) => a.arriveAt.localeCompare(b.arriveAt));
  const [report] = await tx.insert(moonScans).values({
    seasonId: world.seasonId, scannerPlayerId: playerId, scannerPlanetId: planetId, targetPlanetId,
    scannedAt: now, fuelPaid: fuel, pierced, rows: { v: 1, rows },
  }).returning({ id: moonScans.id });

  // The worlds on the routes are now known (S53), with their moon's rarity; a record already held stays.
  const others = [...new Set(rows.map((row) => row.otherPlanetId))];
  if (others.length > 0) {
    const [owned, known] = await Promise.all([
      tx.select({ id: planets.id }).from(planets).where(and(inArray(planets.id, others), eq(planets.controllerPlayerId, playerId))),
      tx.select({ id: probeWorldMemories.targetPlanetId }).from(probeWorldMemories).where(and(
        eq(probeWorldMemories.observerPlayerId, playerId), inArray(probeWorldMemories.targetPlanetId, others),
        isNull(probeWorldMemories.invalidatedAt))),
    ]);
    const skip = new Set([...owned, ...known].map((row) => row.id));
    for (const id of others) {
      if (skip.has(id)) continue;
      await rememberWorld(tx, { observerPlayerId: playerId, targetPlanetId: id, seasonId: world.seasonId, seenAt: now, source: 'SCAN' });
    }
  }
  await markProgress(tx, playerId, now); // V55: every moon order restarts the Silent Space clock
  return { id: report!.id, scannedAt: now, pierced, rows };
}

export async function scanFromMoon(
  db: Db, playerId: string, planetId: string, targetPlanetId: string, clock: Clock,
): Promise<{ id: string; scannedAt: Date; pierced: boolean; rows: MoonScanRow[] }> {
  return db.transaction((tx) => scanFromMoonTx(tx, playerId, planetId, targetPlanetId, clock));
}

/** The caller's own Gözcü reports, newest first (§6.12). */
export async function listMoonScans(db: Db, playerId: string, limit = 50) {
  const scans = await db.select().from(moonScans).where(eq(moonScans.scannerPlayerId, playerId))
    .orderBy(desc(moonScans.scannedAt)).limit(limit);
  return scans.map((scan) => ({
    id: scan.id, scannerPlanetId: scan.scannerPlanetId, targetPlanetId: scan.targetPlanetId,
    scannedAt: scan.scannedAt, pierced: scan.pierced, rows: scan.rows.rows,
  }));
}
