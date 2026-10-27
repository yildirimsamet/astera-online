import { describe, expect, it } from 'vitest';
import {
  ARENA_TUNING as T, createFlightState, createInput, createMesh, hullCapsule, hullGap, meshSegmentClosest, segmentObstacles,
  stepFlight, sweptHull, type ArenaLayout, type ArenaMesh, type Capsule, type FlightState, type MeshObstacle, type Quaternion,
} from '../../src/arena/index.js';
import { box, layoutWith, lumpyMesh } from './helpers.js';

/** A mesh obstacle placed at p with rotation q and uniform scale; mesh index 0. */
function placed(mesh: ArenaMesh, p: { x: number; y: number; z: number }, scale: number, q: Quaternion = { x: 0, y: 0, z: 0, w: 1 },
  kind: MeshObstacle['kind'] = 'rock'): ArenaLayout {
  const o: MeshObstacle = { id: 0, kind, shape: 'mesh', mesh: 0, p, q, scale, radius: mesh.radius * scale };
  return { ...layoutWith([o]), meshes: [mesh] };
}

/** The same mesh with the placement baked into its vertices, placed at the origin unturned. */
function baked(mesh: ArenaMesh, p: { x: number; y: number; z: number }, scale: number, q: Quaternion): ArenaLayout {
  const out: number[] = [];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const x = (mesh.positions[i] ?? 0) * scale; const y = (mesh.positions[i + 1] ?? 0) * scale; const z = (mesh.positions[i + 2] ?? 0) * scale;
    // v' = v + 2w(q×v) + 2 q×(q×v)
    const cx = q.y * z - q.z * y; const cy = q.z * x - q.x * z; const cz = q.x * y - q.y * x;
    out.push(x + 2 * (q.w * cx + q.y * cz - q.z * cy) + p.x, y + 2 * (q.w * cy + q.z * cx - q.x * cz) + p.y,
      z + 2 * (q.w * cz + q.x * cy - q.y * cx) + p.z);
  }
  const world = createMesh(out, mesh.indices);
  return placed(world, { x: 0, y: 0, z: 0 }, 1);
}

const capsule = (): Capsule => ({ ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, r: 0 });

/** Smallest gap between any hull capsule and the mesh obstacle, by the mesh query in world space. */
function hullDistance(state: FlightState, layout: ArenaLayout): number {
  const o = layout.obstacles[0];
  const mesh = layout.meshes[0];
  if (o?.shape !== 'mesh' || !mesh || o.scale !== 1 || o.p.x !== 0 || o.q.w !== 1) throw new Error('use a baked layout');
  const c = capsule(); const out = { sx: 0, sy: 0, sz: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, d: 0, inside: false };
  let gap = Infinity;
  for (let k = 0; k < 2; k++) {
    hullCapsule(state.q, k, T, c);
    if (meshSegmentClosest(mesh, state.p.x + c.ax, state.p.y + c.ay, state.p.z + c.az, state.p.x + c.bx, state.p.y + c.by,
      state.p.z + c.bz, 1000, out)) gap = Math.min(gap, (out.inside ? -out.d : out.d) - c.r);
  }
  return gap;
}

const turned: Quaternion = (() => {
  const x = 0.3; const y = -0.5; const z = 0.2; const w = 0.78; const l = Math.sqrt(x * x + y * y + z * z + w * w);
  return { x: x / l, y: y / l, z: z / l, w: w / l };
})();

describe('the ship hull (Y2): a fuselage and a wing, not a 6 m ball', () => {
  it('reaches the nose and the wing tips, and nothing above the canopy', () => {
    const c = capsule();
    const q = { x: 0, y: 0, z: 0, w: 1 };
    hullCapsule(q, 0, T, c);
    expect(Math.max(c.az, c.bz) + c.r).toBeCloseTo(T.bodyLength / 2, 9);
    expect(c.r).toBe(T.bodyRadius);
    hullCapsule(q, 1, T, c);
    expect(Math.max(Math.abs(c.ax), Math.abs(c.bx)) + c.r).toBeCloseTo(T.wingSpan / 2, 9);
    expect(T.bodyRadius).toBeLessThan(T.shipHitRadius);
  });

  it('touches a wall beside the wing tip, and clears a ceiling the old ball would have scraped', () => {
    const fly = (layout: ArenaLayout): FlightState => {
      const state = createFlightState(); state.s = T.speedMax;
      const input = createInput(); input.throttle = 1;
      for (let i = 0; i < 40; i++) stepFlight(state, input, layout);
      return state;
    };
    // A long wall whose face is 0.5 m inside the wing tip's reach (local +X side): the wing is pushed off it.
    const side = T.wingSpan / 2 - 0.5;
    expect(fly(layoutWith([box(0, side + 20, 0, 300, 20, 40, 400)])).p.x).toBeLessThan(-0.49);
    // A ceiling 1 m above the canopy: inside the old 6 m ball, clear of this hull.
    const above = T.bodyRadius + 1;
    const under = fly(layoutWith([box(0, 0, above + 20, 300, 60, 20, 400)]));
    expect(under.p.x).toBe(0); expect(under.p.y).toBe(0);
  });
});

