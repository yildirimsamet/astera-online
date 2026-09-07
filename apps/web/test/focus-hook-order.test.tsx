import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { PlanetFocus } from '../src/galaxy/FocusPanel.js';
import type { GalaxyPlanet, IntelView, PlanetView } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';

/**
 * THE FOCUS RAIL SURVIVES THE PLAYER CHANGING THEIR MIND ABOUT WHOSE WORLD IT IS.
 *
 * A production crash report, React #310 — "Rendered more hooks than during the
 * previous render" — decoded to this component and to one hook inside it. The
 * cause was an ordinary rules-of-hooks slip with a very specific reach:
 *
 *   · `PlanetFocus` calls three hooks, THEN returns early for an owned world,
 *     THEN calls `useAccordion` for a foreign one. Six hooks or three, depending
 *     on a prop.
 *   · `GalaxyView` renders the rail with no `key`, so moving the focus from one
 *     world to another re-renders the SAME fiber rather than mounting a new one.
 *   · `planetFocusRailVisible` keeps the rail up across that move: an owned world
 *     shows it while a transfer origin exists, and a foreign world always shows
 *     it. Nothing unmounts in between.
 *
 * So tapping your own colony and then any foreign world grew the hook count on a
 * live fiber and took the whole React tree down — and the reverse order shrank it,
 * which is React #300. Only a commander holding more than one world could reach
 * it, which is exactly the "some players" shape the report arrived in.
 *
 * These two tests are that sequence and nothing else. They are deliberately about
 * hook COUNT rather than about anything on screen: the rail's contents are already
 * covered elsewhere, and a test that asserted them would pass for the wrong reason
 * the moment somebody re-ordered the early return back.
 */

const NOW = new Date('2026-04-01T12:00:00.000Z').getTime();

const harness = () => {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queries}>
      <ApiProvider api={api}>
        <ToastProvider>{children}</ToastProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
};

const world = (over: Partial<GalaxyPlanet> = {}): GalaxyPlanet => ({
  id: 'p2',
  name: 'Grimhold',
  owner: 'Sable',
  position: { x: 200, y: 0, z: 0 },
  coreTier: 2,
  coreLevel: 6,
  intel: 'RESOLVED' as const,
  state: { kind: 'NORMAL' as const },
  satellites: [],
  shielded: false,
  isSelf: false,
  ...over,
});

const mine: PlanetView = planetView(
  {
    buildings: { CORE: 4, REFINERY: 2, EXTRACTOR: 2, VAULT: 1, SHIPYARD: 1 },
    instruments: { TELESCOPE: 1, RADAR: 0, AEGIS: 0, VEIL: 0 },
    orbit: ['UPLINK'],
    fleet: { DART: 6 },
  },
  { alloy: 4000, crystal: 2000, alloyCap: 9000, crystalCap: 4000 },
);

const intel: IntelView = {
  watching: [],
  probeReports: [],
  probeCooldowns: [],
  radarLog: [],
  probeCost: { alloy: 25, crystal: 25, deuterium: 0 },
};

/** Every prop the rail needs, so a test states only the one that is changing. */
const rail = (target: GalaxyPlanet) => (
  <PlanetFocus
    target={target}
    planet={mine}
    intel={intel}
    reports={[]}
    now={NOW}
    onClose={vi.fn()}
    onAttack={vi.fn()}
    onTransfer={vi.fn()}
    onInstallTelescope={vi.fn()}
    onLaunched={vi.fn()}
    open
    onToggle={vi.fn()}
  />
);

const owned = world({ isOwned: true, kind: 'COLONY' as const, isSelf: true });
const foreign = world();

describe('the focus rail keeps one hook order', () => {
  it('moves focus from an owned colony to a foreign world without remounting', () => {
    const Wrapper = harness();
    const { rerender } = render(<Wrapper>{rail(owned)}</Wrapper>);

    expect(() => {
      rerender(<Wrapper>{rail(foreign)}</Wrapper>);
    }).not.toThrow();
  });

  it('moves focus from a foreign world back to an owned colony', () => {
    const Wrapper = harness();
    const { rerender } = render(<Wrapper>{rail(foreign)}</Wrapper>);

    expect(() => {
      rerender(<Wrapper>{rail(owned)}</Wrapper>);
    }).not.toThrow();
  });
});
