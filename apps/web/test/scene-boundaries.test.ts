import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * NOTHING THAT LOADS A MODEL MAY EMPTY THE DISC (code review, 2026-09-25).
 *
 * The scene sits under ONE Suspense boundary (`GalaxyCanvas`): worlds, pins, fleets,
 * rocks, rings. A component that asks for a model not yet in the cache suspends, and a
 * suspension with no boundary nearer climbs to that one — which hides every one of them
 * at once while R3F keeps the hidden worlds tappable (owner, on a phone: "gezegenler
 * aslında yok ama çiziliyor mu"). So every component that calls `useGLTF` is mounted
 * inside a boundary of its own, and a slow model costs only itself.
 */
const source = (file: string): string => readFileSync(`src/galaxy/${file}`, 'utf8');

/** Each loader, the file that mounts it, and how it is mounted. */
const MOUNTS: readonly [string, string][] = [
  ['DysonShells.tsx', 'Shell'],
  ['Asteroids.tsx', 'RockBucket'],
  ['Satellites.tsx', 'Ring'],
  ['Wrecks.tsx', 'Wreck'],
];

describe('every model loader has a boundary of its own', () => {
  it.each(MOUNTS)('%s mounts each %s inside its own Suspense', (file, loader) => {
    const text = source(file);
    const mounts = [...text.matchAll(new RegExp(`<${loader}\\b`, 'g'))];
    expect(mounts.length).toBeGreaterThan(0);
    for (const mount of mounts) {
      const before = text.slice(Math.max(0, mount.index - 120), mount.index);
      expect(before, `${loader} in ${file}`).toMatch(/<Suspense key=\{[^}]+\} fallback=\{null\}>\s*$/);
    }
  });

  /** `Hull` is mounted from six files; it carries its boundary itself. */
  it('gives every hull its own boundary, wherever it is mounted', () => {
    const fleets = source('Fleets.tsx');
    const hull = fleets.slice(fleets.indexOf('export function Hull('), fleets.indexOf('export function Hull(') + 900);
    expect(hull).toMatch(/<Suspense fallback=\{null\}>\s*<LoadedHull /);
  });
});
