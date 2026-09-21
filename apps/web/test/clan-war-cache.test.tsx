import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys, useClanWarActions } from '../src/api/queries.js';
import { clanWarContributionResultSchema, clanWarSchema } from '../src/api/schemas.js';
import { WorldProvider } from '../src/api/world.js';
import { planetView } from './fixtures.js';

const operation = {
  id: 'operation', status: 'ASSEMBLING' as const, closeReason: null,
  leaderPlayerId: 'leader',
  target: { playerId: 'enemy', username: 'Rival', planetId: 'target',
    planetName: 'Vega', position: { x: 1, y: 2, z: 3 } },
  staging: { planetId: 'home', name: 'Home', position: { x: 0, y: 0, z: 0 } },
  createdAt: '2026-09-20T12:00:00Z', expiresAt: '2026-09-21T12:00:00Z',
  startedAt: null, resolvedAt: null, completedAt: null,
  contributions: [{ id: 'wave', playerId: 'member', username: 'Scout',
    originPlanetId: 'origin', originPlanetName: 'Origin', sourceKind: 'PHYSICAL' as const,
    status: 'OUTBOUND' as const, fleet: { DART: 3 }, bulk: 3, fuelPaid: 18,
    sentAt: '2026-09-20T12:01:00Z', arrivesAt: '2026-09-20T12:10:00Z',
    mine: true, canRecall: true }],
  pool: { combatHulls: 3, waves: 1, participants: 1 },
};

describe('joint-war contribution cache hand-off', () => {
  it('applies the war and traffic snapshots from the POST before any refetch', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    client.setQueryData(keys.clanWar, clanWarSchema.parse({
      available: true, level: 1, maxLevel: false,
      treasury: { alloy: 0, crystal: 0, deuterium: 0 },
      nextCost: { alloy: 100, crystal: 100, deuterium: 10 },
      room: { alloy: 100, crystal: 100, deuterium: 10 }, canUpgrade: false,
      hangar: { used: 0, reserved: 0, total: 160 },
      serverNow: '2026-09-20T12:00:00Z', operation: null,
    }));
    client.setQueryData(keys.traffic, { contacts: [{ id: 'old-contact' }] });
    const response = clanWarContributionResultSchema.parse({
      contributionId: 'wave', sourceKind: 'PHYSICAL', status: 'OUTBOUND',
      fuelPaid: 18, reservedBulk: 3, stagedAt: null,
      planet: planetView(), pending: [], war: operation,
      traffic: { contacts: [] },
    });
    const contributeClanWar = vi.fn().mockResolvedValue(response);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <ApiProvider api={{ contributeClanWar } as unknown as Api}>{children}</ApiProvider>
      </QueryClientProvider>
    );
    const view = renderHook(() => useClanWarActions(), { wrapper });

    await act(async () => {
      await view.result.current.contribute.mutateAsync({
        originPlanetId: 'origin', fleet: { DART: 3 }, acknowledgeShieldLoss: false,
      });
    });

    expect(client.getQueryData<ReturnType<typeof clanWarSchema.parse>>(keys.clanWar)?.operation)
      .toEqual(response.war);
    expect(client.getQueryData(keys.pending)).toEqual({ pending: response.pending });
    expect(client.getQueryData(keys.traffic)).toEqual(response.traffic);
  });

  it('does not replace the selected world snapshots after contributing from another world', async () => {
    localStorage.clear();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const active = planetView({}, { id: 'active', name: 'Active' });
    const remote = planetView({}, { id: 'remote', name: 'Remote' });
    client.setQueryData(keys.planets, {
      playerId: 'player', seasonId: 'season', capitalPlanetId: 'active', planets: [active, remote],
    });
    const selectedPending = { pending: [{
      id: 'selected-flight', kind: 'attack' as const, ownerPlayerId: 'player',
      originPlanetId: 'active', targetPlanetId: 'target', fleet: { DART: 1 },
      departAt: new Date('2026-09-20T12:00:00Z'), arriveAt: new Date('2026-09-20T12:10:00Z'),
      returning: false,
    }] };
    const selectedTraffic = { contacts: [{ id: 'selected-contact' }] };
    client.setQueryData(keys.pending, selectedPending);
    client.setQueryData(keys.traffic, selectedTraffic);
    const response = clanWarContributionResultSchema.parse({
      contributionId: 'wave', sourceKind: 'PHYSICAL', status: 'OUTBOUND',
      fuelPaid: 18, reservedBulk: 3, stagedAt: null,
      planet: remote, pending: [], war: operation, traffic: { contacts: [] },
    });
    const contributeClanWar = vi.fn().mockResolvedValue(response);
    const api = { contributeClanWar, planets: vi.fn().mockResolvedValue({
      playerId: 'player', seasonId: 'season', capitalPlanetId: 'active', planets: [active, remote],
    }) } as unknown as Api;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <ApiProvider api={api}><WorldProvider>{children}</WorldProvider></ApiProvider>
      </QueryClientProvider>
    );
    const view = renderHook(() => useClanWarActions(), { wrapper });

    await act(async () => {
      await view.result.current.contribute.mutateAsync({
        originPlanetId: 'remote', fleet: { DART: 3 }, acknowledgeShieldLoss: false,
      });
    });

    expect(client.getQueryData(keys.pending)).toEqual(selectedPending);
    expect(client.getQueryData(keys.traffic)).toEqual(selectedTraffic);
  });
});
