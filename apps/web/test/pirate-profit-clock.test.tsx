import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import type { GalaxyView, PirateContact } from '../src/api/schemas.js';
import * as clock from '../src/lib/clock.js';
import { useLaunchPlan } from '../src/lib/useLaunchPlan.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';

describe('pirate profit on a changing radiation clock', () => {
  it('finishes its deferred estimate without waiting for the clock to stop moving', async () => {
    const at = Date.parse('2026-10-12T12:00:00Z');
    let reads = 0;
    // Bounded so a broken render loop fails promptly rather than hanging the suite.
    const now = vi.spyOn(clock, 'serverNow').mockImplementation(() => at + Math.min(reads++, 40) * 1000);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData<Pick<GalaxyView, 'radiationModel' | 'hpRadiation'>>(keys.galaxy, {
      radiationModel: 'HP', hpRadiation: [{ id: 'timed-cloud', mode: 'EMIT', center: { x: 0, y: 0, z: 0 },
        radius: 5000, intensityHpPerMinute: 1, activeFrom: new Date(at - 60_000),
        activeUntil: new Date(at + 10 * 60_000) }],
    });
    const api = new Api({ fetch: vi.fn<typeof fetch>().mockRejectedValue(new Error('No network in this test')) });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>
      <ApiProvider api={api}><ToastProvider>{children}</ToastProvider></ApiProvider>
    </QueryClientProvider>;
    const pirate: PirateContact = { id: 'clock-pirate', callsign: 'TIME', zone: 'IDENTIFIED',
      at: { x: 900, y: 0, z: 0 }, expiresInMinutes: 180, reachMinutes: 12,
      reach: [{ hull: 'CITADEL', minutes: 12, distance: 900, at: { x: 900, y: 0, z: 0 } }],
      level: 4, fleet: { PALADIN: 1 }, hoard: { alloy: 3250, crystal: 1750, deuterium: 333 },
      lootPaid: { alloy: 0, crystal: 0, deuterium: 0 } };
    try {
      const { result, unmount } = renderHook(() => useLaunchPlan({ target: { kind: 'pirate', pirate },
        planet, onLaunched: () => undefined }), { wrapper });
      await act(async () => { result.current.set('CITADEL', 6); await Promise.resolve(); });
      expect(result.current.radiation?.kind).toBe('HP');
      expect(result.current.pirateProfitState).toBe('ready');
      expect(result.current.pirateProfit).not.toBeNull();
      expect(reads).toBeLessThan(15);
      unmount();
    } finally { now.mockRestore(); client.clear(); }
  });
});

const planet = planetView({ rulesetVersion: 16, fleet: { CITADEL: 6 } }, { deuterium: 500_000 });
