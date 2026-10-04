import { and, eq, isNull } from 'drizzle-orm';
import type { Tx } from '../db/client.js';
import { clanMemberships, clanWarOperations, monumentWaves } from '../db/schema.js';
import { publishPrivate } from '../stream/bus.js';

/** Handoff releases preparation at arrival/loss; native HOLD/returns own the ships thereafter. */
export async function completeMonumentJoint(tx: Tx, operationId: string | null, at: Date): Promise<void> {
  if (operationId === null) return;
  const [flying] = await tx.select({ id: monumentWaves.id }).from(monumentWaves)
    .where(and(eq(monumentWaves.jointOperationId, operationId), eq(monumentWaves.status, 'OUTBOUND'))).limit(1);
  if (flying) return;
  const [operation] = await tx.update(clanWarOperations).set({ status: 'COMPLETED', closeReason: 'MONUMENT', resolvedAt: at, completedAt: at })
    .where(and(eq(clanWarOperations.id, operationId), eq(clanWarOperations.targetKind, 'MONUMENT'), eq(clanWarOperations.status, 'ATTACKING'))).returning();
  if (!operation) return;
  const members = await tx.select({ playerId: clanMemberships.playerId }).from(clanMemberships)
    .where(and(eq(clanMemberships.clanId, operation.clanId), isNull(clanMemberships.leftAt)));
  for (const member of members) await publishPrivate(tx, member.playerId, 'war');
}
