import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const harness = readFileSync(resolve(import.meta.dirname, '../../../tools/visual.mjs'), 'utf8');

describe('the visual verification journey', () => {
  /**
   * THE DISC'S HOME MARK LEFT WITH THE v2 SHELL; the dock's Galaxy tab, pressed while
   * lit, is Home now (same three steps, D163). A harness still clicking the old mark
   * stops at step 3 with a selector timeout that reads like a broken camera.
   */
  it('flies home with the dock’s Galaxy tab', () => {
    expect(harness).toContain("dock.getByRole('button', { name: /^Galaxy/ })");
    expect(harness).not.toContain('data-disc-control');
  });

  it('reaches the next action through the context slot, not the old guide card', () => {
    expect(harness).not.toMatch(/open galaxy chat|galaxy chronicle/i);
    expect(harness).toContain("name: 'Build defence'");
  });

  it('clears a live galaxy event out of the slot first, since the event outranks advice (B3)', () => {
    const onboarding = harness.slice(harness.indexOf("process.argv.includes('--onboarding')"));
    const dismiss = onboarding.indexOf("getByRole('region', { name: /^galaxy event$/i })");
    expect(dismiss).toBeGreaterThan(-1);
    expect(dismiss).toBeLessThan(onboarding.indexOf("name: 'Build defence'"));
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
