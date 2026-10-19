import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { chatMediaAssets, mediaDeletionQueue } from '../db/schema.js';

/** File removal happens only after the owning account transaction has committed. */
export async function processMediaDeletionQueue(db: Db, directory: string, requestId?: string) {
  return db.transaction(async tx => {
    const rows = await tx.select().from(mediaDeletionQueue).where(and(
      requestId ? eq(mediaDeletionQueue.requestId, requestId) : undefined,
      sql`not exists (select 1 from ${chatMediaAssets} where ${chatMediaAssets.id} = ${mediaDeletionQueue.assetId})`,
    )).orderBy(asc(mediaDeletionQueue.createdAt), asc(mediaDeletionQueue.assetId)).limit(32).for('update', { skipLocked: true });
    let removed = 0; let deferred = 0;
    for (const row of rows) {
      try { await unlink(join(directory, row.assetId)); }
      catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) { deferred++; continue; }
      }
      // If this DB commit fails, the retained row retries an already absent file safely.
      await tx.delete(mediaDeletionQueue).where(eq(mediaDeletionQueue.assetId, row.assetId));
      removed++;
    }
    return { removed, deferred };
  });
}
