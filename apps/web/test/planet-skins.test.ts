import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { PLANET_SKIN_IDS } from '@astera/rules';
import { planetSkinVisual, partitionPlanetSkins } from '../src/ui/planetSkins.js';
import { createPlanetSkinMaterial } from '../src/galaxy/planetSkinMaterial.js';
import { maskOpaquePlanetBillboard } from '../src/galaxy/planetBillboardMaterial.js';
import * as THREE from 'three';
import {
  planetSkinBillboardVisible,
  planetSkinLod,
  unitPlanetGeometry,
} from '../src/galaxy/PlanetSkinModel.js';
import { galaxySchema, skinCollectionSchema } from '../src/api/schemas.js';
import { PLANET_SKIN_CATALOG } from '../src/ui/skinCatalog.js';

const served = (url: string): string => resolve(process.cwd(), 'public', url.replace(/^\//, ''));

const geometrySchema = z.object({
  accessors: z.array(z.object({ count: z.number() })),
  meshes: z.array(z.object({
    primitives: z.array(z.object({
      indices: z.number().optional(),
      attributes: z.object({ POSITION: z.number() }),
    })),
  })),
});

const glbTriangles = (binary: Buffer): number => {
  const jsonLength = binary.readUInt32LE(12);
  const gltf = geometrySchema.parse(JSON.parse(binary.toString('utf8', 20, 20 + jsonLength)));
  return gltf.meshes.reduce((total, mesh) => total + mesh.primitives.reduce((sum, primitive) => {
    const accessor = gltf.accessors[primitive.indices ?? primitive.attributes.POSITION];
    return sum + (accessor?.count ?? 0) / 3;
  }, 0), 0);
};

describe('first planet skin visuals', () => {
  it('starts full and low planet requests together instead of waterfalling', () => {
    const source = readFileSync('src/galaxy/PlanetSkinModel.tsx', 'utf8');
    expect(source).toMatch(/useGLTF\(\s*\[visual\.modelUrl, visual\.lowModelUrl\],\s*false,?\s*\)/);
  });

  it('compacts off-screen 3D skin instances before uploading their matrices', () => {
    const source = readFileSync('src/galaxy/PlanetSkinModel.tsx', 'utf8');
    expect(source).toContain('sphereInFrustum(frustum, node.position, node.radius)');
  });

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
      expect(normal?.lowModelUrl).toBe('/assets/models/test_planet_modal_lod.glb');
      expect(struck?.lowModelUrl).toBe('/assets/models/patlamis_gezegen_2_lod.glb');
      expect(normal?.billboardUrl).toBe(PLANET_SKIN_CATALOG[id].image);
      expect(struck?.billboardUrl).toBe(PLANET_SKIN_CATALOG[id].image);
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
        expect(visual?.lowModelUrl).toMatch(/^\/assets\/models\/[a-z0-9_]+\.glb$/);
        const modelPath = served(visual?.modelUrl ?? '');
        const lowModelPath = served(visual?.lowModelUrl ?? '');
        expect(existsSync(modelPath), id).toBe(true);
        expect(existsSync(lowModelPath), id).toBe(true);
        const binary = readFileSync(modelPath);
        const lowBinary = readFileSync(lowModelPath);
        expect(binary.toString('ascii', 0, 4), id).toBe('glTF');
        expect(lowBinary.toString('ascii', 0, 4), id).toBe('glTF');
        expect(statSync(modelPath).size, id).toBeLessThan(256 * 1024);
        expect(statSync(lowModelPath).size, id).toBeLessThan(statSync(modelPath).size);
        expect(glbTriangles(lowBinary), id).toBeLessThan(glbTriangles(binary) / 4);
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
    const cached = unitPlanetGeometry(mesh);
    expect(output.getAttribute('position').array).toBeInstanceOf(Float32Array);
    expect(output.boundingSphere?.center.length()).toBeLessThan(0.001);
    expect(output.boundingSphere?.radius).toBeCloseTo(1);
    expect(cached).toBe(output);
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

  it('moves a skin from full model to low model and finally its PNG billboard', () => {
    expect(planetSkinLod(1, 20)).toBe('full');
    expect(planetSkinLod(1, 40)).toBe('low');
    expect(planetSkinLod(1, 91)).toBe('billboard');
  });

  it('keeps loading fallbacks and the shared far billboard bucket complementary', () => {
    expect(planetSkinBillboardVisible('full', 'near')).toBe(true);
    expect(planetSkinBillboardVisible('low', 'near')).toBe(true);
    expect(planetSkinBillboardVisible('billboard', 'near')).toBe(false);
    expect(planetSkinBillboardVisible('full', 'far')).toBe(false);
    expect(planetSkinBillboardVisible('billboard', 'far')).toBe(true);
    expect(planetSkinBillboardVisible('full', 'all')).toBe(true);
    expect(planetSkinBillboardVisible('billboard', 'all')).toBe(true);
  });

  it('cuts the opaque catalogue preview background away on far billboards', () => {
    const shader = { fragmentShader: '#include <alphatest_fragment>' };
    maskOpaquePlanetBillboard(shader);
    expect(shader.fragmentShader).toContain('skinBillboardRadius');
    expect(shader.fragmentShader).toContain('#include <alphatest_fragment>');
  });
});
