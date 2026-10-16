import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { referenceArtPlugin } from '../src/lib/referenceArtPlugin.js';
import shipArt from '../src/galaxy/referenceArtManifest.json';

const repository = mkdtempSync(join(tmpdir(), 'astera-reference-opt-in-'));
beforeAll(() => {
  const files = [
    'astera-refs/dist/v2/manifest.json', 'astera-refs/dist/fx/explosion.webp',
    ...['rock-s', 'rock-m', 'rock-l'].map(name => `astera-refs/dist/selected/${name}.glb`),
    ...Object.keys(shipArt).flatMap(hull => ['', '_lod'].map(suffix => `.dev/reference-art/ships/${hull.toLowerCase()}${suffix}.glb`)),
  ];
  for (const file of files) {
    mkdirSync(dirname(join(repository, file)), { recursive: true });
    writeFileSync(join(repository, file), 'fixture');
  }
});
afterAll(() => { rmSync(repository, { recursive: true, force: true }); });
afterEach(() => { vi.unstubAllEnvs(); });

it('uses owned Astera models by default even when a complete old reference pack is on disk', () => {
  vi.stubEnv('ASTERA_REFS', join(repository, 'astera-refs'));
  vi.stubEnv('ASTERA_REFERENCE_ART', undefined);
  expect(referenceArtPlugin(repository)).toBeNull();
});
it('requires an explicit local art review opt-in', () => {
  vi.stubEnv('ASTERA_REFS', join(repository, 'astera-refs'));
  vi.stubEnv('ASTERA_REFERENCE_ART', 'true');
  expect(referenceArtPlugin(repository)?.name).toBe('astera-local-reference-art');
});
it('does not enable reference replacements when the flag is false', () => {
  vi.stubEnv('ASTERA_REFS', join(repository, 'astera-refs'));
  vi.stubEnv('ASTERA_REFERENCE_ART', 'false');
  expect(referenceArtPlugin(repository)).toBeNull();
});
