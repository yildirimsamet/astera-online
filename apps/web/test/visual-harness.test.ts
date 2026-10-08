import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { landing } from '../src/i18n/locales/en/entry.js';
import { academy } from '../src/i18n/locales/en/academy.js';

const harness = readFileSync(resolve(import.meta.dirname, '../../../tools/visual.mjs'), 'utf8');

describe('the visual verification journey', () => {
  it('can enter through both current English training doors', () => {
    const selector = /const trainingDoor = page\.getByRole\('button', \{ name: \/([^/]+)\/([a-z]*) \}\)/.exec(harness);
    if (!selector) throw new Error('Missing training-door selector');
    const label = new RegExp(selector[1]!, selector[2]);
    expect(landing.register).toMatch(label);
    expect(landing.newCommander).toMatch(label);
  });
  it('can skip the current training screen', () => {
    const selector = /const skip = page\.getByRole\('button', \{ name: \/([^/]+)\/([a-z]*) \}\)/.exec(harness);
    if (!selector) throw new Error('Missing training skip selector');
    expect(academy.skip).toMatch(new RegExp(selector[1]!, selector[2]));
  });
  it('offers a Wiki journey that checks public content with JavaScript disabled and the in-game sheet', () => {
    expect(harness).toContain("process.argv.includes('--wiki')");
    const wiki = readFileSync(resolve(import.meta.dirname, '../../../tools/wiki-visual.mjs'), 'utf8');
    expect(wiki).toContain('javaScriptEnabled: false');
    expect(wiki).toContain('view=wiki');
    expect(wiki).toContain('scrollWidth');
  });
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

  it('measures the new top-bar vessel fill directly while production runs', () => {
    const works = harness.slice(harness.indexOf('/* ── 6 ·'));
    expect(works).toContain('[data-works-resource="alloy"] [data-works-fill]');
    expect(works).not.toContain('SKIP  the works fill without a refetch');
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
