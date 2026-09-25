import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * THE WORKS LIVE ON THE TOP BAR, AND ONLY THERE (owner, 2026-09-25: "Base Menü sheet'indeki
 * Works/Havuz section -> top status bar'a taşınmalı", and the collect bubble over the home
 * world "kötü duruyor"). Wiring facts no component test sees, so they read the sources, as
 * `context-slot-host.test` does; the line itself is `works-line.test.tsx`.
 */
const read = (path: string): string => readFileSync(path, 'utf8');

describe('the works', () => {
  it('are drawn by the top bar, under the stores', () => {
    expect(read('src/v2/hud/TopBar.tsx')).toMatch(/<WorksLine/);
  });

  it('are not on the base any more, whose hero stays out of the Academy', () => {
    const base = read('src/screens/PlanetScreen.tsx');
    expect(base).not.toMatch(/CollectHost|WorksPool/);
    expect(base).toMatch(/\{!lesson && <div className="flex flex-col gap-2 px-2 pt-2">\s*<PlanetHero planet=\{data\} \/>/);
  });

  it('do not ride the home world on the galaxy', () => {
    expect(read('src/screens/GalaxyView.tsx')).not.toMatch(/CollectHost|CollectBubble|homeAnchor/);
    expect(read('src/galaxy/GalaxyCanvas.tsx')).not.toMatch(/onHomeAnchor/);
  });
});
