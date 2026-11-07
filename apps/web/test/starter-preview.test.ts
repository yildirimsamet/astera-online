import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { VESSEL_HULLS, VESSEL_LOOKS, VESSEL_SYSTEMS, mainOffsetOf, monumentMotion, motionPositionAt, openingProgress, toWorld } from '@astera/rules';
import { VESSEL_BAYS, VESSEL_NOSE_TURN, isMainWorld, mainSkyClouds, mainSkyMonuments, mainSkyNodes, mainSkyPoints, starterCameraFar, starterOpeningCamera, starterOpeningPose, starterShipYaw, vesselLights, vesselModelFile } from '../src/galaxy/mainSky.js';
import { eyeNodes } from '../src/galaxy/PlanetField.js';
import { SKY_RADIUS } from '../src/galaxy/sky.js';
import { canOpenStarterPreview } from '../src/starter/preview.js';

const OFFSET = mainOffsetOf(1);

describe('the starter galaxy preview', () => {
  it('opens only in development or a visual test build, and only when asked', () => {
    expect(canOpenStarterPreview({ DEV: true }, '?starterPreview=1')).toBe(true);
    expect(canOpenStarterPreview({ DEV: false, VITE_VISUAL_TEST: '1' }, '?starterPreview=1')).toBe(true);
    expect(canOpenStarterPreview({ DEV: true }, '')).toBe(false);
    expect(canOpenStarterPreview({ DEV: true }, '?starterPreview=0')).toBe(false);
    expect(canOpenStarterPreview({ DEV: false }, '?starterPreview=1')).toBe(false);
  });
});

describe('the main galaxy points', () => {
  const points = [{ x: 100, y: 200, z: 300 }, { x: -50, y: 0, z: 25 }];
  const main = OFFSET;

  it('become worlds at their true place beside this galaxy', () => {
    expect(mainSkyNodes(points, OFFSET).map(node => node.position)).toEqual([
      toWorld({ x: 100 + main.x, y: 200 + main.y, z: 300 + main.z }),
      toWorld({ x: -50 + main.x, y: main.y, z: 25 + main.z }),
    ]);
  });

  it('are worlds nobody here has found: no name, no owner, nothing to read', () => {
    for (const node of mainSkyNodes(points, OFFSET)) {
      expect(node.intel).toBe('UNKNOWN');
      expect(node.name).toBe('');
      expect(node.owner).toBe('');
      expect(node.isOwned).toBe(false);
    }
  });

  it('have ids of their own, which can be told from a ship and cannot be aimed at', () => {
    const ids = mainSkyNodes(points, OFFSET).map(node => node.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids.every(isMainWorld)).toBe(true);
    expect(isMainWorld('7e0a1c9e-0000-4000-8000-000000000000')).toBe(false);
  });

  it('are placed from whichever galaxy the ship is in', () => {
    const elsewhere = mainOffsetOf(5);
    expect(mainSkyNodes(points, elsewhere)[0]!.position).toEqual(toWorld({ x: 100 + elsewhere.x, y: 200 + elsewhere.y, z: 300 + elsewhere.z }));
  });

  it('wear no mark asking to be explored, since a probe cannot reach them from here', () => {
    expect(eyeNodes(mainSkyNodes(points, OFFSET))).toEqual([]);
  });

  it('are none when the picture is empty', () => {
    expect(mainSkyNodes([], OFFSET)).toEqual([]);
  });

  it('come back from the wire\'s flat array in order', () => {
    expect(mainSkyPoints([1, 2, 3, -4, 5, -6])).toEqual([{ x: 1, y: 2, z: 3 }, { x: -4, y: 5, z: -6 }]);
    expect(mainSkyPoints([])).toEqual([]);
  });
});

