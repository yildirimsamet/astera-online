import type { ReactNode } from 'react';
import { readFileSync } from 'node:fs';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILD, cancelRefund } from '@astera/rules';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { QueueStrip } from '../src/ui/QueueStrip.js';
import { PlanetFocus } from '../src/galaxy/FocusPanel.js';
import type { BuildOrderView, GalaxyPlanet, IntelView, PlanetView } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { planetView } from './fixtures.js';

/**
 * TWO CONTROLS THAT SPENT SOMETHING PERMANENTLY ON ONE TAP. Owner report.
 *
 * *"Queue'daki bir item'ı iptal ederken onay modal'ı çıkmalı, kaynağın yarısının
 * gideceği bildirilmeli. Ölüm yıldızı yollama butonuna da onay gelmeli,
 * yanlışlıkla."*
 *
 * · THE QUEUE'S CANCEL is a 20px glyph in the corner of a build segment, on a
 *   strip whose segments are already pressable, and it destroys HALF of what the
 *   order cost (`BUILD.cancelRefund`). The figure was on a `title` attribute —
 *   a tooltip, on a game budgeted for a phone, where no such thing exists. So on
 *   the target device the price was not merely un-confirmed, it was unstated.
 *
 * · THE DEATH STAR STRIKE is the most expensive single action in the game
 *   (`DEATH_STAR.cost`), it consumes the weapon, and it sat as one
 *   slab among four in a wrapped row where the neighbouring control is an
 *   ordinary raid. Its exact price comes from the shared rules table.
 *
 * `visual-design.md` reserves commit styling for the irreversible and this file
 * is the other half of that rule: an irreversible thing also gets a SECOND BEAT.
 * One shared surface, because a confirm that looked different on each screen
 * would be the inconsistency the owner reported in the same breath.
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

/**
 * `BuildOrderView` is a union of four shapes and a literal has to satisfy one of
 * them exactly, so the base is written as the timed CONSTRUCTION member and the
 * override is applied to it — no cast, and a wrong field is still a type error.
 */
type TimedConstruction = Extract<BuildOrderView, { queue: 'CONSTRUCTION'; startedAt: Date }>;

const order = (over: Partial<TimedConstruction> = {}): TimedConstruction => ({
  id: 'o1',
  queue: 'CONSTRUCTION',
  kind: 'BUILDING',
  subject: 'REFINERY',
  count: 1,
  slot: 0,
  cost: { alloy: 900, crystal: 400, deuterium: 60 },
  startedAt: new Date(NOW - 60_000),
  finishesAt: new Date(NOW + 600_000),
  ...over,
});

beforeEach(async () => {
  await i18n.changeLanguage('en');
  window.localStorage.clear();
});

