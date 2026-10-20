import { and, desc, eq, exists, lte, or } from 'drizzle-orm';
import { isHonorCandidate, isSupportedHonorVersion, type HonorVersion } from '@astera/rules';
import type { Tx } from '../db/client.js';
import { honorSeasons, seasonCycles, seasons, shards } from '../db/schema.js';

/** Continue the announced main-galaxy program, never promote an invisible trial.
 * A same-cycle new galaxy can inherit the program, as can the next cycle. A race
 * hidden with a promise of the next season is announced, not a trial. */
async function latestHonorPrograms(tx: Tx, startsAt: Date) {
  const [latest] = await tx.select({ id: seasonCycles.id }).from(seasonCycles)
    .where(and(lte(seasonCycles.startsAt, startsAt), exists(tx.select({ id: seasons.id }).from(seasons)
      .innerJoin(shards, eq(shards.id, seasons.shardId))
      .where(and(eq(seasons.cycleId, seasonCycles.id), eq(shards.role, 'MAIN')))))).orderBy(desc(seasonCycles.ordinal)).limit(1);
  if (!latest) return [];
  return tx.select({ version: honorSeasons.version, benefitsVersion: honorSeasons.benefitsVersion }).from(honorSeasons)
    .innerJoin(seasons, eq(seasons.id, honorSeasons.seasonId)).innerJoin(shards, eq(shards.id, seasons.shardId))
    .where(and(eq(seasons.cycleId, latest.id), eq(shards.role, 'MAIN'),
      or(eq(honorSeasons.mode, 'ACTIVE'), eq(honorSeasons.successorAnnounced, true))));
}

export async function inheritedHonorProgram(tx: Tx, startsAt: Date): Promise<HonorVersion | undefined> {
  const configs = await latestHonorPrograms(tx, startsAt);
  const versions = [...new Set(configs.map(row => row.version))];
  if (versions.length === 0) return undefined;
  if (versions.length !== 1) throw new Error('Conflicting announced Honor programs require an explicit successor version');
  const version = versions[0]!;
  if (!isSupportedHonorVersion(version) || isHonorCandidate(version)) throw new Error('Unreleased Honor successor program');
  return version;
}

/** Only a program actually announced in the preceding main cycle can carry. */
export async function inheritedHonorBenefitsProgram(tx: Tx, startsAt: Date): Promise<1 | null> {
  const configs = await latestHonorPrograms(tx, startsAt);
  // Null is an unannounced program, not a second incompatible version. Opening
  // galaxies one at a time must not break the next cycle's atomic rollover.
  const versions = [...new Set(configs.flatMap(row => row.benefitsVersion === null ? [] : [row.benefitsVersion]))];
  if (versions.length === 0) return null;
  if (versions.length !== 1 || versions[0] !== 1) throw new Error('Conflicting announced Honor economic programs');
  return 1;
}