describe('the monuments over there', () => {
  const main = OFFSET;
  const motion = monumentMotion({ x: 6000, y: 0, z: 0 }, 0);
  const one = { position: { x: 6000, y: 0, z: 0 }, difficulty: 'HARD', ordinal: 3, motion } as const;

  it('stand where the main galaxy stands', () => {
    expect(mainSkyMonuments([one], OFFSET)[0]!.position).toEqual({ x: 6000 + main.x, y: main.y, z: main.z });
  });

  it('keep moving on their path, around the main galaxy\'s centre', () => {
    const plain = motionPositionAt(motion, 3_600_000);
    expect(motionPositionAt(mainSkyMonuments([one], OFFSET)[0]!.motion!, 3_600_000)).toEqual({ x: plain.x + main.x, y: plain.y + main.y, z: plain.z + main.z });
  });

  it('keep the model and size of the real one, and claim no holder', () => {
    expect(mainSkyMonuments([one], OFFSET)[0]).toMatchObject({ ordinal: 3, difficulty: 'HARD', controller: { kind: 'NEUTRAL' } });
  });

  it('stand still when the season has no motion', () => {
    expect(mainSkyMonuments([{ position: one.position, difficulty: 'LEGACY', ordinal: 1 }], OFFSET)[0]!.motion).toBeUndefined();
  });
});

describe('the main galaxy, as the server sends it', () => {
  it('turns the flat array back into positions', () => {
    expect(mainSkyPoints([1, 2, 3, -4, 5, -6])).toEqual([{ x: 1, y: 2, z: 3 }, { x: -4, y: 5, z: -6 }]);
    expect(mainSkyPoints([])).toEqual([]);
  });
});

describe('the first look from a ship', () => {
  const ship: [number, number, number] = [10, 2, -30];
  const main = toWorld(OFFSET);

  it('stands behind the ship and looks along it toward the main galaxy', () => {
    const [x, y, z] = starterOpeningCamera(ship, OFFSET);
    const toShip = [ship[0] - x, ship[1] - y, ship[2] - z];
    const toMain = [main[0] - ship[0], main[1] - ship[1], main[2] - ship[2]];
    const dot = toShip[0]! * toMain[0]! + toShip[1]! * toMain[1]! + toShip[2]! * toMain[2]!;
    const cosine = dot / (Math.hypot(...toShip.map(Number)) * Math.hypot(...toMain.map(Number)));
    expect(cosine).toBeGreaterThan(0.85);
  });

  it('is close enough to read the hull', () => {
    const at = starterOpeningCamera(ship, OFFSET);
    expect(Math.hypot(at[0] - ship[0], at[1] - ship[1], at[2] - ship[2])).toBeLessThan(8);
  });

  it('can see all of the main galaxy with its far plane', () => {
    const reach = Math.hypot(...main);
    expect(starterCameraFar(OFFSET)).toBeGreaterThan(reach * 1.2);
  });

  it('never cuts the sky with its far plane: the sky is a sphere around the camera', () => {
    expect(starterCameraFar(OFFSET)).toBeGreaterThan(SKY_RADIUS);
    expect(starterCameraFar(OFFSET)).toBeGreaterThanOrEqual(600);
  });

  /**
   * OWNER 2026-11-06: the first frame had the ship low, behind the bottom card. The ship is the
   * middle of the screen now, and the main galaxy hangs ahead of it, above, in the same frame.
   */
  it('puts the ship in the middle of the screen, with the main galaxy ahead and above it', () => {
    const { camera, target } = starterOpeningPose(ship, OFFSET);
    expect(target).toEqual(ship);
    const look = [target[0] - camera[0], target[1] - camera[1], target[2] - camera[2]];
    const way = [main[0] - camera[0], main[1] - camera[1], main[2] - camera[2]];
    const cosine = (look[0]! * way[0]! + look[1]! * way[1]! + look[2]! * way[2]!) / (Math.hypot(look[0]!, look[1]!, look[2]!) * Math.hypot(way[0]!, way[1]!, way[2]!));
    expect(Math.acos(cosine) * 180 / Math.PI).toBeLessThan(20);
    const rise = (v: number[]) => v[1]! / Math.hypot(v[0]!, v[1]!, v[2]!);
    expect(rise(way)).toBeGreaterThan(rise(look));
  });

  it('turns about a point close to the ship, so a drag keeps it in view', () => {
    const { target } = starterOpeningPose(ship, OFFSET);
    expect(Math.hypot(target[0] - ship[0], target[1] - ship[1], target[2] - ship[2])).toBeLessThan(2);
  });
});

