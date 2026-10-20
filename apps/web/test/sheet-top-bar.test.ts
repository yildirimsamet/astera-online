import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '../src');
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? files(join(dir, entry.name)) : /\.tsx?$/.test(entry.name) ? [join(dir, entry.name)] : []);

/** Owner 2026-10-20: every sheet stops at the top bar's foot; none may zero that ceiling. */
describe('the ceiling every sheet shares', () => {
  it('no game surface resets the top bar offset to the screen top', () => {
    const offenders = files(SRC).filter(path => !path.includes('/gallery/'))
      .filter(path => /--v2-top-h:\s*0px|'--v2-top-h':\s*'0px'/.test(readFileSync(path, 'utf8')))
      .map(path => relative(SRC, path));
    expect(offenders).toEqual([]);
  });
});
