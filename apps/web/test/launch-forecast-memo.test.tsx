import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { forecastLines } from '@astera/rules';
import type * as Rules from '@astera/rules';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { intelSchema, type GalaxyPlanet } from '../src/api/schemas.js';
import { LaunchSheet } from '../src/screens/LaunchSheet.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';

vi.mock('@astera/rules', async (importOriginal) => {
  const actual = await importOriginal<typeof Rules>();
  return { ...actual, forecastLines: vi.fn(actual.forecastLines) };
});

/**
 * A FEW DOZEN BATTLES PER READING, SO THEY RUN ONCE PER READING. D199.
 *
 * Found on the phone harness: the force box never settled, because the forecast was
 * recomputed on every render — `flightModifiers(planet)` builds a fresh research
 * object each call and the parent hands the sheet a fresh `target` literal each
 * render, so the memo's inputs never compared equal. A render that changes nothing
 * the forecast reads must not pay for it again.
 */
const world: GalaxyPlanet = {
  id: 'p2',
  name: 'Tharsis',
  owner: 'Sable',
  position: { x: 120, y: 0, z: 80 },
  coreTier: 2,
  coreLevel: 6,
  intel: 'RESOLVED' as const,
  state: { kind: 'NORMAL' as const },
  satellites: [],
  shielded: false,
  isSelf: false,
};

/** The lines are what a probe buys, so the sheet is opened on one. */
const intel = intelSchema.parse({
  watching: [],
  radarLog: [],
  probeCost: { alloy: 50, crystal: 30, deuterium: 0 },
  probeReports: [{
    targetPlanetId: 'p2',
    targetName: 'Tharsis',
    targetUsername: 'Sable',
    at: new Date(),
    accuracy: 0.55,
    stock: { low: 1_000, high: 2_000 },
    deuteriumStock: null,
    defence: { low: 4_000, high: 6_000 },
    fleetSize: { low: 5, high: 8 },
    fleetHome: true,
    detected: false,
    doctrines: {},
    classReading: { kind: 'DOMINANT', cls: 'BULWARK' },
    shield: { low: 0, high: 0 },
    unarmed: { low: 0, high: 0 },
  }],
});

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
const wrap = (node: ReactNode) => (
  <QueryClientProvider client={client}>
    <ApiProvider api={api}>
      <ToastProvider>{node}</ToastProvider>
    </ApiProvider>
  </QueryClientProvider>
);

describe('the forecast on the launch sheet', () => {
  it('is not recomputed by a render that changes nothing it reads', async () => {
    const planet = planetView({ fleet: { TALON: 20 } });
    const sheet = () => (
      <LaunchSheet
        target={{ kind: 'world', world }}
        planet={planet}
        intel={intel}
        onClose={vi.fn()}
        onLaunched={vi.fn()}
      />
    );
    const view = render(wrap(sheet()));
    for (const band of screen.queryAllByRole('button', { expanded: false })) {
      await userEvent.click(band);
    }
    await userEvent.click(screen.getByRole('button', { name: /max talon/i }));
    await screen.findByTestId('compare-lines');
    const settled = vi.mocked(forecastLines).mock.calls.length;
    expect(settled).toBeGreaterThan(0);

    view.rerender(wrap(sheet()));
    view.rerender(wrap(sheet()));
    await screen.findByTestId('compare-lines');
    expect(vi.mocked(forecastLines).mock.calls.length).toBe(settled);
  });
});
