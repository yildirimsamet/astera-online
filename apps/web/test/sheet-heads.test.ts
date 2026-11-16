import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * EVERY PAGE OVER THE GALAXY WEARS THE KIT'S HEAD (2026-11-16). The menu, the season ladder, the
 * research tree, the shop and the Wiki opened with the old plain title above kit bodies: a web
 * page's header on a game screen. A sheet asks for the kit's head with `kit`; the ones whose
 * group has not come yet stay on this list until it does, and the list only shrinks.
 */
const NOT_YET = new Map([
  ['planet.data.vessel.name', 'G15 starter journey'],
  ["t('arena.nav')", 'G12 arena'],
  ["t('community.admin.title')", 'G14 admin'],
]);

function sheets(source: string): { title: string; kit: boolean }[] {
  const found: { title: string; kit: boolean }[] = [];
  for (const match of source.matchAll(/<V2Sheet\b/g)) {
    let depth = 0;
    let index = match.index;
    for (; index < source.length; index += 1) {
      const char = source[index];
      if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
      else if (char === '>' && depth === 0) break;
    }
    const tag = source.slice(match.index, index);
    const title = /\btitle=(?:\{([^\n]*?)\}\s*$|"([^"]*)")/m.exec(tag);
    found.push({ title: (title?.[1] ?? title?.[2] ?? '').trim(), kit: /\bkit=\{/.test(tag) });
  }
  return found;
}

describe('the pages over the galaxy', () => {
  it('all wear the kit’s head, but for the groups still to come', () => {
    const all = sheets(readFileSync('src/screens/GalaxyView.tsx', 'utf8'));
    expect(all.length).toBeGreaterThan(10);
    const plain = all.filter((sheet) => !sheet.kit).map((sheet) => sheet.title);
    expect(plain.filter((title) => ![...NOT_YET.keys()].some((key) => title.startsWith(key)))).toEqual([]);
  });
});
