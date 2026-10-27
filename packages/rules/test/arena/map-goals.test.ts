import { describe, expect, it } from 'vitest';
import { ARENA_LAYOUT as L, ARENA_TUNING as T, hiddenByDust, type Vec3 } from '../../src/arena/index.js';
import { segmentObstacles } from '../../src/arena/collision.js';

/**
 * V6b (16-yarik-v6-plani §2, goal 1): with 48 pilots, at least 1.5 farm places per pilot that
 * nobody sees from an open lane or the open heart. "Sees" is what the game lets a pilot see: a
 * clear line (no rock, structure or deep dust) within the area the server sends (AOI).
 */
const lookouts: Vec3[] = [];
// The open lanes: from the heart to each district and to Kristal Kuşağı, every 250 m (the
// outposts have no lane: they are reached through open frontier, not a cleared road).
const districts = [...L.structures.filter(s => ['cave', 'station', 'wreck', 'yard'].includes(s.kind)).map(s => s.p), ...L.fields.slice(0, 1).map(f => f.p)];
for (const to of districts) {
  const length = Math.hypot(to.x, to.y, to.z);
  for (let d = 450; d < length - 400; d += 250) lookouts.push({ x: to.x * d / length, y: to.y * d / length, z: to.z * d / length });
}
// The open heart: a 400 m grid out to 2 km, at three heights.
for (let x = -2000; x <= 2000; x += 400) {
  for (let z = -2000; z <= 2000; z += 400) {
    if (Math.hypot(x, z) > 2000 || Math.hypot(x, z) < 450) continue;
    for (const y of [-300, 0, 300]) lookouts.push({ x, y, z });
  }
}
const seen = (spot: Vec3): boolean => lookouts.some(o => {
  if (Math.hypot(spot.x - o.x, spot.y - o.y, spot.z - o.z) > T.aoiRadius) return false;
  return segmentObstacles(L, o.x, o.y, o.z, spot.x, spot.y, spot.z, 0) > 1 && !hiddenByDust(L, o, spot);
});

describe('v6 map goals', () => {
  it('hides at least 1.5 farm places per pilot (48) from the open lanes and the open heart', () => {
    const hidden = L.farmSpots.filter(spot => !seen(spot)).length;
    expect(hidden).toBeGreaterThanOrEqual(Math.ceil(48 * 1.5));
    // And the plan's share: ≥ 60 % of the farm places out of sight of every lane.
    expect(hidden / L.farmSpots.length).toBeGreaterThanOrEqual(0.6);
  });
});
