import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { openingProgress } from '@astera/rules';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { vesselSchema } from '../src/api/starterSchemas.js';
import i18n from '../src/i18n/index.js';
import { vesselToPlanetView } from '../src/starter/adapter.js';
import { YardDeck } from '../src/starter/YardDeck.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { urlOf, wireVessel } from './starterVesselFixture.js';

/**
 * THE YARD, AGAINST A TARGET THE PROBE READ (plan §5.5, F4c). The investment road is decided here:
 * which ship to build for which outpost. Each warship says how it meets the guard of the target
 * picked, the rule in view at the moment the resources are spent.
 */
const NOW = new Date('2026-11-08T12:00:00.000Z').getTime();
const YARD = { ...openingProgress(), modules: { ...openingProgress().modules, REFINERY: 3, EXTRACTOR: 2, SURVEY: 1, SHIPYARD: 1 } };
const report = (id: string, name: string, minutesAgo: number, wall: 'BULWARK' | 'SKIRMISHER') => ({
  targetPlanetId: id, targetName: name, targetUsername: name, at: new Date(NOW - minutesAgo * 60_000).toISOString(), accuracy: 0.55,
  stock: { low: 99, high: 263 }, deuteriumStock: null, defence: { low: 595, high: 1570 }, fleetSize: { low: 1, high: 5 },
  fleetHome: true, detected: false, outpost: true,
  classReading: { kind: 'RANGES', shares: {
    SKIRMISHER: wall === 'SKIRMISHER' ? { low: 55, high: 100 } : { low: 0, high: 45 },
    BULWARK: wall === 'BULWARK' ? { low: 55, high: 100 } : { low: 0, high: 45 },
    LANCE: { low: 0, high: 45 },
  } },
});
const TEVIS = report('tevis', 'Tevis', 2, 'BULWARK');
const ELDETH = report('eldeth', 'Eldeth', 5, 'SKIRMISHER');

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(() => { cleanup(); });

const draw = async (probeReports: object[]) => {
  const answer = (path: string) => path.includes('/intel')
    ? { watching: [], radarLog: [], probeReports, probeCost: { alloy: 65, crystal: 40, deuterium: 0 } }
    : {};
  const fetch = vi.fn((input: RequestInfo | URL) => Promise.resolve(new Response(JSON.stringify(answer(urlOf(input))), { status: 200, headers: { 'content-type': 'application/json' } })));
  const vessel = vesselSchema.parse(wireVessel({ fleet: { DART: 2, PROSPECTOR: 1 }, progress: YARD }));
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queries}>
      <ApiProvider api={new Api({ fetch })}><ToastProvider>{children}</ToastProvider></ApiProvider>
    </QueryClientProvider>
  );
  render(<YardDeck vessel={vessel} view={vesselToPlanetView(vessel)} fetchedAt={NOW} />, { wrapper: wrap });
  // The reports are in before anything is read off the yard.
  await vi.waitFor(() => { expect(queries.getQueryData(['intel'])).toBeDefined(); });
};
const mark = (hull: string) => document.querySelector(`[data-testid="yard-hull"][data-hull="${hull}"] [data-matchup]`)?.getAttribute('data-matchup');

describe('the yard against a target', () => {
  it('marks each warship against the guard of the latest target, and a support hull not at all', async () => {
    await draw([ELDETH, TEVIS]);
    const picker = await screen.findByTestId('yard-target');
    expect(within(picker).getByRole('button', { name: /Tevis/, pressed: true })).toBeInTheDocument();
    expect(mark('DART')).toBe('strong');
    expect(mark('PIKE')).toBe('weak');
    expect(mark('WARDEN')).toBe('even');
    expect(mark('PROSPECTOR')).toBeUndefined();
    expect(mark('COURIER')).toBeUndefined();
  });

  it('turns every mark to the other target with one tap', async () => {
    await draw([TEVIS, ELDETH]);
    fireEvent.click(within(await screen.findByTestId('yard-target')).getByRole('button', { name: /Eldeth/ }));
    expect(mark('DART')).toBe('even');
    expect(mark('PIKE')).toBe('strong');
    expect(mark('WARDEN')).toBe('weak');
  });

  it('offers no target and marks nothing it has not paid for', async () => {
    await draw([{ ...report('even', 'Even', 1, 'BULWARK'), classReading: { kind: 'EVEN' } }]);
    expect(screen.queryByTestId('yard-target')).toBeNull();
    expect(document.querySelector('[data-testid="yard-hull"] [data-matchup]')).toBeNull();
  });
});
