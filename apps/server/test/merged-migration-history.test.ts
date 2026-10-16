import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { expect, it } from 'vitest';

const directory = resolve('drizzle');
const journal = z.object({ entries: z.array(z.object({ idx: z.number(), when: z.number(), tag: z.string() })) });
const snapshot = z.object({ id: z.string(), prevId: z.string() });

it('keeps deployed migration identities and puts every local step after the live history', () => {
  const { entries } = journal.parse(JSON.parse(readFileSync(resolve(directory, 'meta/_journal.json'), 'utf8')));
  expect(entries.find(entry => entry.idx === 151)).toMatchObject({ tag: '0151_death_star_surface_hits', when: 1791924752284 });
  expect(entries.find(entry => entry.idx === 152)).toMatchObject({ tag: '0152_resource_read_indexes', when: 1791924753284 });
  expect(new Set(entries.map(entry => entry.idx)).size).toBe(entries.length);
  for (let i = 1; i < entries.length; i += 1) expect(entries[i]!.when).toBeGreaterThan(entries[i - 1]!.when);
  expect(entries.filter(entry => entry.tag.endsWith('_death_star_surface_hits'))).toHaveLength(1);
  for (const entry of entries.filter(entry => entry.idx >= 153)) {
    const prefix = String(entry.idx).padStart(4, '0');
    expect(readdirSync(directory).filter(file => file.startsWith(`${prefix}_`) && file.endsWith('.sql'))).toEqual([`${entry.tag}.sql`]);
    const current = snapshot.parse(JSON.parse(readFileSync(resolve(directory, `meta/${prefix}_snapshot.json`), 'utf8')));
    const previous = snapshot.parse(JSON.parse(readFileSync(resolve(directory, `meta/${String(entry.idx - 1).padStart(4, '0')}_snapshot.json`), 'utf8')));
    expect(current.prevId).toBe(previous.id);
  }
});