describe('ships against mesh rocks (Y2: the surface you see is the surface you hit)', () => {
  const mesh = lumpyMesh(3, 14, 20);

  it('never lets the hull into a turned, scaled rock, at any approach', () => {
    const at = { x: 30, y: -20, z: 220 };
    const world = baked(mesh, at, 60, turned);
    for (const [x, y] of [[0, 0], [25, 10], [-30, -15], [10, 40]] as const) {
      const state = createFlightState(); state.p.x = x + 30; state.p.y = y - 20;
      state.s = T.speedMax * T.turboSpeedMul;
      const input = createInput(); input.throttle = 1; input.turbo = true;
      for (let i = 0; i < 90; i++) {
        stepFlight(state, input, world);
        expect(hullDistance(state, world)).toBeGreaterThanOrEqual(-1e-6);
      }
    }
  });

  it('places and turns the rock exactly as baking it into the vertices would', () => {
    const at = { x: 30, y: -20, z: 220 };
    const left = placed(mesh, at, 60, turned); const right = baked(mesh, at, 60, turned);
    for (const [x, y] of [[0, 0], [25, 10], [-30, -15]] as const) {
      const a = createFlightState(); const b = createFlightState();
      a.p.x = b.p.x = x + 30; a.p.y = b.p.y = y - 20; a.s = b.s = T.speedMax;
      const input = createInput(); input.throttle = 1; input.steerX = 0.3;
      for (let i = 0; i < 120; i++) { stepFlight(a, input, left); stepFlight(b, input, right); }
      expect(a.p.x).toBeCloseTo(b.p.x, 6); expect(a.p.y).toBeCloseTo(b.p.y, 6); expect(a.p.z).toBeCloseTo(b.p.z, 6);
    }
  });

  it('lets a ship fly 1 m off the surface without touching it', () => {
    // A flat slab of triangles under the flight line; the hull's lowest point rides 1 m above it.
    const floor = createMesh([-500, 0, -500, 500, 0, -500, 500, 0, 500, -500, 0, 500, -500, -40, -500, 500, -40, -500, 500, -40, 500, -500, -40, 500],
      [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]);
    const layout = placed(floor, { x: 0, y: -(Math.max(T.bodyRadius, T.wingRadius) + 1), z: 0 }, 1);
    const state = createFlightState(); state.p.z = -400; state.s = T.speedMax;
    const input = createInput(); input.throttle = 1;
    for (let i = 0; i < 150; i++) {
      stepFlight(state, input, layout);
      expect(state.bump).toBe(0);
      expect(state.ky).toBe(0);
      expect(state.p.y).toBe(0);
    }
  });

  it('flies into a hollow that a round collider would have filled', () => {
    // The dent faces +X (mesh space). Fly down its axis from outside.
    const scale = 80;
    const layout = placed(mesh, { x: 0, y: 0, z: 0 }, scale);
    const state = createFlightState(); state.p.x = 160;
    state.q = { x: 0, y: -Math.SQRT1_2, z: 0, w: Math.SQRT1_2 };
    state.s = 20;
    const input = createInput(); input.throttle = 0.15;
    for (let i = 0; i < 400; i++) stepFlight(state, input, layout);
    // Deeper than the rock's mean surface: only possible inside the hollow.
    expect(state.p.x).toBeLessThan(mesh.mean * scale);
    expect(state.landed).toBe(0);
  });

  it('lands on a mesh rock with LAND held and settles its belly onto the surface', () => {
    const layout = placed(mesh, { x: 0, y: 0, z: 0 }, 60, { x: 0, y: 0, z: 0, w: 1 }, 'rock');
    const state = createFlightState(); state.p.z = -140;
    const input = createInput(); input.throttle = 0.15; input.land = true;
    for (let i = 0; i < 900 && !state.landed; i++) stepFlight(state, input, layout);
    expect(state.landed).toBe(1);
    // Hold still for two seconds: the ship levels on the normal and comes to rest on its belly.
    input.throttle = 0;
    for (let i = 0; i < 60; i++) stepFlight(state, input, layout);
    const gap = hullGap(layout, 0, state.p, state.q, T);
    expect(gap).toBeGreaterThanOrEqual(-1e-6);
    expect(gap).toBeLessThan(0.05);
  });
});

