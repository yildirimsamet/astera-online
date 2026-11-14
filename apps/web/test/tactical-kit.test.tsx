import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ANTI_STRATEGIC, DEATH_STAR } from '@astera/rules';
import { PlanetScreen } from '../src/screens/PlanetScreen.js';
import { RadiationBombForge } from '../src/screens/RadiationBombControls.js';
import { ToastProvider } from '../src/ui/Toast.js';
import type { PlanetView } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';

/**
 * G2-g, 2026-11-14: THE STRATEGIC HARDWARE ON THE GAME KIT. The player's moment: "do I build a
 * strategic weapon, what does it do, what does it cost, how many can this world hold?" — and on
 * Defend, "what stops one of those?". The Death Star forge, the interception battery and the
 * radiation-bomb forge share one card: the picture, the stock as cells, the state, the facts, the
 * rule one tap away, what it still needs as doors, the price, and a one-second hold.
 */

const buildDeathStar = vi.fn();
const loadCharge = vi.fn();
let current: PlanetView = planetView();

vi.mock('../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/api/queries.js');
  return {
    ...actual,
    usePlanet: () => ({ data: current, dataUpdatedAt: Date.now(), isPending: false }),
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
    useBuildDeathStar: () => ({ mutate: buildDeathStar, isPending: false }),
    useBuildInterceptor: () => ({ mutate: loadCharge, isPending: false }),
  };
});

const plenty = { alloy: 900_000, crystal: 900_000, deuterium: 90_000, alloyCap: 2_000_000, crystalCap: 2_000_000, deuteriumCap: 200_000 };
const weapon = (id: string, status: 'READY' | 'BUILDING' | 'PAUSED', readyAt: Date | null = null) =>
  ({ id, status, readyAt, remainingSeconds: status === 'READY' ? 0 : DEATH_STAR.buildMinutes * 60 });
/** A world that may build a Death Star: the Core and the Shipyard it needs, and the purse. */
const forgeWorld = (over: Partial<Omit<PlanetView, 'planet'>> = {}): PlanetView => planetView({
  buildings: { CORE: DEATH_STAR.requiredCore, REFINERY: 4, EXTRACTOR: 4, VAULT: 2, SHIPYARD: DEATH_STAR.requiredShipyard },
  instruments: { RADAR: ANTI_STRATEGIC.requiredRadar },
  orbit: ['UPLINK'],
  ...over,
}, plenty);
const withResearch = (id: 'STRATEGIC_STOCKPILE' | 'INTERCEPTION_GRID', level: number): PlanetView['research'] =>
  planetView().research.map((project) => project.id === id ? { ...project, level, discovered: true, completed: true, available: false } : project);

const show = (tab: 'tactical' | 'defend', onOpenResearch = vi.fn()) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider><PlanetScreen focusGroup={tab} onOpenResearch={onOpenResearch} /></ToastProvider>
    </QueryClientProvider>,
  );
};
const forge = (): HTMLElement => document.querySelector<HTMLElement>('[data-strategic-state]')!;
const battery = (): HTMLElement => document.querySelector<HTMLElement>('[data-interceptor-state]')!;
const holdToCommit = async (button: HTMLElement) => {
  button.focus();
  await userEvent.keyboard('{Enter}{Enter}');
};
/** Whatever the v2 card used to wear, nothing of it is left. */
const v2Classes = (root: HTMLElement): string[] => [...root.querySelectorAll<HTMLElement>('[class]'), root]
  .flatMap((node) => [...node.classList])
  .filter((name) => /^(tactical-|radiation-product|radiation-forge|v2-|font-v2|text-micro|text-v2|bg-v2|border-v2)/.test(name));

beforeEach(() => {
  buildDeathStar.mockClear();
  loadCharge.mockClear();
  try { window.localStorage.clear(); } catch { /* a private window is fine */ }
});

