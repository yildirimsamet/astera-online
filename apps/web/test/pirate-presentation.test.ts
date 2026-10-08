import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CRAFT_SCALE } from '../src/galaxy/scene.js';
import { formationMarkerHitSize } from '../src/galaxy/Fleets.jsx';

describe('pirate formation presentation', () => {
  const pirateBaseScale = 0.205 * CRAFT_SCALE;

  it('wraps each hull in a narrow elongated box instead of a broad sphere', () => {
    const dart = formationMarkerHitSize('DART', pirateBaseScale);
    const corsair = formationMarkerHitSize('CORSAIR', pirateBaseScale);
    expect(dart[0]).toBeLessThan(dart[2]);
    expect(dart[1]).toBeLessThan(dart[2]);
    expect(dart[0]).toBeLessThan(0.45);
    expect(corsair[2]).toBeGreaterThan(dart[2]);
  });

  it('uses batched per-hull targets and an animated flame bank for pirates', () => {
    const source = readFileSync('src/galaxy/Fleets.tsx', 'utf8');
    expect(source).toContain('<PirateFormationHitTarget');
    expect(source).toContain('name="pirate-formation-hit-targets"');
    expect(source).toContain('<boxGeometry args={[1, 1, 1]} />');
    expect(source).toContain('node.computeBoundingSphere()');
    expect(source).toContain('<PirateEngineFlames');
    expect(source).toContain('name="pirate-engine-flames"');
  });
});
