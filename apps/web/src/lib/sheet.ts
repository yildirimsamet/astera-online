/**
 * THE HEIGHTS A v2 SHEET SETTLES AT. Spec B3 and the gesture table.
 *
 * peek (≤140 px) is the context card beside the world; half (55%) and full (92%)
 * are the dossier and the pages the dock opens; fit is as tall as its content, up
 * to a page, and scrolls the rest (owner, 2026-09-24: an item sheet stood full height
 * over empty space). A sheet lists the ones it uses, lowest first.
 */
export type Detent = 'peek' | 'half' | 'fit' | 'full';

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

/**
 * ONE ESCAPE, ONE SHEET. An item sheet opened over the Base page closed the page with
 * it, because every open sheet heard the same key. The sheet on top is the last panel
 * in the document — a sheet opened from another is drawn inside it or after it — and
 * only that one answers. Both kits mark their panel `data-sheet-panel`.
 */
export function isTopSheet(panel: Element | null): boolean {
  if (!panel) return false;
  const panels = document.querySelectorAll('[data-sheet-panel]');
  return panels[panels.length - 1] === panel;
}

/**
 * Whether this Escape is this sheet's to answer, CLAIMING it if so. Listener order is
 * not stable (a re-render re-registers), and React removes a closed sheet before the
 * next listener runs — so without the claim the sheet below found itself on top and
 * closed on the same key.
 */
export function claimEscape(event: KeyboardEvent, panel: Element | null): boolean {
  if (event.key !== 'Escape' || event.defaultPrevented || !isTopSheet(panel)) return false;
  event.preventDefault();
  return true;
}
