import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FLEET_V2_ASSET_MANIFEST } from '../src/ui/fleet-v2-assets.js';
import { CRAFT_SCALE } from '../src/galaxy/scene.js';
import { MONUMENT_FOG, MONUMENT_GLOW, MONUMENT_MODELS, MONUMENT_SCALE, monumentModel, monumentModelUrl } from '../src/galaxy/MonumentModel.js';
import { TRADE_SHIP_SCALE } from '../src/galaxy/TradeShip.js';

describe('monument presentation', () => {
  it('maps all five public ordinals to the supplied runtime models', () => {
    expect(MONUMENT_MODELS).toHaveLength(5);
    expect(new Set(MONUMENT_MODELS).size).toBe(5);
    MONUMENT_MODELS.forEach((model, index) => { expect(monumentModelUrl(index + 1)).toBe(model); });
    expect(MONUMENT_MODELS.every((url) => url.startsWith('/assets/models/monuments/'))).toBe(true);
  });

  it.each([0, 6, -1, 1.5, NaN, Infinity])('rejects invalid ordinal %s', (ordinal) => {
    expect(() => monumentModelUrl(ordinal)).toThrow();
  });

  it('draws at three times the public trade ship and exceeds every ordinary hull', () => {
    const largestStrategicShip = 0.34 * CRAFT_SCALE * 3.4;
    expect(MONUMENT_SCALE / TRADE_SHIP_SCALE).toBeCloseTo(3, 9);
    const largestOwnedHull = Math.max(...Object.values(FLEET_V2_ASSET_MANIFEST).map(({ scale }) => scale)) * 0.225 * CRAFT_SCALE;
    expect(MONUMENT_SCALE / largestStrategicShip).toBeGreaterThan(1);
    expect(MONUMENT_SCALE / largestOwnedHull).toBeGreaterThanOrEqual(3);
  });

  it('uses a restrained neon rim colour shared by every monument model', () => {
    expect(MONUMENT_GLOW).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('keeps public landmarks readable at the galaxy-wide zoom', () => {
    expect(MONUMENT_FOG).toBe(false);
  });

  it('preserves all meshes and node transforms while centering and sizing the visible geometry', () => {
    const source = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
    const first = new THREE.Mesh(new THREE.BoxGeometry(65_534, 20_000, 10_000), material);
    first.position.set(-0.8, 0.5, 1.2);
    first.scale.setScalar(0.00004);
    source.add(first);
    const second = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), material);
    second.position.set(3, 1, -1);
    source.add(second);
    source.position.set(17, -9, 6);
    const original = new THREE.Box3().setFromObject(source);

    const model = monumentModel(source);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(MONUMENT_SCALE, 7);
    expect(box.getCenter(new THREE.Vector3()).length()).toBeCloseTo(0, 9);
    let meshes = 0;
    model.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        meshes += 1;
        expect(node.material).toBe(material);
      }
    });
    expect(meshes).toBe(2);
    expect(new THREE.Box3().setFromObject(source).equals(original)).toBe(true);
    expect(material.side).toBe(THREE.DoubleSide);
  });
});
