import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * NOTHING ALLOCATED EVERY FRAME ON THE CAMERA'S PATH (code review, 2026-09-25). While the
 * camera tracks a moving subject — a fleet, a craft — the rig ran every frame, and it built
 * two vectors each time: garbage the phone's collector then pauses to sweep, mid-pan.
 */
describe('the camera rig', () => {
  const canvas = readFileSync('src/galaxy/GalaxyCanvas.tsx', 'utf8');
  const track = canvas.slice(canvas.indexOf('if (act.track && at) {'), canvas.indexOf('if (act.track && at) {') + 400);

  it('tracks a subject without allocating', () => {
    expect(track).not.toMatch(/new THREE\.Vector3|\.clone\(\)/);
    expect(track).toMatch(/TRACK_DRIFT\.set\(at\[0\], at\[1\], at\[2\]\)\.sub\(controls\.target\)/);
  });
});
