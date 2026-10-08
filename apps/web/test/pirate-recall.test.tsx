import type { ReactNode } from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { useRecallFlight } from '../src/api/queries.js';
import type { NotificationView, PendingThread, PirateContact } from '../src/api/schemas.js';
import { PirateFocus, ThreadFocus } from '../src/galaxy/FocusPanel.js';
import i18n from '../src/i18n/index.js';
import { describeNotification } from '../src/lib/notifications.js';

/**
 * A PIRATE RAID TURNS HOME LIKE EVERY OTHER OUTBOUND FLEET. Owner, 2026-10-08.
 * The screens have to offer it where the fleet is read, and stop saying it is impossible.
 */

afterEach(async () => { await i18n.changeLanguage('en'); });

const thread = (over: Partial<PendingThread> = {}): PendingThread => ({
  id: '0f5e3c2a-7a39-4a8b-9d6e-1f2a3b4c5d6e', kind: 'pirate', targetName: 'mJtQ', minutesRemaining: 10,
  arriveAt: new Date(Date.now() + 600_000), leg: 'outbound', fleet: { DART: 4 }, recallable: true, ...over,
});

describe('the selected pirate raid', () => {
  it('offers the recall while the raid is still turnable', () => {
    const onRecall = vi.fn();
    render(<ThreadFocus thread={thread()} minutesRemaining={10} onClose={vi.fn()} onToggle={vi.fn()} open onRecall={onRecall} />);
    fireEvent.click(screen.getByRole('button', { name: 'Recall fleet' }));
    expect(onRecall).toHaveBeenCalledOnce();
    expect(screen.getByText(i18n.t('focus.thread.recallable'))).toBeInTheDocument();
  });

  it('says the engagement has begun once it can no longer turn', () => {
    render(<ThreadFocus thread={thread({ recallable: undefined })} minutesRemaining={0} onClose={vi.fn()} onToggle={vi.fn()} open onRecall={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Recall fleet' })).not.toBeInTheDocument();
    expect(screen.getByText(i18n.t('focus.thread.outboundPirate'))).toBeInTheDocument();
    expect(i18n.t('focus.thread.outboundPirate')).not.toMatch(/cannot be recalled/i);
  });
});

describe('the words around a pirate raid', () => {
  const pirate: PirateContact = {
    id: 'mJtQH0vR5cP8sN2xK7dL4A', callsign: 'mJtQ', zone: 'IDENTIFIED', at: { x: 100, y: 0, z: 0 },
    expiresInMinutes: 180, reachMinutes: 12, reach: [{ hull: 'DART', minutes: 12, distance: 900, at: { x: 900, y: 0, z: 0 } }],
    level: 3, fleet: { DART: 2 }, damageMult: 1, mass: 'MEDIUM',
  };
  it('never promises a raid that cannot be called back, in any language', async () => {
    render(<PirateFocus pirate={pirate} fleetAtHome={{ DART: 10 }} raiding={false} onClose={vi.fn()} onAttack={vi.fn()} open onToggle={vi.fn()} />);
    expect(screen.getByText(i18n.t('pirate.outbound'))).toBeInTheDocument();
    const noRecall = /cannot be recalled|geri çağrılamaz|nicht zurückgerufen|no se puede (retirar|recuperar|llamar)|ne peut pas être rappel|呼び戻せません/i;
    for (const language of ['en', 'tr', 'de', 'es', 'fr', 'ja']) {
      await i18n.changeLanguage(language);
      for (const key of ['pirate.outbound', 'launch.warningPirate', 'launch.warningPirateOpen', 'academy.steps.pirate'] as const) {
        if (!i18n.exists(key)) continue;
        expect(i18n.t(key, { world: 'Kestrel', duration: '1h' })).not.toMatch(noRecall);
      }
    }
  });
});

describe('recalling from any flight list', () => {
  it('sends a pirate raid to its own lane and a mission to the fleet lane', async () => {
    const requestUrl = (input: RequestInfo | URL): string =>
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const fetch = vi.fn<typeof globalThis.fetch>((url) => Promise.resolve(new Response(JSON.stringify(
      requestUrl(url).includes('/api/pirates/')
        ? { raidId: thread().id, homeAt: new Date(Date.now() + 300_000).toISOString() }
        : { missionId: 'm1', arriveAt: new Date(Date.now() + 300_000).toISOString() },
    ), { status: 200, headers: { 'content-type': 'application/json' } })));
    const api = new Api({ fetch });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={new QueryClient()}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>
    );
    const { result } = renderHook(() => useRecallFlight(), { wrapper });
    await act(async () => { await result.current.mutateAsync({ missionId: thread().id!, pirate: true }); });
    await act(async () => { await result.current.mutateAsync({ missionId: 'm1' }); });
    const urls = fetch.mock.calls.map(([url]) => requestUrl(url));
    expect(urls.some((url) => url.endsWith(`/api/pirates/raids/${thread().id!}/recall`))).toBe(true);
    expect(urls.some((url) => url.endsWith('/api/fleet/m1/recall'))).toBe(true);
  });
});

describe('a recalled pirate raid coming home', () => {
  const home = (payload: Record<string, unknown>): NotificationView => ({
    id: 'n1', kind: 'fleet_returned', refId: 'r1', payload, seen: false, at: new Date('2026-10-08T12:00:00.000Z'),
  });
  it('says it was called back rather than empty-handed', () => {
    const line = describeNotification(home({ trip: 'pirate', recalled: true, ships: 6, lootAlloy: 0, lootCrystal: 0, lootDeuterium: 0 }), Date.now());
    expect(line).toBe(i18n.t('notifications.pirateHomeRecalled', { count: 6 }));
    expect(line).not.toBe(i18n.t('notifications.pirateHomeEmpty', { count: 6 }));
  });
});
