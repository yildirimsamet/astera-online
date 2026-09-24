interface Span { left: number; right: number }

/** Never more than this share of the canvas: a sliver of galaxy still has a middle. */
const MOST = 0.8;
/** Sub-pixel rounding between a panel's edge and the canvas's. */
const EDGE = 2;

/**
 * HOW MUCH OF THE GALAXY A PAGE COVERS FROM THE RIGHT. E11 · K10.
 *
 * On a wide screen a page docks as a column over the right of the canvas. Only a panel
 * that reaches the canvas's right edge and starts inside it counts: a dialog in the
 * middle stops short of the edge, and a phone's bottom sheet starts where the canvas
 * does — neither covers anything to the side.
 */
export function rightCover(canvas: Span, panels: readonly Span[]): number {
  let cover = 0;
  for (const panel of panels) {
    const docked = panel.right >= canvas.right - EDGE && panel.left > canvas.left + EDGE;
    if (docked) cover = Math.max(cover, canvas.right - panel.left);
  }
  return Math.min(cover, (canvas.right - canvas.left) * MOST);
}
