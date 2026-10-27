import { describe, expect, it } from 'vitest';
import { escortOf, escortRoute } from '../src/lib/admiralEscort.js';

const now = Date.parse('2026-10-25T12:00:00Z');
const view = (status: 'ready' | 'repair' | 'service' | 'admiral' | 'yarik', readyAt: string | null = null, rulesetVersion = 19) =>
  ({ capitalPlanetId: '00000000-0000-4000-8000-000000000001', rulesetVersion, ship: { class: 'kilavuz' as const, level: 1, status, readyAt } });

describe('the commander ship offered as a raid escort (Y9)', () => {
  it('offers a ready ship with its class bonus', () => {
    expect(escortOf(view('ready'), now)).toEqual({ kind: 'ready', ship: 'kilavuz', level: 1, bonuses: { damage: 1, hull: 1, time: 0.97, fuel: 0.95 } });
  });

  it('names what keeps a busy ship home, with the clock when it has one', () => {
    const later = new Date(now + 90_000).toISOString();
    expect(escortOf(view('repair', later), now)).toMatchObject({ kind: 'busy', reason: 'repair', until: now + 90_000 });
    expect(escortOf(view('service', later), now)).toMatchObject({ kind: 'busy', reason: 'service' });
    expect(escortOf(view('yarik'), now)).toMatchObject({ kind: 'busy', reason: 'yarik', until: null });
    expect(escortOf(view('admiral'), now)).toMatchObject({ kind: 'busy', reason: 'admiral', until: null });
    // A clock that has run out is a ready ship.
    expect(escortOf(view('repair', later), now + 90_000)?.kind).toBe('ready');
  });

  it('offers nothing before the season that carries escorts, or without a ship', () => {
    expect(escortOf(view('ready', null, 18), now)).toBeNull();
    expect(escortOf({ ...view('ready'), ship: null }, now)).toBeNull();
    expect(escortOf(undefined, now)).toBeNull();
  });

  it('offers it in a live season the server switched on, whatever its ruleset', () => {
    expect(escortOf({ ...view('ready', null, 18), admiral: true }, now)?.kind).toBe('ready');
    expect(escortOf({ ...view('ready', null, 19), admiral: false }, now)).toBeNull();
  });

  it('quotes the route the server will fly: legs times the time bonus, fuel rounded up', () => {
    const route = { distance: 900, oneWayMinutes: 40, exposureMinutes: 80, cargo: 10, fuel: 101, homeDefenceAfter: 3 };
    expect(escortRoute(route, { damage: 1, hull: 1, time: 0.97, fuel: 0.95 })).toEqual({ ...route, oneWayMinutes: 38.8, exposureMinutes: 77.6, fuel: 96 });
    expect(escortRoute(route, null)).toBe(route);
  });

  it('keeps a pirate meeting the server already solved at the escorted speed, shortening only the way home', () => {
    const route = { distance: 900, oneWayMinutes: 40, exposureMinutes: 80, cargo: 10, fuel: 101, homeDefenceAfter: 3 };
    expect(escortRoute(route, { damage: 1, hull: 1, time: 0.97, fuel: 0.95 }, true)).toEqual({ ...route, exposureMinutes: 78.8, fuel: 96 });
  });
});

describe('the escorted craft on the flight list (Y9)', () => {
  it('keeps the escort a thread names, so the galaxy draws it at the rear of the fleet', async () => {
    const { pendingSchema } = await import('../src/api/schemas.js');
    const thread = { kind: 'fleet', targetName: 'Vega', minutesRemaining: 4, arriveAt: '2026-10-25T12:04:00Z', id: 'm1' };
    const parsed = pendingSchema.parse({ pending: [{ ...thread, admiral: { ship: 'muhafiz', level: 3 } }, thread] });
    expect(parsed.pending[0]!.admiral).toEqual({ ship: 'muhafiz', level: 3 });
    expect(parsed.pending[1]!.admiral).toBeUndefined();
  });
});
