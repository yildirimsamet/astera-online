import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ONE TYPE SCALE (owner 2026-11-12, standard 2.2 and stage 3.1). Every word in the kit takes
 * its size from the `--gk-t-*` steps in tokens.css — 11 / 12 / 13 / 14 / 17 / 22, numbers 16, hero 27,
 * and 10 for an uppercase tracked tag — so a size cannot drift on one surface, and none goes under
 * the 11 px floor. The steps are the former ones at 90 % (owner 2026-11-17: the 90 % interface
 * size became the default); Japanese keeps a step more at the small end. A font size that
 * only sizes a glyph (an icon drawn 1em wide) is not text and is named below with its reason.
 */

const KIT = 'src/game-ui';
const tokens = readFileSync(join(KIT, 'tokens.css'), 'utf8');
const css = readFileSync(join(KIT, 'game-ui.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Rules whose font size sizes a glyph or a picture, never a word. */
const NOT_TEXT = new Map([
  ['.gk-btn__glyph', 'the glyph beside a button word'],
  ['.gk-round', 'the glyph on a round button'],
  ['.gk-round--small .gk-round__face', 'the glyph on a small round button'],
  ['.gk-hold__dial', 'the glyph in the hold dial'],
  ['.gk-mult .gk-glyph', 'the arrow in a multiplier badge'],
  ['.gk-lock .gk-glyph', 'the padlock in a lock badge'],
  ['.gk-stat__icon', 'the glyph of a value plate'],
  ['.gk-timer__ring', 'the glyph inside a timer ring'],
  ['.gk-banner__icon', 'the glyph of a banner'],
  ['.gk-tab .gk-glyph', 'the glyph of a tab'],
  ['.gk-nav__lock', 'the padlock on a locked dock item'],
  ['.gk-unit__home .gk-glyph', 'the hangar glyph by the stock'],
  ['.gk-lang__tick', 'the tick by the chosen language'],
  ['.gk-status__coin', 'the glyph on a status coin'],
  ['.gk-frow__coin', 'the damage glyph on a fault row’s coin'],
  ['.gk-store__safe .gk-glyph', 'the shield on a store\'s raid-safe box'],
]);

const rawSizes = (): [string, string][] =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(([, selector = '', body = '']) =>
    [...body.matchAll(/font-size:\s*([^;]+);/g)]
      .map(([, value = '']) => value.trim())
      // A size that follows its picture in em still keeps the floor: max(var(--gk-t-floor), …).
      .filter((value) => !value.startsWith('var(--gk-t-') && !value.startsWith('max(var(--gk-t-floor),'))
      .map((value): [string, string] => [selector.trim().replace(/\s+/g, ' '), value]));

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]);

describe('the kit type scale', () => {
  it('holds exactly the decided steps, none under the 11 px floor but the 10 px tag', () => {
    const block = (selector: string): Record<string, number> => {
      const start = tokens.indexOf(`${selector} {`);
      const body = tokens.slice(start, tokens.indexOf('\n}', start));
      return Object.fromEntries([...body.matchAll(/--gk-t-([\w-]+):\s*(\d+)px/g)].map(([, name = '', px]) => [name, Number(px)]));
    };
    expect(block(':root')).toEqual({ tag: 10, floor: 11, small: 12, body: 13, lead: 14, title: 17, head: 22, number: 16, hero: 27 });
    expect(block('html:lang(ja)')).toEqual({ tag: 11, floor: 12, small: 13 });
  });

  it('sizes every word in the kit stylesheet from the scale', () => {
    expect(rawSizes().filter(([selector]) => !NOT_TEXT.has(selector))).toEqual([]);
  });

  it('carries no stale exception', () => {
    const raw = new Set(rawSizes().map(([selector]) => selector));
    expect([...NOT_TEXT.keys()].filter((selector) => !raw.has(selector))).toEqual([]);
  });

  it('writes no inline text size outside the scale in kit components', () => {
    const inline = files(KIT).filter((file) => file.endsWith('.tsx')).flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/fontSize:\s*([^,}]+)/g)]
        .map(([, value = '']) => `${file}: ${value.trim()}`)
        // A clan tile sizes its tag in em of the tile (see .gk-emblem-tile__tag).
        .filter((hit) => !hit.includes('var(--gk-t-') && !hit.endsWith('ranks.tsx: size')));
    expect(inline).toEqual([]);
  });
});
