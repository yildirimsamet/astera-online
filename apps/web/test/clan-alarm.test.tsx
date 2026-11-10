import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { planetSchema, type NotificationView, type PlanetView } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { activeClanAlarms, clanAlarmOf, supportLandingBefore, supportVerdict } from '../src/lib/clanAlarm.js';
import { subscribeClanAlarm } from '../src/lib/clanAlarmDoor.js';
import { describeNotification, isAlarming, isUrgent, signalFamily, signalGlyph } from '../src/lib/notifications.js';
import { ClanSupportBay } from '../src/screens/ClanSupportBay.js';
import { ClanSupportSheet } from '../src/screens/ClanSupportSheet.js';
import { DESTINATION, Signals } from '../src/shell/Signals.js';
import { planetView } from './fixtures.js';

/**
 * KLAN ALARMI ON THE CLIENT (F2 P2 · E1 · E6, owner 2026-11-10). A clanmate's radar heard a raid:
 * the bell names who and where and when it lands; one tap opens the support sheet aimed at that
 * world, and the sheet says, for the ships picked, whether they land before the raid or too late.
 * The host reads the answer: how many saw the call and what is flying in, against the raid.
 */

const MINUTE = 60_000;
const AT = new Date('2026-11-10T12:00:00.000Z');
const ALARM = '00000000-0000-4000-8000-0000000000a1';
const alarmPayload = (over: Record<string, unknown> = {}) => ({
  arriveAt: new Date(AT.getTime() + 14 * MINUTE).toISOString(), etaMinutes: 14,
  targetPlanetName: 'Kuzgun', alarmId: ALARM, hostPlayerId: 'ayse', hostPlanetId: 'kuzgun', hostName: 'Ayşe', ...over,
});
let rows: NotificationView[] = [];
vi.mock('../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/api/queries.js');
  return {
    ...actual,
    useNotifications: () => ({ data: { notifications: rows } }),
    usePlanet: () => ({ data: undefined, dataUpdatedAt: Date.now() }),
    useMarkSeen: () => ({ mutate: vi.fn() }),
  };
});
const news = (payload: Record<string, unknown> = alarmPayload()): NotificationView => ({
  id: 'n-alarm', kind: 'clan_alarm', refId: 'mission-1', payload, seen: false, at: AT,
});

describe('the clan alarm in the bell', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); });

  it('names the clanmate, the world and when the raid lands', () => {
    expect(describeNotification(news(), AT.getTime())).toBe('Clan alarm · Ayşe · Kuzgun is under attack · lands in 14m');
    expect(describeNotification(news(), AT.getTime() + 20 * MINUTE)).toBe('Clan alarm · Ayşe · the raid on Kuzgun has landed');
  });

  it('reads in Turkish', async () => {
    await i18n.changeLanguage('tr');
    expect(describeNotification(news(), AT.getTime())).toMatch(/^Klan alarmı · Ayşe · Kuzgun saldırı altında · 14/);
  });

  it('is urgent, a call rather than a threat to the reader, and opens the support sheet', () => {
    expect(isUrgent(news())).toBe(true);
    expect(isAlarming(news())).toBe(false);
    expect(signalFamily(news())).toBe('watch');
    expect(signalGlyph(news())).toBe('incoming');
    expect(DESTINATION.clan_alarm).toEqual({ panel: null });
  });

  it('reads the call off the payload, and nothing off a broken one', () => {
    expect(clanAlarmOf(news())).toEqual({
      alarmId: ALARM, hostPlanetId: 'kuzgun', hostPlanetName: 'Kuzgun', hostName: 'Ayşe',
      arriveAt: new Date(AT.getTime() + 14 * MINUTE),
    });
    expect(clanAlarmOf(news(alarmPayload({ hostName: undefined })))?.hostName).toBeNull();
    expect(clanAlarmOf(news({ etaMinutes: 3 }))).toBeNull();
  });

  it('opens the call from the bell in one tap', async () => {
    const heard = vi.fn();
    const stop = subscribeClanAlarm(heard);
    try {
      rows = [news()];
      const onOpen = vi.fn();
      render(<QueryClientProvider client={new QueryClient()}><Signals onOpen={onOpen} onFocusPlanet={vi.fn()} /></QueryClientProvider>);
      await userEvent.click(await screen.findByRole('button', { name: /^Signals/ }));
      await userEvent.click(await screen.findByRole('button', { name: 'Open related report' }));
      expect(heard).toHaveBeenCalledWith(expect.objectContaining({ alarmId: ALARM, hostPlanetId: 'kuzgun', hostName: 'Ayşe' }));
      expect(onOpen).toHaveBeenCalledWith(null, undefined, undefined, undefined);
    } finally { stop(); }
  });
});

