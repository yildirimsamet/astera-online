import { act, render, screen } from '@testing-library/react';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { Api, ApiError } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { describeError } from '../src/i18n/errors.js';
import i18n from '../src/i18n/index.js';
import { LANGUAGES } from '../src/i18n/languages.js';
import { describeNow, nowEntries, type NowInput } from '../src/lib/nowLine.js';
import { clockTime } from '../src/lib/time.js';
import { clearMaintenance, noteMaintenanceWindow, useMaintenance } from '../src/platform/maintenanceGate.js';
import { MaintenanceScreen } from '../src/shell/MaintenanceScreen.js';
import type * as UpdateGateModule from '../src/platform/updateGate.js';

/**
 * PLANNED MAINTENANCE, AS THE PLAYER MEETS IT. Scaling plan F0.9.
 *
 * A day ahead the Now line names the window and what it refuses; inside it the game
 * shows the reopening instead of an error and comes back by itself; a launch that
 * would land inside it says when the window is, in the player's own time.
 */
const reload = vi.hoisted(() => vi.fn());
vi.mock('../src/brand/OpeningScene.js', () => ({ OpeningScene: () => <div /> }));
vi.mock('../src/platform/updateGate.js', async importOriginal => ({
  ...await importOriginal<typeof UpdateGateModule>(), reloadWebApp: reload,
}));

const json = (body: unknown, status = 200): Promise<Response> =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
const MAINTENANCE = { error: 'MAINTENANCE', message: 'Astera is under maintenance', params: { endsAt: '2026-11-02T01:15:00.000Z' } };

function Probe() {
  const state = useMaintenance();
  return <p>{state ? `maintenance until ${state.endsAt ?? 'unknown'}` : 'playing'}</p>;
}

afterEach(() => { clearMaintenance(); noteMaintenanceWindow(null); reload.mockClear(); vi.useRealTimers(); });
afterAll(async () => { await i18n.changeLanguage('en'); });

describe('the maintenance gate', () => {
  it('turns the flag answer into the maintenance screen, not a request error', async () => {
    render(<Probe />);
    const api = new Api({ fetch: () => json(MAINTENANCE, 503), authTransport: null });
    await act(async () => { await expect(api.me()).rejects.toBeInstanceOf(ApiError); });
    expect(screen.getByText('maintenance until 2026-11-02T01:15:00.000Z')).toBeTruthy();
  });

  it('reads a lost server inside the known window as maintenance, and outside it as a lost server', async () => {
    render(<Probe />);
    const down = new Api({ fetch: () => Promise.resolve(new Response('bad gateway', { status: 502 })), authTransport: null });
    const now = Date.now();
    noteMaintenanceWindow({ startsAt: new Date(now + 3_600_000), endsAt: new Date(now + 7_200_000) });
    await act(async () => { await expect(down.me()).rejects.toMatchObject({ code: 'UNREACHABLE' }); });
    expect(screen.getByText('playing')).toBeTruthy();
    const endsAt = new Date(now + 1_800_000);
    noteMaintenanceWindow({ startsAt: new Date(now - 60_000), endsAt });
    await act(async () => { await expect(down.me()).rejects.toMatchObject({ code: 'UNREACHABLE' }); });
    expect(screen.getByText(`maintenance until ${endsAt.toISOString()}`)).toBeTruthy();
  });

  it('turns a live channel refused for maintenance into the screen too', async () => {
    render(<Probe />);
    const api = new Api({ fetch: () => json(MAINTENANCE, 503), authTransport: null });
    await act(async () => {
      await expect(api.stream(() => undefined, new AbortController().signal)).rejects.toMatchObject({ code: 'STREAM_FAILED' });
    });
    expect(screen.getByText('maintenance until 2026-11-02T01:15:00.000Z')).toBeTruthy();
  });

  it('reads a live channel that cannot connect inside the known window as maintenance', async () => {
    render(<Probe />);
    const endsAt = new Date(Date.now() + 1_800_000);
    noteMaintenanceWindow({ startsAt: new Date(Date.now() - 60_000), endsAt });
    const api = new Api({ fetch: () => Promise.reject(new TypeError('Failed to fetch')), authTransport: null });
    await act(async () => { await expect(api.stream(() => undefined, new AbortController().signal)).rejects.toBeInstanceOf(TypeError); });
    expect(screen.getByText(`maintenance until ${endsAt.toISOString()}`)).toBeTruthy();
  });

  it('reads the public notice', async () => {
    const window = { startsAt: '2026-11-02T00:30:00.000Z', endsAt: '2026-11-02T01:15:00.000Z' };
    expect(await new Api({ fetch: () => json({ window }), authTransport: null }).maintenanceNotice())
      .toEqual({ window: { startsAt: new Date(window.startsAt), endsAt: new Date(window.endsAt) } });
    expect(await new Api({ fetch: () => json({ window: null }), authTransport: null }).maintenanceNotice()).toEqual({ window: null });
  });
});

