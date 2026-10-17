import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiProvider } from '../src/api/context.js';
import { useUnknownSignals, useUnknownSignalActions } from '../src/api/queries.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HULLS, type UnknownSignalOutcome } from '@astera/rules';
import type { UnknownSignalView } from '../src/api/schemas.js';
import { UnknownSignalSheet } from '../src/screens/UnknownSignalSheet.js';
import { UnknownSignalHud } from '../src/screens/UnknownSignalHud.js';
import { unknownSignalQuote, unknownSignalMarkerState, openUnknownSignal, subscribeUnknownSignal } from '../src/lib/unknownSignal.js';
import { readsForPrivateEvent, readsForShardEvent } from '../src/session/shardEvents.js';
import { keys } from '../src/api/keys.js';
import { Api } from '../src/api/client.js';
import { flightRecallInput, flightTitle } from '../src/lib/flights.js';
import { describeNotification, signalFamily, signalGlyph } from '../src/lib/notifications.js';
import i18n from '../src/i18n/index.js';
import { planetView } from './fixtures.js';

const now = Date.parse('2026-10-17T09:00:00Z');
const signal = (outcome: UnknownSignalOutcome | null = null): UnknownSignalView => ({
  id: '00000000-0000-4000-8000-000000000001', at: { x: 2000, y: 0, z: 0 }, status: outcome ? 'returning' : 'open',
  appearedAt: new Date(now), expiresAt: new Date(now + 3_600_000), originPlanetId: null, origin: null,
  fleet: null, damage: null, departAt: null, arriveAt: null, returnDepartAt: null, returnAt: null,
  recalledAt: null, outcome, deliveredAt: null,
});
const props = () => ({ signal: signal(), planet: planetView({ fleet: { DART: 1, PIKE: 1, RAMPART: 1, COURIER: 1 },
  buildings: { CORE: 3, REFINERY: 1, EXTRACTOR: 1, SHIPYARD: 1, VAULT: 0 } }, { deuterium: 1000 }),
  now, radar: { level: 0, range: 2700 }, tier: 1 as const,
  onClose: vi.fn(), onSend: vi.fn(), onBuild: vi.fn(), onSkins: vi.fn(),
});
beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('unknown signal commitment sheet', () => {
  it('refuses departure from a world still in recovery', () => {
    const p = props();
    p.planet.planet.recoveryUntil = new Date(now + 60_000);
    expect(unknownSignalQuote(p.planet, p.signal, 'DART', now).blocked).toBe('locked');
  });

  it('uses a real translated cosmetic name in a skin result', () => {
    const p = props(); p.signal = signal({ kind: 'SKIN', cosmeticId: 'planet-lava' });
    render(<UnknownSignalSheet {...p} />);
    expect(screen.getByTestId('unknown-signal-result')).not.toHaveTextContent('skins.items');
  });
  it('defaults to the cheapest available warship, requires a Courier, and explains all five odds', () => {
    render(<UnknownSignalSheet {...props()} />);
    expect(screen.getByRole('radio', { name: /Dart/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Investigate signal' })).toBeEnabled();
    for (const percent of ['56%', '15%', '12%', '16%', '1%']) expect(screen.getByText(percent)).toBeInTheDocument();
    expect(screen.getByText(/If pirates are waiting/)).toBeInTheDocument();
    expect(screen.getByText(/You have no Radar yet/)).toBeInTheDocument();
  });

  it('sends exactly the selected warship and Courier through its single commitment action', () => {
    const p = props();
    render(<UnknownSignalSheet {...p} />);
    fireEvent.click(screen.getByRole('radio', { name: /Rampart/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Investigate signal' }));
    expect(p.onSend).toHaveBeenCalledWith('RAMPART');
  });

  it.each(['warship', 'courier', 'shipyard', 'bays', 'fuel', 'expired'] as const)('explains %s and disables launch', reason => {
    const p = props();
    if (reason === 'warship') p.planet.fleet = { COURIER: 1 };
    if (reason === 'courier' || reason === 'shipyard') p.planet.fleet = { DART: 1 };
    if (reason === 'shipyard') p.planet.buildings.SHIPYARD = 0;
    if (reason === 'bays') p.planet.flight = { used: 3, total: 3 };
    if (reason === 'fuel') p.planet.planet.deuterium = 0;
    if (reason === 'expired') p.signal.expiresAt = new Date(now);
    render(<UnknownSignalSheet {...p} />);
    expect(screen.getByRole('button', { name: 'Investigate signal' })).toBeDisabled();
    expect(screen.getByRole('status')).not.toBeEmptyDOMElement();
    if (reason === 'shipyard') expect(screen.getByText(/Courier needs Shipyard level 1/)).toBeInTheDocument();
  });

  it('opens ship construction and explains Radar without a navigation button', () => {
    const p = props(); p.planet.fleet = { DART: 1 };
    render(<UnknownSignalSheet {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Build Courier' }));
    expect(p.onBuild).toHaveBeenCalledWith('COURIER');
    expect(screen.queryByRole('button', { name: 'Open Radar' })).not.toBeInTheDocument();
    expect(screen.getByText(/incoming attack fleets/)).toBeInTheDocument();
  });

  it('shows the outbound status without suggesting recall or navigating to Radar', () => {
    const p = props(); p.signal.status = 'outbound'; p.signal.arriveAt = new Date(now + 60_000);
    render(<UnknownSignalSheet {...p} />);
    expect(screen.queryByRole('button', { name: 'Recall fleet' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Radar' })).not.toBeInTheDocument();
    expect(screen.getByText(/incoming attack fleets/)).toBeInTheDocument();
  });

  it('derives travel and loss value from the current shared ship catalogue', () => {
    const p = props();
    const dart = unknownSignalQuote(p.planet, p.signal, 'DART', now);
    const rampart = unknownSignalQuote(p.planet, p.signal, 'RAMPART', now);
    expect(rampart.minutes).toBeGreaterThan(dart.minutes);
    expect(dart.risk.alloy).toBe(HULLS.DART.alloy + HULLS.COURIER.alloy);
    expect(dart.risk.crystal).toBe(HULLS.DART.crystal + HULLS.COURIER.crystal);
    expect(dart.roundTripMinutes).toBe(dart.minutes * 2);
    expect(dart.fuel).toBeGreaterThan(0);
  });

  it('routes private discovery events without invalidating public galaxy reads', () => {
    const reads = readsForPrivateEvent('private:unknown-signal-spawn');
    expect(reads).toContainEqual(keys.unknownSignals);
    expect(reads).not.toContainEqual(keys.galaxy);
    expect(reads).not.toContainEqual(keys.traffic);
    expect(readsForShardEvent('shard:season')).toContainEqual(keys.unknownSignals);
  });
});

describe('unknown signal client integration', () => {
  it('opens an owned result id from the notification door and removes its listener on unmount', () => {
    const focused = vi.fn(); const stop = subscribeUnknownSignal(focused);
    openUnknownSignal(signal().id);
    expect(focused).toHaveBeenCalledWith(signal().id);
    window.dispatchEvent(new CustomEvent('astera:unknown-signal', { detail: { id: 'forged' } }));
    expect(focused).toHaveBeenCalledTimes(1);
    stop(); openUnknownSignal(signal().id);
    expect(focused).toHaveBeenCalledTimes(1);
  });
  it('opens the discovered signal from its HUD chip and commits through the real selected id', () => {
    const p = props(); const onFocus = vi.fn(); const onSend = vi.fn();
    const data = { signals: [{ ...signal(), expiresAt: new Date(Date.now() + 3_600_000) }], radar: { capitalPlanetId: p.planet.planet.id, at: p.planet.planet.position, level: 0, range: 2700 }, tier: 1 as const };
    const hud = { data, planet: p.planet, focusedId: null as string | null, worlds: [p.planet], onFocus, onSend,
      onClose: p.onClose, onOrigin: vi.fn(), onBuild: p.onBuild, onSkins: p.onSkins, onDetected: vi.fn() };
    const view = render(<UnknownSignalHud {...hud} />);
    fireEvent.click(screen.getByRole('button', { name: /Unknown signal/ }));
    expect(onFocus).toHaveBeenCalledWith(data.signals[0]!.id);
    view.rerender(<UnknownSignalHud {...hud} focusedId={data.signals[0]!.id} />);
    fireEvent.click(screen.getByRole('button', { name: 'Investigate signal' }));
    expect(onSend).toHaveBeenCalledWith(data.signals[0]!.id, 'DART');
  });
  it('keeps a dispatched signal targeted and uses bounded arrival effects and expiry fade', () => {
    const s = signal();
    expect(unknownSignalMarkerState(s, now).phase).toBe('open');
    expect(unknownSignalMarkerState(s, s.expiresAt.getTime() - 500).opacity).toBeLessThan(1);
    expect(unknownSignalMarkerState(s, s.expiresAt.getTime()).phase).toBe('hidden');
    s.status = 'outbound';
    expect(unknownSignalMarkerState(s, s.expiresAt.getTime()).phase).toBe('targeted');
    s.status = 'returning'; s.arriveAt = new Date(now); s.outcome = { kind: 'RESOURCES', loot: { alloy: 200, crystal: 0, deuterium: 0 } };
    expect(unknownSignalMarkerState(s, now + 500).phase).toBe('flash');
    expect(unknownSignalMarkerState(s, now + 4000).phase).toBe('hidden');
    s.status = 'lost'; s.outcome = { kind: 'PIRATES' };
    expect(unknownSignalMarkerState(s, now + 500).phase).toBe('pirates');
  });
  it('refreshes personal signals and owned world state after dispatch', async () => {
    const api = new Api();
    vi.spyOn(api, 'unknownSignals').mockResolvedValue({ signals: [signal()] });
    vi.spyOn(api, 'dispatchUnknownSignal').mockResolvedValue({ signalId: signal().id, arriveAt: new Date(now + 600_000), fuel: 10 });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>;
    const hook = renderHook(() => ({ list: useUnknownSignals(), actions: useUnknownSignalActions() }), { wrapper });
    await waitFor(() => { expect(hook.result.current.list.data?.signals).toHaveLength(1); });
    await act(async () => { await hook.result.current.actions.send.mutateAsync({ id: signal().id, originPlanetId: props().planet.planet.id, fleet: { DART: 1, COURIER: 1 }, key: 'hook-send' }); });
    expect(invalidate.mock.calls.map(([filter]) => filter?.queryKey)).toEqual(expect.arrayContaining([keys.unknownSignals, keys.pending, keys.planet, keys.planets]));
    hook.unmount(); client.clear();
  });
  it('reads privately, sends an exact manifest with a stable retry key, and recalls through its own API', async () => {
    const id = signal().id;
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(input => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      return Promise.resolve(new Response(JSON.stringify(
        url.endsWith('/dispatch') ? { signalId: id, arriveAt: new Date(now + 600_000), fuel: 20 }
          : url.endsWith('/recall') ? { signalId: id, returnAt: new Date(now + 300_000) } : { signals: [signal()] },
      ), { status: 200, headers: { 'content-type': 'application/json' } }));
    });
    const api = new Api({ fetch });
    expect((await api.unknownSignals()).signals[0]?.id).toBe(id);
    await api.dispatchUnknownSignal(id, props().planet.planet.id, { WARDEN: 1, COURIER: 1 }, 'signal-test-launch');
    expect(fetch.mock.calls[1]?.[1]).toMatchObject({ method: 'POST', body: JSON.stringify({ originPlanetId: props().planet.planet.id, fleet: { WARDEN: 1, COURIER: 1 } }) });
    expect(new Headers(fetch.mock.calls[1]?.[1]?.headers).get('idempotency-key')).toBe('signal-test-launch');
    await api.recallUnknownSignal(id, 'signal-test-recall');
    expect(fetch.mock.calls[2]?.[0]).toBe(`/api/unknown-signals/${id}/recall`);
    expect(new Headers(fetch.mock.calls[2]?.[1]?.headers).get('idempotency-key')).toBe('signal-test-recall');
  });

  it('names and recalls a signal flight without exposing a wire identifier', () => {
    const thread = { id: signal().id, kind: 'unknown_signal' as const, leg: 'outbound' as const,
      arriveAt: new Date(now + 600_000), recallable: true, targetName: 'UNKNOWN_SIGNAL', minutesRemaining: 10 };
    expect(flightTitle(thread)).toBe(i18n.t('unknownSignal.flightOut'));
    expect(flightRecallInput(thread, now)).toEqual({ missionId: thread.id, unknownSignal: true });
    expect(flightTitle({ ...thread, leg: 'return' })).toBe(i18n.t('unknownSignal.flightHome'));
  });
});

describe('unknown signal result cards', () => {
  it('shows cargo loss as soon as the Courier is gone, while the warship is still returning', () => {
    const p = props(); p.signal = signal({ kind: 'RESOURCES', loot: { alloy: 500, crystal: 0, deuterium: 0 } });
    p.signal.fleet = { DART: 1 };
    render(<UnknownSignalSheet {...p} />);
    expect(screen.getByText(/Courier was lost/)).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('unknownSignal.lost'))).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('unknownSignal.inTransit'))).not.toBeInTheDocument();
  });

  it('does not call a derelict delivered when that hull was destroyed on the return leg', () => {
    const p = props(); p.signal = signal({ kind: 'DERELICT', hull: 'TEMPEST', damageBp: 4000 });
    p.signal.status = 'done'; p.signal.deliveredAt = new Date(now); p.signal.fleet = { DART: 1, COURIER: 1 };
    render(<UnknownSignalSheet {...p} />);
    expect(screen.queryByText(i18n.t('unknownSignal.delivered'))).not.toBeInTheDocument();
    expect(screen.getByText(/derelict was lost/)).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('unknownSignal.lost'))).not.toBeInTheDocument();
  });

  it('removes launch instructions after the outcome has been revealed', () => {
    const p = props(); p.signal = signal({ kind: 'PIRATES' }); p.signal.status = 'lost';
    render(<UnknownSignalSheet {...p} />);
    expect(screen.queryByText(i18n.t('unknownSignal.description'))).not.toBeInTheDocument();
  });
  it.each([
    { kind: 'RESOURCES', loot: { alloy: 500, crystal: 100, deuterium: 30 } },
    { kind: 'ENERGY', hours: 2 },
    { kind: 'DERELICT', hull: 'TEMPEST', damageBp: 4000 },
    { kind: 'PIRATES' },
    { kind: 'SKIN', cosmeticId: 'planet-lava' },
  ] satisfies UnknownSignalOutcome[])('explains the $kind result', outcome => {
    const p = props(); p.signal = signal(outcome);
    render(<UnknownSignalSheet {...p} />);
    expect(screen.getByTestId('unknown-signal-result')).not.toBeEmptyDOMElement();
    expect(screen.queryByRole('button', { name: 'Investigate signal' })).not.toBeInTheDocument();
    if (outcome.kind === 'ENERGY') expect(screen.getByText(/Collect during the boost/)).toBeInTheDocument();
    if (outcome.kind === 'DERELICT') expect(screen.getByText(/60%/)).toBeInTheDocument();
    const notice = { id: 'news', kind: 'unknown_signal_result', at: new Date(now), seen: false, refId: p.signal.id, payload: { signalId: p.signal.id, outcome } };
    expect(describeNotification(notice, now)).toBeTruthy();
    expect(signalFamily(notice)).toBe(outcome.kind === 'PIRATES' ? 'threat' : 'gain');
    expect(signalGlyph(notice)).toBe('scan');
  });

  it('explains a squadron lost to radiation without pretending it is returning', () => {
    const p = props(); p.signal.status = 'lost'; p.signal.fleet = {};
    render(<UnknownSignalSheet {...p} />);
    expect(screen.queryByText('Returning home')).not.toBeInTheDocument();
    expect(screen.getByText(/lost before the signal/)).toBeInTheDocument();
  });
});
