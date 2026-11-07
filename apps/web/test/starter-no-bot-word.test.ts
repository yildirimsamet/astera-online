import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '../src/i18n/locales');
const files = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? files(path) : [path];
});

/** Owner, 2026-10-28: no player may ever learn that a commander is played by the server. */
const WORD = /(^|[^\p{L}])(bots?|botlar\p{L}*|botu\p{L}*|botun\p{L}*|ボット|npc)(?=$|[^\p{L}])/iu;

describe('no language calls anyone a machine', () => {
  it.each(files(ROOT).filter(file => !file.endsWith('.d.ts')))('%s', (file) => {
    const strings = [...readFileSync(file, 'utf8').matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/gu)].map(match => match[2]!);
    expect(strings.filter(text => WORD.test(text))).toEqual([]);
  });
});
