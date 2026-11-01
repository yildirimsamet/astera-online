import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { awardStudioRoom } from '../src/legacy/studio.js';

describe('award reflection room', () => {
  it('keeps a neutral darker surround and bright reflection panels without a live shadow pass', () => {
    const room = awardStudioRoom();
    let surfaces = 0, panels = 0;
    room.traverse(object => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
      if (object.material instanceof THREE.MeshStandardMaterial) {
        const luminance = object.material.color.getRGB(new THREE.Color());
        expect(Math.max(luminance.r, luminance.g, luminance.b)).toBeLessThan(0.5);
        surfaces++;
      } else if (object.material instanceof THREE.MeshLambertMaterial) {
        expect(object.material.emissiveIntensity).toBeGreaterThan(1);
        panels++;
      }
    });
    expect(surfaces).toBeGreaterThan(0);
    expect(panels).toBeGreaterThan(1);
    expect(room.children.some(object => object instanceof THREE.Light && object.castShadow)).toBe(false);
    room.dispose();
  });
});
