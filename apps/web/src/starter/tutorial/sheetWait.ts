import { useEffect, useState } from 'react';
import type { Focus } from '../../galaxy/FocusPanel.js';
import type { TutorialAnswer } from './script.js';

/*
  THE CAMERA GOES FIRST (owner phone playtest 2026-11-18, items 20 and 21). In the lessons that pick a
  target, the sheet came up the moment the target was touched and covered the camera flying to it. A
  rock's sheet waits half a second from the touch, the length of the approach; the probe's target waits
  for the camera to reach the ship (half a second) and half a second more. Anywhere else a sheet opens at once.
*/
export const ROCK_SHEET_WAIT_MS = 500;
export const PROBE_SHEET_WAIT_MS = 1000;

/** How long the sheet of a target just touched waits for the camera, in this lesson. */
export function lessonSheetWait(answer: TutorialAnswer | null, focus: Focus | null): number {
  if (answer?.kind !== 'step' || answer.nav || !focus) return 0;
  if (answer.id === 'findRock' && focus.kind === 'asteroid') return ROCK_SHEET_WAIT_MS;
  if (answer.id === 'probe' && focus.kind === 'planet') return PROBE_SHEET_WAIT_MS;
  return 0;
}

const keyOf = (focus: Focus | null): string | null => (focus ? `${focus.kind}:${'id' in focus ? focus.id : ''}` : null);

/** True while the sheet of the target just touched waits; the wait is the touch's, whatever the lesson says next. */
export function useSheetWait(answer: TutorialAnswer | null, focus: Focus | null): boolean {
  const key = keyOf(focus);
  const wait = lessonSheetWait(answer, focus);
  const [seen, setSeen] = useState(key);
  const [held, setHeld] = useState<{ key: string; ms: number } | null>(null);
  if (key !== seen) {
    setSeen(key);
    setHeld(key !== null && wait > 0 ? { key, ms: wait } : null);
  }
  useEffect(() => {
    if (!held) return undefined;
    const timer = window.setTimeout(() => { setHeld(null); }, held.ms);
    return () => { window.clearTimeout(timer); };
  }, [held]);
  return held !== null && held.key === key;
}
