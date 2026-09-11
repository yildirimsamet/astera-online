/** Explicit waking windows. Season origin is Monday 07:30 Türkiye time; no activity production multiplier. */
export type ActivityProfile = 'heavy' | 'average' | 'half' | 'low' | 'low-once';
export interface ActivityWindow { start: number; end: number }

/**
 * THE AUDIENCE, WRITTEN DOWN. Owner brief, 2026-09-10.
 *
 * Thirty to forty, working, out of the house from eight until seven. They check in
 * from wherever they are — a build finishes while the phone is in a pocket — and
 * the session that matters is the evening one, an hour or two on the sofa. The
 * brief's own figures are `average`: 10, 15, 15 and 90 minutes on a working day,
 * 130 in the evening at the weekend.
 *
 * `heavy` and `half` are the brief's other sentence — *"bu değerlerin 2 katına
 * çıkanlar da olacaktır, yarısı kadar oynayanlar da"* — so the population has a
 * spread rather than a single point. They scale the WHOLE day, evening included,
 * because a player who plays twice as much does not do it in the same ninety
 * minutes.
 *
 * `low` and `low-once` are the tail below all three: twenty minutes, lapsing.
 *
 * OFFSETS ARE MINUTES FROM 07:30 — 0 is waking, 270 is noon, 480 is mid-afternoon,
 * 720 is half past seven in the evening. Nothing here may run past 01:00; the
 * calendar test holds that, because a bot awake at four in the morning is the
 * measurement error this file exists to end.
 */
const SLOTS: Record<ActivityProfile, { weekday: number[][]; weekend: number[][] }> = {
  heavy: {
    weekday: [[0, 20], [270, 30], [480, 30], [720, 180]],
    weekend: [[0, 20], [330, 20], [720, 260]],
  },
  average: {
    weekday: [[0, 10], [270, 15], [480, 15], [720, 90]],
    weekend: [[0, 10], [330, 10], [720, 130]],
  },
  half: {
    weekday: [[0, 5], [270, 8], [480, 7], [720, 45]],
    weekend: [[0, 5], [330, 5], [720, 65]],
  },
  low: { weekday: [[0, 10], [720, 10]], weekend: [[0, 10], [720, 10]] },
  'low-once': { weekday: [[720, 20]], weekend: [[720, 20]] },
};

export function playerWindows(profile: ActivityProfile, days: number): ActivityWindow[] {
  const windows: ActivityWindow[] = [];
  for (let day = 0; day < Math.ceil(days); day++) {
    const slots = day % 7 < 5 ? SLOTS[profile].weekday : SLOTS[profile].weekend;
    for (const [offset, duration] of slots) {
      const start = day * 1440 + offset!, end = Math.min(days * 1440, start + duration!);
      if (start < end) windows.push({ start, end });
    }
  }
  return windows;
}

/**
 * HOW OFTEN A WAKING PLAYER ACTS. D189.
 *
 * TWO MINUTES WAS NOT A MODEL OF ANYBODY. It made a ninety-minute evening into
 * forty-five complete sessions — forty-five chances to launch, queue and buy — and
 * the galaxy flew 6.5 raids per player per day. Nobody does that; the figure was an
 * artefact of the tick, and every band measured through it inherited the inflation.
 *
 * TEN IS CHOSEN FROM THE GAME'S OWN CLOCKS, not from a target. What makes a
 * commander act again is the shortest thing that CHANGES: a wave coming home
 * (15-32 minutes), a short build finishing (minutes early, hours later), a
 * threshold crossed. Ten minutes sits under the fastest of those, so the model
 * never misses a change, and above the point where it would be inventing acts
 * between changes.
 *
 * IT ALSO MAKES THE BRIEF'S OWN WINDOWS READ CORRECTLY. The ten-minute morning
 * check-in is exactly ONE act — collect, queue, pocket the phone — which is how the
 * audience described it; the ninety-minute evening is nine, one per ten minutes on
 * the sofa, which is if anything conservative.
 *
 * MEASURED ACROSS THE CADENCE, two seeds, `by-archetype`:
 *
 *   cadence   raids/player/day   sessions/player/day
 *      2            6.53                68.7
 *      5            4.28                27.3
 *     10            2.73                14.4
 *     15            2.00                 9.9
 *     20            1.81                 8.5
 *
 * Fifteen is defensible too and was rejected for one reason: it cuts the evening to
 * six acts, which is fewer than the round trips that fit in it.
 */
export const DECISION_MINUTES = 10;

/** Next decision strictly after `after`, one cadence step while active. */
export function nextDecision(profile: ActivityProfile, after: number, days: number): number {
  const step = DECISION_MINUTES;
  for (const w of playerWindows(profile, days)) {
    const next = w.start + Math.max(0, Math.floor((after - w.start) / step) + 1) * step;
    if (next < w.end) return next;
  }
  return Infinity;
}
