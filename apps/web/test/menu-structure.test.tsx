import type { ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { MenuPanel, type MenuPage } from '../src/shell/MenuPanel.js';
import { returnsToMenu } from '../src/shell/panelRoute.js';
import { Sheet } from '../src/ui/kit/index.js';
import { keys } from '../src/api/keys.js';
import i18n from '../src/i18n/index.js';
import { planetView } from './fixtures.js';

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

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(() => { vi.restoreAllMocks(); });

const enter = (page: Exclude<MenuPage, 'home'>) => fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${i18n.t(`menu.navigation.${page}`)}\\.`) }));
const back = () => fireEvent.click(screen.getByRole('button', { name: i18n.t('menu.navigation.back') }));

describe('the compact commander menu', () => {
  it('starts with four categories and keeps detailed controls behind their category', () => {
    show();
    for (const page of ['season', 'academy', 'community', 'settings'] as const) {
      expect(screen.getByRole('button', { name: new RegExp(`^${i18n.t(`menu.navigation.${page}`)}\\.`) })).toBeVisible();
    }
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('button', { name: /Sign out/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Feedback\./ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Vacation/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Rewards\./ })).toBeNull();
  });

  it('opens support directly above settings and keeps it out of the community submenu', () => {
    const onOpen = vi.fn();
    show({ onOpen });
    const support = screen.getByRole('button', { name: named(i18n.t('community.donate.menuLabel'), i18n.t('community.donate.menuHint')) });
    const settings = screen.getByRole('button', { name: new RegExp(`^${i18n.t('menu.navigation.settings')}\\.`) });
    expect(support.parentElement).toBe(settings.parentElement);
    expect(support.nextElementSibling).toBe(settings);
    fireEvent.click(support);
    expect(onOpen).toHaveBeenCalledWith('donate');
    enter('community');
    expect(screen.queryByRole('button', { name: named(i18n.t('community.donate.menuLabel'), i18n.t('community.donate.menuHint')) })).toBeNull();
  });

  it('opens a category, announces its heading and returns focus to its entry', () => {
    show();
    enter('settings');
    expect(screen.getByRole('heading', { name: i18n.t('menu.navigation.settings') })).toHaveFocus();
    expect(screen.getByRole('slider', { name: i18n.t('menu.volumeLabel') })).toBeVisible();
    expect(screen.queryByRole('button', { name: /^Feedback\./ })).toBeNull();
    back();
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.getByRole('button', { name: new RegExp(`^${i18n.t('menu.navigation.settings')}\\.`) })).toHaveFocus();
  });

  it('keeps every existing destination reachable through the right category', () => {
    const onOpen = vi.fn(), replay = vi.fn();
    show({ onOpen, onReplayAcademy: replay, isAdmin: true });
    for (const [label, panel] of [['skinsShop', 'skin-shop'], ['skinsInventory', 'skin-inventory']] as const) {
      fireEvent.click(screen.getByRole('button', { name: named(i18n.t(`menu.${label}Label`), i18n.t(`menu.${label}Hint`)) }));
      expect(onOpen).toHaveBeenCalledWith(panel);
    }
    enter('season');
    for (const [label, panel] of [['leaderboard', 'leaderboard'], ['rewards', 'rewards']] as const) {
      fireEvent.click(screen.getByRole('button', { name: named(i18n.t(`menu.${label}Label`), i18n.t(`menu.${label}Hint`)) }));
      expect(onOpen).toHaveBeenCalledWith(panel);
    }
    back(); enter('community');
    for (const [name, panel] of [[named(i18n.t('menu.announcementsLabel'), i18n.t('menu.announcementsHint')), 'announcements'], [named(i18n.t('menu.feedbackLabel'), i18n.t('menu.feedbackHint')), 'feedback'], [named(i18n.t('community.admin.menuLabel'), i18n.t('community.admin.menuHint')), 'admin']] as const) {
      fireEvent.click(screen.getByRole('button', { name }));
      expect(onOpen).toHaveBeenCalledWith(panel);
    }
    back(); enter('academy');
    fireEvent.click(screen.getByRole('button', { name: named(i18n.t('menu.guideLabel'), i18n.t('menu.guideHint')) }));
    expect(onOpen).toHaveBeenCalledWith('wiki');
    fireEvent.click(screen.getByRole('button', { name: named(i18n.t('academy.replay'), i18n.t('academy.replayHint')) }));
    expect(replay).toHaveBeenCalledOnce();
  });

  it('surfaces waiting rewards and unread announcements without opening categories', () => {
    const { wrapper, queries } = harness();
    queries.setQueryData(keys.rewards, { chains: [], claimable: 3 });
    queries.setQueryData(keys.announcements, { announcements: [{ seen: false }, { seen: true }] });
    const onOpen = vi.fn();
    render(<MenuPanel galaxy="Vantage" shard="EU-1" endsAt={null} onOpen={onOpen} onSignOut={vi.fn()} />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: named(i18n.t('menu.navigation.rewardsReady', { count: 3 }), i18n.t('menu.rewardsHint')) }));
    expect(onOpen).toHaveBeenCalledWith('rewards');
    expect(screen.getByRole('button', { name: new RegExp(`^${i18n.t('menu.navigation.community')}\\.`) })).toHaveTextContent(i18n.t('menu.announcementsWaiting', { count: 1 }));
  });

  it('puts season results and placement first, and creates no urgency for vacation', () => {
    const view = show({ inSilentSpace: true, hasSeasonResult: true });
    const rows = view.container.querySelectorAll('[data-menu-row]');
    expect(rows).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${i18n.t('silentSpace.menu')}\\.`) }));
    expect(screen.queryByRole('button', { name: /^Vacation/ })).toBeNull();
  });

  it('keeps identity, galaxy and season context at the top; account operations inside the profile', () => {
    const view = show({ commander: 'Orion' });
    expect(view.container.querySelector('[data-menu-identity]')).toHaveTextContent('Orion');
    expect(view.container.querySelector('[data-menu-context]')).toHaveTextContent('Vantage');
    expect(view.container.querySelector('[data-menu-context]')).toHaveTextContent('EU-1');
    expect(screen.getByRole('link', { name: new RegExp(`^${i18n.t('menu.navigation.account')}\\.`) })).toHaveAttribute('href', '/profile');
  });

  it('retains independent rival focus and lost-mark removal without adding rows', () => {
    const onFocusRival = vi.fn(), onClearRival = vi.fn();
    const view = show({ rivals: [{ planetId: 'a', slot: 0, owner: 'Sable', name: 'A', lost: false }, { planetId: 'b', slot: 1, owner: '', name: '', lost: true }], onFocusRival, onClearRival });
    expect(view.container.querySelectorAll('[data-rival-chip]')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /rival · sable/i }));
    expect(onFocusRival).toHaveBeenCalledWith('a');
    fireEvent.click(screen.getByRole('button', { name: /rival signal lost/i }));
    expect(onClearRival).toHaveBeenCalledWith('b');
  });

  it.each(['android', 'ios'])('keeps web-only controls absent and account/inventory accessible on %s', platform => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue(platform);
    const onOpen = vi.fn();
    show({ onOpen });
    expect(screen.queryByRole('button', { name: named(i18n.t('community.donate.menuLabel'), i18n.t('community.donate.menuHint')) })).toBeNull();
    expect(screen.queryByRole('button', { name: named(i18n.t('menu.skinsShopLabel'), i18n.t('menu.skinsShopHint')) })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: named(i18n.t('menu.skinsInventoryLabel'), i18n.t('menu.skinsInventoryHint')) }));
    expect(onOpen).toHaveBeenCalledWith('skin-inventory');
    enter('community');
    expect(screen.queryByRole('button', { name: new RegExp(`^${i18n.t('community.donate.menuLabel')}\\.`) })).toBeNull();
    back(); enter('settings');
    expect(screen.queryByRole('button', { name: i18n.t('consent.menuLabel') })).toBeNull();
    back();
    expect(screen.getByRole('link', { name: new RegExp(`^${i18n.t('menu.navigation.account')}\\.`) })).toHaveAttribute('href', '/profile');
  });

  it('exposes Notification Center in app settings with its unfunded warning on the parent', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
    const { wrapper, queries } = harness();
    const prices = { T3: 20, T5: 30, T15: 60, RADAR: 100 };
    queries.setQueryData(keys.notificationCenter, { built: true, wallet: 10, timing: 'T5', muted: [], buildCost: { alloy: 1, crystal: 1, deuterium: 0 }, deuteriumPerHour: 0, prices: { incoming_attack: prices, incoming_strategic: prices, probe_detected: 20 }, unfunded: 0, recent: [] });
    render(<MenuPanel galaxy="Vantage" shard="EU-1" endsAt={null} onOpen={vi.fn()} onSignOut={vi.fn()} />, { wrapper });
    expect(screen.getByRole('button', { name: new RegExp(`^${i18n.t('menu.navigation.settings')}\\.`) })).toHaveTextContent(i18n.t('notificationCenter.menuEmpty'));
    enter('settings');
    fireEvent.click(screen.getByRole('button', { name: named(i18n.t('notificationCenter.title'), i18n.t('notificationCenter.menuHint')) }));
    expect(await screen.findByRole('dialog', { name: i18n.t('notificationCenter.title') })).toBeInTheDocument();
  });

  it('shows no trace of the Notification Center on the web', () => {
    const view = show();
    expect(view.container).not.toHaveTextContent(i18n.t('notificationCenter.menuEmpty'));
    enter('settings');
    expect(screen.queryByRole('button', { name: new RegExp(`^${i18n.t('notificationCenter.title')}`) })).toBeNull();
    expect(view.container).not.toHaveTextContent(i18n.t('notificationCenter.title'));
  });

  it('respects a restored category when returning from a destination', () => {
    const onOpen = vi.fn();
    show({ page: 'community', onOpen });
    expect(screen.getByRole('heading', { name: i18n.t('menu.navigation.community') })).toHaveFocus();
    expect(screen.getByRole('button', { name: /^Feedback\./ })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /^Feedback\./ }));
    expect(onOpen).toHaveBeenCalledWith('feedback');
    expect(screen.queryByRole('slider')).toBeNull();
  });
});