describe('the Death Star forge on the kit', () => {
  it('is a kit weapon card: the picture, the name, the stock as cells, nothing of the v2 card', () => {
    current = forgeWorld();
    show('tactical');
    expect(forge()).toHaveClass('gk-arm');
    expect(forge().closest('.gk')).not.toBeNull();
    expect(forge().querySelector('.gk-arm__art img')).toHaveAttribute('src', '/assets/images/atmosphere/strategic-v2.webp');
    expect(within(forge()).getByRole('heading', { name: 'Death Star' })).toBeInTheDocument();
    expect(forge().querySelector('.gk-cells[data-tally]')).toHaveAttribute('data-total', '1');
    expect(forge().querySelector('[data-stock-counter]')).toHaveTextContent('Stock 0/1');
    expect(v2Classes(forge())).toEqual([]);
  });

  it('says what it does once: the rule line, with no category line repeating it above', () => {
    current = forgeWorld();
    show('tactical');
    expect(forge()).toHaveTextContent("Zeroes the target's Aegis and silences its ground defences.");
    expect(forge()).not.toHaveTextContent(/Tactical EMP weapon/i);
  });

  it('builds on a one-second hold, never on a tap', async () => {
    current = forgeWorld();
    show('tactical');
    const hold = within(forge()).getByRole('button', { name: /^Build/ });
    expect(hold).toHaveClass('gk-hold');
    expect(hold.getAttribute('style')).toContain('--gk-hold-ms: 1000ms');
    await userEvent.click(hold);
    expect(buildDeathStar).not.toHaveBeenCalled();
    await holdToCommit(hold);
    expect(buildDeathStar).toHaveBeenCalledOnce();
  });

  it('says the first thing it needs on the dead hold, and the unmet needs are doors', async () => {
    current = planetView({}, plenty);
    show('tactical');
    const dead = forge().querySelector<HTMLButtonElement>('[data-act] button')!;
    expect(dead).toBeDisabled();
    expect(dead).toHaveTextContent(new RegExp(`core l${String(DEATH_STAR.requiredCore)}`, 'i'));
    const needs = within(forge()).getAllByRole('listitem');
    expect(needs.map((need) => need.dataset.met)).toEqual(['false', 'false', 'true']);
    expect(forge().querySelectorAll('.gk-need-chip')).toHaveLength(3);
    // a met need is a fact, not a button
    expect(within(needs[2]!).queryByRole('button')).toBeNull();
    Element.prototype.scrollIntoView = vi.fn();
    await userEvent.click(within(needs[0]!).getByRole('button'));
    expect(screen.getByRole('tab', { name: 'Production' })).toHaveAttribute('aria-selected', 'true');
  });

  it('states the price on the kit cost line, with the build time beside it', () => {
    current = forgeWorld();
    show('tactical');
    const price = forge().querySelector('.gk-cost')!;
    expect(price.querySelectorAll('.gk-cost__part')).toHaveLength(3);
    expect(price.querySelector('.gk-cost__time')).not.toBeNull();
  });

  it('shows what one strike does as two facts, and keeps the whole rule one tap away', async () => {
    current = forgeWorld();
    show('tactical');
    const specs = forge().querySelector('.gk-arm__specs')!;
    expect(specs).toHaveTextContent('1h 00m');
    expect(specs).toHaveTextContent(`−${String(DEATH_STAR.colonyLoyaltyLoss)}`);
    expect(within(forge()).queryByText(/Drops the target's Aegis to zero/)).toBeNull();
    await userEvent.click(within(forge()).getByRole('button', { name: 'How it works' }));
    expect(within(forge()).getByText(/Drops the target's Aegis to zero/)).toBeInTheDocument();
  });

  it('draws a weapon under construction on the kit bar and lights the bay', () => {
    const building = weapon('b', 'BUILDING', new Date(Date.now() + DEATH_STAR.buildMinutes * 30_000));
    current = forgeWorld({ strategic: building, deathStars: [building] });
    show('tactical');
    const fill = forge().querySelector<HTMLElement>('[data-strategic-progress] .gk-bar__fill')!;
    expect(Number.parseFloat(fill.style.width)).toBeCloseTo(50, 0);
    expect(forge()).toHaveAttribute('data-working');
    expect(forge().querySelector('[data-arm-status]')).toHaveAttribute('data-tone', 'self');
  });

  it('gives a second weapon under construction its own line and bar, never under the ready one', () => {
    const ready = weapon('r', 'READY');
    const building = weapon('b', 'BUILDING', new Date(Date.now() + DEATH_STAR.buildMinutes * 30_000));
    current = forgeWorld({ strategic: ready, deathStars: [ready, building], research: withResearch('STRATEGIC_STOCKPILE', 1) });
    show('tactical');
    const lines = [...forge().querySelectorAll<HTMLElement>('[data-arm-status]')];
    expect(lines.map((line) => line.dataset.tone)).toEqual(['good', 'self']);
    expect(lines[0]).toHaveTextContent('Ready to launch');
    expect(lines[1]).toHaveTextContent(/Building/);
    const bar = forge().querySelector('[data-strategic-progress]')!;
    expect(lines[1]!.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(lines[0]!.nextElementSibling).toBe(lines[1]);
  });

  it('says a lone weapon once, and lists the mix only when the pad holds more than one state', () => {
    const ready = weapon('r', 'READY');
    current = forgeWorld({ strategic: ready, deathStars: [ready] });
    const lone = show('tactical');
    expect(forge()).toHaveTextContent('Ready to launch');
    expect(forge()).not.toHaveTextContent('Ready: 1');
    lone.unmount();

    const building = weapon('b', 'BUILDING', new Date(Date.now() + 60_000));
    current = forgeWorld({ strategic: ready, deathStars: [ready, building], research: withResearch('STRATEGIC_STOCKPILE', 1) });
    show('tactical');
    expect(forge()).toHaveTextContent(/Ready: 1.*Building: 1/);
    expect([...forge().querySelectorAll<HTMLElement>('[data-cell]')].map((cell) => cell.dataset.cell)).toEqual(['ready', 'loading']);
  });

  it('points a full pad at the research that makes it bigger, through a kit door', async () => {
    const ready = weapon('r', 'READY');
    const onOpenResearch = vi.fn();
    current = forgeWorld({ strategic: ready, deathStars: [ready] });
    show('tactical', onOpenResearch);
    const door = within(forge()).getByRole('button', { name: /strategic stockpile/i });
    expect(door).toHaveClass('gk-arm__next');
    expect(door).toHaveTextContent('2');
    await userEvent.click(door);
    expect(onOpenResearch).toHaveBeenCalledWith('STRATEGIC_STOCKPILE');
  });
});

describe('the interception battery on the kit', () => {
  it('is the same kit card on Defend, with its charges as cells', () => {
    const charge = weapon('c', 'READY');
    current = forgeWorld({ interceptor: charge, interceptors: [charge] });
    show('defend');
    expect(battery()).toHaveClass('gk-arm');
    expect(battery().querySelector('.gk-arm__art img')).toHaveAttribute('src', '/assets/images/atmosphere/interceptor-v4.webp');
    expect(battery().querySelector('[data-stock-counter]')).toHaveTextContent('Charges 1/2');
    expect(battery().querySelector('.gk-cells[data-tally]')).toHaveAttribute('data-used', '1');
    expect(v2Classes(battery())).toEqual([]);
  });

  it('loads a charge on a one-second hold: it spends, so a tap does not', async () => {
    current = forgeWorld();
    show('defend');
    const hold = within(battery()).getByRole('button', { name: /^Load charge/ });
    expect(hold).toHaveClass('gk-hold');
    expect(hold.getAttribute('style')).toContain('--gk-hold-ms: 1000ms');
    await userEvent.click(hold);
    expect(loadCharge).not.toHaveBeenCalled();
    await holdToCommit(hold);
    expect(loadCharge).toHaveBeenCalledOnce();
  });

  it('reads a loaded charge with its ring dark as a warning, and names what brings the ring back', () => {
    const charge = weapon('c', 'READY');
    current = forgeWorld({ interceptor: charge, interceptors: [charge], orbit: [] });
    show('defend');
    expect(battery().querySelector('[data-arm-status]')).toHaveAttribute('data-tone', 'warn');
    expect(battery()).toHaveTextContent(/Radar ring is offline/);
    expect(within(battery()).getByRole('button', { name: /Uplink/ })).toBeInTheDocument();
  });

  it('points a full battery at the Interception Grid through the kit door', () => {
    const charges = [weapon('a', 'READY'), weapon('b', 'READY')];
    current = forgeWorld({ interceptor: charges[0]!, interceptors: charges, research: withResearch('INTERCEPTION_GRID', 0) });
    show('defend');
    expect(within(battery()).getByRole('button', { name: /interception grid/i })).toHaveClass('gk-arm__next');
  });
});

describe('the radiation-bomb forge on the kit', () => {
  const origin = (): PlanetView => planetView({
    radiationBombsAvailable: true,
    radiationBombs: [
      { id: 'l1', level: 1, status: 'READY', readyAt: null, remainingSeconds: 0 },
      { id: 'l2', level: 2, status: 'LAUNCHED', readyAt: null, remainingSeconds: 0 },
    ],
    buildings: { CORE: 13, SHIPYARD: 5 },
  });
  const held = { alloy: 100_000, crystal: 100_000, deuterium: 100_000 };

  it('is one card with a level lever, opening on the first level with an empty slot', () => {
    render(<RadiationBombForge planet={origin()} held={held} now={0} pending={false} onBuild={vi.fn()} />);
    const lever = screen.getByRole('radiogroup', { name: 'Radiation Bomb' });
    expect(within(lever).getAllByRole('radio').map((stop) => stop.textContent)).toEqual(['Level 1', 'Level 2', 'Level 3']);
    expect(within(lever).getByRole('radio', { name: 'Level 3' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByTestId(/^radiation-product-/)).toHaveLength(1);
    const card = screen.getByTestId('radiation-product-3');
    expect(card).toHaveClass('gk-arm');
    expect(card.querySelector('.gk-arm__art img')).toHaveAttribute('src', '/assets/images/tactical/radiation-bomb-forge-l3.webp');
    expect(within(card).getByRole('button', { name: /^Build L3/ })).toHaveClass('gk-hold');
    expect(v2Classes(card)).toEqual([]);
  });

  it('reads every level’s slot at a glance beside the lever', () => {
    render(<RadiationBombForge planet={origin()} held={held} now={0} pending={false} onBuild={vi.fn()} />);
    const levels = screen.getByTestId('radiation-levels');
    expect([...levels.querySelectorAll<HTMLElement>('[data-cell]')].map((cell) => cell.dataset.cell)).toEqual(['ready', 'flight', 'empty']);
  });

  it('shows the chosen level’s state, and no build where its slot is taken', async () => {
    render(<RadiationBombForge planet={origin()} held={held} now={0} pending={false} onBuild={vi.fn()} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Level 1' }));
    const one = screen.getByTestId('radiation-product-1');
    expect(one).toHaveTextContent('Ready to launch');
    expect(within(one).queryByRole('button', { name: /Build L1/ })).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'Level 2' }));
    expect(screen.getByTestId('radiation-product-2')).toHaveTextContent('In flight · stock occupied');
  });

  it('says nothing twice: an empty slot has no state line beside its "Stock 0/1"', async () => {
    render(<RadiationBombForge planet={origin()} held={held} now={0} pending={false} onBuild={vi.fn()} />);
    expect(screen.getByTestId('radiation-product-3').querySelector('[data-arm-status]')).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'Level 1' }));
    expect(screen.getByTestId('radiation-product-1').querySelector('[data-arm-status]')).toHaveTextContent('Ready to launch');
  });

  it('builds the chosen level on a one-second hold', async () => {
    const onBuild = vi.fn();
    render(<RadiationBombForge planet={origin()} held={held} now={0} pending={false} onBuild={onBuild} />);
    const hold = screen.getByRole('button', { name: /^Build L3/ });
    expect(hold.getAttribute('style')).toContain('--gk-hold-ms: 1000ms');
    await userEvent.click(hold);
    expect(onBuild).not.toHaveBeenCalled();
    await holdToCommit(hold);
    expect(onBuild).toHaveBeenCalledWith(3);
  });

  it('keeps the rules one tap away instead of a folded paragraph', async () => {
    render(<RadiationBombForge planet={origin()} held={held} now={0} pending={false} onBuild={vi.fn()} />);
    expect(document.querySelector('details')).toBeNull();
    expect(screen.queryByText(/Repairs and dismantling stop/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'How it works' }));
    expect(screen.getByText(/Repairs and dismantling stop/)).toBeInTheDocument();
    expect(document.querySelector('[data-honor-weapon-rule]')).not.toBeNull();
  });
});
