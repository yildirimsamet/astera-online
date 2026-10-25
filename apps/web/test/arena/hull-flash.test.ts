import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { flashHull } from '../../src/arena/render/ships.js';

/**
 * A confirmed hit flashes the hull warm for a moment. Lit panels and engine glow keep
 * their own colour: the flash used to leave a glowing part orange for the rest of the match.
 */
describe('hull hit flash', () => {
  it('tints the hull during the flash and gives a glowing part its own glow back', () => {
    const panel = new THREE.MeshStandardMaterial({ emissive: '#3cc8ff', emissiveIntensity: 2 });
    const own = panel.emissive.clone();
    flashHull(panel, 0);
    expect(panel.emissive.equals(own)).toBe(true);
    flashHull(panel, 1);
    expect(panel.emissive.equals(own)).toBe(false);
    expect(panel.emissiveIntensity).toBeCloseTo(1.4);
    flashHull(panel, 0);
    expect(panel.emissive.equals(own)).toBe(true);
    expect(panel.emissiveIntensity).toBe(2);
  });

  it('leaves a dark hull dark once the flash is over', () => {
    const plate = new THREE.MeshStandardMaterial();
    flashHull(plate, 0.5);
    flashHull(plate, 0);
    expect(plate.emissive.getHex()).toBe(0);
    expect(plate.emissiveIntensity).toBe(1);
  });
});
