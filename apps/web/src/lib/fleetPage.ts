import { ALL_HULLS, type Fleet, type HullId } from '@astera/rules';

/**
 * THE FLEET PAGE'S ARITHMETIC. Spec E4, B11 (docs/ui-v2/gozlemevi.md).
 */

/**
 * HOW FAR ALONG, AS A FRACTION OF THIS LEG. Null where the leg is not knowable.
 *
 * Clamped at both ends: a payload can be a few seconds stale on either side of a
 * departure or an arrival, and a marker drawn past the end of its own track reads
 * as a bug rather than as a late read.
 */
export const legProgress = (span: { from: number; to: number } | null, now: number): number | null => {
  if (!span) return null;
  const length = span.to - span.from;
  if (length <= 0) return 1;
  return Math.max(0, Math.min(1, (now - span.from) / length));
};

/**
 * WHAT A RECALL WOULD COST, IN TIME (K8). A turned flight comes home in the time it
 * has already flown, and stays in the air all that while — which is why the row says
 * it beside the button rather than after the press.
 */
export const recallPreview = (departAt: number, now: number): { backInMs: number; homeAt: number } => {
  const backInMs = Math.max(0, now - departAt);
  return { backInMs, homeAt: now + backInMs };
};

/** A pace worth a label, as a whole percentage; null at full speed or when unknown (S1). */
export const paceShown = (pace: number | undefined): number | null =>
  pace === undefined || pace >= 1 ? null : Math.round(pace * 100);

/** One world's ships at home, most first; ties in the catalogue's own order so the list never reshuffles. */
export const garrisonOf = (fleet: Fleet): { hull: HullId; count: number }[] =>
  ALL_HULLS
    .map((hull) => ({ hull, count: fleet[hull] ?? 0 }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);

interface Room { used: number; total: number; full: boolean }

/**
 * A WORLD'S ROOM: the Hangar (every ship it owns, home, away and queued, by bulk) and
 * the ground pool. The Hangar reading is optional on the wire for a rolling deploy.
 */
export function roomOf(capacity: {
  hangar?: number | undefined;
  hangarUsed?: number | undefined;
  hangarCeiling?: number | undefined;
  ground: number;
  groundUsed: number;
} | undefined): { hangar: (Room & { ceiling: number | null }) | null; ground: Room | null } {
  if (!capacity) return { hangar: null, ground: null };
  const hangar = capacity.hangar === undefined || capacity.hangarUsed === undefined
    ? null
    : {
        used: capacity.hangarUsed,
        total: capacity.hangar,
        full: capacity.hangarUsed >= capacity.hangar,
        ceiling: capacity.hangarCeiling ?? null,
      };
  return {
    hangar,
    ground: { used: capacity.groundUsed, total: capacity.ground, full: capacity.groundUsed >= capacity.ground },
  };
}
