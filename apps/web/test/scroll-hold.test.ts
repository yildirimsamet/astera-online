import { afterEach, describe, expect, it } from 'vitest';
import { holdScroll, releaseScroll, scrollHeld } from '../src/lib/scrollHold.js';

/*
  Owner phone playtest 2026-11-18 (item 25): on the way down to Repair the page jumped back up to the
  reward. Two hands moved it: the ship's repair moment and the guide's pointer. A moment on screen now
  holds the others' scrolling until it is over.
*/
describe('one scroll at a time', () => {
  afterEach(() => { releaseScroll(); });

  it('holds for as long as it was asked, then lets go', () => {
    holdScroll(1000, 0);
    expect(scrollHeld(999)).toBe(true);
    expect(scrollHeld(1000)).toBe(false);
  });

  it('keeps the longer of two holds, and lets go at once when released', () => {
    holdScroll(2000, 0);
    holdScroll(500, 100);
    expect(scrollHeld(1500)).toBe(true);
    releaseScroll();
    expect(scrollHeld(1500)).toBe(false);
  });
});
