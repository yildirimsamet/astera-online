import { motionPositionAt, motionVelocityAt, toWorld, VIEW, type MonumentMotion } from '@astera/rules';
import { BufferAttribute, BufferGeometry, Color, Group, Line, LineBasicMaterial, LineSegments, Vector3, type Camera } from 'three';

const SEGMENTS = 384;
const ARROWS = 3;
const COLOUR = '#b6d6e2';
const noRaycast = () => null;
/**
 * What an unfocused trajectory and its chevrons share. Owner, 2026-10-16: the idle loops read
 * as a wire cage (his capture showed ~0.16 along the whole orbit), and the chevrons were to
 * wear the route's opacity; choosing the monument (0.32 route, 0.95 chevrons) is what draws one.
 */
const IDLE_OPACITY = 0.025;
/** Both recede further while another monument holds the focus. */
const RECEDED_OPACITY = 0.01;

/** A rolling real trajectory, not a circle: the two rotations need not share a period. */
export function createMonumentOrbit(motion: MonumentMotion, bodyScale: number) {
  const pathPositions = new BufferAttribute(new Float32Array((SEGMENTS + 1) * 3), 3);
  const pathColours = new BufferAttribute(new Float32Array((SEGMENTS + 1) * 4), 4);
  const arrowPositions = new BufferAttribute(new Float32Array(ARROWS * 4 * 3), 3);
  const arrowColours = new BufferAttribute(new Float32Array(ARROWS * 4 * 3), 3);
  const pathGeometry = new BufferGeometry();
  pathGeometry.setAttribute('position', pathPositions);
  pathGeometry.setAttribute('color', pathColours);
  const colour = new Color(COLOUR);
  for (let i = 0; i <= SEGMENTS; i++) {
    const u = i / SEGMENTS;
    // A short forward arc leads the eye; the rest of each orbit is a whisper, not a wire globe.
    const alpha = 0.07 + 0.7 * Math.exp(-u / 0.045) + 0.3 * Math.exp(-(1 - u) / 0.018);
    pathColours.setXYZW(i, colour.r, colour.g, colour.b, alpha);
  }
  const arrowGeometry = new BufferGeometry();
  arrowGeometry.setAttribute('position', arrowPositions);
  arrowGeometry.setAttribute('color', arrowColours);
  const path = new Line(pathGeometry, new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: IDLE_OPACITY, depthWrite: false, fog: false, toneMapped: false }));
  const arrows = new LineSegments(arrowGeometry, new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: IDLE_OPACITY, depthWrite: false, fog: false, toneMapped: false }));
  path.name = 'monument-orbit-path';
  arrows.name = 'monument-orbit-direction';
  path.raycast = arrows.raycast = noRaycast;
  // The buffers move independently of React; their initial bounding spheres are stale next frame.
  path.frustumCulled = arrows.frustumCulled = false;
  const object = new Group();
  object.add(path, arrows);
  const at = new Vector3(), heading = new Vector3(), view = new Vector3(), side = new Vector3();
  const span = Math.max(motion.periodXMs, motion.periodYMs);
  /**
   * A sixteen-hour loop moves its head a pixel a minute: rebuilding 385 points on every frame was
   * the galaxy's hottest function (2026-10-20 profile). Rebuilt after a sixteenth of a segment.
   */
  const resampleMs = span / SEGMENTS / 16;
  let sampledAt = Number.NaN;

  function update(now: number, camera: Camera, viewportHeight: number, focused: boolean, hasFocus: boolean) {
    const velocity = motionVelocityAt(motion, now);
    const speed = Math.hypot(velocity.x, velocity.y, velocity.z) / VIEW.scale;
    object.visible = speed > 1e-10;
    if (!object.visible) return;

    const resting = hasFocus ? RECEDED_OPACITY : IDLE_OPACITY;
    path.material.opacity = focused ? 0.32 : resting;
    arrows.material.opacity = focused ? 0.95 : resting;
    if (!(now >= sampledAt && now - sampledAt < resampleMs)) {
      sampledAt = now;
      for (let i = 0; i <= SEGMENTS; i++) {
        pathPositions.setXYZ(i, ...toWorld(motionPositionAt(motion, now + span * i / SEGMENTS)));
      }
      pathPositions.needsUpdate = true;
    }

    at.set(...toWorld(motionPositionAt(motion, now)));
    // Four-to-six-pixel arrowheads survive the map zoom, while a close camera keeps them delicate.
    const worldPerPixel = 2 * at.distanceTo(camera.position) / (Math.max(1, viewportHeight) * camera.projectionMatrix.elements[5]);
    const length = Math.max(bodyScale * 0.13, worldPerPixel * 5);
    for (let i = 0; i < ARROWS; i++) {
      const ahead = now + (bodyScale * 0.85 + i * Math.max(bodyScale * 0.48, length * 2.5)) / speed;
      at.set(...toWorld(motionPositionAt(motion, ahead)));
      const tangent = motionVelocityAt(motion, ahead);
      heading.set(tangent.x, tangent.y, tangent.z).normalize();
      view.copy(camera.position).sub(at).normalize();
      side.crossVectors(heading, view).normalize();
      // Camera-facing open chevrons remain readable when looking across a tilted orbit.
      const base = i * 4;
      arrowPositions.setXYZ(base, at.x - heading.x * length + side.x * length * 0.48,
        at.y - heading.y * length + side.y * length * 0.48, at.z - heading.z * length + side.z * length * 0.48);
      arrowPositions.setXYZ(base + 1, at.x, at.y, at.z);
      arrowPositions.setXYZ(base + 2, at.x, at.y, at.z);
      arrowPositions.setXYZ(base + 3, at.x - heading.x * length - side.x * length * 0.48,
        at.y - heading.y * length - side.y * length * 0.48, at.z - heading.z * length - side.z * length * 0.48);
      // Light flows forward; the chevrons themselves always stay on the real trajectory.
      const light = ahead >= (motion.stopAtMs ?? Infinity) ? 0 : 0.56 + 0.44 * (0.5 + 0.5 * Math.cos(now / 900 - i * 1.3));
      for (let vertex = base; vertex < base + 4; vertex++) {
        arrowColours.setXYZ(vertex, colour.r * light, colour.g * light, colour.b * light);
      }
    }
    arrowPositions.needsUpdate = arrowColours.needsUpdate = true;
  }

  function dispose() {
    pathGeometry.dispose(); arrowGeometry.dispose();
    path.material.dispose(); arrows.material.dispose();
  }
  return { object, path, arrows, update, dispose };
}