describe('the lights aboard', () => {
  it('leaves a broken system dark', () => {
    expect(vesselLights(openingProgress()).SURVEY).toBe(0);
  });

  it('lights a system as far as it is repaired', () => {
    const lights = vesselLights({ ...openingProgress(), modules: { SURVEY: 1 } });
    expect(lights.SURVEY).toBe(0.5);
    expect(vesselLights({ ...openingProgress(), modules: { SURVEY: 2 } }).SURVEY).toBe(1);
  });
});

describe('the clouds over there', () => {
  const cloud = { mode: 'EMIT', center: { x: 100, y: 0, z: -200 }, radius: 900, intensityHpPerMinute: 2, level: 1 } as const;
  const main = OFFSET;

  it('stands where the main galaxy stands, in this galaxy\'s coordinates', () => {
    const [drawn] = mainSkyClouds([cloud], new Date(0), OFFSET);
    expect(drawn!.center).toEqual({ x: 100 + main.x, y: main.y, z: -200 + main.z });
    expect(drawn!.radius).toBe(900);
  });

  it('is lit from the start and never ends, since the picture is only a snapshot', () => {
    const [drawn] = mainSkyClouds([cloud], new Date(1000), OFFSET);
    expect(drawn!.activeFrom.getTime()).toBeLessThanOrEqual(1000);
    expect(drawn!.activeUntil).toBeNull();
  });

  it('moves around the main galaxy\'s centre when its monument moves', () => {
    const motion = monumentMotion({ x: 100, y: 0, z: -200 }, 0);
    const plain = motionPositionAt(motion, 3_600_000);
    const [drawn] = mainSkyClouds([{ ...cloud, motion }], new Date(0), OFFSET);
    expect(motionPositionAt(drawn!.motion!, 3_600_000)).toEqual({ x: plain.x + main.x, y: plain.y + main.y, z: plain.z + main.z });
  });

  it('gives each cloud its own key, with no identity from the server', () => {
    const drawn = mainSkyClouds([cloud, cloud], new Date(0), OFFSET);
    expect(new Set(drawn.map(item => item.id)).size).toBe(2);
    expect(drawn[0]!.target).toBeUndefined();
  });
});

describe('which way the ship points', () => {
  it('turns its nose to the main galaxy', () => {
    const ship: [number, number, number] = [10, 2, -30];
    const main = toWorld(OFFSET);
    const yaw = starterShipYaw(ship, OFFSET);
    const nose = [Math.sin(yaw), Math.cos(yaw)];
    const way = [main[0] - ship[0], main[2] - ship[2]];
    const cosine = (nose[0]! * way[0]! + nose[1]! * way[1]!) / Math.hypot(way[0]!, way[1]!);
    expect(cosine).toBeGreaterThan(0.999);
  });
});


describe('the ship\'s own model', () => {
  const noseAfterTurn = (turn: number) => ({ x: Math.cos(turn), z: -Math.sin(turn) });

  it('has a file for every hull in every state, small enough to load on a phone', () => {
    for (const hull of VESSEL_HULLS) for (const look of VESSEL_LOOKS) {
      const file = join(import.meta.dirname, '../public', vesselModelFile(hull, look));
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size, file).toBeLessThan(2_000_000);
    }
  });

  it('turns a nose modelled along +X to the +Z that the ship\'s yaw points', () => {
    const nose = noseAfterTurn(VESSEL_NOSE_TURN);
    expect(nose.x).toBeCloseTo(0, 6);
    expect(nose.z).toBeCloseTo(1, 6);
  });

  it('knows where each system stands on each hull, inside the hull and with the drive at the tail', () => {
    for (const hull of VESSEL_HULLS) {
      const bays = VESSEL_BAYS[hull];
      for (const system of VESSEL_SYSTEMS) for (const value of bays[system]) expect(Math.abs(value)).toBeLessThanOrEqual(0.5);
      expect(bays.DRIVE[0]).toBeLessThan(-0.2);
    }
  });
});
