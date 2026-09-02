import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { noseBearing, noseVector, orientedCraft, posedCraft, turnOnto } from '../src/galaxy/model.js';
import {
  CRAFT_MODELS,
  HULL_MODEL,
  MODEL,
  MODEL_FACING,
  MODEL_POSE,
  PROP_MODELS,
} from '../src/ui/assets.js';

/**
 * SHIPS MUST FLY NOSE-FIRST.
 *
 * This is here because they did not. The old rule inferred forward from the
 * bounding box — longer horizontal axis wins — which turned the Explorer's
 * WINGSPAN into its direction of travel and flew it sideways down every route,
 * and pointed three other hulls' engines at their destination.
 *
 * A bounding box cannot tell a fuselage from a wingspan or a nose from a tail, so
 * facing is now declared. These tests pin the two things that keeps honest: the
 * turn actually lands the declared nose on +Z (the axis `lookAt` aims), and no
 * hull can be added to the game without declaring one.
 */

type NamedFacing = '+x' | '-x' | '+z' | '-z';

/**
 * A craft-shaped object whose nose points down an arbitrary bearing.
 *
 * BUILT CANONICALLY AND THEN TURNED, rather than laid out along the direction. It
 * is then the SAME OBJECT at every bearing — which is what lets a diagonal hull be
 * compared against an axis-aligned one and any difference in the result be blamed
 * on `orientedCraft` rather than on the fixture. Taking a direction rather than a
 * compass name is what gets the missile's 56.5° nose (D44) under test at all.
 */
function craftAlong(
  nose: THREE.Vector3,
  { wingspan = 3 }: { wingspan?: number } = {},
): THREE.Object3D {
  const inner = new THREE.Group();

  // The body: two units long down +Z, with a marked tip at the nose end.
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2));
  body.position.set(0, 0, 1);
  body.name = 'nose';
  inner.add(body);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4));
  tail.position.set(0, 0, -1);
  inner.add(tail);

  // Wings, deliberately WIDER than the body is long — the exact shape the old
  // bounding-box rule got wrong.
  inner.add(new THREE.Mesh(new THREE.BoxGeometry(wingspan * 2, 0.05, 0.1)));

  const group = new THREE.Group();
  group.add(inner);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nose.clone().normalize());
  group.updateMatrixWorld(true);
  return group;
}

const AXIS: Record<NamedFacing, THREE.Vector3> = {
  '+x': new THREE.Vector3(1, 0, 0),
  '-x': new THREE.Vector3(-1, 0, 0),
  '+z': new THREE.Vector3(0, 0, 1),
  '-z': new THREE.Vector3(0, 0, -1),
};

/** A craft-shaped object: a long body down `nose`, with a wide wing across it. */
function craft(nose: NamedFacing, opts: { wingspan?: number } = {}): THREE.Object3D {
  return craftAlong(AXIS[nose], opts);
}

/** Where the marked nose ends up, in the wrapper's own frame. */
function noseAfter(nose: NamedFacing): THREE.Vector3 {
  const wrapper = orientedCraft(craft(nose), nose);
  wrapper.updateMatrixWorld(true);
  const tip = wrapper.getObjectByName('nose');
  if (!tip) throw new Error('nose marker lost');
  return tip.getWorldPosition(new THREE.Vector3());
}

