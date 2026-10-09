import { expect, it } from 'vitest';
import { Euler, Object3D, Vector3 } from 'three';
import { fleetFlagPose } from '../src/galaxy/cosmeticEffects.js';

const frameFor = (scale: number) => {
  const pose = fleetFlagPose(scale);
  const frame = new Object3D();
  frame.position.set(...pose.position);
  frame.rotation.set(...pose.rotation);
  frame.scale.setScalar(pose.scale);
  frame.updateMatrix();
  return frame;
};

it.each([0.15, 0.4, 1, 3.5])('centres the raised mast above the fleet nose at formation scale %s', scale => {
  const frame = frameFor(scale);
  // The actual cylinder is 1.9 high and its centre is x=-0.83.
  const foot = new Vector3(-0.83, -0.95, 0).applyMatrix4(frame.matrix);
  expect(foot.x).toBeCloseTo(0, 10);
  expect(foot.y).toBeCloseTo(scale * 0.7, 10);
  expect(foot.z).toBeCloseTo(scale * 0.5, 10);
});

it('keeps the entire cloth behind the mast rather than across or ahead of the formation', () => {
  const frame = frameFor(1);
  const mast = new Vector3(-0.83, 0.25, 0).applyMatrix4(frame.matrix);
  // Includes both cloth edges and the full shader flutter amplitude.
  for (const x of [-0.8, 0, 0.8]) {
    for (const flutter of [-0.135, 0, 0.135]) {
      const cloth = new Vector3(x, 0.25, flutter).applyMatrix4(frame.matrix);
      expect(cloth.z).toBeLessThan(mast.z);
      expect(Math.abs(cloth.x)).toBeLessThanOrEqual(0.075);
    }
  }
});

it.each([[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [1, 0.6, -3]])(
  'streams rearward and retains its raised nose alignment when the fleet heads to %j',
  (x, y, z) => {
    const heading = new Vector3(x, y, z).normalize();
    const fleet = new Object3D();
    fleet.rotation.copy(new Euler(0, 0, 0));
    fleet.lookAt(heading);
    const frame = frameFor(2);
    fleet.add(frame);
    fleet.updateMatrixWorld(true);
    const mast = new Vector3(-0.83, 0.25, 0).applyMatrix4(frame.matrixWorld);
    const freeEdge = new Vector3(0.8, 0.25, 0).applyMatrix4(frame.matrixWorld);
    expect(freeEdge.sub(mast).normalize().dot(heading)).toBeCloseTo(-1, 10);
    const foot = new Vector3(-0.83, -0.95, 0).applyMatrix4(frame.matrixWorld);
    const raisedNose = new Vector3(0, 1.4, 1).applyMatrix4(fleet.matrixWorld);
    expect(foot.distanceTo(raisedNose)).toBeLessThan(1e-10);
  },
);

it.each([0.15, 0.4, 1, 3.5])('keeps the full fluttering cloth clear of the lead hull envelope at scale %s', scale => {
  const frame = frameFor(scale);
  // Posed hulls fit inside a centred unit box; include the shader's downward flutter.
  const clothBottom = new Vector3(0.8, 0.25 - 1.03 / 2 - 0.035, 0).applyMatrix4(frame.matrix);
  const hullTop = scale * 0.5;
  expect(clothBottom.y - hullTop).toBeGreaterThan(scale * 0.5);
});
