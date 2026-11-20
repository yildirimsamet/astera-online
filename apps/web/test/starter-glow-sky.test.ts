import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SKY_GALAXY_MATERIAL } from '../src/galaxy/StarterGlow.js';

describe('the first galaxies in the main sky', () => {
  it('ignore the scene fog: past its far edge a sprite became a flat rectangle of fog colour (owner, 2026-11-20)', () => {
    const material = new THREE.SpriteMaterial(SKY_GALAXY_MATERIAL);
    expect(material.fog).toBe(false);
  });

  it('add light and never hide what is behind them', () => {
    expect(SKY_GALAXY_MATERIAL.blending).toBe(THREE.AdditiveBlending);
    expect(SKY_GALAXY_MATERIAL.depthWrite).toBe(false);
  });
});
