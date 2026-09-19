/**
 * WHAT COUNTS AS SOMETHING IN THE AIR. Owner instruction, 2026-09-19: drills,
 * probes and fleets cross the disc at thirty frames a second (`FLIGHT_FPS`), not at
 * the 24 a 120Hz display strides the ambient floor to.
 *
 * A pirate is left out on purpose. It goes round its orbit for hours and there is
 * nearly always one on the disc, so counting it would hold thirty for the whole
 * session and the ambient floor would never apply again. A battle published as a
 * flash (`effectOnly`) is not a craft either.
 *
 * Structural rather than the schema types, so the rule reads the three fields it
 * actually decides on and a test can state them without building whole payloads.
 */
export interface FlightSources {
  pending: readonly { path?: unknown }[];
  runs: readonly { status: string }[];
  contacts: readonly { kind: string; effectOnly?: boolean }[];
}

export function anythingInFlight({ pending, runs, contacts }: FlightSources): boolean {
  return pending.some((thread) => thread.path !== undefined)
    || runs.some((run) => run.status !== 'done')
    || contacts.some((contact) => contact.kind !== 'pirate' && contact.effectOnly !== true);
}
