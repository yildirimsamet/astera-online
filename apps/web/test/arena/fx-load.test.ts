import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ARENA_FX, fxToLoad } from '../../src/arena/assets/load.js';

/**
 * The pack ships 41 effect textures and the arena draws 14 (measured 2026-10-22). Loading the
 * rest held GPU memory on phones for nothing — the exit portal's 8×8 flip-book among them,
 * which went with the ring (owner 2026-10-22: the exit is a dock, not a ring).
 */
const SOURCE = join(__dirname, '../../src/arena');
const files = (dir: string): string[] => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
});

describe('effect textures', () => {
  it('lists every effect the arena code asks for', () => {
    const asked = new Set<string>();
    for (const file of files(SOURCE)) for (const match of readFileSync(file, 'utf8').matchAll(/fx\.get\('([^']+)'\)/g)) asked.add(match[1] ?? '');
    expect(asked.size).toBeGreaterThan(5);
    for (const key of asked) expect(ARENA_FX).toContain(key);
  });

  it('loads only those: not the portal flip-book, not the unused rest', () => {
    const pack = { portalEnergy: '/__ref/p.webp', laserBlue: '/__ref/l.webp', lensRing: '/__ref/r.webp', glowDot: '/__ref/g.webp' };
    expect(fxToLoad(pack)).toEqual([['laserBlue', '/__ref/l.webp'], ['glowDot', '/__ref/g.webp']]);
  });
});
