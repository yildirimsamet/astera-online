import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { FLEET_V2_HULLS } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createElement } from 'react';
import * as assets from '../src/ui/assets.js';
import * as preload from '../src/lib/preload.js';
import { HullMark } from '../src/ui/icons/hulls.js';

interface FleetAsset {
  readonly card: string;
  readonly icon: string;
  readonly model: string;
  readonly facing: unknown;
  readonly scale: number;
  readonly pose: {
    readonly rotation: readonly [number, number, number];
    readonly height: number;
  };
  readonly light: { readonly color: string; readonly intensity: number; readonly distance: number };
  readonly trail: { readonly color: string; readonly width: number };
}

const manifest = (assets as unknown as {
  FLEET_V2_ASSET_MANIFEST?: Record<string, FleetAsset>;
}).FLEET_V2_ASSET_MANIFEST;

const served = (url: string): string =>
  resolve(process.cwd(), 'public', url.replace(/^\//, ''));

interface GlbDocument {
  readonly extensionsRequired?: readonly string[];
  readonly materials?: readonly unknown[];
  readonly images?: readonly { readonly mimeType?: string }[];
}

const glbJson = (path: string): GlbDocument => {
  const data = readFileSync(path);
  let offset = 12;
  while (offset < data.length) {
    const length = data.readUInt32LE(offset);
    if (data.toString('ascii', offset + 4, offset + 8).startsWith('JSON')) {
      const parsed: unknown = JSON.parse(data.toString('utf8', offset + 8, offset + 8 + length));
      if (parsed === null || typeof parsed !== 'object') throw new Error(`${path} has invalid JSON`);
      return parsed;
    }
    offset += 8 + length;
  }
  throw new Error(`${path} has no GLB JSON chunk`);
};

describe('Fleet V2 canonical assets', () => {
  it('declares one exhaustive entry for each of the eighteen craftable hulls', () => {
    expect(manifest).toBeDefined();
    expect(Object.keys(manifest ?? {}).sort()).toEqual([...FLEET_V2_HULLS].sort());
  });

  it('uses unique canonical runtime URLs rather than staging spellings', () => {
    const entries = Object.values(manifest ?? {});
    for (const asset of entries) {
      expect(asset.card).toMatch(/^\/assets\/images\/ships\/[a-z0-9-]+\.webp$/);
      expect(asset.icon).toMatch(/^\/assets\/images\/ships\/icons\/[a-z0-9-]+\.webp$/);
      expect(asset.model).toMatch(/^\/assets\/models\/ships\/[a-z0-9-]+\.glb$/);
      expect(`${asset.card} ${asset.icon} ${asset.model}`).not.toMatch(/new_test|shiled|lvl_/i);
    }
    expect(new Set(entries.map(({ card }) => card)).size).toBe(18);
    expect(new Set(entries.map(({ icon }) => icon)).size).toBe(18);
    expect(new Set(entries.map(({ model }) => model)).size).toBe(18);
  });

  it('resolves every canonical render, icon and model inside mobile transfer budgets', () => {
    for (const [id, asset] of Object.entries(manifest ?? {})) {
      for (const [kind, url, minKb, maxKb] of [
        ['card', asset.card, 0, 160],
        ['icon', asset.icon, 0, 40],
        ['model', asset.model, 200, 300],
      ] as const) {
        const path = served(url);
        expect(existsSync(path), `${id} ${kind} is missing: ${url}`).toBe(true);
        if (existsSync(path)) {
          const sizeKb = statSync(path).size / 1024;
          expect(sizeKb, `${id} ${kind} is below ${minKb} KB`).toBeGreaterThanOrEqual(minKb);
          expect(sizeKb, `${id} ${kind} exceeds ${maxKb} KB`).toBeLessThanOrEqual(maxKb);
        }
      }
    }
  });

  it('ships meshopt geometry and three WebP material maps per model', () => {
    for (const [id, asset] of Object.entries(manifest ?? {})) {
      const json = glbJson(served(asset.model));
      expect(json.extensionsRequired, `${id} mesh transport`).toContain('EXT_meshopt_compression');
      expect(json.extensionsRequired, `${id} texture transport`).toContain('EXT_texture_webp');
      expect(json.materials?.length, `${id} material`).toBeGreaterThan(0);
      expect(json.images, `${id} texture count`).toHaveLength(3);
      expect(json.images?.every((image) => image.mimeType === 'image/webp'))
        .toBe(true);
    }
  });

  it('declares usable flight presentation metadata for every hull', () => {
    for (const [id, asset] of Object.entries(manifest ?? {})) {
      expect(asset.facing, `${id} facing`).toBeDefined();
      expect(asset.scale, `${id} scale`).toBeGreaterThan(0);
      expect(asset.light.color, `${id} light color`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(asset.light.intensity, `${id} light intensity`).toBeGreaterThan(0);
      expect(asset.light.distance, `${id} light distance`).toBeGreaterThan(0);
      expect(asset.trail.color, `${id} trail color`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(asset.trail.width, `${id} trail width`).toBeGreaterThan(0);
      expect(asset.pose.rotation, `${id} calibrated rotation`).toHaveLength(3);
      expect(asset.pose.rotation.every(Number.isFinite), `${id} finite rotation`).toBe(true);
      expect(Number.isFinite(asset.pose.height), `${id} finite height`).toBe(true);
    }
  });

  it('pins the owner-approved additive rotation and height calibration', () => {
    expect(Object.fromEntries(Object.entries(manifest ?? {}).map(([id, asset]) => [
      id,
      { ...asset.pose, rotation: [...asset.pose.rotation] },
    ]))).toEqual({
      DART: { rotation: [0, -1, 16], height: 0.17 },
      PIKE: { rotation: [0, 0, 0], height: 0.14 },
      RAMPART: { rotation: [0, 0, 0], height: 0.12 },
      WARDEN: { rotation: [1, 0, 0], height: 0.06 },
      COURIER: { rotation: [0, 0, 0], height: 0.12 },
      VIPER: { rotation: [0, 0, 0], height: 0.15 },
      TALON: { rotation: [0, 0, 0], height: 0.1 },
      STRONGHOLD: { rotation: [0, 0, 0], height: 0.09 },
      SENTINEL: { rotation: [0, 0, 0], height: 0.1 },
      WAYFARER: { rotation: [0, 0, 0], height: 0.12 },
      TEMPEST: { rotation: [0, 0, 0], height: 0.15 },
      BALLISTA: { rotation: [-10.5, 0, 0], height: 0.09 },
      LEVIATHAN: { rotation: [0, 0, 0], height: 0.15 },
      PRAETORIAN: { rotation: [0, 0, 0], height: 0.16 },
      ATLAS: { rotation: [-15, 0, 0], height: 0.12 },
      NULLIFIER: { rotation: [12, 0, 0], height: 0 },
      CATACLYSM: { rotation: [11.5, 0, 90], height: 0.13 },
      CITADEL: { rotation: [-13, 180, 0], height: 0.21 },
    });
  });

  it('pins the nose axes measured in the six-side viewer', () => {
    const measured = {
      DART: '-x', PIKE: '+x', RAMPART: '+x', WARDEN: '+x', COURIER: '+x',
      VIPER: '+x', TALON: '+x', STRONGHOLD: '+z', SENTINEL: '+z', WAYFARER: '+x',
      TEMPEST: '+x', BALLISTA: '+z', LEVIATHAN: '+x', PRAETORIAN: '+z', ATLAS: '+z',
      NULLIFIER: '-x', CATACLYSM: '-x', CITADEL: '-z',
    } as const;
    expect(Object.fromEntries(
      Object.entries(manifest ?? {}).map(([id, asset]) => [id, asset.facing]),
    )).toEqual(measured);
  });

  it('uses each canonical icon in compact manifest surfaces', () => {
    for (const id of FLEET_V2_HULLS) {
      const view = render(createElement(HullMark, { hull: id, className: 'size-6' }));
      expect(view.container.querySelector('img')).toHaveAttribute('src', manifest?.[id]?.icon);
      expect(view.container.querySelector('svg')).toBeNull();
      view.unmount();
    }
  });
});

describe('Fleet V2 opening preload', () => {
  const opening = (preload as unknown as { FLEET_V2_OPENING_ASSETS?: readonly string[] })
    .FLEET_V2_OPENING_ASSETS;

  it('warms Dart and no other Fleet V2 model', () => {
    expect(opening).toBeDefined();
    expect(manifest).toBeDefined();
    const dartModel = manifest?.DART?.model;
    expect(dartModel).toBeDefined();
    expect(opening).toContain(dartModel);
    const fleetModels = new Set(Object.values(manifest ?? {}).map(({ model }) => model));
    expect((opening ?? []).filter((url) => fleetModels.has(url))).toEqual([dartModel]);
  });

  it('does not exceed the measured pre-V2 galaxy transfer budget', () => {
    const bytes = (opening ?? []).reduce((total, url) => total + statSync(served(url)).size, 0);
    expect(bytes).toBeLessThanOrEqual(1_786_315);
  });
});
