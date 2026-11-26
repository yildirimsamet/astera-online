import { appendFileSync } from 'node:fs';
import { vi } from 'vitest';
import type { Recorded } from './record.js';

/*
  OTA F4, N-1 recording (vitest.n1.config.ts only): every client schema module the server tests import
  writes the payloads it accepted to ASTERA_N1_RECORD, one JSON line each. tools/n1-contract.mjs reads them
  again with the live client's schemas.
*/
const out = process.env.ASTERA_N1_RECORD;
if (!out) throw new Error('ASTERA_N1_RECORD names the file the N-1 recording writes to');
const sink = (line: Recorded): void => { appendFileSync(out, `${JSON.stringify(line)}\n`); };
const wrap = async (module: string, load: () => Promise<Record<string, unknown>>) =>
  (await import('./record.js')).recordSchemas(module, await load(), sink);

vi.mock('../../../web/src/api/schemas.js', async (load: () => Promise<Record<string, unknown>>) => wrap('schemas', load));
vi.mock('../../../web/src/api/legacySchemas.js', async (load: () => Promise<Record<string, unknown>>) => wrap('legacySchemas', load));
vi.mock('../../../web/src/api/adminSchemas.js', async (load: () => Promise<Record<string, unknown>>) => wrap('adminSchemas', load));
vi.mock('../../../web/src/api/battleReplaySchemas.js', async (load: () => Promise<Record<string, unknown>>) => wrap('battleReplaySchemas', load));
vi.mock('../../../web/src/api/starterSchemas.js', async (load: () => Promise<Record<string, unknown>>) => wrap('starterSchemas', load));
vi.mock('../../../web/src/api/journeySchemas.js', async (load: () => Promise<Record<string, unknown>>) => wrap('journeySchemas', load));
vi.mock('../../../web/src/api/analyticsSchemas.js', async (load: () => Promise<Record<string, unknown>>) => wrap('analyticsSchemas', load));
vi.mock('../../../web/src/api/analyticsAdminSchemas.js', async (load: () => Promise<Record<string, unknown>>) => wrap('analyticsAdminSchemas', load));
