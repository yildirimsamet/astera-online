import { existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { PLANET_SKIN_IDS } from '@astera/rules';
import { planetSkinVisual, partitionPlanetSkins } from '../src/ui/planetSkins.js';
import {
  createPlanetSkinAttachmentMaterial,
  createCountryRecoveryMaterial,
  createPlanetSkinMaterial,
} from '../src/galaxy/planetSkinMaterial.js';
import { maskOpaquePlanetBillboard } from '../src/galaxy/planetBillboardMaterial.js';
import * as THREE from 'three';
import {
  planetSkinBillboardVisible,
  planetSkinLod,
  unitPlanetGeometry,
} from '../src/galaxy/PlanetSkinModel.js';
import {
  PLANET_SKIN_ATTACHMENT_ASSETS,
  PLANET_SKIN_ATTACHMENT_SCALE_VARIANTS,
  planPlanetSkinAttachments,
  planetSkinAttachmentsVisible,
  planetSurfaceProbes,
  planetSkinRotation,
  resolvePlanetSkinAttachments,
  unitAttachmentGeometry,
} from '../src/galaxy/planetSkinAttachments.js';
import { galaxySchema, skinCollectionSchema } from '../src/api/schemas.js';
import { PLANET_SKIN_CATALOG, SKIN_COLLECTIONS } from '../src/ui/skinCatalog.js';

const served = (url: string): string => resolve(process.cwd(), 'public', url.replace(/^\//, '').replace(/\?.*$/, ''));

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

const glbJson = (binary: Buffer): {
  extensionsRequired?: string[];
  images?: { bufferView?: number; mimeType?: string }[];
  bufferViews?: { buffer?: number; byteLength: number; byteOffset?: number }[];
} => {
  const jsonLength = binary.readUInt32LE(12);
  return JSON.parse(binary.toString('utf8', 20, 20 + jsonLength)) as {
    extensionsRequired?: string[];
    images?: { bufferView?: number; mimeType?: string }[];
    bufferViews?: { buffer?: number; byteLength: number; byteOffset?: number }[];
  };
};

const webpDimensions = (binary: Buffer, offset: number): readonly [number, number] => {
  expect(binary.toString('ascii', offset, offset + 4)).toBe('RIFF');
  expect(binary.toString('ascii', offset + 8, offset + 12)).toBe('WEBP');
  const kind = binary.toString('ascii', offset + 12, offset + 16);
  if (kind === 'VP8X') {
    return [
      1 + binary.readUIntLE(offset + 24, 3),
      1 + binary.readUIntLE(offset + 27, 3),
    ];
  }
  if (kind === 'VP8 ') {
    return [
      binary.readUInt16LE(offset + 26) & 0x3fff,
      binary.readUInt16LE(offset + 28) & 0x3fff,
    ];
  }
  if (kind === 'VP8L') {
    const bits = binary.readUInt32LE(offset + 21);
    return [1 + (bits & 0x3fff), 1 + ((bits >>> 14) & 0x3fff)];
  }
  throw new Error(`Unsupported WebP chunk ${kind}`);
};

describe('first planet skin visuals', () => {
  it('holds a selection card at one planet angle while keeping the live preview in motion', () => {
    const cardStart = planetSkinRotation('shop-preview', 2.5, 0, true);
    expect(planetSkinRotation('shop-preview', 2.5, 5, true)).toBe(cardStart);
    expect(planetSkinRotation('shop-preview', 2.5, 5, false)).not.toBe(cardStart);
  });

  it('places each product in exactly one shop collection', () => {
    expect([...SKIN_COLLECTIONS.elemental.ids, ...SKIN_COLLECTIONS.country.ids]).toEqual(PLANET_SKIN_IDS);
  });

  it('starts full and low planet requests together instead of waterfalling', () => {
    const source = readFileSync('src/galaxy/PlanetSkinModel.tsx', 'utf8');
    expect(source).toMatch(/useGLTF\(\s*\[visual\.modelUrl, visual\.lowModelUrl\],\s*false,?\s*\)/);
  });

  it('compacts off-screen 3D skin instances before uploading their matrices', () => {
    const source = readFileSync('src/galaxy/PlanetSkinModel.tsx', 'utf8');
    expect(source).toContain('sphereInFrustum(frustum, node.position, node.radius)');
  });

  it('serves nine distinct screenshots of the actual looks for selection cards', () => {
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

  it('resolves every elemental skin to the existing palette models and props', () => {
    const rampKeys = new Set<string>();
    for (const id of SKIN_COLLECTIONS.elemental.ids) {
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
        expect(visual?.includedAttachments).toHaveLength(4);
      }
    }
    expect(rampKeys.size).toBe(SKIN_COLLECTIONS.elemental.ids.length);
  });

  it('serves all five authored country globes within mobile geometry and texture budgets', () => {
    for (const country of ['turkey', 'germany', 'france', 'spain', 'japan'] as const) {
      const id = `planet-${country}` as const;
      const visual = planetSkinVisual(id, 'NORMAL');
      expect(visual?.modelUrl).toMatch(new RegExp(`^/assets/models/planets/country/planet_${country}\\.glb\\?v=[0-9a-f]{10}$`));
      expect(visual?.lowModelUrl).toMatch(new RegExp(`^/assets/models/planets/country/planet_${country}-lod\\.glb\\?v=[0-9a-f]{10}$`));
      expect(visual?.billboardUrl).toBe(PLANET_SKIN_CATALOG[id].image);
      expect(visual?.finish.kind).toBe('AUTHORED');
      expect(planetSkinVisual(id, 'RECOVERY_SHIELD')?.modelUrl).toBe(visual?.modelUrl);
      expect(planetSkinVisual(id, 'RECOVERY_SHIELD')?.finish)
        .toEqual({ kind: 'AUTHORED', damaged: true });
      expect(visual?.includedAttachments).toEqual([]);
      for (const [tier, url] of [['full', visual?.modelUrl], ['low', visual?.lowModelUrl]] as const) {
        const path = served(url ?? '');
        expect(existsSync(path), id).toBe(true);
        const binary = readFileSync(path);
        expect(url?.split('?v=')[1], id).toBe(createHash('sha256').update(binary).digest('hex').slice(0, 10));
        const gltf = glbJson(binary);
        expect(gltf.extensionsRequired, id).toContain('EXT_meshopt_compression');
        expect(gltf.images?.every((image) => image.mimeType === 'image/webp'), id).toBe(true);
        const binOffset = 28 + binary.readUInt32LE(12);
        for (const image of gltf.images ?? []) {
          const view = gltf.bufferViews?.[image.bufferView ?? -1];
          expect(view, `${id} ${tier} image`).toBeDefined();
          const [width, height] = webpDimensions(binary, binOffset + (view?.byteOffset ?? 0));
          expect(Math.max(width, height), `${id} ${tier} texture`).toBeLessThanOrEqual(tier === 'full' ? 1024 : 256);
        }
      }
      const full = readFileSync(served(visual?.modelUrl ?? ''));
      const low = readFileSync(served(visual?.lowModelUrl ?? ''));
      expect(full.byteLength, id).toBeLessThan(320 * 1024);
      expect(low.byteLength, id).toBeLessThan(64 * 1024);
      expect(glbTriangles(full), id).toBeLessThanOrEqual(country === 'turkey' ? 6_000 : 3_000);
      expect(glbTriangles(low), id).toBeLessThanOrEqual(country === 'turkey' ? 1_500 : 500);
      const card = readFileSync(served(visual?.billboardUrl ?? ''));
      expect(visual?.billboardUrl.split('?v=')[1], id)
        .toBe(createHash('sha256').update(card).digest('hex').slice(0, 10));
    }
  });

  it('adds visible scars to a struck country world without discarding its flag texture', () => {
    const map = new THREE.Texture();
    const source = new THREE.MeshStandardMaterial({ map });
    const damaged = createCountryRecoveryMaterial(source);
    const shader = { fragmentShader: '#include <map_fragment>\n#include <emissivemap_fragment>' };
    damaged.onBeforeCompile(shader as never, {} as never);
    expect(damaged.map).toBe(map);
    expect(shader.fragmentShader).toContain('countryScar');
    expect(shader.fragmentShader).toContain('totalEmissiveRadiance');
    damaged.dispose();
    source.dispose();
    map.dispose();
  });

  it('keeps palette and country planet bodies opaque when their GLTF material is translucent', () => {
    const source = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.5, depthWrite: false });
    const visual = planetSkinVisual('planet-lava')!;
    if (visual.finish.kind !== 'PALETTE') throw new Error('Expected palette');
    const palette = createPlanetSkinMaterial(source, visual.finish).material;
    const country = createCountryRecoveryMaterial(source);
    for (const material of [palette, country]) {
      expect(material.transparent).toBe(false);
      expect(material.opacity).toBe(1);
      expect(material.depthWrite).toBe(true);
    }
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

  it('pulls authored prop colours toward each planet palette without replacing their textures', () => {
    const map = new THREE.Texture();
    const normalMap = new THREE.Texture();
    const source = new THREE.MeshStandardMaterial({ map, normalMap, roughness: 0.35, metalness: 0.7 });
    const looks = SKIN_COLLECTIONS.elemental.ids.map((id) => planetSkinVisual(id)!.finish);
    const dressed = looks.map((finish) => {
      if (finish.kind !== 'PALETTE') throw new Error('Expected palettes');
      return createPlanetSkinAttachmentMaterial(source, finish);
    });
    expect(new Set(dressed.map(({ material }) => material))).toHaveLength(SKIN_COLLECTIONS.elemental.ids.length);
    expect(new Set(dressed.map(({ material }) => material.color.getHexString())).size)
      .toBe(SKIN_COLLECTIONS.elemental.ids.length);
    for (const { material } of dressed) {
      expect(material.map).toBe(map);
      expect(material.normalMap).toBe(normalMap);
      expect(material.metalness).toBeLessThanOrEqual(0.12);
      expect(material.roughness).toBeGreaterThanOrEqual(0.7);
      expect(material.color.equals(source.color)).toBe(false);
      material.dispose();
    }
    source.dispose();
    map.dispose();
    normalMap.dispose();
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

  it('mounts all sixteen matching low-detail surface assets inside mobile budgets', () => {
    const urls = new Set<string>();
    for (const id of SKIN_COLLECTIONS.elemental.ids) {
      const visual = planetSkinVisual(id, 'NORMAL');
      const assets = resolvePlanetSkinAttachments(visual?.includedAttachments ?? []);
      expect(assets).toHaveLength(4);
      for (const asset of assets) {
        expect(asset.url).toMatch(new RegExp(`^/assets/models/optimized-models-${asset.palette}/.+_low\\.glb$`));
        expect(PLANET_SKIN_ATTACHMENT_ASSETS[asset.assetId]).toBe(asset);
        expect(asset.size, `${asset.assetId} is not a small surface detail`).toBeGreaterThanOrEqual(0.16);
        expect(asset.size, `${asset.assetId} is not a small surface detail`).toBeLessThanOrEqual(0.28);
        expect(urls.has(asset.url), asset.assetId).toBe(false);
        urls.add(asset.url);

        const path = served(asset.url);
        expect(existsSync(path), asset.assetId).toBe(true);
        const binary = readFileSync(path);
        const json = glbJson(binary);
        expect(statSync(path).size, asset.assetId).toBeLessThan(96 * 1024);
        expect(glbTriangles(binary), `${asset.assetId} is too coarse`).toBeGreaterThanOrEqual(1_000);
        expect(glbTriangles(binary), `${asset.assetId} is too dense`).toBeLessThanOrEqual(1_800);
        expect(json.extensionsRequired, asset.assetId).toContain('EXT_meshopt_compression');
        expect(json.extensionsRequired, asset.assetId).not.toContain('KHR_draco_mesh_compression');

        const jsonLength = binary.readUInt32LE(12);
        const binaryChunkOffset = 20 + jsonLength;
        const binaryDataOffset = binaryChunkOffset + 8;
        expect(binary.toString('ascii', binaryChunkOffset + 4, binaryDataOffset)).toBe('BIN\0');
        expect(json.images, asset.assetId).toHaveLength(3);
        for (const image of json.images ?? []) {
          expect(image.mimeType, asset.assetId).toBe('image/webp');
          const view = json.bufferViews?.[image.bufferView ?? -1];
          expect(view, asset.assetId).toBeDefined();
          const dimensions = webpDimensions(binary, binaryDataOffset + (view?.byteOffset ?? 0));
          expect(Math.max(...dimensions), asset.assetId).toBeLessThanOrEqual(256);
        }
      }
    }
    expect(urls.size).toBe(16);
  });

  it('keeps surface geometry on the full model only', () => {
    expect(planetSkinAttachmentsVisible('full')).toBe(true);
    expect(planetSkinAttachmentsVisible('low')).toBe(false);
    expect(planetSkinAttachmentsVisible('billboard')).toBe(false);
  });

  it('normalises authored props onto a centred unit footprint with a grounded base', () => {
    const source = new THREE.BoxGeometry(2, 4, 6);
    source.translate(8, 12, -5);
    const mesh = new THREE.Mesh(source, new THREE.MeshStandardMaterial());
    mesh.scale.set(2, 0.5, 1.5);
    const geometry = unitAttachmentGeometry(mesh);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const span = new THREE.Vector3();
    box.getSize(span);
    expect(box.min.y).toBeCloseTo(0);
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0);
    expect((box.min.z + box.max.z) / 2).toBeCloseTo(0);
    expect(Math.max(span.x, span.y, span.z)).toBeCloseTo(1);
    expect(unitAttachmentGeometry(mesh)).toBe(geometry);
    geometry.dispose();
    source.dispose();
  });

  it('beds twelve deterministic, separated props in three sizes into the real curved surface', () => {
    const planet = new THREE.IcosahedronGeometry(1, 3);
    const probes = planetSurfaceProbes(planet);
    const assets = resolvePlanetSkinAttachments(
      planetSkinVisual('planet-lava')?.includedAttachments ?? [],
    );
    const first = planPlanetSkinAttachments(['world-a', 'world-b'], probes, assets);
    const again = planPlanetSkinAttachments(['world-a', 'world-b'], probes, assets);
    expect(probes.length).toBeGreaterThan(100);
    expect(first).toHaveLength(4);
    expect(first.map((group) => group.placements.length)).toEqual([6, 6, 6, 6]);
    expect(first.map((group) => group.placements.map((placement) => placement.local.toArray())))
      .toEqual(again.map((group) => group.placements.map((placement) => placement.local.toArray())));

    const placements = first.flatMap((group) => group.placements.filter(({ nodeIndex }) => nodeIndex === 0));
    expect(placements).toHaveLength(12);
    const positions = placements.map((placement) => {
      const at = new THREE.Vector3().setFromMatrixPosition(placement.local);
      expect(at.length()).toBeGreaterThan(0.75);
      expect(at.length()).toBeLessThan(1.05);
      return at.normalize();
    });
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        expect(positions[i]!.dot(positions[j]!)).toBeLessThan(0.9);
      }
    }
    for (const group of first) {
      const scales = group.placements
        .filter(({ nodeIndex }) => nodeIndex === 0)
        .map(({ local }) => new THREE.Vector3().setFromMatrixScale(local).x);
      PLANET_SKIN_ATTACHMENT_SCALE_VARIANTS.forEach((variant, index) => {
        expect(scales[index]).toBeCloseTo(group.asset.size * variant);
      });
    }
    expect(first[0]!.placements[0]!.local.toArray()).not.toEqual(first[0]!.placements[3]!.local.toArray());
    planet.dispose();
  });

  it('rejects rays that pass through a fractured opening and hit the far inner shell', () => {
    const openShell = new THREE.SphereGeometry(
      1, 24, 12, 0, Math.PI * 2, Math.PI / 3, Math.PI * 2 / 3,
    );
    const probes = planetSurfaceProbes(openShell);
    expect(probes.length).toBeGreaterThan(40);
    expect(probes.every((probe) => probe.direction.y < 0.58)).toBe(true);
    const assets = resolvePlanetSkinAttachments(
      planetSkinVisual('planet-lava')?.includedAttachments ?? [],
    );
    const plans = planPlanetSkinAttachments(['struck-world'], probes, assets, {
      fractureClearance: 0.45,
      avoidFractureHemisphere: true,
    });
    expect(plans.every((plan) => plan.placements.length === 3)).toBe(true);
    for (const plan of plans) {
      const at = new THREE.Vector3().setFromMatrixPosition(plan.placements[0]!.local).normalize();
      expect(at.y).toBeLessThan(-0.2);
    }
    openShell.dispose();
  });

  it('recognises a deep shattered cavity even when every ray still hits geometry', () => {
    const cratered = new THREE.SphereGeometry(1, 32, 20);
    const positions = cratered.getAttribute('position');
    const point = new THREE.Vector3();
    for (let index = 0; index < positions.count; index++) {
      point.fromBufferAttribute(positions, index);
      if (point.z > 0.15) point.multiplyScalar(0.52 + Math.max(0, point.z) * 0.12);
      positions.setXYZ(index, point.x, point.y, point.z);
    }
    positions.needsUpdate = true;
    cratered.computeVertexNormals();
    const probes = planetSurfaceProbes(cratered);
    expect(probes.length).toBeGreaterThan(300);
    const assets = resolvePlanetSkinAttachments(
      planetSkinVisual('planet-ice')?.includedAttachments ?? [],
    );
    const plans = planPlanetSkinAttachments(['cratered-world'], probes, assets, {
      fractureClearance: 0.45,
      avoidFractureHemisphere: true,
    });
    expect(plans.every((plan) => plan.placements.length === 3)).toBe(true);
    for (const plan of plans) {
      for (const placement of plan.placements) {
        const at = new THREE.Vector3().setFromMatrixPosition(placement.local).normalize();
        expect(at.z).toBeLessThan(-0.2);
      }
    }
    cratered.dispose();
  });

  it('loads surface props behind their own non-blocking boundary', () => {
    const source = readFileSync('src/galaxy/PlanetSkinModel.tsx', 'utf8');
    expect(source).toContain('<PlanetSkinAttachments');
    expect(source).toMatch(/<SkinAssetBoundary fallback=\{null\}>\s*<Suspense fallback=\{null\}>/);
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
