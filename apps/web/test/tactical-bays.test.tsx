import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlanetView, SynthesisView } from '../src/api/schemas.js';
import { PlanetScreen } from '../src/screens/PlanetScreen.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';

/*
  THE TACTICAL TAB, IN TWO BAYS (owner 2026-11-25: "Taktik menüsünü iki tab'a ayıralım. Bir tabda füzelerin
  üretimi olsun, diğer tabda Sentez Laboratuvarı olsun. İleride bu laboratuvar daha gelişecek.").
  The weapons open first, as before; the laboratory has its own bay, only where there is one to stand in
  (the capital, in a galaxy with Asteryum). A finished batch's notification lands in the lab's bay.
*/

let planet: PlanetView = planetView();
let synthesis: SynthesisView | undefined;

const lab = (): SynthesisView => ({
  enabled: true, requiredCore: 10, coreLevel: 10, unlocked: true, asterium: 12, perDay: 3,
  moons: [], capsules: { OPTIC_VEIL: 0, SILENT_THRUST: 0 }, job: null, storm: null,
});

vi.mock('../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/api/queries.js');
  return {
    ...actual,
    usePlanet: () => ({ data: planet, dataUpdatedAt: Date.now(), isPending: false, refetch: vi.fn() }),
    useGalaxy: () => ({ data: undefined }),
    useIntel: () => ({ data: undefined }),
    usePending: () => ({ data: undefined }),
    useReports: () => ({ data: undefined }),
    useUpgrade: () => ({ mutate: vi.fn(), isPending: false }),
    useCollect: () => ({ mutate: vi.fn(), isPending: false }),
    useBuild: () => ({ mutate: vi.fn(), isPending: false }),
    useCompleteResearch: () => ({ mutate: vi.fn(), isPending: false }),
    useInstallSatellite: () => ({ mutate: vi.fn(), isPending: false }),
    useRaiseInstrument: () => ({ mutate: vi.fn(), isPending: false }),
    useCancelBuildOrder: () => ({ mutate: vi.fn(), isPending: false }),
    useBuildDeathStar: () => ({ mutate: vi.fn(), isPending: false }),
    useBuildInterceptor: () => ({ mutate: vi.fn(), isPending: false }),
    useSynthesis: () => ({ data: synthesis }),
    useSynthesisOrder: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

const show = (focusItem?: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ToastProvider>
    <PlanetScreen focusGroup="tactical" {...(focusItem ? { focusItem } : {})} />
  </ToastProvider></QueryClientProvider>);
};
const bays = () => screen.queryByRole('tablist', { name: 'Tactical bays' });
const forge = (): Element | null => document.querySelector('[data-strategic-state]');
const theLab = (): Element | null => document.querySelector('[data-testid="synthesis-lab"]');

afterEach(() => { planet = planetView(); synthesis = undefined; });

describe('the Tactical tab’s two bays', () => {
  it('opens on the weapons, and the laboratory is the second bay', async () => {
    synthesis = lab();
    show();
    const tabs = within(bays()!).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Weapons', 'Laboratory']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(forge()).not.toBeNull();
    expect(theLab()).toBeNull();
    await userEvent.click(tabs[1]!);
    expect(theLab()).not.toBeNull();
    expect(forge()).toBeNull();
    expect(screen.getByRole('tabpanel', { name: 'Laboratory' })).toContainElement(theLab() as HTMLElement);
  });

  it('lands in the laboratory when a finished batch’s notification is pressed', () => {
    synthesis = lab();
    show('synthesis-lab');
    expect(within(bays()!).getByRole('tab', { name: 'Laboratory' })).toHaveAttribute('aria-selected', 'true');
    expect(theLab()).not.toBeNull();
  });

  it('draws no bays where there is no laboratory: a colony, or a galaxy without Asteryum', () => {
    synthesis = { ...lab(), enabled: false };
    const first = show();
    expect(bays()).toBeNull();
    expect(forge()).not.toBeNull();
    first.unmount();
    synthesis = lab();
    planet = planetView({}, { kind: 'COLONY' });
    show();
    expect(bays()).toBeNull();
    expect(theLab()).toBeNull();
  });
});
