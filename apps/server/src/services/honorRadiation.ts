import { and, eq, inArray } from 'drizzle-orm';
import { HONOR_LAUNCH_VERSION, honorRadiationDamage, type Fleet, type HpDamageLots, type HpRadiationSource,
  type Segment, type TechLevels } from '@astera/rules';
import type { Tx } from '../db/client.js';
import { honorSeasons, hpRadiationSources, radiationBombFlights } from '../db/schema.js';
import { strategicHonorEvidence, strategicHonorIntent } from './honorStrategic.js';
import { deferHonor } from './honorDeferred.js';

/** Same pre-dose inventory and path as the health writer. Its persisted cursor
 * makes each interval unique; the journal caps positive return across the bomb. */
export async function recordRadiationHonor(tx: Tx, input: {
  seasonId: string; victim: string; slice: string; until: Date;
  fleet: Fleet; damage: HpDamageLots | null | undefined; tech: TechLevels;
  segments: readonly Segment[]; sources: readonly HpRadiationSource[];
}) {
  if (!input.sources.some(source => source.origin === 'BOMB')) return;
  const [config] = await tx.select().from(honorSeasons).where(eq(honorSeasons.seasonId, input.seasonId));
  if (config?.version !== HONOR_LAUNCH_VERSION) return;
  const harm = honorRadiationDamage({ ...input, catalogue: config.catalogue });
  if (harm.length === 0) return;
  const bombs = await tx.select({ sourceId: hpRadiationSources.id, flight: radiationBombFlights })
    .from(hpRadiationSources).innerJoin(radiationBombFlights, eq(radiationBombFlights.id, hpRadiationSources.bombFlightId))
    .where(and(eq(hpRadiationSources.seasonId, input.seasonId), inArray(hpRadiationSources.id, harm.map(row => row.id))));
  for (const damage of harm) {
    const bomb = bombs.find(row => row.sourceId === damage.id)?.flight;
    if (!bomb || bomb.ownerPlayerId === input.victim) continue;
    const ready = await strategicHonorIntent(tx, input.seasonId, `bomb:${bomb.id}`);
    if (!ready?.intent.defence.some(row => row.id === input.victim)) continue;
    // A deliberately selected owner keeps their frozen conditions. Newly arriving
    // voluntary holders/support do not retroactively become selected weak victims.
    const intent = ready.intent;
    const id = JSON.stringify(['bomb', bomb.id, input.victim, input.slice,
      input.segments[0]?.startMs, input.until.getTime()]);
    const evidence = strategicHonorEvidence(intent, id, new Date(input.until.getTime() - 1));
    evidence.attackKey = `bomb:${bomb.id}`;
    evidence.tacticalCap = { id: `bomb:${bomb.id}`, limit: 2_500_000 };
    evidence.tactical = [{ actor: bomb.ownerPlayerId, enemy: input.victim,
      base: 0, pressureFifths: 0, radiation: { armedMicros: damage.armedMicros, allMicros: damage.allMicros } }];
    deferHonor(tx, input.seasonId, evidence);
  }
}
