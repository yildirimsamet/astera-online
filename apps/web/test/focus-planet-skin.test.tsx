import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { PLANET_SKIN_IDS } from '@astera/rules';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import type { GalaxyPlanet } from '../src/api/schemas.js';
import { PlanetFocus } from '../src/galaxy/FocusPanel.js';
import { planetArt } from '../src/ui/assets.js';
import { PLANET_SKIN_CATALOG } from '../src/ui/skinCatalog.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';

const noop = () => undefined;
const origin = planetView();
const contexts = [
  { label: 'foreign collapsed', owned: false, open: false },
  { label: 'foreign expanded', owned: false, open: true },
  { label: 'owned collapsed', owned: true, open: false },
  { label: 'owned expanded', owned: true, open: true },
];

describe('the focus rail planet portrait', () => {
  it.each(contexts)('$label shows the equipped skin and updates when focus changes', ({ owned, open }) => {
    const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const api = new Api({ fetch: () => new Promise<Response>(() => undefined) });
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queries}>
        <ApiProvider api={api}><ToastProvider>{children}</ToastProvider></ApiProvider>
      </QueryClientProvider>
    );
    const world = (skin?: GalaxyPlanet['skin']): GalaxyPlanet => ({
      id: 'focus-destination', name: 'Kestrel', owner: 'Commander',
      position: { x: 200, y: 0, z: 0 }, coreTier: 2, coreLevel: 6,
      intel: 'RESOLVED', kind: 'COLONY', state: { kind: 'NORMAL' },
      satellites: [], shielded: false, isSelf: false, isOwned: owned,
      ...(skin ? { skin } : {}),
    });
    const rail = (target: GalaxyPlanet) => <Wrapper><PlanetFocus
      target={target} planet={origin} intel={undefined} reports={[]} now={0}
      onClose={noop} onAttack={noop} onTransfer={noop} onInstallTelescope={noop}
      onLaunched={noop} open={open} onToggle={noop}
    /></Wrapper>;
    const { container, rerender } = render(rail(world()));
    const portrait = () => container.querySelector('[data-focus-rail] [role="img"] img');
    expect(portrait()).toHaveAttribute('src', planetArt('focus-destination'));
    for (const id of PLANET_SKIN_IDS) {
      for (const status of ['NORMAL', 'RECOVERY_SHIELD'] as const) {
        rerender(rail(world({ id, status })));
        expect(portrait()).toHaveAttribute('src', PLANET_SKIN_CATALOG[id].image);
      }
    }
    for (const id of ['planet-future', '__proto__', '']) {
      rerender(rail(world({ id, status: 'NORMAL' })));
      expect(portrait()).toHaveAttribute('src', planetArt('focus-destination'));
    }
    rerender(rail(world()));
    expect(portrait()).toHaveAttribute('src', planetArt('focus-destination'));
  });
});
