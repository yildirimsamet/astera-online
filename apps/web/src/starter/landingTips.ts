const DAY_MS = 86_400_000;

/** One line a day for the first week: what the ladder taught aboard has no ladder here. Plan §3.8. */
export type LandingTip = 'core' | 'colony' | 'clan' | 'dominion' | 'honor';

const SCHEDULE: readonly { from: number; to: number; id: LandingTip }[] = [
  { from: 0, to: 1, id: 'core' },
  { from: 1, to: 2, id: 'colony' },
  { from: 2, to: 3, id: 'clan' },
  { from: 3, to: 5, id: 'dominion' },
  { from: 5, to: 7, id: 'honor' },
];

export const tipFor = (landedAtMs: number, nowMs: number): LandingTip | null => {
  const days = (nowMs - landedAtMs) / DAY_MS;
  return SCHEDULE.find(entry => days >= entry.from && days < entry.to)?.id ?? null;
};

const keyOf = (id: LandingTip): string => `astera:landing-tip:${id}`;

/** A per-device convenience: at worst a note is read twice. */
export const tipDismissed = (id: LandingTip): boolean => {
  try { return window.localStorage.getItem(keyOf(id)) !== null; } catch { return false; }
};
export const dismissTip = (id: LandingTip): void => {
  try { window.localStorage.setItem(keyOf(id), '1'); } catch { /* Storage may be disabled. */ }
};