describe('the verdict: in time or too late', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); });
  const raid = new Date(AT.getTime() + 30 * MINUTE);

  it('lands before the raid only when strictly earlier', () => {
    expect(supportVerdict(new Date(raid.getTime() - 4 * MINUTE), raid)).toEqual({ inTime: true, minutes: 4 });
    expect(supportVerdict(new Date(raid.getTime() + 6 * MINUTE), raid)).toEqual({ inTime: false, minutes: 6 });
    expect(supportVerdict(raid, raid)).toEqual({ inTime: false, minutes: 0 });
  });
});

/* ── the sheet, aimed at the call ─────────────────────────────── */

const HOUR = 60 * MINUTE;
const quote = (arriveAt: Date, stationHours = 12) => ({
  refusals: [], arriveAt: arriveAt.toISOString(), travelMinutes: 10, returnMinutes: 20, fuel: 64,
  bays: { used: 2, total: 5 }, hostRoom: { used: 40, reserved: 0, total: 470, after: 64 },
  band: { ok: true, mine: 3, theirs: 3 },
  stationUntil: new Date(arriveAt.getTime() + stationHours * HOUR).toISOString(),
  seasonClipped: false, personalHangar: { used: 300, total: 470 }, senderShieldUntil: null,
});

function sheet(answer: Record<string, unknown>, raidAt: Date | null) {
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(answer), {
    status: 200, headers: { 'content-type': 'application/json' },
  })));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(['season'], { honorSoloCredit: false });
  const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
  render(<QueryClientProvider client={client}><ApiProvider api={api}>
    <ClanSupportSheet host={{ planetId: 'kuzgun', planetName: 'Kuzgun', ownerName: 'Ayşe',
      ...(raidAt ? { alarm: { id: ALARM, arriveAt: raidAt } } : {}) }}
    worlds={[planetView({ fleet: { PIKE: 30 } }, { id: 'origin', name: 'Home' })]} onClose={vi.fn()} onSent={vi.fn()} />
  </ApiProvider></QueryClientProvider>);
  return { fetch };
}

async function pick(count: number) {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const more = screen.getByRole('button', { name: /more pike/i });
  for (let i = 0; i < count; i++) act(() => { more.click(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  vi.useRealTimers();
}

describe('the support sheet answering an alarm', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); });

  it('says the ships land before the raid, and sends the answer with the alarm', async () => {
    const raidAt = new Date(Date.now() + 30 * MINUTE);
    const { fetch } = sheet(quote(new Date(raidAt.getTime() - 4 * MINUTE - 5_000)), raidAt);
    expect(screen.getByText(/answering the clan alarm/i)).toBeInTheDocument();
    await pick(3);
    expect(await screen.findByText(/lands 4m 05s before the raid/i)).toBeInTheDocument();
    const commit = within(document.querySelector<HTMLElement>('[data-support-commit]')!).getByRole('button');
    fireEvent.keyDown(commit, { key: 'Enter' });
    fireEvent.keyDown(commit, { key: 'Enter' });
    await waitFor(() => {
      const sent = fetch.mock.calls.find((call) => (call as [string])[0].endsWith('/api/clan/support'));
      const body = (sent as [string, RequestInit] | undefined)?.[1].body;
      expect(typeof body === 'string' ? body : '').toContain(`"alarmId":"${ALARM}"`);
    });
  });

  it('says plainly when they would be too late', async () => {
    const raidAt = new Date(Date.now() + 10 * MINUTE);
    sheet(quote(new Date(raidAt.getTime() + 6 * MINUTE)), raidAt);
    await pick(3);
    const late = await screen.findByText(/6m 00s too late for the raid/i);
    expect(late).toHaveClass('text-v2-warn');
  });

  it('states the stay the clan level buys, not a fixed twelve hours', async () => {
    sheet(quote(new Date(Date.now() + 10 * MINUTE), 18), null);
    await pick(2);
    expect(await screen.findByText(/stays at most 18 h/i)).toBeInTheDocument();
    expect(screen.queryByText(/clan alarm/i)).toBeNull();
  });
});

/* ── E6: the host reads the answer ───────────────────────────── */

function host(alarms: Record<string, unknown>[], waves: Record<string, unknown>[] = []): PlanetView {
  return planetSchema.parse(JSON.parse(JSON.stringify({
    ...planetView(), rulesetVersion: 15,
    defencePosture: { posture: 'SUPPORT', escape: false, support: true, supportLocked: null },
    clanSupport: { room: { used: 0, reserved: 0, total: 470 }, waves, alarms },
  })));
}
const inbound = (arriveAt: Date, alarmId: string | null = ALARM) => ({
  id: `wave-${arriveAt.getTime()}`, status: 'OUTBOUND', sender: { playerId: 'ali', name: 'Ali' }, host: { playerId: 'me', name: 'Me' },
  originPlanetId: 'o', hostPlanetId: 'kuzgun', hostPlanetName: 'Kuzgun', fleet: { PIKE: 5 }, bulk: 50, damaged: false,
  sentAt: new Date(Date.now() - MINUTE).toISOString(), arriveAt: arriveAt.toISOString(), stationedAt: null, expiresAt: null,
  returnAt: null, returnReason: null, outOfBand: false, battles: 0, alarmId,
});

