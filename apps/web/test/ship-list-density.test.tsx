import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import type { GalaxyPlanet } from '../src/api/schemas.js';
import { LaunchSheet } from '../src/screens/LaunchSheet.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { UpgradeRow } from '../src/ui/UpgradeRow.js';
import { ClassChip } from '../src/ui/CounterMark.js';
import i18n from '../src/i18n/index.js';
import { planetView } from './fixtures.js';

/**
 * THE 375-PIXEL BUDGET, AND WHAT IS ALLOWED TO SPEND IT. Owner report.
 *
 * The owner's screenshot showed hull rows reading "E...", "P..." and "K..." — one
 * letter and an ellipsis where a ship's name should be. Two causes, and both are
 * recorded here so neither comes back:
 *
 *   · `tools/visual.mjs` ran at 390px, fifteen pixels wider than the real target.
 *     Every screenshot this project ever took was of a screen the game does not
 *     ship on, and fifteen pixels is exactly the margin that hides a truncation.
 *   · A class chip was added to the NAME's line, which is the one line on the row
 *     with nothing to spare. `UpgradeRow`'s own docblock has warned about this
 *     since D109 — "a truncated label is worse than a small one: the player cannot
 *     tell what they are being sold, and this row exists to sell it."
 *
 * jsdom has no layout, so these assert the STRUCTURE that produces the layout:
 * which line each element is on. That is the actual invariant — the name owns its
 * line — and it is checkable where a pixel width is not.
 */

beforeEach(async () => {
  await i18n.changeLanguage('en');
  /*
    THE FOLD IS REMEMBERED PER DEVICE NOW (`useAccordion`), and jsdom hands every
    test in this file the same `localStorage`. A case that opens a band would
    otherwise hand its choice to the next case's assertion about the DEFAULT — the
    one thing this file exists to pin.
  */
  window.localStorage.clear();
});

const line = (view: ReturnType<typeof render>, name: string) =>
  view.container.querySelector<HTMLElement>(`[data-row-line="${name}"]`);

describe('what shares the name\'s line', () => {
  it('gives the name a line of its own', () => {
    const view = render(
      <UpgradeRow
        name="Praetorian"
        role="escort"
        tag="Mobile escort"
        nameBadge={<ClassChip cls="BULWARK" />}
        nameAside="1 away"
        cost={{ alloy: 2500, crystal: 900, deuterium: 300 }}
        held={{ alloy: 9e5, crystal: 9e5, deuterium: 9e5 }}
        verb="build"
        onAct={() => undefined}
      />,
    );
    const nameLine = line(view, 'name');
    expect(nameLine).toHaveTextContent('Praetorian');
    // The two things that used to crowd it are NOT on it.
    expect(nameLine!.querySelector('[data-class]')).toBeNull();
    expect(nameLine!.textContent).not.toMatch(/away/i);
  });

  it('puts the class and the counts on the supporting line instead', () => {
    const view = render(
      <UpgradeRow
        name="Praetorian"
        role="escort"
        tag="Mobile escort"
        nameBadge={<ClassChip cls="BULWARK" />}
        nameAside="1 away"
        cost={{ alloy: 2500, crystal: 900, deuterium: 300 }}
        held={{ alloy: 9e5, crystal: 9e5, deuterium: 9e5 }}
        verb="build"
        onAct={() => undefined}
      />,
    );
    const support = line(view, 'support');
    expect(support!.querySelector('[data-class]')).toHaveAttribute('data-class', 'BULWARK');
    expect(support).toHaveTextContent('1 away');
  });

  /**
   * THE PRICE RUNS ACROSS, NOT DOWN. `Price` defaults to a one-per-line grid,
   * which on a three-resource hull stacked into four lines of right-hand column
   * and dragged the row's height with it. A row has the width for one line.
   */
  it('lays the price out across the row rather than stacking it', () => {
    const view = render(
      <UpgradeRow
        name="Praetorian"
        role="escort"
        cost={{ alloy: 2500, crystal: 900, deuterium: 300 }}
        held={{ alloy: 9e5, crystal: 9e5, deuterium: 9e5 }}
        verb="build"
        onAct={() => undefined}
      />,
    );
    expect(view.container.querySelector('.price')).toHaveAttribute('data-layout', 'row');
  });
});

