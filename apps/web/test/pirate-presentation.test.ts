import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CRAFT_SCALE } from '../src/galaxy/scene.js';
import { formationMarkerHitRadius } from '../src/galaxy/Fleets.jsx';

describe('pirate formation presentation', () => {
  const pirateBaseScale = 0.205 * CRAFT_SCALE;

  it('wraps each visible hull in a tight target instead of covering the empty formation rectangle', () => {
    expect(formationMarkerHitRadius('DART', pirateBaseScale)).toBeLessThan(0.45);
    expect(formationMarkerHitRadius('CORSAIR', pirateBaseScale))
      .toBeGreaterThanOrEqual(pirateBaseScale * 2.7 * 0.5);
  });

  it('uses batched per-hull targets and an animated flame bank for pirates', () => {
    const source = readFileSync('src/galaxy/Fleets.tsx', 'utf8');
    expect(source).toContain('<PirateFormationHitTarget');
    expect(source).toContain('name="pirate-formation-hit-targets"');
    expect(source).toContain('<PirateEngineFlames');
    expect(source).toContain('name="pirate-engine-flames"');
    expect(source).toContain('depthTest: false');
  });
});
