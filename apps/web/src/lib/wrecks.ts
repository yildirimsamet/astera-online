/** What a tap needs to know about a wreck field: where it is and how long it has left. */
interface WreckSpot {
  id: string;
  planetId: string | null;
  at: { x: number; y: number; z: number };
  minutesLeft: number;
}

/**
 * THE FIELD A TAP ON A WRECK RING OPENS: the freshest one on that spot. Owner report,
 * 2026-10-15 — the salvage button read "too late" on a debris field that had just formed.
 *
 * Every battle over a world leaves its own field, and in production most of them are
 * born while an older field still orbits the same world (780 of 1,304 in one week).
 * Their rings are drawn on one spot, so the ray chose between them and often opened the
 * old field, with minutes left and nothing a craft could still reach. The newest field
 * is the one the player just watched form and the one with the most time to race for.
 *
 * Fields over the same world share a spot; open-space fields share one only at the same
 * coordinates. An id no longer listed comes back unchanged.
 */
export function freshestWreckAt(wrecks: readonly WreckSpot[], id: string): string {
  const tapped = wrecks.find((wreck) => wreck.id === id);
  if (!tapped) return id;
  const sameSpot = (wreck: WreckSpot): boolean => (tapped.planetId === null
    ? wreck.planetId === null
      && wreck.at.x === tapped.at.x && wreck.at.y === tapped.at.y && wreck.at.z === tapped.at.z
    : wreck.planetId === tapped.planetId);
  return wrecks.reduce(
    (best, wreck) => (sameSpot(wreck) && wreck.minutesLeft > best.minutesLeft ? wreck : best),
    tapped,
  ).id;
}
