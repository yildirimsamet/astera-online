import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api, ApiError } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import i18n from '../src/i18n/index.js';
import { flightModifiers, planRoute } from '../src/lib/navigation.js';
import { LaunchSheet } from '../src/screens/LaunchSheet.js';
import { ToastProvider } from '../src/ui/Toast.js';
import type { GalaxyPlanet } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';
import { HULLS } from '@astera/rules';

/**
 * RADIATION ON THE LAUNCH SHEET. Plan D10 · F10.
 *
 * The route's dose is quoted beside the other prices of the press, before the hold:
 * what each ship will take and whether it lands needing the Repair Station. A route
 * that would finish ships says how many, in the colour of a loss — and holding the
 * commit is the commander's answer, carried to the server as the acknowledgement it
 * would otherwise refuse without.
 */

const target: GalaxyPlanet = {
  id: 'their-world', name: 'Orrery-8', owner: 'Sable', kind: 'CAPITAL',
  position: { x: 400, y: 0, z: 0 }, coreTier: 2, coreLevel: 6, satellites: [],
  shielded: false, isSelf: false, isOwned: false, isCapital: true, intel: 'RESOLVED', state: { kind: 'NORMAL' },
};
const mine = planetView({ fleet: { DART: 20 } }, { deuterium: 50_000 });
/** Whole minutes a single Dart takes to Orrery-8, as the sheet itself plans it. */
const minutes = planRoute(mine.planet.position, target.position, { DART: 1 }, mine.fleet, mine.ground,
  flightModifiers(mine)).oneWayMinutes;

function show(pctOverFlight: number | null, hpOverFlight?: number) {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  const launch = vi.spyOn(api, 'launch').mockResolvedValue({
    missionId: 'm1', arriveAt: new Date(Date.now() + 600_000), exposureMinutes: 20,
    homeDefenceAfter: 4, pending: [], planet: mine,
  } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.season, { rivals: [], shieldUntil: null, rulesetVersion: hpOverFlight === undefined ? 15 : 16 });
  client.setQueryData(keys.galaxy, {
    you: { planetId: mine.planet.id, playerId: 'me' },
    planets: [],
    hpRadiation: hpOverFlight === undefined ? [] : [{ id: 'hp', mode: 'EMIT', center: { x: 200, y: 0, z: 0 }, radius: 100_000,
      intensityHpPerMinute: hpOverFlight / minutes, activeFrom: new Date(0), activeUntil: null }],
    radiation: pctOverFlight === null ? [] : [{
      id: 'storm', mode: 'EMIT', center: { x: 200, y: 0, z: 0 }, radius: 100_000,
      intensityPctPerMinute: pctOverFlight / minutes, activeFrom: new Date(0), activeUntil: null,
    }],
  });
  render(
    <QueryClientProvider client={client}>
      <ApiProvider api={api}><ToastProvider>
        <LaunchSheet target={{ kind: 'world', world: target }} planet={mine} onClose={vi.fn()} onLaunched={vi.fn()} />
      </ToastProvider></ApiProvider>
    </QueryClientProvider>,
  );
  return { launch };
}

const pick = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /more dart/i }));
};
const hold = () => {
  const button = screen.getByRole('button', { name: /^launch/i });
  fireEvent.keyDown(button, { key: 'Enter' });
  fireEvent.keyDown(button, { key: 'Enter' });
};
const line = () => document.querySelector('[data-radiation-warning]');

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('radiation on the launch sheet', () => {
  it('shows the new HP route loss and carries its held consent without using the legacy percent clouds', async () => {
    const { launch } = show(null, HULLS.DART.hp * 2);
    await pick();
    expect(line()).toHaveTextContent(/HP per ship/);
    expect(line()).toHaveTextContent(/destroys 1 ship/);
    hold();
    await waitFor(() => { expect(launch).toHaveBeenCalled(); });
    expect(launch.mock.calls[0]?.[5]).toBe(true);
  });
  it('says nothing where the route crosses no cloud', async () => {
    show(null);
    await pick();
    expect(line()).toBeNull();
  });

  it('quotes the share of a hull each ship takes, and that it will need the Repair Station', async () => {
    show(30);
    await pick();
    expect(line()).toHaveTextContent(/radiation/i);
    expect(line()).toHaveTextContent(/30%/);
    expect(line()).toHaveTextContent(/Repair Station/);
  });

  it('says a light dose is patched free on landing', async () => {
    show(10);
    await pick();
    expect(line()).toHaveTextContent(/10%/);
    expect(line()).toHaveTextContent(/patched free/);
  });

  it('asks for nothing when the cloud only hurts', async () => {
    const { launch } = show(30);
    await pick();
    hold();
    await waitFor(() => { expect(launch).toHaveBeenCalled(); });
    expect(launch.mock.calls[0]?.[5]).toBeUndefined();
  });

  it('names how many ships a lethal route finishes, and the hold carries the answer', async () => {
    const { launch } = show(300);
    await pick();
    expect(line()).toHaveTextContent(/destroys 1 ship/);
    hold();
    await waitFor(() => { expect(launch).toHaveBeenCalled(); });
    expect(launch.mock.calls[0]?.[5]).toBe(true);
  });

  /*
    THE SERVER'S ANSWER IS A FORECAST TOO. At a window's edge, or for a cloud about to light,
    the server can find a route lethal that the sheet quoted as safe. Its refusal names the
    count; the sheet says it, and the next hold is the acknowledgement it asked for.
  */
  it('takes the server\'s lethal refusal as the question, and the next hold answers it', async () => {
    const { launch } = show(null);
    launch.mockRejectedValueOnce(new ApiError('RADIATION_LETHAL', 'lethal', 409, { count: 1 }));
    await pick();
    hold();
    await waitFor(() => { expect(line()).toHaveTextContent(/destroys 1 ship/); });
    expect(launch.mock.calls[0]?.[5]).toBeUndefined();
    hold();
    await waitFor(() => { expect(launch).toHaveBeenCalledTimes(2); });
    expect(launch.mock.calls[1]?.[5]).toBe(true);
  });
});