describe('shots against mesh rocks and ship hulls', () => {
  const mesh = lumpyMesh(5);

  it('stop at the drawn surface of a turned, scaled rock', () => {
    const at = { x: 0, y: 0, z: 300 };
    const left = placed(mesh, at, 50, turned); const right = baked(mesh, at, 50, turned);
    for (const [x, y] of [[0, 0], [20, -10], [-35, 15], [60, 60]] as const) {
      const a = segmentObstacles(left, x, y, 0, x * 0.2, y * 0.2, 600, 0);
      const b = segmentObstacles(right, x, y, 0, x * 0.2, y * 0.2, 600, 0);
      if (b > 1) expect(a).toBeGreaterThan(1); else expect(a).toBeCloseTo(b, 9);
    }
  });

  it('pass through the hollow where the round collider used to stop them', () => {
    const layout = placed(mesh, { x: 0, y: 0, z: 0 }, 80);
    // Down the dent's axis to just short of its floor.
    expect(segmentObstacles(layout, 200, 0, 0, 0.62 * 80, 0, 0, 0)).toBeGreaterThan(1);
    // Straight through the middle: blocked at the surface.
    expect(segmentObstacles(layout, 0, 200, 0, 0, -200, 0, 0)).toBeLessThan(1);
  });

  it('hit a ship where its hull is, padded by hitPad, and miss the empty corners of the old ball', () => {
    const target = createFlightState();
    const still = { x: 0, y: 0, z: 0 };
    const shot = (ax: number, ay: number, az: number, bx: number, by: number, bz: number): number =>
      sweptHull({ previous: { x: ax, y: ay, z: az }, p: { x: bx, y: by, z: bz } }, target, still, T);
    // Down onto the nose, just inside its tip: the old 6 m ball missed this.
    expect(shot(0, 50, T.bodyLength / 2 - 0.5, 0, -50, T.bodyLength / 2 - 0.5)).toBeLessThan(1);
    // Across, just above the canopy plus pad: the old ball would have hit.
    const over = T.bodyRadius + T.hitPad + 0.3;
    expect(over).toBeLessThan(T.shipHitRadius);
    expect(shot(-50, over, 0, 50, over, 0)).toBeGreaterThan(1);
    // Through the wing tip.
    expect(shot(T.wingSpan / 2 - 0.3, 50, T.wingZ, T.wingSpan / 2 - 0.3, -50, T.wingZ)).toBeLessThan(1);
    // Starting inside the hull counts as an immediate hit.
    expect(shot(0, 0, 0, 0, 0, 1)).toBe(0);
  });

  it('measure the hit where the shot enters the hull, for impact placement', () => {
    const target = createFlightState();
    const t = sweptHull({ previous: { x: 0, y: 100, z: 0 }, p: { x: 0, y: -100, z: 0 } }, target, { x: 0, y: 0, z: 0 }, T);
    // Enters the top of the fuselage (radius + pad) from 100 m above, over a 200 m path.
    expect(t).toBeCloseTo((100 - T.bodyRadius - T.hitPad) / 200, 9);
  });

  it('follow a turning target: the hull is tested in the target\'s own frame', () => {
    const target = createFlightState();
    // Nose turned to +X: the fuselage now lies along X, the wing along Z.
    target.q = { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 };
    const tip = T.bodyLength / 2 - 0.5;
    expect(sweptHull({ previous: { x: tip, y: 50, z: 0 }, p: { x: tip, y: -50, z: 0 } }, target, { x: 0, y: 0, z: 0 }, T)).toBeLessThan(1);
    expect(sweptHull({ previous: { x: 0, y: 50, z: tip }, p: { x: 0, y: -50, z: tip } }, target, { x: 0, y: 0, z: 0 }, T)).toBeGreaterThan(1);
  });
});
