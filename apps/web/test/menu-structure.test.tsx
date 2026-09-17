import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { MenuPanel } from '../src/shell/MenuPanel.js';
import { returnsToMenu } from '../src/shell/panelRoute.js';
import { Sheet } from '../src/ui/kit/index.js';
import { keys } from '../src/api/keys.js';
import i18n from '../src/i18n/index.js';
import { planetView } from './fixtures.js';

/**
 * THE MENU IS A MAP, NOT A PILE OF BUTTONS. Owner report.
 *
 * *"bir gruplama yok, bir hiyeraşi yok, hangi buton nerede nasıl gösterilmeli gibi
 * bir önem sıralaması yok. Butonlar yatay şekilde uzayıp gereksiz yer kaplıyor.
 * Yanlış bir buton'a tıklayınca geri dönme yok direk kapatılıyor."*
 *
 * Four separate failures, and each one has its own test below.
 *
 *   · NO GROUPING — nine destinations in one undifferentiated column. A reader
 *     cannot tell that the leaderboard and the sound slider are different KINDS of
 *     thing, so they read all nine every time.
 *   · NO RANK — a season shortcut, a bug report and a resolution dial were drawn
 *     with the same weight, so nothing on the sheet said what mattered.
 *   · FULL-WIDTH SLABS — a 350px row spending three hundred of them on the gap
 *     between a glyph and a chevron, nine times over, is most of a phone screen.
 *   · NO WAY BACK — every row REPLACED the menu, so the cost of a mistaken tap was
 *     the header control plus finding your place in the list again.
 *
 * The shape that answers them: three visual ranks — a full-width row is something
 * that needs you NOW, a chip is a shortcut you made yourself, a tile is a place to
 * go — destinations in named groups two to a row, and a way back on every surface
 * the menu opens.
 */

function harness() {
  const fetch = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ servers: [], placement: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
  const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queries}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
  return { wrapper, queries };
}

type MenuProps = Parameters<typeof MenuPanel>[0];

const show = (props: Partial<MenuProps> = {}) => {
  const { wrapper: Wrapper } = harness();
  return render(
    <Wrapper>
      <MenuPanel
        galaxy="Vantage"
        shard="EU-1"
        endsAt={new Date(Date.now() + 3_600_000)}
        onOpen={vi.fn()}
        onSignOut={vi.fn()}
        {...props}
      />
    </Wrapper>,
  );
};

/** A destination's accessible name: what it is, then what is behind it. */
const named = (label: string, hint: string): string => `${label}. ${hint}`;

