import * as THREE from 'three';

/**
 * A `.glb` turned into geometry you can instance at a size you chose.
 *
 * THIS EXISTS BECAUSE OF A REAL BUG. Instancing `mesh.geometry` straight out of a
 * loaded glTF looks right and is wrong in two ways at once:
 *
 *   1. THE NODE TRANSFORM IS LOST. A model's real size usually lives on the node,
 *      not in the vertex data — and the pipeline's meshopt compression makes that
 *      certain, because quantised positions are stored as integers spanning the
 *      whole uint16 range and dequantised by a scale on the node. The asteroid
 *      models measure 65,534 units across in their own accessors. Instancing that
 *      geometry directly and multiplying by "0.68" produces a rock the size of a
 *      solar system, or a random size per model — which is exactly what shipped.
 *
 *   2. THE ORIGIN IS ARBITRARY. Models are rarely centred on their own bounds, so
 *      even at the right size they orbit off-centre and their hit target misses.
 *
 * So: bake the world matrix into the vertices, centre on the bounding sphere, and
 * divide by its radius. After this, `scale = r` reliably means "r world units
 * across the widest axis", and a size in this codebase can be compared against a
 * planet's radius and mean something.
 */
export interface UnitModel {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

export function unitModel(scene: THREE.Object3D): UnitModel | null {
  const meshes: THREE.Mesh[] = [];
  scene.updateWorldMatrix(true, true);
  scene.traverse((node) => {
    if ((node as { isMesh?: boolean }).isMesh === true) meshes.push(node as THREE.Mesh);
  });

  const first = meshes[0];
  if (!first) return null;

  const geometry = first.geometry.clone();
  // The node's own transform, which is where a quantised model keeps its scale.
  geometry.applyMatrix4(first.matrixWorld);
  geometry.computeBoundingSphere();

  const sphere = geometry.boundingSphere;
  if (sphere && sphere.radius > 0) {
    geometry.translate(-sphere.center.x, -sphere.center.y, -sphere.center.z);
    geometry.scale(1 / sphere.radius, 1 / sphere.radius, 1 / sphere.radius);
    geometry.computeBoundingSphere();
  }

  const material = Array.isArray(first.material) ? first.material[0]! : first.material;
  return { geometry, material };
}


/**
 * Which way a craft's nose points IN ITS OWN FILE.
 *
 * This used to be inferred: take the bounding box, call the longer horizontal
 * axis the length, turn that onto +Z. It is a reasonable-sounding rule and it is
 * wrong, because a bounding box cannot tell a fuselage from a wingspan. The
 * Explorer is 0.62 long and 1.00 across the wings, so the rule turned its
 * WINGSPAN into the direction of travel and flew it sideways for the whole of its
 * journey — which is exactly what the owner reported seeing.
 *
 * Worse, a box cannot tell a nose from a tail at all. Three of the five hulls are
 * built along −X; the old rule turned +X onto +Z and pointed their engines at the
 * destination.
 *
 * So facing is DECLARED, measured once off the models themselves (each was
 * rendered from six sides: the Explorer's +X face is an engine bell, its −X face
 * a canopy). Five entries is not a burden, and a wrong one is visible the first
 * time a ship flies. Any new hull must be added here — see
 * `docs/visual-design.md`, which now states the convention for commissioned art.
 *
 * AND A NOSE IS NOT ALWAYS ON AN AXIS. D44. The missile arrived lying at 56.5° in
 * its own XZ plane — its bounding box is 1.00 by 0.70 for a body that is 1.17
 * long, which is the signature of a diagonal. Four compass points cannot express
 * that, so a facing may also be a BEARING in radians, measured from +Z toward +X
 * exactly as the four named ones are. The names are the special cases: `'+x'` is
 * `noseBearing(1, 0)`, and a test asserts all four agree.
 */
export type Facing = '+x' | '-x' | '+z' | '-z' | number;

/**
 * The bearing of a nose, from the direction it points in its own file.
 *
 * Takes the X and Z of the measured nose vector — the axis of the body, signed
 * toward the pointed end — and returns the facing this file understands. Written
 * as a call at the declaration site so the numbers that were measured stay
 * visible there rather than being pre-baked into a radian nobody can check.
 */
export const noseBearing = (x: number, z: number): number => Math.atan2(x, z);

/** Radians about Y that bring each named facing onto +Z, the axis `lookAt` aims. */
const AXIS_TURN: Record<'+x' | '-x' | '+z' | '-z', number> = {
  '+z': 0,
  '-z': Math.PI,
  // rotateY(+90°) maps −X onto +Z; rotateY(−90°) maps +X onto +Z.
  '-x': Math.PI / 2,
  '+x': -Math.PI / 2,
};

/** How far to turn a model about Y so its nose runs down +Z. */
export const turnOnto = (facing: Facing): number =>
  typeof facing === 'number' ? -facing : AXIS_TURN[facing];

/**
 * A craft, centred, turned to face +Z, and normalised to fit a unit box.
 *
 * Normalised by the LARGEST extent rather than by the length, so a wide hull
 * cannot quietly draw half again as big as a narrow one at the same `scale`.
 * `scale` is then a real world size and every ship obeys it.
 *
 * THE MODEL IS TURNED BEFORE IT IS MEASURED, and that ordering is load-bearing
 * from D44 onward. A box drawn round a body lying diagonally is a box round the
 * diagonal, not round the body: the missile measures 1.00 across a hull that is
 * 1.17 long, so measuring first would draw it 17% short of the size it was asked
 * for and would centre it on the wrong point. Turning first measures the craft
 * itself. For the four named facings this changes nothing at all — a quarter turn
 * only permutes the extents, and their largest is the same either way — which
 * `model.test.ts` holds.
 */
export function orientedCraft(scene: THREE.Object3D, facing: Facing): THREE.Object3D {
  // Cloned because the same craft can be in the air more than once, and one
  // object cannot be in two places.
  const model = scene.clone(true);

  const turn = turnOnto(facing);
  if (turn !== 0) model.rotateY(turn);
  model.updateWorldMatrix(true, true);

  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const centre = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(centre);

  model.position.sub(centre);

  const wrapper = new THREE.Group();
  wrapper.add(model);
  wrapper.scale.setScalar(1 / (Math.max(size.x, size.y, size.z) || 1));
  return wrapper;
}