/* ── the accordion ─────────────────────────────────────────────────────────── */

const target: GalaxyPlanet = {
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

const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  return (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <ToastProvider>{children}</ToastProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
};

/** Fuelled, so the commit button reaches the confirmation rather than refusing. */
const launch = (fleet: Record<string, number>) =>
  render(
    <LaunchSheet
      target={{ kind: 'world', world: target }}
      planet={planetView({ fleet }, { deuterium: 50_000 })}
      onClose={vi.fn()}
      onLaunched={vi.fn()}
    />,
    { wrapper },
  );

describe('the attack sheet bands the ships and folds them', () => {
  it('opens with the first band expanded and the rest shut', () => {
    launch({ DART: 4, RAMPART: 2, ATLAS: 1 });
    // Offensive is first in the roster order, so its rows are the ones on screen.
    expect(screen.getByRole('textbox', { name: /dart quantity/i })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /rampart quantity/i })).toBeNull();
    expect(screen.queryByRole('textbox', { name: /atlas quantity/i })).toBeNull();
  });

  /**
   * THE COUNT IS SHIPS, NOT ROWS. Two Ramparts is what a commander has to spend;
   * "one kind of Rampart" is a fact about the catalogue and answers nothing.
   */
  it('states how many ships each shut band is holding back', () => {
    launch({ DART: 4, RAMPART: 2, ATLAS: 1 });
    const defensive = screen.getByRole('button', { name: /defensive/i });
    expect(defensive).toHaveAttribute('aria-expanded', 'false');
    expect(defensive).toHaveTextContent('2');
  });

  it('opens a band when it is pressed, without shutting the others', async () => {
    launch({ DART: 4, RAMPART: 2, ATLAS: 1 });
    await userEvent.click(screen.getByRole('button', { name: /defensive/i }));
    expect(screen.getByRole('textbox', { name: /rampart quantity/i })).toBeInTheDocument();
    // The first band stays where the player left it.
    expect(screen.getByRole('textbox', { name: /dart quantity/i })).toBeInTheDocument();
  });

  /**
   * A SINGLE BAND IS NOT AN ACCORDION. Folding the only group on screen would cost
   * a tap and hide the entire picker to save nothing.
   */
  it('leaves a lone band open, because there is nothing to fold away', () => {
    launch({ DART: 4, VIPER: 2 });
    expect(screen.getByRole('textbox', { name: /dart quantity/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /viper quantity/i })).toBeInTheDocument();
  });
});

describe('what the attack sheet no longer spends a plate on', () => {
  /**
   * Owner instruction: *"Bu filo dışarıdayken sectionları kaldır. Büyük çok yer
   * kaplıyor ve gereksiz"* — quoting `launch.whileAway`'s own Turkish heading.
   *
   * The two facts it carried are not lost: the confirmation step still names the
   * garrison that holds and still says the fleet cannot be recalled, which is where
   * a warning belongs — one press before the irreversible one, rather than filling
   * a third of the sheet while the player is still choosing.
   */
  it('drops the "while this fleet is away" plate', () => {
    const view = launch({ DART: 4 });
    expect(view.container.querySelector('[data-defence-bar]')).toBeNull();
    expect(view.container.textContent).not.toMatch(/while this fleet is away/i);
  });

  it('still warns about the undefended garrison at the moment of commitment', async () => {
    const view = launch({ DART: 4 });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /more dart/i }));
    await user.click(screen.getByRole('button', { name: /^send/i }));
    /*
      The confirmation step is where the plate's two facts now live: `launch.warning`
      names the garrison that stays behind and states the launch is irreversible,
      and `launch.fleetsave` gives the rule that makes the risk cut both ways.
    */
    expect(view.container.textContent).toMatch(/cannot be recalled/i);
    expect(view.container.textContent).toMatch(/holds \d+ units until it comes back/i);
    expect(view.container.textContent).toMatch(/cannot be raided/i);
  });
});
