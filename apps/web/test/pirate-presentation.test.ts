import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('pirate formation presentation', () => {
  it('uses batched per-hull targets and an animated flame bank for pirates', () => {
    const source = readFileSync('src/galaxy/Fleets.tsx', 'utf8');
    expect(source).toContain('<CraftHitTargets');
    expect(source).toContain('bounds={pickBounds}');
    expect(source).toContain('onPointerUp={pickContact}');
    expect(source).not.toContain('formationHitBox');
    expect(source).toContain('<PirateEngineFlames');
    expect(source).toContain('name="pirate-engine-flames"');
  });
});
