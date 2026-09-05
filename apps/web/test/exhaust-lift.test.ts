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

  /**
   * READ OFF THE TABLE, NOT RESTATED FROM IT.
   *
   * This used to name the Citadel as the most-lifted hull and assert a floor under
   * that figure, which stopped being true the moment the authored sizes were
   * re-scaled by tier: the lift is a pose height DIVIDED by the hull's scale, so
   * making a capital bigger makes its normalised lift smaller. The claim that
   * matters survives either way — a hull the owner posed off the ground is drawn
   * off the ground, and the one hull posed at zero is drawn at zero.
   */
  it('is a real offset on the hulls that were drawn floating', () => {
    for (const hull of FLEET_V2_HULLS) {
      const asset = FLEET_V2_ASSET_MANIFEST[hull];
      if (asset.pose.height === 0) continue;
      expect(hullPoseLift(hull), hull).toBeGreaterThan(0);
    }
    expect(hullPoseLift('DART')).toBeGreaterThan(0);
    // The one Fleet V2 hull that needed no lift at all.
    expect(FLEET_V2_ASSET_MANIFEST.NULLIFIER.pose.height).toBe(0);
    expect(hullPoseLift('NULLIFIER')).toBe(0);
  });

  it('is zero for anything with no authored pose, rather than undefined', () => {
    expect(hullPoseLift('PROSPECTOR')).toBe(0);
    expect(hullPoseLift('BASTION')).toBe(0);
    expect(hullPoseLift('THORN')).toBe(0);
  });
});