describe('cancelling a queued order asks first, and states what it costs', () => {
  const strip = (onCancel: (o: BuildOrderView) => void) => {
    const Wrapper = harness();
    return render(
      <Wrapper>
        <QueueStrip label="Construction" orders={[order()]} now={NOW} onCancel={onCancel} />
      </Wrapper>,
    );
  };

  it('does not cancel on the first press', async () => {
    const onCancel = vi.fn();
    const view = strip(onCancel);
    await userEvent.click(view.container.querySelector('[data-cancel]')!);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('opens one confirmation instead', async () => {
    const view = strip(vi.fn());
    await userEvent.click(view.container.querySelector('[data-cancel]')!);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  /**
   * THE HALF THAT DOES NOT COME BACK IS THE POINT. A refund figure alone reads
   * as a gain — the player is being handed resources — and says nothing about
   * the larger number that is being destroyed to hand it over.
   */
  it('states what is lost, not only what is refunded', async () => {
    const view = strip(vi.fn());
    await userEvent.click(view.container.querySelector('[data-cancel]')!);
    const dialog = screen.getByRole('dialog');
    const cost = order().cost;
    const back = cancelRefund(cost);
    for (const resource of ['alloy', 'crystal', 'deuterium'] as const) {
      const lost = cost[resource] - back[resource];
      expect(
        within(dialog).getAllByText(new RegExp(String(lost))).length,
        `the ${resource} being destroyed is not on the sheet`,
      ).toBeGreaterThan(0);
    }
  });

  it('names the share the rules actually keep', async () => {
    const view = strip(vi.fn());
    await userEvent.click(view.container.querySelector('[data-cancel]')!);
    const share = Math.round((1 - BUILD.cancelRefund) * 100);
    expect(within(screen.getByRole('dialog')).getByText(new RegExp(`${String(share)}\\s*%`)))
      .toBeInTheDocument();
  });

  it('cancels once, and only once, when the commander confirms', async () => {
    const onCancel = vi.fn();
    const view = strip(onCancel);
    await userEvent.click(view.container.querySelector('[data-cancel]')!);
    await userEvent.click(within(screen.getByRole('dialog')).getByTestId('confirm-commit'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledWith(expect.objectContaining({ id: 'o1' }));
  });

  it('leaves the order alone when the commander backs out', async () => {
    const onCancel = vi.fn();
    const view = strip(onCancel);
    await userEvent.click(view.container.querySelector('[data-cancel]')!);
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  /**
   * A CANCEL ALREADY IN FLIGHT DISABLES THE COMMIT BEING ASKED ABOUT.
   *
   * `QueueStrip` already knew this — `cancelling` is what greys the segment
   * marks while the mutation runs — and the confirmation was the one surface not
   * told, so `Confirm`'s `pending` prop existed and nothing passed it. Its commit
   * is the button most likely to be pressed twice: a commander who has just
   * decided to lose half an order does not wait to see whether it took.
   */
  it('refuses a second commit while the first is still in flight', async () => {
    const Wrapper = harness();
    const one = order();
    const view = render(
      <Wrapper>
        <QueueStrip label="Construction" orders={[one]} now={NOW} onCancel={vi.fn()} />
      </Wrapper>,
    );
    await userEvent.click(view.container.querySelector('[data-cancel]')!);
    expect(screen.getByTestId('confirm-commit')).toBeEnabled();

    // The mutation starts: the parent re-renders the strip with it in flight.
    view.rerender(
      <Wrapper>
        <QueueStrip
          label="Construction"
          orders={[one]}
          now={NOW}
          cancelling={one.id}
          onCancel={vi.fn()}
        />
      </Wrapper>,
    );
    expect(screen.getByTestId('confirm-commit')).toBeDisabled();
  });
});

describe('a Death Star strike asks before it leaves', () => {
  const target = (over: Partial<GalaxyPlanet> = {}): GalaxyPlanet => ({
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
    kind: 'COLONY' as const,
    ...over,
  });

  const armed = (): PlanetView => ({
    ...planetView(
      {
        buildings: { CORE: 8, REFINERY: 4, EXTRACTOR: 4, VAULT: 2, SHIPYARD: 4 },
        instruments: { TELESCOPE: 2, RADAR: 2, AEGIS: 0, VEIL: 0 },
        orbit: ['UPLINK'],
        fleet: { DART: 6 },
      },
      { alloy: 40_000, crystal: 20_000, alloyCap: 90_000, crystalCap: 40_000 },
    ),
    strategic: { id: 's1', status: 'READY', readyAt: new Date(NOW), remainingSeconds: null },
  });

  const intel: IntelView = {
    watching: [],
    probeReports: [],
    probeCooldowns: [],
    radarLog: [],
    probeCost: { alloy: 25, crystal: 25, deuterium: 0 },
  };

  const show = (onDeathStar: () => void) => {
    const Wrapper = harness();
    return render(
      <Wrapper>
        <PlanetFocus
          target={target()}
          planet={armed()}
          intel={intel}
          reports={[]}
          now={NOW}
          onClose={vi.fn()}
          onAttack={vi.fn()}
          onDeathStar={onDeathStar}
          onInstallTelescope={vi.fn()}
          onLaunched={vi.fn()}
          open
          onToggle={vi.fn()}
        />
      </Wrapper>,
    );
  };

  it('does not launch on the first press', async () => {
    const onDeathStar = vi.fn();
    const view = show(onDeathStar);
    await userEvent.click(view.container.querySelector('[data-death-star]')!);
    expect(onDeathStar).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  /** The world is the whole question — a mis-tap sends it to the wrong one. */
  it('names the world it is about to darken', async () => {
    const view = show(vi.fn());
    await userEvent.click(view.container.querySelector('[data-death-star]')!);
    expect(within(screen.getByRole('dialog')).getByText(/Grimhold/)).toBeInTheDocument();
  });

  it('launches once the commander confirms', async () => {
    const onDeathStar = vi.fn();
    const view = show(onDeathStar);
    await userEvent.click(view.container.querySelector('[data-death-star]')!);
    await userEvent.click(within(screen.getByRole('dialog')).getByTestId('confirm-commit'));
    expect(onDeathStar).toHaveBeenCalledTimes(1);
  });

  it('leaves the weapon on the pad when the commander backs out', async () => {
    const onDeathStar = vi.fn();
    const view = show(onDeathStar);
    await userEvent.click(view.container.querySelector('[data-death-star]')!);
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    expect(onDeathStar).not.toHaveBeenCalled();
  });
});

describe('a confirmation is above everything, and dies with its question', () => {
  /**
   * TWO FAULTS FOUND BY REVIEWING THE FIRST BUILD OF THIS FILE, both of them
   * invisible to every assertion above.
   *
   * 1 · THE SHEET WAS TRAPPED IN A STACKING CONTEXT. `FocusShell` is
   *     `absolute … z-20`, and position plus a z-index that is not `auto` opens
   *     a stacking context — so the sheet's own `z-40` was being resolved INSIDE
   *     it. Everything on the page at z-30 or above (the pending strip, a toast
   *     at z-50) painted over the scrim and stayed clickable through it, which
   *     is a modal that is not modal. The first docblock written here claimed
   *     "where the element sits in this tree changes nothing about where it
   *     lands" — true of the POSITION, false of the painting order, and the
   *     reason a confirmation goes through a portal.
   *
   * 2 · THE QUESTION OUTLIVED ITS SUBJECT. The focus rail keeps its fiber across
   *     a change of world (that is what `focus-hook-order.test.tsx` guards), so
   *     `striking` survived one. Open the strike question on Grimhold, focus your
   *     own colony without answering — the panel early-returns and the sheet
   *     vanishes — then focus any foreign world, and it reappeared by itself,
   *     now naming a world the commander never pressed anything on. That is a
   *     worse version of the *"yanlışlıkla"* this whole file exists to answer.
   */
  const target = (over: Partial<GalaxyPlanet> = {}): GalaxyPlanet => ({
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
    kind: 'COLONY' as const,
    ...over,
  });

  const armed = (): PlanetView => ({
    ...planetView(
      {
        buildings: { CORE: 8, REFINERY: 4, EXTRACTOR: 4, VAULT: 2, SHIPYARD: 4 },
        instruments: { TELESCOPE: 2, RADAR: 2, AEGIS: 0, VEIL: 0 },
        orbit: ['UPLINK'],
        fleet: { DART: 6 },
      },
      { alloy: 40_000, crystal: 20_000, alloyCap: 90_000, crystalCap: 40_000 },
    ),
    strategic: { id: 's1', status: 'READY', readyAt: new Date(NOW), remainingSeconds: null },
  });

  const intel: IntelView = {
    watching: [],
    probeReports: [],
    probeCooldowns: [],
    radarLog: [],
    probeCost: { alloy: 25, crystal: 25, deuterium: 0 },
  };

  const panel = (world: GalaxyPlanet) => (
    <PlanetFocus
      target={world}
      planet={armed()}
      intel={intel}
      reports={[]}
      now={NOW}
      onClose={vi.fn()}
      onAttack={vi.fn()}
      onDeathStar={vi.fn()}
      onInstallTelescope={vi.fn()}
      onLaunched={vi.fn()}
      open
      onToggle={vi.fn()}
    />
  );

  it('escapes the focus rail’s stacking context', async () => {
    const Wrapper = harness();
    const view = render(<Wrapper>{panel(target())}</Wrapper>);
    await userEvent.click(view.container.querySelector('[data-death-star]')!);

    const dialog = screen.getByRole('dialog');
    const scrim = dialog.parentElement;
    expect(scrim, 'the sheet has no scrim wrapper').not.toBeNull();
    // A portal renders into `document.body`, outside every rail and every panel.
    expect(scrim?.parentElement).toBe(document.body);
    expect(view.container.contains(dialog)).toBe(false);
  });

  it('closes itself when the focus moves to another world', async () => {
    const Wrapper = harness();
    const view = render(<Wrapper>{panel(target())}</Wrapper>);
    await userEvent.click(view.container.querySelector('[data-death-star]')!);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    view.rerender(<Wrapper>{panel(target({ id: 'p3', name: 'Ashfell' }))}</Wrapper>);
    expect(screen.queryByRole('dialog'), 'the question followed the commander to a new world').toBeNull();
  });

  /** The half of that fault that reopened by itself, which is the worse one. */
  it('does not reappear after a detour through an owned world', async () => {
    const Wrapper = harness();
    const view = render(<Wrapper>{panel(target())}</Wrapper>);
    await userEvent.click(view.container.querySelector('[data-death-star]')!);

    view.rerender(<Wrapper>{panel(target({ id: 'mine', isOwned: true, isSelf: true }))}</Wrapper>);
    expect(screen.queryByRole('dialog')).toBeNull();

    view.rerender(<Wrapper>{panel(target({ id: 'p4', name: 'Ashfell' }))}</Wrapper>);
    expect(screen.queryByRole('dialog'), 'the strike question opened itself').toBeNull();
  });

  /** The queue's confirmation is the same object, so it makes the same escape. */
  it('escapes from a build queue too', async () => {
    const Wrapper = harness();
    const view = render(
      <Wrapper>
        <QueueStrip label="Construction" orders={[order()]} now={NOW} onCancel={vi.fn()} />
      </Wrapper>,
    );
    await userEvent.click(view.container.querySelector('[data-cancel]')!);
    expect(view.container.contains(screen.getByRole('dialog'))).toBe(false);
  });
});

describe('the refusal fits the phone it is refused on', () => {
  /**
   * 350 x 812, and this one is arithmetic rather than taste.
   *
   * The footer is two controls: the refusal at `flex-1` and the commitment at
   * `flex-2`. On the target screen that is 350 − 24 (the footer's own padding)
   * − 8 (the gap) = 343px of row, so the refusal gets a third of it — about
   * 111px — and `px-3` takes 24 of those. Roughly 87px of text at `--text-body`
   * uppercase with `--tracking-label`, which is ten characters and no more.
   *
   * "İNŞAYA DEVAM" is twelve and wrapped to two lines in the first build of this
   * sheet — a two-line button beside a one-line button, on the surface whose
   * whole job is to be read before something is destroyed. `visual-design.md`
   * budgets every layout against this width; this is that budget, for this row.
   */
  const CEILING = 10;

  it.each(['tr', 'en'])('keeps every confirm refusal on one line (%s)', async (lang) => {
    await i18n.changeLanguage(lang);
    for (const key of ['planet.queue.confirm.back', 'focus.planet.strikeConfirm.back'] as const) {
      expect(i18n.t(key).length, `${lang}/${key}: "${i18n.t(key)}"`).toBeLessThanOrEqual(CEILING);
    }
    await i18n.changeLanguage('en');
  });

  /** The commitment gets twice the room, and still is not a paragraph. */
  it.each(['tr', 'en'])('keeps every confirm verb short enough to read (%s)', async (lang) => {
    await i18n.changeLanguage(lang);
    for (const key of ['planet.queue.confirm.commit', 'focus.planet.strikeConfirm.commit'] as const) {
      expect(i18n.t(key).length, `${lang}/${key}: "${i18n.t(key)}"`).toBeLessThanOrEqual(CEILING * 2);
    }
    await i18n.changeLanguage('en');
  });
});

describe('both confirmations are the same object', () => {
  /**
   * The owner's other report in the same message is that every surface in this
   * game looks like a different designer made it. Two confirmations introduced
   * on one day is the easiest possible place for that to happen again, so they
   * are one component and this is what says so.
   */
  it('is one component, used by both', () => {
    const queue = readFileSync('src/ui/QueueStrip.tsx', 'utf8');
    const focus = readFileSync('src/galaxy/FocusPanel.tsx', 'utf8');
    expect(queue).toContain('Confirm');
    expect(focus).toContain('Confirm');
  });
});
