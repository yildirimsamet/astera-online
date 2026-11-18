/*
  ONE SCROLL AT A TIME (owner phone playtest 2026-11-18, item 25). On the way down to Repair the page
  jumped back up to the reward: the ship's repair moment and the guide's pointer each moved it. A moment
  that plays where the player is looking holds the others' scrolling until it is over; then one hand
  moves the page.
*/
let heldUntil = 0;

export function holdScroll(ms: number, now = Date.now()): void {
  heldUntil = Math.max(heldUntil, now + ms);
}

export function releaseScroll(): void {
  heldUntil = 0;
}

export const scrollHeld = (now = Date.now()): boolean => now < heldUntil;