describe('orientedCraft', () => {
  it.each<NamedFacing>(['+x', '-x', '+z', '-z'])('turns a %s-facing hull onto +Z', (facing) => {
    const tip = noseAfter(facing);
    // +Z dominant, and the sign is positive: the nose leads.
    expect(tip.z).toBeGreaterThan(0);
    expect(tip.z).toBeGreaterThan(Math.abs(tip.x));
  });

  /**
   * The regression itself. A hull whose wings are three times its length must
   * still fly nose-first — under the old rule this one crabbed sideways.
   */
  it('is not fooled by a wingspan longer than the fuselage', () => {
    const wrapper = orientedCraft(craft('-x', { wingspan: 3 }), '-x');
    wrapper.updateMatrixWorld(true);
    const marker = wrapper.getObjectByName('nose');
    if (!marker) throw new Error('nose marker lost');
    const tip = marker.getWorldPosition(new THREE.Vector3());
    expect(tip.z).toBeGreaterThan(0);
    expect(Math.abs(tip.x)).toBeLessThan(tip.z);
  });

  it('leaves the original untouched, so one hull can be in the air twice', () => {
    const source = craft('-x');
    const marker = source.getObjectByName('nose');
    if (!marker) throw new Error('nose marker lost');
    const before = marker.position.clone();
    const wasFacing = source.quaternion.clone();

    orientedCraft(source, '-x');
    orientedCraft(source, '-x');

    expect(marker.position.equals(before)).toBe(true);
    expect(source.quaternion.equals(wasFacing)).toBe(true);
    expect(source.position.lengthSq()).toBe(0);
  });

  /**
   * A NOSE THAT IS NOT ON AN AXIS. D44.
   *
   * The missile arrived lying at 56.5° in its own XZ plane, which no compass point
   * can express — and getting it wrong is not subtle: the craft crabs across its
   * own route at half a right angle. Swept across a full turn rather than tested
   * at the one bearing that happens to matter, because the next model will arrive
   * at a different angle and this is the rule, not the special case.
   */
  it.each([0, 30, 56.5, 90, 137, 180, 214, 271, 330])(
    'turns a hull declared at %s° onto +Z',
    (degrees) => {
      const radians = (degrees * Math.PI) / 180;
      const nose = new THREE.Vector3(Math.sin(radians), 0, Math.cos(radians));
      const facing = noseBearing(nose.x, nose.z);

      const wrapper = orientedCraft(craftAlong(nose), facing);
      wrapper.updateMatrixWorld(true);
      const tip = wrapper.getObjectByName('nose');
      if (!tip) throw new Error('nose marker lost');
      const at = tip.getWorldPosition(new THREE.Vector3()).normalize();

      expect(at.z).toBeCloseTo(1, 5);
      expect(at.x).toBeCloseTo(0, 5);
    },
  );

  it.each([
    { measured: [0.7101, 0.408, -0.5736] as const },
    { measured: [0.8332, -0.044, 0.5512] as const },
    { measured: [-0.45, 0.31, 0.84] as const },
  ])('levels a pitched $measured nose and sends it down +Z', ({ measured }) => {
    const native = new THREE.Vector3(...measured).normalize();
    const wrapper = orientedCraft(
      craftAlong(native),
      noseVector(native.x, native.y, native.z),
    );
    wrapper.updateMatrixWorld(true);
    const tip = wrapper.getObjectByName('nose');
    if (!tip) throw new Error('nose marker lost');
    const at = tip.getWorldPosition(new THREE.Vector3()).normalize();
    expect(at.z).toBeCloseTo(1, 5);
    expect(at.x).toBeCloseTo(0, 5);
    expect(at.y).toBeCloseTo(0, 5);
  });

  /**
   * THE FOUR NAMES ARE THE SPECIAL CASES, not a parallel system.
   *
   * If a bearing and its named equivalent ever turned a model differently, half
   * the fleet would fly one way and half the other and nothing would say so.
   */
  it('agrees with the named facings it generalises', () => {
    expect(turnOnto(noseBearing(1, 0))).toBeCloseTo(turnOnto('+x'), 12);
    expect(turnOnto(noseBearing(-1, 0))).toBeCloseTo(turnOnto('-x'), 12);
    expect(turnOnto(noseBearing(0, 1))).toBeCloseTo(turnOnto('+z'), 12);
    expect(Math.abs(turnOnto(noseBearing(0, -1)))).toBeCloseTo(Math.abs(turnOnto('-z')), 12);
  });

  /**
   * THE MEASURE-AFTER-TURNING ORDER, WHICH ONLY A DIAGONAL EXPOSES. D44.
   *
   * A box drawn round a body lying at an angle is a box round the diagonal. The
   * missile measures 1.00 across a hull that is 1.17 long, so measuring first
   * would normalise by the wrong number and draw it short of the size it was
   * asked for. A unit-length body declared diagonally must come out the same size
   * as the same body declared along an axis.
   */
  it('sizes a diagonal hull by the hull, not by its bounding diagonal', () => {
    const straight = new THREE.Box3()
      .setFromObject(orientedCraft(craftAlong(new THREE.Vector3(0, 0, 1)), '+z'))
      .getSize(new THREE.Vector3());

    const nose = new THREE.Vector3(Math.sin(0.9862), 0, Math.cos(0.9862));
    const diagonal = new THREE.Box3()
      .setFromObject(orientedCraft(craftAlong(nose), noseBearing(nose.x, nose.z)))
      .getSize(new THREE.Vector3());

    expect(diagonal.z).toBeCloseTo(straight.z, 3);
    expect(diagonal.x).toBeCloseTo(straight.x, 3);
  });

  /** `scale` is meant to BE the world size, so nothing may exceed a unit box. */
  it('normalises every hull into a unit box', () => {
    for (const facing of ['+x', '-x', '+z', '-z'] as const) {
      const wrapper = orientedCraft(craft(facing, { wingspan: 4 }), facing);
      wrapper.updateMatrixWorld(true);
      const size = new THREE.Box3().setFromObject(wrapper).getSize(new THREE.Vector3());
      expect(Math.max(size.x, size.y, size.z)).toBeLessThanOrEqual(1.0001);
    }
  });
});

