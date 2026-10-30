import { and, eq, inArray } from 'drizzle-orm';
import { coreTier, honorSoloCredit, isSupportedHonorVersion, HONOR_HISTORY_HOURS, honorChallenge, honorPairKey, honorReferenceAt } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { buildings, honorObservations, honorSeasons, planets, players } from '../db/schema.js';
import { honorStateSchema } from './honorAccounting.js';
import { readHonorRelations } from './honorRelations.js';
import { ownedHonorNavy } from './honorNavy.js';
import { honorGalaxyTopTier } from './honorReference.js';
import { GameError } from './planet.js';

/** Coarse decision guidance only. GET never writes observations, commitments or points. */
export async function honorTargetPreview(db: Db, playerId: string, targetPlanetId: string,
  clock: Clock, adminUsernames: ReadonlySet<string>) {
  return db.transaction(async tx => {
    const [owner] = await tx.select({ seasonId: players.seasonId }).from(players).where(eq(players.id, playerId));
    if (!owner) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
    const [config] = await tx.select().from(honorSeasons).where(eq(honorSeasons.seasonId, owner.seasonId));
    if (config?.mode !== 'ACTIVE' || config.closedAt !== null) return { enabled: false as const };
    const [target] = await tx.select({ owner: planets.controllerPlayerId }).from(planets)
      .where(and(eq(planets.seasonId, owner.seasonId), eq(planets.id, targetPlanetId)));
    if (!target || target.owner === playerId) throw new GameError('INVALID_TARGET', 'Invalid Honor target', 400);
    if (target.owner === null) return { enabled: true as const, eligible: false as const };
    const now = clock.now(), ids = [playerId, target.owner];
    const [history, currentNavies, core, galaxyTopTier] = await Promise.all([
      tx.select().from(honorObservations).where(and(eq(honorObservations.seasonId, owner.seasonId), inArray(honorObservations.playerId, ids))),
      Promise.all(ids.map(id => ownedHonorNavy(tx, id, config))),
      tx.select({ owner: planets.controllerPlayerId, level: buildings.level }).from(buildings)
        .innerJoin(planets, eq(planets.id, buildings.planetId)).where(and(eq(buildings.type, 'CORE'), inArray(planets.controllerPlayerId, ids))),
      honorGalaxyTopTier(tx, owner.seasonId, now, adminUsernames),
    ]);
    const references = ids.map((id, index) => {
      const rows = history.filter(row => row.playerId === id && row.at <= now);
      if (rows.length === 0) throw new Error('Missing Honor reference history');
      const navy = currentNavies[index]!;
      const tier = coreTier(Math.max(1, ...core.filter(row => row.owner === id).map(row => row.level)));
      // The present state is a read-only sample. Any subsequent launch freezes its own authoritative snapshot.
      return honorReferenceAt([...rows.map(row => ({ at: row.at.getTime(), order: row.id, navy: row.navy, coreTier: row.coreTier })),
        { at: now.getTime(), order: Math.max(0, ...rows.map(row => row.id)) + 1, navy, coreTier: tier }], now.getTime());
    });
    const [own, enemy] = references;
    if (!own || !enemy) throw new Error('Missing Honor preview reference');
    const comparison = honorChallenge({ ownTier: own.tier, ownNavy: own.navy, enemyTier: enemy.tier, enemyNavy: enemy.navy, galaxyTopTier, weakNavyBand: 75 });
    const relationships = await readHonorRelations(tx, { seasonId: owner.seasonId, attack: [playerId], defence: [target.owner], at: now, adminUsernames });
    if (!relationships.eligible) return { enabled: true as const, eligible: false as const };
    const state = honorStateSchema.parse(config.state), since = now.getTime() - HONOR_HISTORY_HOURS * 3_600_000;
    return { enabled: true as const, eligible: true as const, kind: comparison.kind,
      ...(own.tier === galaxyTopTier && enemy.tier === own.tier - 1 ? { topTierPeer: true as const } : {}),
      retaliationLootPercent: config.retaliationLootPercent,
      soloCredit: isSupportedHonorVersion(config.version) && honorSoloCredit(config.version),
      militaryReturn: comparison.gainFactor === 0 ? 'NONE' as const : comparison.gainFactor === 500_000 ? 'HALF' as const : 'FULL' as const,
      related: relationships.relations.some(row => row.related),
      repeated: state.pairs.some(pair => honorPairKey(pair.a, pair.b) === honorPairKey(playerId, target.owner!) && pair.raw > 0),
      // A grant only neutralises a weak-target sanction; elsewhere it changes nothing.
      retaliation: comparison.kind === 'WEAK' && state.retaliations.some(grant => grant.holder === playerId && grant.opponent === target.owner
        && grant.at > since && grant.at <= now.getTime() && grant.remaining > 0),
    };
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
}
