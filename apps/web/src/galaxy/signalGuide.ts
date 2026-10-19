import { Vector3, type Camera } from 'three';

interface GuideProjection { x: number; y: number; angle: number; offscreen: boolean }
interface Viewport { width: number; height: number }

/** One scratch/result per guide: camera movement never allocates React state or vectors. */
export function createSignalGuideProjection() {
  const view = new Vector3();
  const projected = new Vector3();
  const result: GuideProjection = { x: 0, y: 0, angle: 0, offscreen: false };
  return (target: Vector3, camera: Camera, { width, height }: Viewport): GuideProjection | null => {
    if (!(width > 0 && height > 0)) return null;
    camera.updateMatrixWorld();
    view.copy(target).applyMatrix4(camera.matrixWorldInverse);
    if (view.lengthSq() < 1e-12) return null;

    const cx = width / 2;
    const cy = height / 2;
    const front = view.z < -1e-6;
    let dx: number;
    let dy: number;
    if (front) {
      projected.copy(target).project(camera);
      dx = projected.x * cx;
      dy = -projected.y * cy;
    } else {
      // Perspective division mirrors targets behind the camera. Their camera-space
      // bearing retains the real side; directly behind gets a stable down bearing.
      dx = view.x * camera.projectionMatrix.elements[0] * cx;
      dy = -view.y * camera.projectionMatrix.elements[5] * cy;
    }
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
    const length = Math.hypot(dx, dy);
    const ux = length > 1e-6 ? dx / length : 0;
    const uy = length > 1e-6 ? dy / length : front ? -1 : 1;
    const inset = Math.min(width * .1, 40);
    const left = inset;
    const right = width - inset;
    const top = Math.min(96, height * .2);
    const bottom = height - Math.min(width < 1100 ? 112 : 64, height * .33);
    const edgeX = ux === 0 ? Infinity : (ux > 0 ? right - cx : cx - left) / Math.abs(ux);
    const edgeY = uy === 0 ? Infinity : (uy > 0 ? bottom - cy : cy - top) / Math.abs(uy);
    const edge = Math.min(edgeX, edgeY);
    const gap = Math.min(108, Math.min(width, height) * .16);
    const along = front ? Math.min(length - gap, edge) : edge;
    result.x = Math.max(left, Math.min(right, cx + ux * along));
    result.y = Math.max(top, Math.min(bottom, cy + uy * along));
    result.angle = Math.atan2(ux, -uy);
    result.offscreen = !front || cx + dx < left || cx + dx > right || cy + dy < top || cy + dy > bottom;
    return result;
  };
}