describe('every surface the menu opens can step back to it', () => {
  it('names the destinations the menu owns', () => {
    for (const panel of [
      'skin-shop', 'skin-inventory', 'leaderboard', 'rewards', 'announcements', 'feedback', 'donate', 'admin', 'wiki',
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

describe('claimable rewards in the galaxy header', () => {
  it('opens rewards directly while a claim is ready and disappears after it is claimed', async () => {
    const { StatusBar } = await import('../src/shell/StatusBar.js');
    const { ToastProvider } = await import('../src/ui/Toast.js');
    const { wrapper: Wrapper, queries } = harness();
    const onOpen = vi.fn();

    queries.setQueryData(keys.planet, planetView());
    queries.setQueryData(keys.rewards, { chains: [], claimable: 0 });
    render(
      <Wrapper>
        <ToastProvider>
          <StatusBar commander="Vantage" onOpen={onOpen} onFocusPlanet={vi.fn()} />
        </ToastProvider>
      </Wrapper>,
    );

    expect(screen.queryByTestId('claimable-rewards')).toBeNull();
    queries.setQueryData(keys.rewards, { chains: [], claimable: 2 });
    const gift = await screen.findByTestId('claimable-rewards', {}, { timeout: 5_000 });
    expect(gift).toHaveAccessibleName(/rewards.*2 ready to claim/i);
    expect(gift.querySelector('[data-gift-swing]')).toBeInTheDocument();
    fireEvent.click(gift);
    expect(onOpen).toHaveBeenCalledWith('rewards');

    queries.setQueryData(keys.rewards, { chains: [], claimable: 0 });
    await waitFor(() => { expect(screen.queryByTestId('claimable-rewards')).toBeNull(); });
  });
});

/** Owner 2026-10-28: the menu draws no Yarık door; the hangar is the one way in (F2). */
describe('the commander menu and the Yarık', () => {
  it('draws no arena invitation, even when a caller still hands one over', () => {
    const onEnterArena = vi.fn();
    // @ts-expect-error the menu no longer takes an arena entry
    show({ onEnterArena });
    expect(document.querySelector('[data-menu-arena]')).toBeNull();
    expect(onEnterArena).not.toHaveBeenCalled();
  });
});