function bay(planet: PlanetView) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ApiProvider api={new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch })}>
    <ClanSupportBay planet={planet} />
  </ApiProvider></QueryClientProvider>);
}

describe('the host reads the clan’s answer', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); });

  it('says who saw the call and when the first answer lands against the raid', () => {
    const raidAt = new Date(Date.now() + 20 * MINUTE);
    bay(host([{ id: ALARM, missionId: 'm', arriveAt: raidAt.toISOString(), called: 3, seen: 2, answered: 2 }],
      [inbound(new Date(raidAt.getTime() - 3 * MINUTE)), inbound(new Date(raidAt.getTime() + 2 * MINUTE)), inbound(new Date(raidAt.getTime() - 9 * MINUTE), null)]));
    const line = document.querySelector('[data-clan-alarm]');
    expect(line).toHaveTextContent(/2 of 3 clanmates saw your alarm/i);
    expect(line).toHaveTextContent(/2 waves answering · the first lands 3m 00s before the raid/i);
  });

  it('says no answer is flying yet', () => {
    bay(host([{ id: ALARM, missionId: 'm', arriveAt: new Date(Date.now() + 20 * MINUTE).toISOString(), called: 2, seen: 0, answered: 0 }]));
    expect(document.querySelector('[data-clan-alarm]')).toHaveTextContent(/0 of 2 clanmates saw your alarm · no answer flying yet/i);
  });

  it('draws nothing without an alarm', () => {
    bay(host([]));
    expect(document.querySelector('[data-clan-alarm]')).toBeNull();
  });
});

describe('alarmed worlds on the galaxy', () => {
  const row = (id: string, over: Record<string, unknown>): NotificationView => ({ ...news(alarmPayload(over)), id });

  it('rings each clanmate world under a raid still in the air, with the raider’s world when the radar read it', () => {
    const alarms = activeClanAlarms([
      row('a', { originPlanetId: 'vex-home' }),
      row('b', { alarmId: '00000000-0000-4000-8000-0000000000a2', hostPlanetId: 'vega', arriveAt: new Date(AT.getTime() + 5 * MINUTE).toISOString() }),
      // Landed: the ring is gone.
      row('c', { alarmId: '00000000-0000-4000-8000-0000000000a3', hostPlanetId: 'old', arriveAt: new Date(AT.getTime() - MINUTE).toISOString() }),
      { ...news(), id: 'd', kind: 'incoming_fleet' },
    ], AT.getTime());
    expect(alarms).toEqual([
      { hostPlanetId: 'vega', arriveAt: new Date(AT.getTime() + 5 * MINUTE), originPlanetId: null },
      { hostPlanetId: 'kuzgun', arriveAt: new Date(AT.getTime() + 14 * MINUTE), originPlanetId: 'vex-home' },
    ]);
  });

  it('draws one ring per world, for the raid that lands first', () => {
    const alarms = activeClanAlarms([
      row('a', {}),
      row('b', { alarmId: '00000000-0000-4000-8000-0000000000a2', arriveAt: new Date(AT.getTime() + 3 * MINUTE).toISOString() }),
    ], AT.getTime());
    expect(alarms).toEqual([{ hostPlanetId: 'kuzgun', arriveAt: new Date(AT.getTime() + 3 * MINUTE), originPlanetId: null }]);
  });
});

describe('support landing before the raid (F2 E6)', () => {
  const wave = (id: string, status: string, arriveIn: number, fleet: Record<string, number>, alarmId: string | null = null) => ({
    id, status, alarmId, fleet, arriveAt: new Date(AT.getTime() + arriveIn * MINUTE),
  });
  const alarm = (arriveIn: number) => ({ arriveAt: new Date(AT.getTime() + arriveIn * MINUTE) });

  it('sums the waves in the air that land before the next raid, whoever sent them', () => {
    expect(supportLandingBefore([
      wave('a', 'OUTBOUND', 4, { PIKE: 6 }, ALARM),
      wave('b', 'OUTBOUND', 9, { PIKE: 2, DART: 3 }),
      // Lands after the raid: does not count.
      wave('c', 'OUTBOUND', 20, { PIKE: 50 }),
      // Already standing: the standing line counts it, not this.
      wave('d', 'STATIONED', -30, { PIKE: 9 }),
    ], [alarm(30), alarm(14)], AT.getTime())).toEqual({ PIKE: 8, DART: 3 });
  });

  it('is empty with no raid ahead', () => {
    expect(supportLandingBefore([wave('a', 'OUTBOUND', 4, { PIKE: 6 })], [alarm(-1)], AT.getTime())).toEqual({});
    expect(supportLandingBefore([wave('a', 'OUTBOUND', 4, { PIKE: 6 })], undefined, AT.getTime())).toEqual({});
  });
});
