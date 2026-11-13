/**
 * WHAT A FINGER CAN ACTUALLY LAND ON.
 *
 * A button's box is not its hit area: a padding-less icon, a sheet edge on top of it or
 * a neighbour's invisible overflow all change where a press goes. The collector asks the
 * browser at every grid point which element would receive the touch; these functions
 * turn those answers into regions and apply WCAG 2.5.8.
 */

export interface HitSample {
  x: number;
  y: number;
  /** The interactive element a press here would reach, or null for none. */
  target: string | null;
}

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface HitRegion {
  target: string;
  /** CSS px² that really reach the target. */
  area: number;
  box: Box;
  width: number;
  height: number;
  /** area ÷ box area: below 1, something covers part of the target. */
  fill: number;
}

/** Group grid samples (each standing for a `step`×`step` cell) by the target they reach. */
export function hitRegions(samples: readonly HitSample[], step: number): HitRegion[] {
  const regions = new Map<string, { count: number } & Box>();
  for (const { x, y, target } of samples) {
    if (target === null) continue;
    const region = regions.get(target);
    if (!region) {
      regions.set(target, { count: 1, left: x, top: y, right: x + step, bottom: y + step });
      continue;
    }
    region.count += 1;
    region.left = Math.min(region.left, x);
    region.top = Math.min(region.top, y);
    region.right = Math.max(region.right, x + step);
    region.bottom = Math.max(region.bottom, y + step);
  }
  return [...regions].map(([target, { count, left, top, right, bottom }]) => {
    const width = right - left;
    const height = bottom - top;
    const area = count * step * step;
    return { target, area, box: { left, top, right, bottom }, width, height, fill: area / (width * height) };
  });
}

/** Straight-line distance between the nearest edges of two boxes; 0 when they touch or overlap. */
export function rectGap(a: Box, b: Box): number {
  const dx = Math.max(0, b.left - a.right, a.left - b.right);
  const dy = Math.max(0, b.top - a.bottom, a.top - b.bottom);
  return Math.hypot(dx, dy);
}

const centre = ({ box }: HitRegion): [number, number] => [(box.left + box.right) / 2, (box.top + box.bottom) / 2];

const pointToBox = ([x, y]: [number, number], box: Box): number =>
  Math.hypot(Math.max(box.left - x, 0, x - box.right), Math.max(box.top - y, 0, y - box.bottom));

/**
 * WCAG 2.5.8 spacing exception: a target under `size` either way passes only if a
 * `size`-diameter circle on its box centre touches no other target and no other
 * undersized target's circle. Returns the failing targets in input order.
 *
 * Given the samples, a neighbour is measured by the cells it really covers: a backdrop's
 * box is the whole screen, but it covers only the frame round the dialog it surrounds.
 */
export function spacingFailures(regions: readonly HitRegion[], size = 24, samples: readonly HitSample[] = [], step = 0): string[] {
  const undersized = (r: HitRegion) => r.width < size || r.height < size;
  const cellsOf = new Map<string, Box[]>();
  for (const { x, y, target } of samples) {
    if (target === null) continue;
    const cells = cellsOf.get(target) ?? [];
    if (cells.length === 0) cellsOf.set(target, cells);
    cells.push({ left: x, top: y, right: x + step, bottom: y + step });
  }
  const touches = (c: [number, number], other: HitRegion): boolean => {
    if (pointToBox(c, other.box) >= size / 2) return false;
    const cells = cellsOf.get(other.target);
    return cells === undefined || cells.some((cell) => pointToBox(c, cell) < size / 2);
  };
  return regions
    .filter(undersized)
    .filter((region) => {
      const c = centre(region);
      return regions.some((other) => {
        if (other === region) return false;
        if (touches(c, other)) return true;
        const o = centre(other);
        return undersized(other) && Math.hypot(c[0] - o[0], c[1] - o[1]) < size;
      });
    })
    .map((region) => region.target);
}