const follows = (first: Element | null | undefined, second: Element | null): boolean => {
  if (!first || !second) return false;
  return (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
};

beforeEach(async () => {
  if (i18n.resolvedLanguage !== 'en') await i18n.changeLanguage('en');
});

describe('the menu groups what it offers', () => {
  /**
   * A HEADING PER GROUP, AND THE ORDER IS THE RANKING.
   *
   * The season first, because it is what a commander came to check; the team
   * second, because it carries the only unread counts on the sheet; help third;
   * the device and the account last, which is where the one irreversible control
   * belongs.
   */
  it('names each group, in the order a commander reads them', () => {
    const view = show();

    const headings = [...view.container.querySelectorAll('h2')].map((node) => node.textContent);
    expect(headings).toEqual([
      i18n.t('menu.seasonHeading'),
      i18n.t('menu.asteraHeading'),
      i18n.t('menu.helpHeading'),
      i18n.t('menu.deviceHeading'),
      i18n.t('menu.accountHeading'),
    ]);
  });

  /**
   * TWO TO A ROW. The whole of the "uzayıp gereksiz yer kaplıyor" complaint: a
   * destination does not need 350 pixels to say LEADERBOARD, and nine of them
   * stacked is a scroll the sheet cannot afford.
   */
  it('lays its destinations out two to a row instead of one slab each', () => {
    const view = show();

    const grids = [...view.container.querySelectorAll('[data-menu-grid]')];
    expect(grids.length).toBeGreaterThan(0);
    for (const grid of grids) expect(grid).toHaveClass('grid-cols-2');
    expect(view.container.querySelectorAll('[data-menu-tile]').length).toBeGreaterThanOrEqual(5);
  });

  /**
   * RANK ONE: A FULL-WIDTH ROW MEANS ACT NOW. Both of these exist only while
   * something is genuinely waiting on the commander — a season that ended, a
   * placement that has to be applied for — so the sheet's widest, loudest shape is
   * spent on them and on nothing else.
   */
  it('puts what needs the commander now above every group, at full width', () => {
    const view = show({ inSilentSpace: true, hasSeasonResult: true });

    const rows = [...view.container.querySelectorAll('[data-menu-row]')];
    expect(rows).toHaveLength(2);
    expect(follows(rows[0], view.container.querySelector('[data-menu-group]'))).toBe(true);
  });

  it('draws no urgent row when nothing is urgent', () => {
    const view = show();
    expect(view.container.querySelectorAll('[data-menu-row]')).toHaveLength(0);
  });

  /**
   * RANK TWO: A MARK IS A CHIP. Five marks used to be five full-width rows — some
   * 240px of a phone spent on bookmarks — and a bookmark is the one thing on this
   * sheet whose entire content is a colour and a name.
   */
  it('folds the rival marks into one wrapping row of chips', () => {
    const onFocusRival = vi.fn();
    const view = show({
      rivals: [
        { planetId: 'orrery-8', slot: 0, owner: 'Sable', name: 'Orrery-8', lost: false },
        { planetId: 'kiln-2', slot: 1, owner: 'Ward', name: 'Kiln-2', lost: false },
      ],
      onFocusRival,
    });

    const strip = view.container.querySelector('[data-rival-chips]');
    expect(strip).not.toBeNull();
    expect(strip).toHaveClass('flex-wrap');
    expect(strip?.querySelectorAll('[data-rival-chip]')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /rival · sable/i }));
    expect(onFocusRival).toHaveBeenCalledWith('orrery-8');
  });

  it('keeps a lost mark clearable on its own, still as a chip', () => {
    const onClearRival = vi.fn();
    const view = show({
      rivals: [
        { planetId: 'orrery-8', slot: 0, owner: '', name: '', lost: true },
        { planetId: 'kiln-2', slot: 1, owner: 'Ward', name: 'Kiln-2', lost: false },
      ],
      onClearRival,
      onFocusRival: vi.fn(),
    });

    expect(view.container.querySelectorAll('[data-rival-chip]')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /rival signal lost/i }));
    expect(onClearRival).toHaveBeenCalledWith('orrery-8');
  });

  it('shows no mark group at all when nothing is marked', () => {
    const view = show();
    expect(view.container.querySelector('[data-rival-chips]')).toBeNull();
  });

  /** Nothing was dropped on the way to a tighter shape. */
  it('keeps every destination one tap away and named', () => {
    const onOpen = vi.fn();
    show({ onOpen, isAdmin: true, onReplayAcademy: vi.fn() });

    const destinations = [
      [named(i18n.t('menu.leaderboardLabel'), i18n.t('menu.leaderboardHint')), 'leaderboard'],
      [named(i18n.t('menu.rewardsLabel'), i18n.t('menu.rewardsHint')), 'rewards'],
      [named(i18n.t('menu.announcementsLabel'), i18n.t('menu.announcementsHint')), 'announcements'],
      [named(i18n.t('menu.feedbackLabel'), i18n.t('menu.feedbackHint')), 'feedback'],
      [named(i18n.t('community.admin.menuLabel'), i18n.t('community.admin.menuHint')), 'admin'],
    ] as const;

    for (const [name, panel] of destinations) {
      fireEvent.click(screen.getByRole('button', { name }));
      expect(onOpen, name).toHaveBeenCalledWith(panel);
    }
    expect(
      screen.getByRole('link', { name: named(i18n.t('menu.guideLabel'), i18n.t('menu.guideHint')) }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: named(i18n.t('academy.replay'), i18n.t('academy.replayHint')) }),
    ).toBeInTheDocument();
  });

  /**
   * RANK FOUR: A PREFERENCE IS A LINE, NOT A CARD. Three stacked cards with their
   * own glyphs, names and explanatory sentences were the tallest block on the
   * sheet and the least often touched thing in the game.
   *
   * They also sat under a heading reading "Language", which is the grouping
   * failure in miniature: a section named after one of the three things in it.
   */
  /**
   * FOUR NOW, AND THE FOURTH BELONGS HERE.
   *
   * The privacy answer is stored per DEVICE, exactly like the language, the
   * sound and the resolution — so it is a fourth line in this plate rather than
   * a fifth section heading on a sheet that is already long. Consent that cannot
   * be withdrawn is not consent, and this row is the standing route back to it.
   */
  it('gathers the device settings into one plate, a line each', () => {
    const view = show();

    const plate = view.container.querySelector('[data-device-settings]');
    expect(plate).not.toBeNull();
    expect(plate?.querySelectorAll('[data-setting-row]')).toHaveLength(4);

    // Every control that was there before is still there, and still live.
    expect(screen.getByRole('group', { name: i18n.t('settings.choose') })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: i18n.t('menu.volumeLabel') })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: i18n.t('menu.qualityLabel') })).toBeInTheDocument();
    expect(plate?.querySelector('[data-consent-settings]')).not.toBeNull();
  });

  /** The way out stays last, and stays alone. */
  it('keeps sign-out at the foot of the sheet', () => {
    const onSignOut = vi.fn();
    const view = show({ onSignOut });

    const out = screen.getByRole('button', { name: i18n.t('galaxy.commander.signOut') });
    fireEvent.click(out);
    expect(onSignOut).toHaveBeenCalledOnce();

    const tiles = [...view.container.querySelectorAll('[data-menu-tile]')];
    expect(follows(tiles.at(-1), out)).toBe(true);
  });
});

