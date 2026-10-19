import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { chmod, lstat, mkdir, open, readdir, readFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client.js';
import { accounts, accountDeletionRequests, adminActions } from '../db/schema.js';
import { GameError } from './planet.js';

export interface ErasureJournalContext { directory: string; secret: string }
const intentSchema = z.object({
  version: z.literal(1), accountHash: z.string().regex(/^[a-f0-9]{64}$/), requestId: z.string().uuid(),
  requestedAt: z.string().datetime(), approvedAt: z.string().datetime(), recordedAt: z.string().datetime(),
  locale: z.enum(['en', 'tr', 'fr', 'de', 'es', 'ja']),
}).strict();
const signedSchema = z.object({ intent: intentSchema, signature: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export type ErasureIntent = z.infer<typeof intentSchema>;
const accountHash = (id: string) => createHash('sha256').update(id).digest('hex');
const signature = (secret: string, intent: ErasureIntent) => createHmac('sha256', secret).update('astera-erasure-intent-v1\0').update(JSON.stringify(intent)).digest();
const journalDirectory = (context: ErasureJournalContext) => join(context.directory, '.account-erasure-ledger');

/** Durable before destructive commit; a rolled-back DB attempt may leave a valid approved intent. */
export async function writeErasureIntent(context: ErasureJournalContext, request: { accountId: string; requestId: string; requestedAt: Date; approvedAt: Date; locale: string }, now: Date): Promise<void> {
  const intent = intentSchema.parse({ version: 1, accountHash: accountHash(request.accountId), requestId: request.requestId,
    requestedAt: request.requestedAt.toISOString(), approvedAt: request.approvedAt.toISOString(), recordedAt: now.toISOString(), locale: request.locale });
  const directory = journalDirectory(context);
  const temporary = join(directory, `.${intent.accountHash}.${randomUUID()}.partial`);
  try {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    if (!(await lstat(directory)).isDirectory() || (await lstat(directory)).isSymbolicLink()) throw new Error('Invalid erasure directory');
    await chmod(directory, 0o700);
    const file = await open(temporary, 'wx', 0o600);
    try { await file.writeFile(JSON.stringify({ intent, signature: signature(context.secret, intent).toString('hex') }) + '\n'); await file.sync(); }
    finally { await file.close(); }
    await rename(temporary, join(directory, `${intent.accountHash}.json`));
    const parent = await open(directory, 'r');
    try { await parent.sync(); } finally { await parent.close(); }
  } catch {
    throw new GameError('DELETION_LEDGER_UNAVAILABLE', 'The private deletion journal is unavailable; retry later', 503);
  } finally { await rm(temporary, { force: true }).catch(() => undefined); }
}

/** A missing, corrupted or wrong-key journal must never be interpreted as an empty history. */
export async function readErasureJournal(context: ErasureJournalContext): Promise<ErasureIntent[]> {
  const directory = journalDirectory(context); const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Invalid erasure directory');
  const names = (await readdir(directory)).filter(name => name.endsWith('.json')).sort();
  if (names.length === 0 || names.length > 100_000) throw new Error('Missing or oversized erasure journal');
  const entries: ErasureIntent[] = []; const requests = new Set<string>();
  for (const name of names) {
    if (!/^[a-f0-9]{64}\.json$/.test(name)) throw new Error('Invalid erasure filename');
    const path = join(directory, name); const file = await lstat(path);
    if (!file.isFile() || file.isSymbolicLink() || file.size > 4096) throw new Error('Invalid erasure file');
    const raw: unknown = JSON.parse(await readFile(path, 'utf8'));
    const parsed = signedSchema.parse(raw);
    if (name !== `${parsed.intent.accountHash}.json` || requests.has(parsed.intent.requestId)
      || !timingSafeEqual(signature(context.secret, parsed.intent), Buffer.from(parsed.signature, 'hex'))) throw new Error('Invalid erasure signature or identity');
    requests.add(parsed.intent.requestId); entries.push(parsed.intent);
  }
  return entries;
}

/** Maintenance restore only: revoke credentials and recreate approved requests, never delete worlds. */
export async function reapplyErasureJournal(db: Db, input: readonly ErasureIntent[], apply: boolean): Promise<{ matched: number; changed: number }> {
  const intents = new Map(z.array(intentSchema).parse(input).map(entry => [entry.accountHash, entry]));
  if (intents.size !== input.length) throw new Error('Duplicate erasure identity');
  return db.transaction(async tx => {
    const rows = await tx.select({ id: accounts.id }).from(accounts).orderBy(accounts.id);
    let matched = 0; let changed = 0;
    for (const row of rows) {
      const intent = intents.get(accountHash(row.id)); if (!intent) continue;
      matched++; if (!apply) continue;
      const [account] = await tx.select().from(accounts).where(eq(accounts.id, row.id)).for('update');
      if (!account) throw new Error('Account changed during restore');
      const [existing] = await tx.select().from(accountDeletionRequests).where(eq(accountDeletionRequests.accountId, account.id)).for('update');
      if (existing && existing.requestId !== intent.requestId) throw new Error('Conflicting deletion request; restore remains closed');
      if (account.deletionApprovedAt && existing?.approvedAt) continue;
      const approvedAt = new Date(intent.approvedAt);
      if (!existing) await tx.insert(accountDeletionRequests).values({ accountId: account.id, requestId: intent.requestId,
        requestedAt: new Date(intent.requestedAt), approvedAt, locale: intent.locale });
      else await tx.update(accountDeletionRequests).set({ approvedAt }).where(eq(accountDeletionRequests.accountId, account.id));
      await tx.update(accounts).set({ deletionApprovedAt: approvedAt, authVersion: account.authVersion + 1 }).where(eq(accounts.id, account.id));
      await tx.insert(adminActions).values({ action: 'ACCOUNT_DELETION_RESTORED', targetAccountId: account.id, details: { requestId: intent.requestId }, createdAt: new Date(intent.recordedAt) });
      changed++;
    }
    return { matched, changed };
  });
}

/** Keep pending accounts protected; completed-account markers outlive the entire backup horizon. */
export async function pruneErasureJournal(db: Db, context: ErasureJournalContext, now: Date): Promise<{ removed: number }> {
  // Once an account is absent, all its transactional journal writers have finished.
  // Reading this first avoids deleting a marker concurrently refreshed by completion.
  const live = new Set((await db.select({ id: accounts.id }).from(accounts)).map(row => accountHash(row.id)));
  let entries: ErasureIntent[];
  try {
    if (!(await readdir(journalDirectory(context))).some(name => name.endsWith('.json'))) return { removed: 0 };
    entries = await readErasureJournal(context);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return { removed: 0 };
    throw error;
  }
  let removed = 0;
  for (const entry of entries) {
    if (live.has(entry.accountHash) || now.getTime() - Date.parse(entry.recordedAt) < 30 * 86_400_000) continue;
    await rm(join(journalDirectory(context), `${entry.accountHash}.json`), { force: true }); removed++;
  }
  return { removed };
}
