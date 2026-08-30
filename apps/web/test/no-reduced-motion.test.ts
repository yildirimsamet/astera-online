import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = resolve(import.meta.dirname, '../src');

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory);
  const files = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry);
    return (await stat(path)).isDirectory() ? sourceFiles(path) : [path];
  }));
  return files.flat().filter((path) => /\.(?:css|ts|tsx)$/.test(path));
}

describe('motion is always enabled', () => {
  it('has no OS reduced-motion query, hook or conditional path anywhere in web source', async () => {
    const forbidden = /prefers-reduced-motion|useReducedMotionPreference|reducedMotion/;
    const offenders: string[] = [];
    for (const path of await sourceFiles(sourceRoot)) {
      if (forbidden.test(await readFile(path, 'utf8'))) offenders.push(path.slice(sourceRoot.length + 1));
    }
    expect(offenders).toEqual([]);
  });
});
