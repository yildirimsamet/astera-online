import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GALLERY_OUT_OF_SCOPE, LISTED_DIRECTORIES, OUT_OF_SCOPE, SURFACES } from '../src/inventory.js';

/**
 * NOTHING THE PLAYER SEES IS LEFT OFF THE LIST.
 *
 * Owner rule for the UI/UX work (2026-11-11): nothing is skipped silently. A screen file
 * that is neither in a surface nor set aside with a reason turns this red, and so does an
 * entry whose file or gallery view has gone.
 */

const WEB = fileURLToPath(new URL('../../../apps/web/src/', import.meta.url));

function tsx(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(WEB, dir))) {
    const path = join(WEB, dir, name);
    if (statSync(path).isDirectory()) out.push(...tsx(relative(WEB, path)));
    else if (name.endsWith('.tsx') && !name.endsWith('.test.tsx')) out.push(relative(WEB, path));
  }
  return out;
}

const listed = new Set([...SURFACES.flatMap((s) => s.files), ...Object.keys(OUT_OF_SCOPE)]);

const gallerySource = ['v2/gallery/main.tsx', 'v2/gallery/Gallery.tsx', 'v2/gallery/GallerySupport.tsx'].map((file) => readFileSync(join(WEB, file), 'utf8')).join('\n');
const found = (pattern: RegExp) => [...gallerySource.matchAll(pattern)].map((m) => m[1] ?? '');
/** `view === 'launch'`, and main.tsx's `params.get('view') === 'planet-card'`. */
const exactViews = new Set(found(/(?:view|get\('view'\)) === '([a-z0-9-]+)'/g));
/** `view.startsWith('rewards')`: one branch, many views. */
const prefixViews = [...new Set(found(/view\??\.startsWith\('([a-z0-9:-]+)'\)/g))];
const reachedViews = new Set(SURFACES.flatMap((s) => s.reach).filter((r) => r.startsWith('gallery:')).map((r) => r.slice('gallery:'.length)));
const galleryHas = (view: string) => exactViews.has(view) || prefixViews.some((prefix) => view.startsWith(prefix));

describe('the surface inventory', () => {
  it('lists every player-facing screen file, or says why it is left out', () => {
    const missing = LISTED_DIRECTORIES.flatMap(tsx).filter((file) => !listed.has(file));
    expect(missing).toEqual([]);
  });

  it('names only files that exist', () => {
    expect([...listed].filter((file) => !existsSync(join(WEB, file)))).toEqual([]);
  });

  it('gives each surface a unique id and at least one way in', () => {
    const ids = SURFACES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(SURFACES.filter((s) => s.reach.length === 0).map((s) => s.id)).toEqual([]);
  });

  it('finds the gallery branches it checks', () => {
    expect(exactViews.size).toBeGreaterThan(100);
    expect(prefixViews).toContain('rewards');
  });

  it('reaches only gallery views that exist', () => {
    expect([...reachedViews].filter((view) => !galleryHas(view))).toEqual([]);
  });

  it('measures every gallery view, or says why not', () => {
    expect([...exactViews].filter((view) => !reachedViews.has(view) && !(view in GALLERY_OUT_OF_SCOPE))).toEqual([]);
  });

  it('measures every prefix branch through at least one view, or says why not (keyed "prefix*")', () => {
    expect(prefixViews.filter((prefix) => ![...reachedViews].some((view) => view.startsWith(prefix)) && !(`${prefix}*` in GALLERY_OUT_OF_SCOPE))).toEqual([]);
  });

  it('gives every exclusion a reason', () => {
    expect(Object.entries({ ...OUT_OF_SCOPE, ...GALLERY_OUT_OF_SCOPE }).filter(([, why]) => why.trim().length < 10)).toEqual([]);
  });
});
