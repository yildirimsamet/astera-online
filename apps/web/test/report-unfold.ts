import type { ReactNode } from 'react';
import { render as renderOnce, type RenderOptions, type RenderResult } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

/**
 * THE REPORT'S FOUR QUESTIONS, OPEN FOR A FILE THAT READS WHAT THEY SAY. O6 (owner 2026-11-17)
 * shuts each question under the scene in a fold; the files that check what a part SAYS read it
 * opened, as a player who pressed its head does. How the sheet ARRIVES — every fold shut — is
 * pinned in `battle-report-sheet-kit.test.tsx`.
 */
const unfold = (): void => {
  for (const fold of document.querySelectorAll<HTMLDetailsElement>('details[data-report-section]')) fold.open = true;
};

/** A report rendered at once arrives with its questions open… */
export function render(ui: ReactNode, options?: Omit<RenderOptions, 'queries'>): RenderResult {
  const view = renderOnce(ui, options);
  unfold();
  return view;
}

/** …and one opened later, from the list or a notification, opens as it lands. */
export function unfoldReportsOnArrival(): void {
  let watch: MutationObserver | null = null;
  beforeEach(() => {
    watch = new MutationObserver(unfold);
    watch.observe(document.body, { childList: true, subtree: true });
  });
  afterEach(() => { watch?.disconnect(); });
}