describe('posedCraft', () => {
  it('applies approved additive XYZ degrees and vertical correction after canonical facing', () => {
    const posed = posedCraft(craft('+z'), '+z', {
      rotation: [12, -3, 90],
      height: 0.21,
    });
    expect(posed.rotation.x).toBeCloseTo(12 * Math.PI / 180, 10);
    expect(posed.rotation.y).toBeCloseTo(-3 * Math.PI / 180, 10);
    expect(posed.rotation.z).toBeCloseTo(Math.PI / 2, 10);
    expect(posed.position.y).toBeCloseTo(0.21, 10);
  });
});

describe('the facing table', () => {
  it('covers every craft the galaxy can draw', () => {
    for (const url of CRAFT_MODELS) {
      expect(MODEL_FACING[url], `${url} has no declared facing`).toBeDefined();
    }
  });

  /**
   * A PROP HAS NO NOSE, AND CLAIMING OTHERWISE IS WORSE THAN SAYING NOTHING.
   *
   * Wreckage tumbles on three axes and is never pointed anywhere. A facing entry
   * for one would be honoured by nothing, so it reads as coverage where there is
   * none — the exact shape of a rule that quietly stops meaning anything.
   */
  it('declares no facing for anything that does not fly', () => {
    for (const url of PROP_MODELS) {
      expect(MODEL_FACING[url], `${url} is a prop but declares a facing`).toBeUndefined();
    }
  });

  /**
   * EVERY MODEL IS CLASSIFIED, exactly once.
   *
   * This is what makes the two rules above complete rather than merely true. A new
   * entry in `MODEL` that lands on neither list would otherwise be checked by
   * nothing at all — which is precisely how `debris` would have slipped past if
   * the craft rule had simply been narrowed and left there.
   */
  it('classifies every model as craft or prop, and never as both', () => {
    const craft = new Set<string>(CRAFT_MODELS);
    const props = new Set<string>(PROP_MODELS);
    for (const [name, url] of Object.entries(MODEL)) {
      expect(
        craft.has(url) !== props.has(url),
        `MODEL.${name} is on neither list, or on both`,
      ).toBe(true);
    }
    expect(craft.size + props.size).toBe(new Set<string>(Object.values(MODEL)).size);
  });

  /**
   * THE ONE DECLARED FACING THAT IS A MEASUREMENT RATHER THAN A COMPASS POINT.
   *
   * The missile's nose lies at 56.5° in its own XZ plane, read off a
   * principal-component fit over all 4,103 of its vertices — an axis of
   * (0.833, −0.044, 0.551), with the +end closing to a cross-section radius of
   * 0.05 against the other end's 0.14 for the fins and the nozzle. Pinned here
   * because a number nobody can check is a number the next edit quietly rounds:
   * at 45° or at 90° the round would crab across its own trail, which is exactly
   * what a wrong facing looks like in play.
   */
  it('declares the missile at the bearing its geometry was measured at', () => {
    const facing = MODEL_FACING[MODEL.missile];
    expect(facing).toEqual([0.8332, -0.044, 0.5512]);
  });

  it('declares the Death Star at its measured diagonal bearing', () => {
    const facing = MODEL_FACING[MODEL.deathStar];
    expect(facing).toEqual([0.7101, 0.408, -0.5736]);
  });

  it('declares the Drill on its measured pitched body axis', () => {
    const facing = MODEL_FACING[MODEL.drill];
    expect(facing).toEqual([0.8652, -0.5010, 0.0208]);
  });

  it('keeps Wayfarer and Nullifier on their measured native nose axes', () => {
    expect(MODEL_FACING[MODEL.wayfarer]).toBe('+x');
    expect(MODEL_FACING[MODEL.nullifier]).toBe('-x');
  });

  it('does not register retired fleet models as runtime craft', () => {
    expect(Object.keys(MODEL)).not.toEqual(expect.arrayContaining([
      'wasp', 'lance', 'bulwark', 'hauler', 'runner', 'breacher',
    ]));
  });

  it('covers every hull a player can build', () => {
    for (const [hull, url] of Object.entries(HULL_MODEL)) {
      expect(MODEL_FACING[url], `${hull} draws ${url}, which has no facing`).toBeDefined();
    }
  });

  it('maps every Fleet V2 hull to its scale-normalised approved pose', () => {
    expect(MODEL_POSE[HULL_MODEL.DART]).toEqual({
      rotation: [0, -1, 16],
      height: 0.17 / 0.84,
    });
    expect(MODEL_POSE[HULL_MODEL.CITADEL]).toEqual({
      rotation: [-13, 180, 0],
      height: 0.21 / 1.38,
    });
    expect(Object.keys(MODEL_POSE)).toHaveLength(18);
  });

  /**
   * A FACING FOR SOMETHING THAT IS NOT DRAWN IS A LIE ABOUT THE FLEET.
   *
   * The map is keyed by URL, so a path that is renamed on one side and not the
   * other leaves an orphan entry that looks like coverage and provides none.
   */
  it('declares a facing only for models that exist', () => {
    const known = new Set<string>(Object.values(MODEL));
    for (const url of Object.keys(MODEL_FACING)) {
      expect(known.has(url), `${url} has a facing but is not in MODEL`).toBe(true);
    }
  });
});

