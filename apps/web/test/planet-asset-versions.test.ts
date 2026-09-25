import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLANET_ART, planetArt, planetModel } from '../src/ui/assets.js';
import { PLANET_TIERS } from '../src/galaxy/planetLod.js';

/**
 * A WORLD'S FILES ARE CACHED FOR A YEAR, SO EVERY ONE CARRIES ITS OWN VERSION (F9).
 * Owner, 2026-09-25: "bu gezegenleri texture'ları vs user'da cacheleyebilir miyiz?"
 *
 * They already are: production serves everything under `/assets/` immutable for a year
 * (`deploy/nginx/astera.conf`). That is right for Vite's hashed chunks and wrong for the
 * planet files, whose names never change — a phone that loaded the old painted
 * `planet_6.png` would have gone on drawing it beside the new 3D world for a year. So
 * each URL carries the file's content hash, written by the tools that make the files
 * (`tools/planet-versions.mjs`): a changed file is a new URL, an unchanged one is never
 * fetched twice.
 */
const served = (url: string): Buffer => readFileSync(resolve(process.cwd(), 'public', url.replace(/^\//, '').replace(/\?.*$/, '')));
const hashOf = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex').slice(0, 10);
const versionOf = (url: string): string | undefined => /\?v=([0-9a-f]+)$/.exec(url)?.[1];

describe('the planet files a browser keeps', () => {
  const urls = [
    ...PLANET_ART,
    ...Array.from({ length: 16 }, (_, look) => look).flatMap((look) => {
      // A planet id of each look, found by walking ids until every look has one.
      const id = Array.from({ length: 400 }, (_, i) => `probe-${String(i)}`).find((candidate) =>
        planetArt(candidate) === PLANET_ART[look]);
      return id ? PLANET_TIERS.map((tier) => planetModel(id, tier)) : [];
    }),
  ];

  it('covers every card and every model of every look', () => {
    expect(PLANET_ART).toHaveLength(16);
    expect(urls).toHaveLength(16 + 16 * PLANET_TIERS.length);
  });

  it('names each by the hash of what is served, so a changed file is a new URL', () => {
    const stale = urls.filter((url) => versionOf(url) !== hashOf(served(url)));
    expect(stale, 'run tools/planet-versions.mjs (the model and card tools call it)').toEqual([]);
  });
});
