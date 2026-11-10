import { describe, expect, it } from 'vitest';
import { pendingSchema } from '../src/api/schemas.js';
import { ROUTE_COLOUR, routeLook } from '../src/galaxy/Fleets.js';
import { CLANMATE_COLOUR } from '../src/galaxy/PlanetField.js';

/**
 * KLAN KORİDORU ON THE DISC (F2 plan §5, owner 2026-11-10): a clan flight's first leg — aid, a
 * support wave, a war rally — runs on the clan's fast lane, so its route is drawn in the clan's
 * colour and flows toward where it lands. Every other route keeps the commander's own amber line.
 */
const thread = (over: Record<string, unknown>) => pendingSchema.parse({
  pending: [{ kind: 'transfer', targetName: 'Kuzgun', minutesRemaining: 9, arriveAt: '2026-11-10T12:09:00.000Z', ...over }],
}).pending[0]!;

describe('the corridor lane', () => {
  it('keeps the server’s corridor mark through the schema', () => {
    expect(thread({ corridor: true }).corridor).toBe(true);
    expect(thread({}).corridor).toBeUndefined();
  });

  it('draws a corridor leg in the clan’s colour, flowing', () => {
    expect(routeLook(thread({ corridor: true }))).toEqual({ colour: CLANMATE_COLOUR, flow: true });
  });

  it('leaves every other route as the commander’s still amber line', () => {
    expect(routeLook(thread({}))).toEqual({ colour: ROUTE_COLOUR, flow: false });
  });
});
