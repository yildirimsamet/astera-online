import type { PlanetNode } from './scene.js';

const EYE_SIZE = 0.5;
/** Smoothly approach a readable minimum; a flat floor makes far worlds look equidistant. */
const depthDetail = (depth: number): number => 1 / (1 + Math.max(0, depth) / 25);

const pixelSize = (depth: number, height: number, fov: number): number =>
  height > 0 ? 2 * Math.max(0, depth) * Math.tan(fov * Math.PI / 360) / height : 0;

/** Readable at distance, with continuous perspective cues rather than one fixed size. */
export function eyeMarkerScale(depth: number, radius: number, height: number, fov: number): number {
  const pixel = pixelSize(depth, height, fov);
  const pixels = 9 + 22 * depthDetail(depth);
  return radius > 0 && pixel > 0 ? pixel * pixels / (radius * EYE_SIZE) : 1.5;
}

/** Size icons independently of their stand-off, so a readable icon stays near its planet. */
export function planetMarkerLayout(
  node: Pick<PlanetNode, 'radius' | 'intel' | 'isOwned' | 'isCapital'>,
  depth: number,
  height: number,
  fov: number,
) {
  const pixel = pixelSize(depth, height, fov);
  const reduction = 2;
  const pinPixels = 4 + 6 * depthDetail(depth);
  const pinScale = pixel > 0 ? (pinPixels - (node.isOwned ? 0 : reduction)) * pixel / 0.2 : node.radius;
  // A three-sided cone is wider than it is tall: subtract CSS pixels on each axis.
  const triangleWidth = 0.13 * Math.sqrt(3);
  const pinWidthScale = pixel > 0 && !node.isOwned ? (pinPixels * triangleWidth / 0.2 - reduction) * pixel / triangleWidth : pinScale;
  const pinOffset = node.radius * 1.14 + pinScale * 0.1 + pixel * 4;
  const pinTop = pinOffset + pinScale * (node.isOwned && node.isCapital ? 0.2 + 0.1 / Math.SQRT2 : 0.1);
  // Only closed eyes shrink; colony fault badges also use the base scale law above.
  const eyeSize = node.radius * EYE_SIZE * eyeMarkerScale(depth, node.radius, height, fov) - pixel * reduction;
  const eyeOffset = (node.intel === 'UNKNOWN' ? node.radius * 1.14 : pinTop) + pixel * 4 + eyeSize / 2;
  const labelOffset = (node.intel !== 'RESOLVED' && !node.isOwned ? eyeOffset + eyeSize / 2 : pinTop) + pixel * 4;
  const colourDetail = 1 / (1 + Math.max(0, depth) / 80);
  const ink = 0.65 + 0.35 * colourDetail;
  return { pinScale, pinWidthScale, pinOffset, eyeSize, eyeOffset, labelOffset, ink, grey: 1 - colourDetail };
}
