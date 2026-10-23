import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { fogToBlack, glowMaterial } from '../../src/arena/render/materials.js';

/**
 * Owner 2026-10-22: from inside a dust cloud, the farm rock in another cloud showed blue
 * squares. An additive sprite mixed towards the fog colour lights its whole quad; in fog an
 * additive glow has to fade to nothing (black) instead.
 */
describe('additive glow in fog', () => {
  it('fades to black, never to the fog colour', () => {
    const shader = fogToBlack(`void main() {\n#include <fog_fragment>\n}`);
    expect(shader).not.toContain('#include <fog_fragment>');
    expect(shader).not.toContain('fogColor');
    expect(shader).toContain('fogFactor');
    expect(shader).toContain('1.0 - fogFactor');
  });

  it('applies to every glow sprite', () => {
    const material = glowMaterial(undefined, '#ffffff');
    expect(material.fog).toBe(true);
    expect(material.customProgramCacheKey()).toContain('fog-black');
    expect(new THREE.SpriteMaterial().customProgramCacheKey()).not.toContain('fog-black');
  });
});
