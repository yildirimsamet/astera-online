import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';

it('refreshes Dart cache versions after full and LOD-only builds, without touching them on inspection', () => {
  const root = mkdtempSync(join(tmpdir(), 'astera-dart-build-'));
  const served = join(root, 'apps/web/public/assets/models/ships');
  const manifest = join(root, 'apps/web/src/ui/dart-model-versions.json');
  const build = (...args) => execFileSync(process.execPath, [resolve('tools/models.mjs'), '--only=ships/dart.glb', ...args], {
    cwd: root, env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' }, stdio: 'pipe',
  });
  const hash = name => createHash('sha256').update(readFileSync(join(served, name))).digest('hex').slice(0, 10);
  try {
    mkdirSync(join(root, 'assets/source/models/ships'), { recursive: true });
    mkdirSync(join(root, 'apps/web/src/ui'), { recursive: true });
    mkdirSync(served, { recursive: true });
    symlinkSync(resolve('node_modules'), join(root, 'node_modules'), 'dir');
    copyFileSync('assets/source/models/ships/dart.glb', join(root, 'assets/source/models/ships/dart.glb'));
    build();
    const versions = () => JSON.parse(readFileSync(manifest, 'utf8'));
    expect(versions()).toEqual({ 'dart.glb': hash('dart.glb'), 'dart_lod.glb': hash('dart_lod.glb') });
    const full = readFileSync(join(served, 'dart.glb'));
    writeFileSync(join(served, 'dart_lod.glb'), 'stale low model');
    writeFileSync(manifest, JSON.stringify({ 'dart.glb': 'stale', 'dart_lod.glb': 'stale' }));
    build('--lod-only');
    expect(readFileSync(join(served, 'dart.glb'))).toEqual(full);
    expect(versions()).toEqual({ 'dart.glb': hash('dart.glb'), 'dart_lod.glb': hash('dart_lod.glb') });
    const before = readFileSync(manifest);
    build('--inspect');
    expect(readFileSync(manifest)).toEqual(before);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60_000);
