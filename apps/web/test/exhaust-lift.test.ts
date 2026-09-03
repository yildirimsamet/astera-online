import { describe, expect, it } from 'vitest';
import { FLEET_V2_HULLS } from '@astera/rules';
import { FLEET_V2_ASSET_MANIFEST, hullPoseLift } from '../src/ui/assets.js';

/**
 * THE FLAME COMES OUT OF THE SHIP. Owner report.
 *
 * Several hulls are posed with a positive `height` — an owner-approved lift
 * applied after the authored nose is normalised onto +Z, because the models sit
 * low in their own files. Nothing else moved with them: the plume, the drive glow
 * and the wake were all anchored at the group's origin, so on every lifted hull
 * the exhaust burned from a point under the tail rather than out of it.
 *
 * ONE NUMBER, READ BY BOTH. `hullPoseLift` is what `Hull` is offset by and what
 * the flame is offset by, in the local units the craft is drawn in — so a re-posed
 * model cannot leave its own fire behind again.
 */
describe('the lift a posed hull is drawn at', () => {
  it('states the pose height in the craft’s own normalised units', () => {
    for (const hull of FLEET_V2_HULLS) {
      const asset = FLEET_V2_ASSET_MANIFEST[hull];
      expect(hullPoseLift(hull)).toBeCloseTo(asset.pose.height / asset.scale, 10);
    }
  });

  it('is a real offset on the hulls that were drawn floating', () => {
    // The two extremes of the authored table: the Citadel is lifted most, and the
    // Nullifier is the one Fleet V2 hull that needed none.
    expect(hullPoseLift('CITADEL')).toBeGreaterThan(0.1);
    expect(hullPoseLift('DART')).toBeGreaterThan(0);
    expect(hullPoseLift('NULLIFIER')).toBe(0);
  });

  it('is zero for anything with no authored pose, rather than undefined', () => {
    expect(hullPoseLift('PROSPECTOR')).toBe(0);
    expect(hullPoseLift('BASTION')).toBe(0);
    expect(hullPoseLift('THORN')).toBe(0);
  });
});