describe('the Now line a day ahead', () => {
  const NOW = Date.parse('2026-11-01T12:00:00Z');
  const HOUR = 3_600_000;
  const base: NowInput = { now: NOW, threads: [], runs: [], builds: [], research: [], events: [], shieldUntil: null };
  const window = (startsInHours: number, minutes = 45) =>
    ({ startsAt: new Date(NOW + startsInHours * HOUR), endsAt: new Date(NOW + startsInHours * HOUR + minutes * 60_000) });

  it('names the window from a day out, low until its last three hours, then above own timers', () => {
    expect(nowEntries({ ...base, maintenance: window(25) })).toEqual([]);
    expect(nowEntries({ ...base, maintenance: window(20) })).toMatchObject([{ kind: 'maintenance', tier: 5, at: NOW + 20 * HOUR }]);
    expect(nowEntries({ ...base, maintenance: window(2) })).toMatchObject([{ kind: 'maintenance', tier: 2, at: NOW + 2 * HOUR }]);
  });

  it('counts to the reopening once the window is under way, and drops it after', () => {
    expect(nowEntries({ ...base, maintenance: window(-0.25) })).toMatchObject([{ kind: 'maintenance', tier: 2, at: NOW + 30 * 60_000 }]);
    expect(nowEntries({ ...base, maintenance: window(-1) })).toEqual([]);
  });

  for (const language of LANGUAGES) {
    it(`says what the window refuses in ${language}`, async () => {
      await i18n.changeLanguage(language);
      const [ahead] = nowEntries({ ...base, maintenance: window(2) });
      const [under] = nowEntries({ ...base, maintenance: window(-0.25) });
      for (const entry of [ahead!, under!]) {
        const { title, detail } = describeNow(entry);
        expect(title).not.toMatch(/now\.|\{\{/u);
        expect(detail).not.toMatch(/now\.|\{\{/u);
      }
      expect(describeNow(ahead!).title).not.toBe(describeNow(under!).title);
    });
  }
});

describe('refused launches', () => {
  const params = { startsAt: '2026-11-02T00:30:00.000Z', endsAt: '2026-11-02T01:15:00.000Z' };
  for (const language of LANGUAGES) {
    it(`names the window in local time in ${language}`, async () => {
      await i18n.changeLanguage(language);
      for (const code of ['MAINTENANCE_LANDING', 'MAINTENANCE_IN_FLIGHT']) {
        const message = describeError(new ApiError(code, 'server fallback', 409, params));
        expect(message).not.toBe(i18n.t('errors.unknown'));
        expect(message).not.toContain('{{');
        expect(message).not.toContain('2026-11-02T');
        expect(message).toMatch(/\d/u);
      }
      expect(describeError(new ApiError('MAINTENANCE_LANDING', '', 409, { startsAt: 'bad', endsAt: 'bad' })))
        .toBe(i18n.t('errors.unknown'));
    });
  }
});

describe('the maintenance screen', () => {
  for (const language of LANGUAGES) {
    it(`gives the reopening and that the game comes back by itself in ${language}`, async () => {
      await i18n.changeLanguage(language);
      const api = new Api({ fetch: () => new Promise<Response>(() => undefined), authTransport: null });
      const endsAt = new Date(Date.now() + 40 * 60_000).toISOString();
      render(<ApiProvider api={api}><MaintenanceScreen endsAt={endsAt} /></ApiProvider>);
      expect(screen.getByRole('heading', { name: i18n.t('app.maintenanceTitle') })).toBeTruthy();
      expect(screen.getByText(i18n.t('app.maintenanceBack'))).toBeTruthy();
      expect(screen.getByRole('timer').textContent).toMatch(/\d/u);
      expect(screen.getByText(i18n.t('app.maintenanceReturn', { time: clockTime(new Date(endsAt)) }))).toBeTruthy();
    });
  }

  it('says it is running long instead of counting at zero', () => {
    const api = new Api({ fetch: () => new Promise<Response>(() => undefined), authTransport: null });
    render(<ApiProvider api={api}><MaintenanceScreen endsAt={new Date(Date.now() - 60_000).toISOString()} /></ApiProvider>);
    expect(screen.queryByRole('timer')).toBeNull();
    expect(screen.getByText(i18n.t('app.maintenanceLate'))).toBeTruthy();
  });

  it('says nothing it does not know when the reopening is unknown', () => {
    const api = new Api({ fetch: () => new Promise<Response>(() => undefined), authTransport: null });
    render(<ApiProvider api={api}><MaintenanceScreen endsAt={null} /></ApiProvider>);
    expect(screen.queryByRole('timer')).toBeNull();
    expect(screen.getByText(i18n.t('app.maintenanceBack'))).toBeTruthy();
  });

  it('reloads the game the first time the server answers again', async () => {
    vi.useFakeTimers();
    let open = false;
    const api = new Api({ fetch: () => open ? json({ window: null }) : json(MAINTENANCE, 503), authTransport: null });
    render(<ApiProvider api={api}><MaintenanceScreen endsAt={MAINTENANCE.params.endsAt} /></ApiProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
    expect(reload).not.toHaveBeenCalled();
    open = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
