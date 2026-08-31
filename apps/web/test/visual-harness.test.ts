import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const harness = readFileSync(resolve(import.meta.dirname, '../../../tools/visual.mjs'), 'utf8');

describe('the visual verification journey', () => {
  it('opens the Worlds panel before pressing its camera-home control', () => {
    const homeSection = harness.slice(
      harness.indexOf('/* ── 3 · home works while something is focused'),
      harness.indexOf('/* ── 4 ·', harness.indexOf('/* ── 3 · home works while something is focused')),
    );
    const opensWorlds = homeSection.indexOf("page.locator('[data-disc-control=\"worlds\"]')");
    const pressesHome = homeSection.indexOf("name: /zoom in on active planet|aktif gezegenine yakınlaş/i");

    expect(opensWorlds).toBeGreaterThanOrEqual(0);
    expect(pressesHome).toBeGreaterThan(opensWorlds);
  });

  it('measures camera home with the current shared world transform', () => {
    const expectedHomeSection = harness.slice(
      harness.indexOf('const expectedHome ='),
      harness.indexOf('const homeRange ='),
    );

    expect(expectedHomeSection).toContain('activeWorld.position.y / 50');
    expect(expectedHomeSection).not.toContain('* 3.5');
  });

  it('expects Home to prime the active world so one subsequent tap opens management', () => {
    const managementSection = harness.slice(
      harness.indexOf('/* ── 4 ·'),
      harness.indexOf('const when ='),
    );

    expect(managementSection).toContain('home-focused owned world first tap opens management');
    expect(managementSection).not.toContain('ownManagementOnSecond');
  });
});
