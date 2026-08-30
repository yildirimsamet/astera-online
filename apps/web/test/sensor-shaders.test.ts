import { describe, expect, it } from 'vitest';
import {
  RADAR_FRAGMENT,
  RADAR_SWEEP_FRAGMENT,
  SHELL_FRAGMENT,
} from '../src/galaxy/SensorRings.js';

/**
 * THE BLACK TILES, AND THE REASON THIS IS A TEST RATHER THAN A CODE REVIEW.
 *
 * It has now happened twice. D126 recorded it for the Telescope shell: a NaN
 * reaching `gl_FragColor` through additive blending on a half-float target
 * renders as SOLID BLACK, in 2x2 quads, appearing and vanishing as the camera
 * moves. Owner report, from a real phone, against the radar this time: *"siyah
 * siyah patlamalar oluyor, kare dikdörtgen alanlar gelip yok oluyor."*
 *
 * The shell was fixed and the sweep — written afterwards — repeated the mistake,
 * because the rule lived in one file's prose and nothing checked the next shader
 * against it. These assertions are crude on purpose: they read the GLSL as text
 * and look for the two shapes that produce a NaN. A crude check that runs on
 * every commit beats a precise one nobody performs.
 */

/**
 * THE CODE, WITHOUT THE PROSE ABOUT IT. These shaders explain themselves at
 * length and several of those explanations NAME the hazard they are guarding
 * against — so a scan of the raw source flags the comment that documents the fix
 * as though it were the bug. Strip comments first and the check reads what the
 * GPU reads.
 */
const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

const SHADERS: readonly [string, string][] = [
  ['shell', code(SHELL_FRAGMENT)],
  ['radar volume', code(RADAR_FRAGMENT)],
  ['radar sweep', code(RADAR_SWEEP_FRAGMENT)],
];

describe('every sensor shader', () => {
  /**
   * A DERIVATIVE CAN BE ZERO. `fwidth()` returns zero across a quad whose value
   * is flat — which happens constantly as a disc turns towards edge-on — and a
   * zero-width `smoothstep` or a division by it is a divide by zero.
   */
  it.each(SHADERS)('floors every derivative it divides or steps by (%s)', (_name, source) => {
    const uses = [...source.matchAll(/fwidth\s*\(/g)];
    for (const use of uses) {
      // The 80 characters around the call: enough to see its guard.
      const around = source.slice(Math.max(0, use.index - 40), use.index + 60);
      expect(around, `unguarded fwidth: ${around.trim()}`).toMatch(/max\s*\(/);
    }
  });

  /**
   * EVERY COMPARISON AGAINST NaN IS FALSE, so `alpha <= eps` discards nothing in
   * exactly the case it exists to catch. The negated form is true for NaN.
   */
  it.each(SHADERS)('never guards its alpha with a test NaN passes (%s)', (_name, source) => {
    expect(source, 'use !(alpha > eps), which is true for NaN')
      .not.toMatch(/if\s*\(\s*alpha\s*<=/);
  });

  /**
   * HIGHP IS NOT A PREFERENCE (D126). At mediump a clock fed to sin() loses its
   * fractional precision after a few thousand seconds and can overflow, and
   * fract(inf) is NaN.
   */
  it.each(SHADERS)('asks for high precision explicitly (%s)', (_name, source) => {
    expect(source).toMatch(/precision\s+highp\s+float\s*;/);
  });
});
