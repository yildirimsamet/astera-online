/**
 * NEW COMMANDER 7 DAYS (plan 2026-11-06 §7.2, Y3). Once an account, from the ship's claim through the
 * landing. No streak: boxes are counted, not days, and a missed day loses nothing. One box a day at
 * most: the next is ready `gapHours` after the last was opened. Only resources, about an hour of what
 * the commander makes now, crystal-heavy; the seventh about three hours. Aboard it goes to the ship, after
 * the landing to the capital's store — where it can be raided, as every reward can.
 */
export const WELCOME_WEEK = {
  boxes: 7,
  gapHours: 20,
  /** Hours of output in each box, in order. */
  hours: [1, 1, 1, 1, 1, 1, 3],
  /** Of the box's worth, this share is crystal: the slower resource early on. */
  crystalShare: 0.6,
  /** A box is never empty: at least this much an hour, even while production is down. */
  floorPerHour: 150,
} as const;

/** Which box opens next and from when (epoch ms); both null once all seven are open. */
export function welcomeNext(opened: number, lastOpenedAtMs: number | null): { box: number | null; readyAtMs: number | null } {
  if (opened >= WELCOME_WEEK.boxes) return { box: null, readyAtMs: null };
  const readyAtMs = lastOpenedAtMs === null ? 0 : lastOpenedAtMs + WELCOME_WEEK.gapHours * 3_600_000;
  return { box: opened + 1, readyAtMs };
}

/** What box `index` (1–7) holds at this hourly output. */
export function welcomeBox(index: number, perHour: { alloy: number; crystal: number }): { alloy: number; crystal: number } {
  const hours = WELCOME_WEEK.hours[index - 1];
  if (hours === undefined) throw new Error(`No welcome box ${String(index)}`);
  const worth = Math.round(hours * Math.max(WELCOME_WEEK.floorPerHour, Math.max(0, perHour.alloy) + Math.max(0, perHour.crystal)));
  const crystal = Math.round(worth * WELCOME_WEEK.crystalShare);
  return { alloy: worth - crystal, crystal };
}
