/**
 * THE "ONLINE" CARD WAITS ITS TURN (owner playtest 2026-11-07). While the starter tutorial speaks about
 * something else, a system's "online" card stays away: on the first look it stood under the NPC and
 * read as a second instruction. The coach holds it; the card shows when a line points at it.
 */
let held = false;
const listeners = new Set<() => void>();

export const unlockHeld = (): boolean => held;

export function watchUnlockHold(notify: () => void): () => void {
  listeners.add(notify);
  return () => { listeners.delete(notify); };
}

export function holdUnlock(next: boolean): void {
  if (held === next) return;
  held = next;
  listeners.forEach((notify) => { notify(); });
}
