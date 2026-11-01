import { parseArgs } from 'node:util';
import { z } from 'zod';
import { createDb } from '../db/client.js';
import { assertSchemaCurrent } from '../db/migrate.js';
import { loadDotEnv, loadEnv } from '../env.js';
import { backfillLegacyBatch } from '../services/legacyArchive.js';
import { bootstrapLegacyBatch } from '../services/legacyBootstrap.js';
import { systemClock } from '../clock.js';

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({ allowPositionals: true, strict: true, options: {
    help: { type: 'boolean', default: false }, apply: { type: 'boolean', default: false },
    limit: { type: 'string', default: '12' }, cursor: { type: 'string' },
    scope: { type: 'string' }, all: { type: 'boolean', default: false },
  } });
  if (values.help) {
    console.log('legacy backfill [--limit 1..24] [--cursor UUID] [--apply] [--all]\nlegacy bootstrap --scope players|accounts [--limit 1..24] [--cursor UUID] [--apply] [--all]\nDefault: preview only, every change is rolled back. --apply commits each bounded batch. --all follows the final cursor.');
    return;
  }
  if (positionals.length !== 1 || !['backfill', 'bootstrap'].includes(positionals[0]!)) throw new Error('Unknown legacy command. Use --help.');
  const scope = positionals[0] === 'bootstrap' ? z.enum(['players', 'accounts']).parse(values.scope) : null;
  if (positionals[0] === 'backfill' && values.scope !== undefined) throw new Error('--scope belongs to bootstrap.');
  const input = z.object({ limit: z.coerce.number().int().min(1).max(24), cursor: z.string().uuid().optional(),
    apply: z.boolean() }).parse(values);
  loadDotEnv();
  const env = loadEnv();
  const { db, close } = createDb(env.DATABASE_URL, { applicationName: 'astera-legacy-backfill', max: 2 });
  try {
    await assertSchemaCurrent(db);
    let cursor = input.cursor;
    do {
      const page = { limit: input.limit, apply: input.apply, at: systemClock.now(), ...(cursor ? { cursor } : {}) };
      const result = scope === null ? await backfillLegacyBatch(db, page) : await bootstrapLegacyBatch(db, { ...page, scope });
      console.log(JSON.stringify({ mode: input.apply ? 'APPLIED' : 'PREVIEW', ...(scope ? { scope } : {}), ...result }));
      cursor = result.nextCursor ?? undefined;
    } while (values.all && cursor);
  } finally { await close(); }
}

try { await main(); }
catch (error) {
  console.error(error instanceof Error ? error.message : 'Legacy operation failed');
  process.exitCode = 1;
}
