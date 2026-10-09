import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { cosmeticsInCategory } from '@astera/rules';

const standard = (id: string) => readFileSync(resolve('public/assets/images/cosmetics/standards', `${id}.svg`), 'utf8');
const WAVE = ['flag-sovereign', 'flag-kraken', 'flag-oni', 'flag-voideye', 'flag-valkyrie',
  'flag-scarab', 'flag-stag', 'flag-horizon', 'flag-tiger', 'flag-scorpion'];

it('ships one self-contained cloth artwork per standard at the shared cloth proportions', () => {
  for (const item of cosmeticsInCategory('FLAG')) {
    const svg = standard(item.id);
    expect(svg, item.id).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="1024" height="640" viewBox="0 0 640 400"/);
    // Rasterised once into a texture: no scripts, embedded pictures or network fetches.
    expect(svg, item.id).not.toMatch(/<script|<image|<foreignObject|href="http|url\(http|@import/i);
    expect(svg.length, item.id).toBeLessThan(24_000);
  }
});

it('cuts each paid wave standard into its own silhouette and gives each its own palette', () => {
  const fields = new Set<string>();
  for (const id of WAVE) {
    const svg = standard(id);
    // The cloth outline is authored in the artwork; the bare canvas around it stays transparent.
    expect(svg, id).toContain('clip-path="url(#cloth)"');
    expect(svg, id).toMatch(/<clipPath id="cloth"><path d="[^"]+"\/><\/clipPath>/);
    expect(svg, id).toMatch(/Gradient/);
    fields.add(/<clipPath id="cloth"><path d="([^"]+)"/.exec(svg)![1]!);
  }
  expect(fields.size).toBeGreaterThanOrEqual(8);
});

it('keeps the two new included standards plain: flat colour, rectangular cloth, no metal', () => {
  for (const id of ['flag-bastion', 'flag-meridian']) {
    const svg = standard(id);
    expect(svg, id).not.toMatch(/Gradient|clipPath|filter/);
  }
});