/**
 * A WRONG TAP IS RECOVERABLE. The fourth complaint, and the only one that is about
 * behaviour rather than shape.
 *
 * Every menu row REPLACED the menu with what it opened, so closing that surface
 * dropped the reader onto the galaxy. The cost of one mis-tap was the header
 * control plus finding your place in the list again — which on a phone is exactly
 * the moment a player stops exploring a menu at all.
 */
describe('every surface the menu opens can step back to it', () => {
  it('names the six destinations the menu owns', () => {
    for (const panel of [
      'leaderboard', 'rewards', 'announcements', 'feedback', 'donate', 'admin',
    ] as const) {
      expect(returnsToMenu(panel), panel).toBe(true);
    }
  });

  /**
   * AND NOTHING ELSE. The planet sheet, Intel and the clan are opened from the
   * disc; the recap and the Silent Space notice open THEMSELVES when a season ends
   * or a placement lands. A back arrow on any of those would point at a sheet the
   * reader never came from.
   */
  it('leaves every surface the menu did not open alone', () => {
    for (const panel of [
      'planet', 'research', 'intel', 'report', 'clan', 'chat', 'chronicle',
      'recap', 'return', 'menu', null,
    ] as const) {
      expect(returnsToMenu(panel), String(panel)).toBe(false);
    }
  });

  it('draws a way back beside the way out, and it does not close the sheet', () => {
    const onClose = vi.fn();
    const onBack = vi.fn();
    render(<Sheet title="Rewards" onBack={onBack} onClose={onClose}>Body</Sheet>);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('sheet.back') }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();

    // The deliberate way out is untouched by it.
    fireEvent.click(screen.getByRole('button', { name: i18n.t('sheet.close') }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('draws no way back on a sheet that was not opened from anywhere', () => {
    render(<Sheet title="Your planet" onClose={vi.fn()}>Body</Sheet>);
    expect(screen.queryByRole('button', { name: i18n.t('sheet.back') })).toBeNull();
  });
});

/**
 * THE CONTROL THAT OPENS IT MUST DESCRIBE IT. D54, arriving through the door the
 * regrouping opened.
 *
 * Both of these were found auditing the rebuilt sheet against the header control
 * at `StatusBar.tsx`, and both are the same defect: the hamburger promising
 * something the sheet behind it cannot deliver. A control that names a surface it
 * cannot reach is exactly the bug D54 was written about — it just wore an
 * accessible name and an amber dot here instead of a face.
 */
describe('the header control promises only what the menu holds', () => {
  /*
    IT SAID "INTEL", and Intel has been a mark on the disc since the disc took the
    three verbs. So the one permanent, always-on-screen description of this menu
    named a surface that is not in it and omitted two groups that are.
  */
  it('names the groups that are in the sheet, and not the ones on the disc', () => {
    for (const language of ['en', 'tr'] as const) {
      const hint = i18n.t('statusBar.menuHint', { name: 'Vantage', lng: language });
      expect(hint, language).toContain('Vantage');
      for (const absent of [/intel/i, /istihbarat/i, /research/i, /araştırma/i, /\bclan\b/i, /klan/i]) {
        expect(hint, `${language} still promises ${String(absent)}`).not.toMatch(absent);
      }
    }
    expect(i18n.t('statusBar.menuHint', { name: 'Vantage', lng: 'en' }))
      .toMatch(/leaderboard.*rewards.*announcements.*help.*account/i);
    expect(i18n.t('statusBar.menuHint', { name: 'Vantage', lng: 'tr' }))
      .toMatch(/liderlik.*ödüller.*duyurular.*yardım.*hesap/i);
  });

  /**
   * AND THE DOT COUNTED THE CLAN. `DiscControls` already lights the clan mark from
   * the same `attentionCount`, so an invite lit the hamburger too — the player
   * opened the sheet, found nothing new in it, and the dot was still there next
   * time. A badge may only promise what the surface it sits on can show, and two
   * things competing for one alarm is how a player learns to ignore both.
   */
  it('does not light for a clan event the sheet cannot show', async () => {
    const { StatusBar } = await import('../src/shell/StatusBar.js');
    const { ToastProvider } = await import('../src/ui/Toast.js');
    const { wrapper: Wrapper, queries } = harness();

    queries.setQueryData(keys.planet, planetView());
    // Three clan updates waiting, and no reward. The clan lives on the disc.
    queries.setQueryData(keys.clanBadge, {
      available: true, attentionCount: 3, clanChatUnread: 0,
    });

    const view = render(
      <Wrapper>
        <ToastProvider>
          <StatusBar commander="Vantage" onOpen={vi.fn()} onFocusPlanet={vi.fn()} />
        </ToastProvider>
      </Wrapper>,
    );

    const control = screen.getByRole('button', { name: /commander vantage/i });
    expect(control.querySelector('.bg-opportunity')).toBeNull();
    expect(view.container.textContent).not.toMatch(/clan updates waiting/i);
  });
});
