import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
  OWNER, 2026-10-20: "Performans düşmanı yanlış kullanım bad practice'ler var mı incele".

  Three draws a transparent DoubleSide material in two passes — back faces, then front — and
  marks the material `needsUpdate` twice a frame to do it, which re-checks its program every
  frame. That ordering exists for blended surfaces that cover each other. Additive light does
  not care what order it is added in, so for it the second pass is pure cost: the Aegis domes,
  the dust clouds and the sky layers paid it on every frame.
*/
const galaxy = resolve(__dirname, '../src/galaxy');
const WINDOW = 10;

function additiveDoubleSided(): { file: string; line: number; singlePass: boolean }[] {
  const found: { file: string; line: number; singlePass: boolean }[] = [];
  for (const file of readdirSync(galaxy).filter((name) => /\.tsx?$/.test(name))) {
    const lines = readFileSync(resolve(galaxy, file), 'utf8').split('\n');
    lines.forEach((text, index) => {
      if (!/side[:=]\s*\{?\s*(THREE\.)?DoubleSide/.test(text)) return;
      const around = lines.slice(Math.max(0, index - WINDOW), index + WINDOW + 1).join('\n');
      if (!around.includes('AdditiveBlending')) return;
      found.push({ file, line: index + 1, singlePass: around.includes('forceSinglePass') });
    });
  }
  return found;
}

describe('additive light is added once', () => {
  it('finds the additive double-sided materials it guards', () => {
    expect(additiveDoubleSided().length).toBeGreaterThanOrEqual(6);
  });

  it('draws every additive double-sided material in a single pass', () => {
    expect(additiveDoubleSided().filter((row) => !row.singlePass)).toEqual([]);
  });
});
