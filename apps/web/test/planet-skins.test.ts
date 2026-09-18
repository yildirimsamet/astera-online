import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { PLANET_SKIN_IDS } from '@astera/rules';
import { planetSkinVisual, partitionPlanetSkins } from '../src/ui/planetSkins.js';
import { createPlanetSkinMaterial } from '../src/galaxy/planetSkinMaterial.js';
import * as THREE from 'three';
import { unitPlanetGeometry } from '../src/galaxy/PlanetSkinModel.js';
import { galaxySchema, skinCollectionSchema } from '../src/api/schemas.js';
import { PLANET_SKIN_CATALOG } from '../src/ui/skinCatalog.js';

const served = (url: string): string => resolve(process.cwd(), 'public', url.replace(/^\//, ''));

describe('first planet skin visuals', () => {
  it('serves four distinct screenshots of the actual looks for selection cards', () => {
    const images = PLANET_SKIN_IDS.map((id) => {
      const path = served(PLANET_SKIN_CATALOG[id].image);
      expect(existsSync(path), id).toBe(true);
      const png = readFileSync(path);
      expect(png.subarray(0, 8).toString('hex'), id).toBe('89504e470d0a1a0a');
      expect(png.readUInt32BE(16), id).toBeGreaterThanOrEqual(300);
      expect(png.readUInt32BE(20), id).toBeGreaterThanOrEqual(250);
      expect(png.byteLength, id).toBeGreaterThan(30_000);
      return png.toString('base64');
    });
    expect(new Set(images).size).toBe(PLANET_SKIN_IDS.length);
  });

  it('resolves every catalogue skin to a served, optimised GLB and its own finish', () => {
    const rampKeys = new Set<string>();
    for (const id of PLANET_SKIN_IDS) {
      const normal = planetSkinVisual(id, 'NORMAL');
      const struck = planetSkinVisual(id, 'RECOVERY_SHIELD');
      expect(normal?.modelUrl).toBe('/assets/models/test_planet_modal.glb');
      expect(struck?.modelUrl).toBe('/assets/models/patlamis_gezegen_2.glb');
      expect(struck?.finish.kind).toBe('PALETTE');
      if (normal?.finish.kind === 'PALETTE' && struck?.finish.kind === 'PALETTE') {
        expect(struck.finish.palette).toEqual(normal.finish.palette);
        expect(normal.finish.tuning.threshold).toBe(0.28);
        expect(struck.finish.tuning.threshold).toBe(0.5);
        expect(normal.finish.tuning.heat).toBe(id === 'planet-desert' ? 0 : 2.4);
        expect(struck.finish.tuning.heat).toBe(id === 'planet-desert' ? 0 : 1.6);
      }
      for (const visual of [normal, struck]) {
        expect(visual?.modelUrl).toMatch(/^\/assets\/models\/[a-z0-9_]+\.glb$/);
        const modelPath = served(visual?.modelUrl ?? '');
        expect(existsSync(modelPath), id).toBe(true);
        const binary = readFileSync(modelPath);
        expect(binary.toString('ascii', 0, 4), id).toBe('glTF');
        expect(statSync(modelPath).size, id).toBeLessThan(256 * 1024);
        const jsonLength = binary.readUInt32LE(12);
        const gltf = z.object({
          extensionsUsed: z.array(z.string()).optional(),
          materials: z.array(z.object({
            pbrMetallicRoughness: z.object({
              baseColorTexture: z.object({ index: z.number() }).optional(),
            }).optional(),
          })).optional(),
        }).parse(JSON.parse(binary.toString('utf8', 20, 20 + jsonLength)));
        expect(gltf.extensionsUsed, id).toContain('EXT_meshopt_compression');
        expect(gltf.materials?.[0]?.pbrMetallicRoughness?.baseColorTexture, id).toBeDefined();
        expect(visual?.finish.kind).toBe('PALETTE');
        if (visual?.finish.kind === 'PALETTE') {
          rampKeys.add(JSON.stringify(visual.finish.palette.ramp));
        }
        expect(visual?.includedAttachments).toEqual([]);
      }
    }
    expect(rampKeys.size).toBe(PLANET_SKIN_IDS.length);
  });

  it('falls back cleanly when a stale or forged skin id is received', () => {
    expect(planetSkinVisual('planet-unknown', 'NORMAL')).toBeNull();
    expect(planetSkinVisual('__proto__', 'RECOVERY_SHIELD')).toBeNull();
  });

  it('keeps PNG worlds while grouping mixed skins and statuses independently', () => {
    const nodes = [
      { id: 'plain' },
      { id: 'lava-a', skin: { id: 'planet-lava', status: 'NORMAL' as const } },
      { id: 'ice', skin: { id: 'planet-ice', status: 'NORMAL' as const } },
      { id: 'lava-b', skin: { id: 'planet-lava', status: 'RECOVERY_SHIELD' as const } },
      { id: 'stale', skin: { id: 'removed', status: 'NORMAL' as const } },
    ];
    const groups = partitionPlanetSkins(nodes);
    expect(groups.png.map((node) => node.id)).toEqual(['plain', 'stale']);
    expect(groups.models.map((group) => [group.skinId, group.status, group.nodes.map((n) => n.id)]))
      .toEqual([
        ['planet-lava', 'NORMAL', ['lava-a']],
        ['planet-ice', 'NORMAL', ['ice']],
        ['planet-lava', 'RECOVERY_SHIELD', ['lava-b']],
      ]);
  });

  it('isolates palette shader uniforms for different skins in one scene', () => {
    const source = new THREE.MeshStandardMaterial();
    const lava = planetSkinVisual('planet-lava')!;
    const ice = planetSkinVisual('planet-ice')!;
    if (lava.finish.kind !== 'PALETTE' || ice.finish.kind !== 'PALETTE') throw new Error('Expected palettes');
    const hot = createPlanetSkinMaterial(source, lava.finish);
    const cold = createPlanetSkinMaterial(source, ice.finish);
    expect(hot.material).not.toBe(cold.material);
    expect(hot.uniforms).not.toBe(cold.uniforms);
    expect(hot.uniforms.ramp0.value).not.toEqual(cold.uniforms.ramp0.value);
    hot.uniforms.time.value = 10;
    expect(cold.uniforms.time.value).toBe(0);
    hot.material.dispose();
    cold.material.dispose();
    source.dispose();
  });

  it('dequantises and centres the compressed GLB geometry before world scaling', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Uint16Array([
      0, 0, 0, 65535, 0, 0, 0, 65535, 0,
    ]), 3, true));
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    mesh.scale.setScalar(10);
    const output = unitPlanetGeometry(mesh);
    expect(output.getAttribute('position').array).toBeInstanceOf(Float32Array);
    expect(output.boundingSphere?.center.length()).toBeLessThan(0.001);
    expect(output.boundingSphere?.radius).toBeCloseTo(1);
    output.dispose();
    geometry.dispose();
  });

  it('validates owned products and planet choices at the API boundary', () => {
    expect(skinCollectionSchema.parse({
      ownedSkinIds: ['planet-lava'],
      planets: [{ id: 'world-1', name: 'Ember', skinId: 'planet-lava' }],
    }).planets[0]?.skinId).toBe('planet-lava');
    expect(skinCollectionSchema.safeParse({ ownedSkinIds: ['__proto__'], planets: [] }).success).toBe(false);
  });

  it('keeps an unknown future galaxy skin on the PNG fallback path', () => {
    const world = galaxySchema.shape.planets.element.parse({
      id: 'world-1',
      position: { x: 0, y: 0, z: 0 },
      isSelf: false,
      skin: { id: 'planet-future', status: 'NORMAL' },
    });
    expect(partitionPlanetSkins([world]).png).toHaveLength(1);
  });
});
