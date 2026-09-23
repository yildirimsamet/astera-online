/**
 * THE HEIGHTS A v2 SHEET SETTLES AT. Spec B3 and the gesture table.
 *
 * peek (≤140 px) is the context card beside the world; half (55%) and full (92%)
 * are the dossier and the pages the dock opens. A sheet lists the ones it uses,
 * lowest first.
 */
export type Detent = 'peek' | 'half' | 'full';

/** How far a pull has to travel before it counts; a shorter one is a slip, not a gesture. */
export const DRAG_STEP_PX = 40;

/**
 * The height one step up or down from `current`. Up stops at the top; down from
 * the lowest height is null, which means the sheet closes.
 */
export function nextDetent(detents: readonly Detent[], current: Detent, direction: 'up' | 'down'): Detent | null {
  const at = Math.max(0, detents.indexOf(current));
  if (direction === 'up') return detents[Math.min(detents.length - 1, at + 1)] ?? current;
  return at === 0 ? null : detents[at - 1] ?? null;
}

/** A pull on the handle, read by its distance: negative is up the screen. */
export function dragStep(dy: number): 'up' | 'down' | null {
  if (dy <= -DRAG_STEP_PX) return 'up';
  if (dy >= DRAG_STEP_PX) return 'down';
  return null;
}
