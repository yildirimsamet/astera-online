import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * NO ROUND SOFT GLOW, NO GROWING HALO (owner 2026-11-18): "Hiç bir yerde, hiç bir zaman kullanılmamasını
 * istiyorum." A white radial gradient on a camera-facing quad fits anywhere and so says nothing. Every
 * effect is the event's own (CLAUDE.md, VFX briefi). The uses that were there when the rule came are
 * listed here and are being replaced: this list only ever shrinks, and nothing new joins it.
 */
const SRC = join(import.meta.dirname, '../src');
const STILL_TO_REPLACE: Readonly<Record<string, { softGlow?: number; radial?: number }>> = {
  'galaxy/Environment.tsx': { softGlow: 1, radial: 2 },
  'galaxy/JumpingShip.tsx': { softGlow: 2 },
  'galaxy/JumpWatch.tsx': { softGlow: 1 },
  'galaxy/PlanetField.tsx': { softGlow: 2 },
  'galaxy/StarterGlow.tsx': { softGlow: 1 },
  'landing/LandingScene.tsx': { softGlow: 1 },
  'starter/StarterPreview.tsx': { softGlow: 1 },
  'arena/hangar/shipModels.ts': { radial: 1 },
  'galaxy/PlanetEmbers.tsx': { radial: 1 },
  'galaxy/SpaceLighting.tsx': { radial: 2 },
  'galaxy/UniverseBalls.tsx': { radial: 1 },
  'galaxy/vfx.ts': { radial: 1 },
  'legacy/AwardScene.tsx': { radial: 1 },
  'legacy/procedural.ts': { radial: 2 },
};

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/u.test(name) ? [path] : [];
  });
}

describe('the round soft glow', () => {
  const found = sources(SRC).flatMap((path) => {
    const text = readFileSync(path, 'utf8');
    const softGlow = (text.match(/softGlow\(/gu) ?? []).length;
    const radial = (text.match(/createRadialGradient\(/gu) ?? []).length;
    if (softGlow === 0 && radial === 0) return [];
    return [{ file: relative(SRC, path).split(sep).join('/'), softGlow, radial }];
  });

  it('is used nowhere new: every effect is the event\'s own', () => {
    const added = found.filter(({ file, softGlow, radial }) => {
      const known = STILL_TO_REPLACE[file];
      return softGlow > (known?.softGlow ?? 0) || radial > (known?.radial ?? 0);
    });
    expect(added, 'a round soft glow was added: build the event\'s own effect from the library (CLAUDE.md, VFX briefi)').toEqual([]);
  });

  it('keeps its list of uses still to replace honest: a replaced one leaves the list', () => {
    const stale = Object.entries(STILL_TO_REPLACE).filter(([file, known]) => {
      const now = found.find(entry => entry.file === file);
      return (now?.softGlow ?? 0) < (known.softGlow ?? 0) || (now?.radial ?? 0) < (known.radial ?? 0);
    }).map(([file]) => file);
    expect(stale, 'lower these counts in STILL_TO_REPLACE').toEqual([]);
  });
});
