import { and, asc, eq, inArray } from 'drizzle-orm';
import { applyHpDose, firstHpLossAtMs, fleetCount, hangarLoad, hpWingLethalAtMs,
  segmentsExposureHp, type HpRadiationSource, type Fleet } from '@astera/rules';
import type { Queryable, Tx } from '../db/client.js';
import { clanWarContributions, clanWarOperations, type planets, type seasons, units } from '../db/schema.js';
import { publishWar } from './clanWar.js';
import { hpSourcesForTarget } from './radiationSources.js';
import { planetRadiationPath } from './planetAegis.js';
import { noteRadiationInventoryChange } from './planetRadiation.js';
import { recordRadiationHonor } from './honorRadiation.js';

type Planet = typeof planets.$inferSelect;
type Season = typeof seasons.$inferSelect;
type Wave = typeof clanWarContributions.$inferSelect;

async function stagedWaves(db: Queryable, host: Planet) {
  return db.select({ wave: clanWarContributions }).from(clanWarContributions)
    .innerJoin(clanWarOperations, eq(clanWarOperations.id, clanWarContributions.operationId))
    .where(and(eq(clanWarOperations.seasonId, host.seasonId), eq(clanWarOperations.stagingPlanetId, host.id), eq(clanWarContributions.status, 'STAGED')))
    .orderBy(asc(clanWarContributions.id));
}

/** Escrow rows stay at the origin; their physical radiation target is the staging world. */
async function waveHealth(db: Queryable, waves: readonly Wave[]) {
  if (waves.length === 0) return [];
  const stock = await db.select().from(units).where(inArray(units.location, waves.map(wave => wave.unitLocation)));
  const grouped = new Map<string, typeof stock>();
  for (const row of stock) {
    const group = grouped.get(row.location) ?? [];
    group.push(row);
    grouped.set(row.location, group);
  }
  return waves.map(wave => {
    const rows = grouped.get(wave.unitLocation) ?? [];
    const fleet: Fleet = {};
    for (const row of rows) if (row.count > 0) fleet[row.hull] = row.count;
    return { wave, fleet, rows };
  });
}

/** Caller holds the staging world before contribution locks, as every roster mutation does. */
export async function settleStagedWarRadiation(tx: Tx, host: Planet, season: Season, at: Date, observedAt: Date) {
  const epoch = season.radiationBombStartsAt;
  if (!epoch || at <= epoch) return;
  const candidates = await stagedWaves(tx, host);
  if (candidates.length === 0) return;
  const waves = await tx.select().from(clanWarContributions)
    .where(and(inArray(clanWarContributions.id, candidates.map(row => row.wave.id)), eq(clanWarContributions.status, 'STAGED')))
    .orderBy(asc(clanWarContributions.id)).for('update');
  if (waves.length === 0) return;
  const until = Math.min(at.getTime(), (season.closedAt ?? season.endsAt).getTime());
  const begin = (wave: Wave) => Math.max(epoch.getTime(), (wave.stagedAt ?? wave.sentAt).getTime(), wave.radiationSettledAt?.getTime() ?? 0);
  const from = Math.min(...waves.map(begin));
  if (from >= until) return;
  const sources = await hpSourcesForTarget(tx, season, { kind: 'PLANET', id: host.id }, new Date(from), new Date(until));
  const changedClans = new Set<string>();
  for (const { wave, fleet, rows } of await waveHealth(tx, waves)) {
    const start = begin(wave);
    if (start >= until) continue;
    const path = await planetRadiationPath(tx, host, start, until);
    const outcome = applyHpDose(fleet, wave.damage, segmentsExposureHp(path, sources), wave.tech);
    await recordRadiationHonor(tx, { seasonId: season.id, victim: wave.playerId, slice: `staging:${wave.id}`,
      until: new Date(until), fleet, damage: wave.damage, tech: wave.tech, segments: path, sources });
    const lost = fleetCount(outcome.fleet) === 0;
    for (const row of rows) {
      const count = outcome.fleet[row.hull] ?? 0;
      if (count === row.count) continue;
      const predicate = and(eq(units.planetId, row.planetId), eq(units.location, row.location), eq(units.hull, row.hull));
      if (count === 0) await tx.delete(units).where(predicate);
      else await tx.update(units).set({ count }).where(predicate);
    }
    await tx.update(clanWarContributions).set({ fleet: outcome.fleet, damage: outcome.lots.length ? outcome.lots : null,
      reservedBulk: hangarLoad(outcome.fleet), radiationSettledAt: new Date(until),
      ...(lost ? { status: 'LOST' as const,
        resolvedAt: new Date(hpWingLethalAtMs(path, sources, fleet, wave.damage, wave.tech) ?? until) } : {}) })
      .where(eq(clanWarContributions.id, wave.id));
    // HP already travels in this read's response. Broadcasting each fractional
    // wound would make GET -> private event -> GET repeat while the source lives.
    if (fleetCount(outcome.destroyed) > 0) {
      noteRadiationInventoryChange(tx, wave.playerId, observedAt);
      changedClans.add(wave.clanId);
    }
  }
  for (const clanId of changedClans) await publishWar(tx, clanId);
}

export async function nextStagedWarRadiationLoss(db: Queryable, host: Planet, season: Season, at: Date, sources: readonly HpRadiationSource[]): Promise<number | null> {
  if (!season.radiationBombStartsAt) return null;
  const waves = await stagedWaves(db, host);
  if (waves.length === 0) return null;
  let first: number | null = null;
  for (const { wave, fleet } of await waveHealth(db, waves.map(row => row.wave))) {
    const loss = firstHpLossAtMs(await planetRadiationPath(db, host, at.getTime(), season.endsAt.getTime()), sources, fleet, wave.damage, wave.tech);
    if (loss !== null) first = Math.min(first ?? loss, loss);
  }
  return first;
}