/**
 * EVERY MODEL PATH RESOLVES TO A REAL FILE.
 *
 * A model URL is a plain string and nothing checks it: a typo, a renamed folder or
 * a source file that never made it through `pnpm models` all produce the same
 * thing — a 404 the console swallows and an object that simply is not there. The
 * asteroid field has already gone invisible once on a green build for a different
 * reason, and it took a person opening the game to notice.
 *
 * This reads the served directory, which is what the browser fetches, so it also
 * catches a model that was added to `assets/source` and never optimised.
 */
describe('the model files', () => {
  it('exist for every entry in MODEL', () => {
    for (const [name, url] of Object.entries(MODEL)) {
      const path = resolve(process.cwd(), 'public', url.replace(/^\//, ''));
      expect(existsSync(path), `MODEL.${name} points at ${url}, which is not in public/`).toBe(
        true,
      );
    }
  });

  /** A GLB whose header is wrong is a corrupt export, not a missing file. */
  it('are real glTF binaries', () => {
    for (const [name, url] of Object.entries(MODEL)) {
      const path = resolve(process.cwd(), 'public', url.replace(/^\//, ''));
      const head = readFileSync(path).toString('ascii', 0, 4);
      expect(head, `MODEL.${name} is not a .glb`).toBe('glTF');
    }
  });

  /**
   * A BUDGET, BECAUSE THIS IS A PHONE GAME.
   *
   * The pipeline exists to keep these small — a 3.4 MB source becomes 70 KB — and
   * the only thing standing between that and somebody committing a raw export is
   * a number. 400 KB is generous against a fleet that currently sits at 40–105 KB;
   * it is a tripwire, not a target.
   */
  it('stay inside the size budget', () => {
    for (const [name, url] of Object.entries(MODEL)) {
      const path = resolve(process.cwd(), 'public', url.replace(/^\//, ''));
      const kb = statSync(path).size / 1024;
      expect(kb, `MODEL.${name} is ${kb.toFixed(0)} KB — did it skip \`pnpm models\`?`).toBeLessThan(
        400,
      );
    }
  });

});
