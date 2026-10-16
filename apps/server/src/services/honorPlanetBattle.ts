import { and, eq } from 'drizzle-orm';
import { honorShieldInvestment } from '@astera/rules';
import type { Tx } from '../db/client.js';
import { honorSeasons, satellites } from '../db/schema.js';
import { worldHonorCommitment } from './honorCommitment.js';
import { honorBattleEvidence, type HonorBattleStack } from './honorBattleEvidence.js';
import { deferHonor } from './honorDeferred.js';

/** Evidence stays in the source transaction; the journal runs after its gameplay writes. */
export async function settlePlanetHonor(tx: Tx, input: {
  source: 'WORLD' | 'CLAN_WAR'; seasonId: string; missionId: string;
  hostPlanetId: string; hostPlayerId: string; at: Date; adminUsernames: ReadonlySet<string>;
  attack: readonly HonorBattleStack[]; defence: readonly HonorBattleStack[];
  shieldCapacity: number; shieldAbsorbed: number;
}) {
  const [config] = await tx.select().from(honorSeasons).where(eq(honorSeasons.seasonId, input.seasonId));
  if (!config) return { status: 'DISABLED' as const };
  const commitment = await worldHonorCommitment(tx, { seasonId: input.seasonId, source: input.source,
    missionId: input.missionId, host: input.hostPlayerId,
    supporters: input.defence.filter(row => row.id !== input.hostPlayerId).map(row => row.id),
    adminUsernames: input.adminUsernames, observedAt: input.at });
  // An explicitly recorded pre-activation flight has no launch-time contract.
  if (!commitment) return { status: 'DISABLED' as const };
  const [aegis] = await tx.select({ level: satellites.level }).from(satellites)
    .where(and(eq(satellites.planetId, input.hostPlanetId), eq(satellites.type, 'AEGIS')));
  deferHonor(tx, input.seasonId, honorBattleEvidence({ catalogue: config.catalogue, commitment,
    source: input.source, id: input.missionId, at: input.at.getTime(), attack: input.attack, defence: input.defence,
    shield: { host: input.hostPlayerId, investment: honorShieldInvestment(config.shieldCatalogue, aegis?.level ?? 0),
      capacity: input.shieldCapacity, normalAbsorbed: input.shieldAbsorbed } }));
}
