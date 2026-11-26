import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { recordSchemas, type Recorded } from './n1/record.js';
import { replay } from './n1/replay.js';
import { reportsSchema } from '../../web/src/api/schemas.js';

/** OTA F4 (canlı güncelleme planı §5.2): the payloads today's tests parse, read again by the live client's schemas. */
describe('recording what the client parses', () => {
  const capture = () => {
    const lines: Recorded[] = [];
    return { lines, sink: (line: Recorded) => { lines.push(line); } };
  };

  it('records each accepted payload under its module and export, and parses as before', () => {
    const { lines, sink } = capture();
    const wrapped = recordSchemas('schemas', { planetSchema: z.object({ id: z.string() }), HULLS: ['DART'] }, sink);
    expect(wrapped.planetSchema.parse({ id: 'a', extra: 1 })).toEqual({ id: 'a' });
    expect(wrapped.planetSchema.safeParse({ id: 'b' }).success).toBe(true);
    expect(wrapped.HULLS).toEqual(['DART']);
    expect(lines).toEqual([
      { module: 'schemas', name: 'planetSchema', value: { id: 'a', extra: 1 } },
      { module: 'schemas', name: 'planetSchema', value: { id: 'b' } },
    ]);
  });

  it('leaves out what today’s schema refuses and what is not JSON from the wire', () => {
    const { lines, sink } = capture();
    const wrapped = recordSchemas('schemas', { atSchema: z.object({ at: z.coerce.date() }) }, sink);
    expect(() => wrapped.atSchema.parse({ at: 'never' })).toThrow();
    wrapped.atSchema.parse({ at: new Date(0) });
    expect(lines).toEqual([]);
  });

  it('keeps the schema usable for composition', () => {
    const { sink } = capture();
    const wrapped = recordSchemas('schemas', { base: z.object({ id: z.string() }) }, sink);
    expect(wrapped.base.extend({ n: z.number() }).parse({ id: 'a', n: 1 })).toEqual({ id: 'a', n: 1 });
  });
});

describe('replaying with the live client', () => {
  const lines: Recorded[] = [
    { module: 'schemas', name: 'intelSchema', value: { moon: { fleet: 'FEW' } } },
    { module: 'schemas', name: 'intelSchema', value: { moon: { fleet: 'MANY' } } },
    { module: 'schemas', name: 'galaxySchema', value: { moons: [] } },
    { module: 'schemas', name: 'moonScansSchema', value: { scans: [] } },
    { module: 'journeySchemas', name: 'journeySchema', value: {} },
  ];
  const old = {
    schemas: {
      intelSchema: z.object({ moon: z.object({ fleetSize: z.string() }) }),
      galaxySchema: z.object({ moons: z.array(z.unknown()) }),
    },
  };

  it('names each schema the live client cannot read, once per broken field', () => {
    const result = replay(lines, name => old[name as keyof typeof old]);
    expect(result.failures).toEqual([{
      module: 'schemas', name: 'intelSchema', path: 'moon.fleetSize', message: expect.any(String) as string, count: 2,
    }]);
    expect(result.passed).toBe(1);
  });

  it('skips what the live client does not have: it never asks for it', () => {
    const result = replay(lines, name => old[name as keyof typeof old]);
    expect(result.skipped).toEqual(['journeySchemas', 'schemas.moonScansSchema']);
  });
});

/** OTA F4 (§5.3): on a phone a list skips a row it cannot read; a contract test must see that row fail. */
it('server tests read the client lists strictly', () => {
  expect(reportsSchema.safeParse({ reports: [{ kind: 'FROM_A_NEWER_SERVER' }], rivals: [] }).success).toBe(false);
});

/** The live release comes from the network: anything but a full commit stops the tool before it touches anything. */
it.each([['{}'], ['{"version":"main"}'], ['<html>502</html>']])('the N-1 tool refuses a latest.json of %s', body => {
  const stub = `data:text/javascript,globalThis.fetch=async()=>new Response(${JSON.stringify(body)})`;
  const run = spawnSync(process.execPath, ['--import', stub, resolve(import.meta.dirname, '../../../tools/n1-contract.mjs')], { encoding: 'utf8' });
  expect(run.status).not.toBe(0);
  expect(run.stderr).toContain('names no release');
});

/** A module the recording leaves unwrapped is a client the N-1 check never reads. */
it('records every client schema module the server tests import', () => {
  const dir = import.meta.dirname;
  const imported = new Set(readdirSync(dir).filter(name => name.endsWith('.test.ts'))
    .flatMap(name => [...readFileSync(resolve(dir, name), 'utf8').matchAll(/from '\.\.\/\.\.\/web\/src\/api\/(\w*Schemas)\.js'/gu)].map(match => match[1])));
  const setup = readFileSync(resolve(dir, 'n1/record.setup.ts'), 'utf8');
  expect([...imported].filter(module => !setup.includes(`web/src/api/${module ?? ''}.js`))).toEqual([]);
  expect(imported.size).toBeGreaterThan(5);
});
