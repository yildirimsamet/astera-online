import { and, eq, inArray } from 'drizzle-orm';
import { hpRadiationApplies } from '@astera/rules';
import type { Db } from '../db/client.js';
import { monumentShipLots, monumentWaves, monuments, seasons } from '../db/schema.js';
import { adminPlayerIdsInSeason } from './admin.js';
import { dominionPodium } from './dominion.js';
import { honorPodium, type HonorPodium } from './honorPodium.js';
import { monumentControllerNames, projectMonumentFacts, type MonumentControllerNames } from './monumentView.js';
import { galaxyRadiationRows, galaxyRadiationView } from './radiation.js';
import { galaxyHpRadiationRows, galaxyHpRadiationView, monumentDoseSources } from './radiationSources.js';

/**
 * WHAT `/api/galaxy` SHOWS EVERY COMMANDER ALIKE. Scaling plan F1.8 (C3, C4, Q3).
 *
 * The season's rules, its monuments, its radiation and both podiums are the galaxy's,
 * not the caller's, so they are read once per galaxy into this record and projected to
 * each request's instant: a monument moves and a cloud lights or burns out with no
 * database write, and the projection is the same function the uncached read uses.
 *
 * The read takes no lock: a consistent read-only snapshot is enough for a picture, and
 * a galaxy read that queued behind a season lock queued every commander behind it.
 */
export interface GalaxyFacts {
  season: typeof seasons.$inferSelect;
  adminPlayerIds: ReadonlySet<string>;
  dominionPodium: Map<string, 1 | 2 | 3> | null;
  honorPodium: HonorPodium;
  radiationRows: Awaited<ReturnType<typeof galaxyRadiationRows>>;
  hpRows: Awaited<ReturnType<typeof galaxyHpRadiationRows>>;
  monuments: (typeof monuments.$inferSelect)[];
  /** Only held waves are public: their lots fill a monument. */
  holds: (typeof monumentWaves.$inferSelect)[];
  lots: { waveId: string; hull: (typeof monumentShipLots.$inferSelect)['hull']; count: number }[];
  names: MonumentControllerNames;
}

/** A request may be a moment older than the read that filled the cache; its rows must still be there. */
const SKEW_MS = 60_000;

export async function loadGalaxyFacts(db: Db, seasonId: string, adminUsernames: ReadonlySet<string>, now: Date): Promise<GalaxyFacts | null> {
  return db.transaction(async (tx) => {
    const [season] = await tx.select().from(seasons).where(eq(seasons.id, seasonId));
    if (!season) return null;
    const since = new Date(now.getTime() - SKEW_MS);
    const hp = hpRadiationApplies(season.rulesetVersion);
    const adminPlayerIds = await adminPlayerIdsInSeason(tx, seasonId, adminUsernames);
    const [radiationRows, hpRows, monumentRows, podium, honor] = await Promise.all([
      galaxyRadiationRows(tx, seasonId, season.rulesetVersion, since),
      hp ? galaxyHpRadiationRows(tx, seasonId, since) : [],
      hp ? tx.select().from(monuments).where(eq(monuments.seasonId, seasonId)) : [],
      adminPlayerIds.size === 0 ? null : dominionPodium(tx, seasonId, adminPlayerIds),
      honorPodium(tx, seasonId, adminPlayerIds),
    ]);
    const ids = monumentRows.map((row) => row.id);
    const holds = ids.length === 0 ? [] : await tx.select().from(monumentWaves)
      .where(and(inArray(monumentWaves.monumentId, ids), eq(monumentWaves.status, 'HOLD')));
    const lots = holds.length === 0 ? [] : await tx.select({ waveId: monumentShipLots.waveId, hull: monumentShipLots.hull,
      count: monumentShipLots.count }).from(monumentShipLots).where(inArray(monumentShipLots.waveId, holds.map((wave) => wave.id)));
    return { season, adminPlayerIds, dominionPodium: podium, honorPodium: honor, radiationRows, hpRows,
      monuments: monumentRows, holds, lots, names: await monumentControllerNames(tx, monumentRows) };
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
}

/** The galaxy's shared part of `/api/galaxy` at `now`. */
export function galaxyFactsAt(facts: GalaxyFacts, now: Date) {
  const { season } = facts;
  const hp = hpRadiationApplies(season.rulesetVersion);
  const ids = new Set(facts.monuments.map((monument) => monument.id));
  const targets = facts.monuments.map((monument) => {
    const waves = facts.holds.filter((wave) => wave.monumentId === monument.id);
    const held = new Set(waves.map((wave) => wave.id));
    // Reservations are private capacity state; the public facts drop them below.
    return { monument, season, waves, lots: facts.lots.filter((lot) => held.has(lot.waveId)), memberships: new Map<string, string>() };
  });
  const monumentFacts = targets.length === 0 ? [] : projectMonumentFacts(targets,
    new Map([[season.id, monumentDoseSources(season, facts.hpRows, ids, now)]]), facts.names, now)
    .map(({ reserved: _reserved, ...fact }) => fact);
  return {
    radiation: galaxyRadiationView(facts.radiationRows, now),
    radiationModel: hp ? 'HP' as const : 'PCT' as const,
    monuments: monumentFacts,
    // Only the body: the motion it is given is published as it is.
    hpRadiation: hp ? galaxyHpRadiationView(season, facts.hpRows, facts.monuments.map(({ id, x, y, z }) => ({ id, x, y, z })), now) : [],
  };
}
