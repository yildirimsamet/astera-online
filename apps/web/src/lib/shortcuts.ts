import { DOCK_TABS, type DockTab } from './dock.js';

/** What a key asks the shell for: a tab, the camera on the selection, or letting go of it. */
export type Shortcut =
  | { kind: 'tab'; tab: DockTab }
  | { kind: 'center' }
  | { kind: 'clear' };

/** The parts of a `KeyboardEvent` the reading needs, so it can be tested without one. */
export interface KeyPress {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  repeat: boolean;
  defaultPrevented: boolean;
  target: EventTarget | null;
}

/** Where a key belongs to what it is typed into. */
const TYPING = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

/** Where Space already means "press this". */
const PRESSABLE = `${TYPING}, button, a[href], summary, [role="button"], [role="tab"], [role="slider"], `
  + '[role="checkbox"], [role="radio"], [role="switch"], [role="option"], [role="menuitem"]';

/**
 * THE DESK KEYBOARD. Spec E11 · K10: 1–5 are the tabs, Space brings the camera to
 * what is selected, Esc closes.
 *
 * Esc on a page is the page's (both sheet kits answer it and claim it); this is the
 * Esc with no page open, which lets go of the selection. Space over a page scrolls
 * it, and on a focused control presses it, so it is theirs there. Nothing here takes
 * a key typed into a field, held down, or combined with a modifier — those belong to
 * the chat line, the browser and the system.
 */
export function shortcutOf(press: KeyPress, pageOpen: boolean): Shortcut | null {
  if (press.defaultPrevented || press.ctrlKey || press.metaKey || press.altKey) return null;
  const at = press.target instanceof Element ? press.target : null;
  if (at?.closest(TYPING)) return null;

  const index = ['1', '2', '3', '4', '5'].indexOf(press.key);
  if (index >= 0) {
    const tab = DOCK_TABS[index];
    return press.repeat || tab === undefined ? null : { kind: 'tab', tab };
  }
  if (press.key === ' ') {
    return pageOpen || press.repeat || at?.closest(PRESSABLE) ? null : { kind: 'center' };
  }
  if (press.key === 'Escape') return pageOpen ? null : { kind: 'clear' };
  return null;
}
