import type { ActiveGalaxyEvent } from '../api/schemas.js';

export type IntergalacticConvoyEvent = Extract<
  ActiveGalaxyEvent,
  { kind: 'INTERGALACTIC_CONVOY' }
>;

/** The one public convoy whose half-open occurrence window contains `now`. */
export function activeIntergalacticConvoy(
  events: readonly ActiveGalaxyEvent[] | undefined,
  now: number,
): IntergalacticConvoyEvent | null {
  for (const event of events ?? []) {
    if (event.kind === 'INTERGALACTIC_CONVOY'
      && event.startsAt.getTime() <= now
      && now < event.endsAt.getTime()) {
      return event;
    }
  }
  return null;
}
