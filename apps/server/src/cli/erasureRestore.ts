/** Restore under maintenance: preview by default; never removes a world or resolves a flight. */
import { parseArgs } from 'node:util';
import { loadDotEnv, loadEnv } from '../env.js';
import { createDb } from '../db/client.js';
import { readErasureJournal, reapplyErasureJournal } from '../services/erasureJournal.js';

async function main(): Promise<void> {
  const { values } = parseArgs({ options: {
    'journal-dir': { type: 'string' }, apply: { type: 'boolean', default: false },
    'maintenance-confirmed': { type: 'boolean', default: false },
  }, strict: true });
  if (values.apply && !values['maintenance-confirmed']) throw new Error('Writes require --maintenance-confirmed with every API and worker stopped');
  if (!values['journal-dir']) throw new Error('Supply --journal-dir containing the preserved .account-erasure-ledger directory');
  loadDotEnv(); const env = loadEnv();
  const entries = await readErasureJournal({ directory: values['journal-dir'], secret: env.JWT_SECRET });
  const { db, close } = createDb(env.DATABASE_URL, { max: 1 });
  try {
    const result = await reapplyErasureJournal(db, entries, values.apply);
    process.stdout.write(JSON.stringify({ apply: values.apply, markers: entries.length, ...result }) + '\n');
  } finally { await close(); }
}

void main().catch((error: unknown) => {
  process.stderr.write((error instanceof Error ? error.message : 'Erasure restore failed') + '\n');
  process.exitCode = 1;
});
