import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const baseline = readFileSync(
  resolve(import.meta.dirname, '../../../tools/visual-baseline.mjs'),
  'utf8',
);

describe('the read-only galaxy performance harness', () => {
  it('enters the current rehearsal by accessible name', () => {
    expect(baseline).toContain("name: /check your planet|gezegenini incele/i");
    expect(baseline).not.toContain("page.locator('button.enter')");
  });

  it('can inject bounded formation and late-season stress payloads', () => {
    expect(baseline).toContain('const STRESS_MODE = process.env.STRESS');
    expect(baseline).toContain('installStressAcademyFixture');
    expect(baseline).toContain('__asteraAcademyVisualFixture');
    expect(baseline).toContain('const FORMATION_CONTACTS = 1');
    expect(baseline).toContain("mode === 'formations'");
    expect(baseline).toContain("mode === 'late-season'");
  });

  it('reports named instance buckets and depth clears', () => {
    expect(baseline).toContain('namedInstances');
    expect(baseline).toContain('clearDepthCalls');
  });

  it('uses the current debug bridge and always closes its browser', () => {
    expect(baseline).not.toContain('__galaxy?.get()');
    expect(baseline).toContain('finally');
    expect(baseline).toContain('await browser.close().catch');
    expect(baseline).toContain('const SAMPLE_MS =');
  });

  it('captures the WebGL canvas without a compositor-wide page screenshot', () => {
    expect(baseline).toContain('captureGalaxyCanvas');
    expect(baseline).not.toContain('page.screenshot(');
    expect(baseline).toContain("gl.domElement.toDataURL('image/png')");
  });
});
