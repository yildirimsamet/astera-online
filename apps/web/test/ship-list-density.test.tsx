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
  const praetorian = () => render(
    <UpgradeRow
      name="Praetorian"
      role="escort"
      tag="Mobile escort"
      nameBadge={<ClassChip cls="BULWARK" />}
      nameAside="1 away"
      tierMark="Lv3"
      cost={{ alloy: 2500, crystal: 900, deuterium: 300 }}
      held={{ alloy: 9e5, crystal: 9e5, deuterium: 9e5 }}
      verb="build"
      onAct={() => undefined}
    />,
  );

  /**
   * THE CLASS CHIP IS THE ONE THAT COST THE NAME ITS WIDTH, and it is still off
   * this line. D195c moved the COUNTS up by owner instruction — *"Dart (Lv1) - 3
   * in 4 out"* — and that is a different quantity of pixels: `hullLocationCounts`
   * is held to 14 characters at `text-micro` by `hull-row-counts.test.tsx`, and the
   * tier mark is three, both `shrink-0` against a `truncate` name. The chip is a
   * glyph plus a word at caption size, roughly 60px of a ~241px budget, and it is
   * a fact ABOUT the ship rather than part of its identity.
   */
  it('keeps the class chip off the name line', () => {
    const nameLine = line(praetorian(), 'name');
    expect(nameLine).toHaveTextContent('Praetorian');
    expect(nameLine!.querySelector('[data-class]')).toBeNull();
  });

  it('carries the tier and the holding beside the name', () => {
    const nameLine = line(praetorian(), 'name');
    expect(nameLine).toHaveTextContent('Lv3');
    expect(nameLine).toHaveTextContent('1 away');
  });

  it('leaves the class and the flavour on the supporting line', () => {
    const support = line(praetorian(), 'support');
    expect(support!.querySelector('[data-class]')).toHaveAttribute('data-class', 'BULWARK');
    expect(support).toHaveTextContent('Mobile escort');
  });

  /** The name still truncates before either mark does — a half-count reads as a bug. */
  it('shrinks the name rather than the marks', () => {
    const view = praetorian();
    const nameLine = line(view, 'name')!;
    expect(nameLine.querySelector('h3')!.className).toContain('truncate');
    expect(view.getByTestId('hull-tier').className).toContain('shrink-0');
    expect(view.getByTestId('hull-where').className).toContain('shrink-0');
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

/**
 * THE MOCK'S PICKER (M3, owner 2026-09-25): one list of what stands home, each row the
 * ship, its class, how many are ready and the stepper. The bands and the per-ship stat
 * strip were built for a picker without the ruler; now the ruler and the matchup line
 * above say what a wing is worth against this target, and the shipyard keeps the stats.
 */
describe('the attack sheet lists the ships in one run', () => {
  it('lists every ship at home, with no folds', () => {
    launch({ DART: 4, RAMPART: 2, ATLAS: 1 });
    for (const name of [/dart quantity/i, /rampart quantity/i, /atlas quantity/i]) {
      expect(screen.getByRole('textbox', { name })).toBeInTheDocument();
    }
    expect(document.querySelector('[data-fleet-family]')).toBeNull();
    expect(screen.queryByRole('button', { name: /defensive/i })).toBeNull();
  });

  it('writes a row as the ship, its class and how many are ready — no stat strip', () => {
    const view = launch({ DART: 4 });
    const row = view.container.querySelector<HTMLElement>('[data-hull-row="DART"]')!;
    expect(row).toHaveTextContent('4 home');
    expect(row.querySelector('.stats')).toBeNull();
    expect(view.container.textContent).not.toMatch(/per ship/i);
  });

  it('says what a cargo hull adds to the hold', async () => {
    const view = launch({ DART: 4, COURIER: 2 });
    const row = view.container.querySelector<HTMLElement>('[data-hull-row="COURIER"]')!;
    expect(row).toHaveTextContent(/cargo each/i);
    await userEvent.click(screen.getByRole('button', { name: /more courier/i }));
    expect(row).toHaveTextContent(/\+[\d.,]+[a-z]* cargo/i);
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
    /*
      The price line under the ships is where the plate's facts now live, before the
      held commit: the garrison that stays behind (and, since K8, no claim that a raid
      at a world cannot be turned), and the fleetsave rule.
    */
    expect(view.container.textContent).not.toMatch(/cannot be recalled/i);
    expect(view.container.textContent).toMatch(/stays thin for .+ until this fleet is home/i);
    expect(view.container.querySelector('[data-launch-figures]')).toHaveTextContent(/\d+ units/);
    expect(view.container.textContent).toMatch(/cannot be raided/i);
  });
});
