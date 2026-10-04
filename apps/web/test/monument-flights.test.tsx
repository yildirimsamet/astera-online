import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { monumentsSchema } from '../src/api/schemas.js';
import { monumentPendingThreads } from '../src/lib/monumentFlights.js';
import { flightTitle } from '../src/lib/flights.js';
import { bombardmentTarget, legStandoff } from '../src/galaxy/scene.js';
import { FleetPage } from '../src/v2/hud/FleetPage.js';
import { ThreadFocus } from '../src/galaxy/FocusPanel.js';

const at = '2026-10-04T12:00:00.000Z', arrive = '2026-10-04T13:00:00.000Z';
const id = '00000000-0000-4000-8000-000000000001';
const lot = { id, hull: 'ARGOSY', count: 1, damageBp: 2000, remainderBp: 0.125,
  maxHp: 1350, remainingHp: 1079.983125, deuterium: 125.5, cargoCapacity: 300 };
const wave = { id, monumentId: id, playerId: id, originPlanetId: id, rootWaveId: null, jointOperationId: null,
  purpose: 'ATTACK', status: 'OUTBOUND', sentAt: at, heldAt: null, arriveAt: arrive,
  position: { x: 0, y: 0, z: 0 }, route: [{ from: { x: 3500, y: 0, z: 0 }, to: { x: 6000, y: 0, z: 0 },
    startMs: new Date(at).getTime(), endMs: new Date(arrive).getTime() }], tech: {}, fleet: { ARGOSY: 1 },
  lots: [lot], deuterium: 125.5, productionPerMinute: 0, fillsAt: null, nextLossAt: null,
  returnForecast: { homePlanetId: id, arriveAt: arrive, minutes: 60, doseHp: 50, destroyed: 0, deuterium: 125.5, lostDeuterium: 0, lots: [lot] } };
const view = monumentsSchema.parse({ serverNow: at, monuments: [{ id, ordinal: 2, position: { x: 6000, y: 0, z: 0 },
  controller: { kind: 'NEUTRAL' }, capacity: 7270, used: 1, reserved: 0, productionPerMinute: 60, emptySince: null }], waves: [wave], probes: [], probeReports: [] });

describe('native monument flights in the existing fleet surfaces', () => {
  it('carries the authoritative whole-wing death time and opens the native manifest from a flight', () => {
    const fadeAt = new Date('2026-10-04T12:15:00.000Z');
    const dying = monumentsSchema.parse({ ...view, waves: [{ ...wave, fadeAt }] });
    const thread = monumentPendingThreads(dying)[0]!;
    expect(thread.fadeAt).toEqual(fadeAt);
    const focus = vi.fn();
    render(<ThreadFocus thread={thread} minutesRemaining={30} open onToggle={vi.fn()} onClose={vi.fn()} onFocusMonument={focus} />);
    fireEvent.click(screen.getByRole('button', { name: /Look at Abandoned Station/ }));
    expect(focus).toHaveBeenCalledWith(id);
  });
  it('projects the exact native route and alive roster without inventing a planet, mission or engagement', () => {
    const [thread] = monumentPendingThreads(view);
    expect(thread).toMatchObject({ id, kind: 'monument', monumentId: id, monumentOrdinal: 2,
      fleet: { ARGOSY: 1 }, arriveAt: new Date(arrive), path: { from: wave.route[0]!.from, to: wave.route[0]!.to,
        departAt: new Date(at), arriveAt: new Date(arrive) } });
    expect(thread?.targetPlanetId).toBeUndefined();
    expect(thread?.recallable).toBeUndefined();
    expect(bombardmentTarget(thread!, [])).toBeUndefined();
    expect(legStandoff(thread!, [])).toEqual({ start: 0, end: 0 });
    expect(flightTitle(thread!)).toContain('Abandoned Station');
  });
  it('keeps indefinite HOLD out of the airborne timer list and uses the real return turn', () => {
    const holding = monumentsSchema.parse({ ...view, waves: [{ ...wave, status: 'HOLD', heldAt: arrive, arriveAt: null, route: [] }] });
    expect(monumentPendingThreads(holding)).toEqual([]);
    const returning = monumentsSchema.parse({ ...view, waves: [{ ...wave, status: 'RETURNING', route: [{ ...wave.route[0],
      from: { x: 5123, y: 0, z: 0 }, to: { x: 3500, y: 0, z: 0 } }] }] });
    expect(monumentPendingThreads(returning)[0]?.path?.from.x).toBe(5123);
    expect(monumentPendingThreads(returning)[0]?.leg).toBe('return');
  });
  it('renders HOLD as its own fleet group with physical cargo and a detail route', () => {
    const focus = vi.fn();
    const holding = monumentsSchema.parse({ ...view, waves: [{ ...wave, status: 'HOLD', heldAt: arrive, arriveAt: null, route: [] }] });
    render(<FleetPage tab="air" onTab={vi.fn()} now={new Date(at).getTime()} bays={null} hangar={null} flights={[]} worlds={[]}
      recalling={null} onFocus={vi.fn()} onRecall={vi.fn()} onOpenRepairStation={vi.fn()} onClose={vi.fn()}
      monuments={{ view: holding, onFocus: focus }} />);
    expect(screen.getByTestId('monument-hold-group')).toHaveTextContent(/125.5.*300/);
    fireEvent.click(screen.getByRole('button', { name: /Abandoned Station/ }));
    expect(focus).toHaveBeenCalledWith(id);
  });
});
