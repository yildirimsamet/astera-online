import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Focus } from '../src/galaxy/FocusPanel.js';
import type { TutorialAnswer, TutorialLineId } from '../src/starter/tutorial/script.js';
import { PROBE_SHEET_WAIT_MS, ROCK_SHEET_WAIT_MS, lessonSheetWait, useSheetWait } from '../src/starter/tutorial/sheetWait.js';

/*
  Owner phone playtest 2026-11-18 (items 20, 21): in the lessons that pick a target, the sheet came up the
  moment the target was touched and covered the camera flying to it. The camera goes first: a rock's sheet
  half a second after the touch (the approach is watched), the probe's target a half second after the
  camera has reached it. Everywhere else a sheet opens at once.
*/
const step = (id: TutorialLineId): TutorialAnswer => ({ kind: 'step', id, step: 'press', marks: [], chapter: 6, strict: false });
const rock: Focus = { kind: 'asteroid', id: 'rock-1' };
const ship: Focus = { kind: 'planet', id: 'ship-9' };
interface Props { answer: TutorialAnswer | null; focus: Focus | null }
const hold = (initialProps: Props) => renderHook(({ answer, focus }: Props) => useSheetWait(answer, focus), { initialProps });

describe('how long a lesson\'s sheet waits for the camera', () => {
  it('waits half a second for a rock found in its lesson, and a second for the probe\'s target', () => {
    expect(ROCK_SHEET_WAIT_MS).toBe(500);
    expect(PROBE_SHEET_WAIT_MS).toBe(1000);
    expect(lessonSheetWait(step('findRock'), rock)).toBe(ROCK_SHEET_WAIT_MS);
    expect(lessonSheetWait(step('probe'), ship)).toBe(PROBE_SHEET_WAIT_MS);
  });
  it('does not wait outside those lessons, or for another kind of target', () => {
    expect(lessonSheetWait(null, rock)).toBe(0);
    expect(lessonSheetWait(step('mine'), rock)).toBe(0);
    expect(lessonSheetWait(step('findRock'), ship)).toBe(0);
    expect(lessonSheetWait(step('probe'), rock)).toBe(0);
    expect(lessonSheetWait(step('findRock'), null)).toBe(0);
  });
});

describe('a sheet held while the camera flies', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('holds the sheet of a target touched in the lesson, then lets it up', () => {
    const { result, rerender } = hold({ answer: step('findRock'), focus: null });
    expect(result.current).toBe(false);
    rerender({ answer: step('findRock'), focus: rock });
    expect(result.current).toBe(true);
    // The lesson moves on as the rock is taken: the hold is the touch's, and keeps its time.
    rerender({ answer: step('mine'), focus: rock });
    expect(result.current).toBe(true);
    act(() => { vi.advanceTimersByTime(ROCK_SHEET_WAIT_MS - 10); });
    expect(result.current).toBe(true);
    act(() => { vi.advanceTimersByTime(20); });
    expect(result.current).toBe(false);
  });

  it('opens at once a sheet already open, or touched outside the lesson', () => {
    const { result, rerender } = hold({ answer: step('findRock'), focus: rock });
    expect(result.current).toBe(false);
    rerender({ answer: null, focus: ship });
    expect(result.current).toBe(false);
  });
});
