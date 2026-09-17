import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { MenuPanel } from '../src/shell/MenuPanel.js';
import { publisherUrl } from '../src/lib/publisherPages.js';
import i18n from '../src/i18n/index.js';
import { CONSENT_EVENT, CONSENT_STORAGE_KEY } from '../src/lib/consent.js';

/**
 * THE QUICK-START GUIDE, REACHABLE. Owner request, and deliberately the small
 * version of it.
 *
 * `public/hizli-baslangic-rehberi.html` is a finished standalone page that Vite
 * already copies into the build and Nginx already serves — so it has been
 * ADDRESSABLE all along and simply had no door. What was missing was one row.
 *
 * IT IS A LINK, AND IT STAYS IN THIS TAB. The page is its own document with its
 * own stylesheet, so an in-game sheet would be pretending it is part of the
 * interface while it still reads as a separate site — but a new tab was the wrong
 * answer too, and the owner said so. On a phone it leaves a tab behind on every
 * visit, and it costs the page the one control every reader already knows: the
 * browser's own back. So the row is an anchor, the guide replaces the game in
 * this tab, and stepping back restores it.
 *
 * APPENDED, NEVER INSERTED. A control that changes position between sessions has
 * to be re-found every time, so it goes after the last standing row and nothing
 * a commander already knows the position of moves.
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
  return { wrapper };
}

const show = () => {
  const { wrapper: Wrapper } = harness();
  return render(
    <Wrapper>
      <MenuPanel
        galaxy="Vantage"
        shard="EU-1"
        endsAt={null}
        onOpen={vi.fn()}
        onSignOut={vi.fn()}
      />
    </Wrapper>,
  );
};

beforeEach(async () => {
  if (i18n.resolvedLanguage !== 'en') await i18n.changeLanguage('en');
});

describe('the quick-start guide row', () => {
  it('opens reward-free Academy replay without signing out', () => {
    const { wrapper } = harness();
    const replay = vi.fn();
    const signOut = vi.fn();
    render(<MenuPanel galaxy="Vantage" shard="EU-1" endsAt={null} onOpen={vi.fn()} onSignOut={signOut} onReplayAcademy={replay} />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: /Replay Academy/i }));
    expect(replay).toHaveBeenCalledOnce();
    expect(signOut).not.toHaveBeenCalled();
  });
  it('is a named row in the menu, not a glyph on its own', () => {
    show();

    expect(
      screen.getByRole('link', { name: new RegExp(i18n.t('menu.guideLabel'), 'i') }),
    ).toBeInTheDocument();
  });

  /*
    A LINK, IN THIS TAB. Owner decision, reversing the new tab this shipped with.

    Two things follow from it and both are improvements. The row becomes an
    ANCHOR rather than a button, which is what it always was semantically — so a
    long-press or a middle-click can still choose a new tab, and the browser's
    own "back" now leads home without the page having to invent one. And a phone
    stops accumulating tabs it never asked for.

    The href is asserted rather than a click handler, because that IS the
    behaviour: nothing runs, the browser navigates.
  */
  it('is a link to the guide rather than a button that opens a window', () => {
    show();

    const row = screen.getByRole('link', {
      name: new RegExp(i18n.t('menu.guideLabel'), 'i'),
    });
    expect(row).toHaveAttribute('href', publisherUrl('guide', i18n.resolvedLanguage));
    expect(row).not.toHaveAttribute('target');
  });

  /*
    The one thing that would make this row a lie is the file not being there. It
    is a static asset rather than a route, so nothing in the type system connects
    the two — this is the connection.
  */
  it('points at a file that exists in public/', () => {
    const page = readFileSync(resolve(process.cwd(), `public${publisherUrl('guide', 'tr')}`), 'utf8');
    expect(page).toContain('<html');
  });

  it('explains the first-day shield and the action that spends it', () => {
    const page = readFileSync(resolve(process.cwd(), `public${publisherUrl('guide', 'tr')}`), 'utf8');
    expect(page).toMatch(/ilk 24 saat/i);
    expect(page).toMatch(/saldırı.*koruma.*sona erer/is);
  });

  /*
    THE WAY BACK IS STICKY, and that is the point of it. Owner request. The guide
    is one long scroll, so a way back that lives at the top is a way back only
    for somebody who has not read anything — the reader who most wants to return
    is the one furthest down the page.

    It steps BACK through history when the reader came from the game, so the
    browser restores the galaxy it already has rather than booting a fresh one,
    and falls through to its own `href="/"` for anyone who arrived cold — a
    shared link, a bookmark — who has no game behind them to step back to.
  */
  it('carries a sticky way back into the game', () => {
    const page = readFileSync(resolve(process.cwd(), `public${publisherUrl('guide', 'tr')}`), 'utf8');

    expect(page).toMatch(/<a[^>]+class="back"[^>]+href="\/"/);
    expect(page).toContain('position:sticky');
    /*
      THE HANDLER IS A FILE, NOT AN INLINE BLOCK, and that is a production fix
      rather than tidiness. The deployed `Content-Security-Policy` grants
      `script-src 'self'` and never `'unsafe-inline'`, so the inline version was
      refused by every browser that actually reached this page: the button worked
      and it worked by doing the plain navigation the handler exists to avoid.
    */
    expect(page).toContain('<script src="/guide-back.js"');
    expect(page).not.toMatch(/<script>/);
    const handler = readFileSync(resolve(process.cwd(), 'public/guide-back.js'), 'utf8');
    // Same tab means the game is one step back in this tab's own history —
    // and stepping back is what lets the browser restore it instead of
    // booting a fresh galaxy. The `href` covers a reader who arrived cold.
    expect(handler).toContain('history.back()');
    expect(handler).not.toContain('window.close()');
  });

  /*
    APPENDED. Rewards was the last standing row before this; if the guide ever
    moves above it, every commander who learned the menu has to read it again.
  */
  it('sits after the rows that were already there', () => {
    const view = show();
    const labels = [...view.container.querySelectorAll('[aria-label]')]
      .map((node) => node.getAttribute('aria-label') ?? '');

    const rewards = labels.findIndex((label) => label.startsWith(i18n.t('menu.rewardsLabel')));
    const guide = labels.findIndex((label) => label.startsWith(i18n.t('menu.guideLabel')));

    expect(rewards).toBeGreaterThan(-1);
    expect(guide).toBeGreaterThan(rewards);
  });
});

/**
 * THE PUBLISHER SET, IN THE READER'S OWN LANGUAGE.
 *
 * The legal pages exist twice — `privacy.html` is English, `gizlilik-politikasi.html`
 * is Turkish — because Google's reviewer reads one and the players read the
 * other. Handing either of them the wrong one is the same defect, so the link
 * resolves through `publisherUrl` rather than through a literal.
 */
describe('publisher links for a signed-in commander', () => {
  it('keeps the privacy, terms and contact pages reachable in English', () => {
    show();
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy.html');
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms.html');
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact.html');
  });

  it('shows the Turkish editions to a Turkish commander', async () => {
    await i18n.changeLanguage('tr');
    show();
    expect(screen.getByRole('link', { name: 'Gizlilik' })).toHaveAttribute('href', '/gizlilik-politikasi.html');
    expect(screen.getByRole('link', { name: 'Koşullar' })).toHaveAttribute('href', '/kullanim-kosullari.html');
    expect(screen.getByRole('link', { name: 'İletişim' })).toHaveAttribute('href', '/iletisim.html');
  });
});

/**
 * THE STANDING ROUTE BACK TO THE PRIVACY CHOICE.
 *
 * Consent that cannot be withdrawn is not consent, and the row has to say where
 * the player currently stands — otherwise finding out costs opening a dialog.
 */
describe('the privacy and cookie settings row', () => {
  const row = (): HTMLElement => screen.getByRole('button', { name: /Privacy & cookie settings/i });

  it('reports that nothing has been chosen yet', () => {
    show();

    expect(row().textContent).toContain('Not chosen yet');
  });

  it('reports a refusal in the row itself', () => {
    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ version: 1, decision: 'denied', at: '2026-09-01T00:00:00.000Z' }),
    );
    show();

    expect(row().textContent).toMatch(/Refused/i);
  });

  it('reopens the first-party notice when no certified CMP is present', () => {
    const heard = vi.fn();
    window.addEventListener(CONSENT_EVENT, heard);
    show();

    fireEvent.click(row());

    expect(heard).toHaveBeenCalledOnce();
    window.removeEventListener(CONSENT_EVENT, heard);
  });

  /**
   * In the EEA, the UK and Switzerland the answer lives inside Google's message
   * and only Google can reopen it. Showing ours on top would be a second notice
   * claiming to speak for a choice it does not hold.
   */
  it('hands the question back to Google where the certified message owns it', () => {
    const heard = vi.fn();
    const showRevocationMessage = vi.fn();
    (window as { __tcfapi?: unknown }).__tcfapi = () => undefined;
    (window as { googlefc?: unknown }).googlefc = { showRevocationMessage };
    window.addEventListener(CONSENT_EVENT, heard);
    show();

    fireEvent.click(row());

    expect(showRevocationMessage).toHaveBeenCalledOnce();
    expect(heard).not.toHaveBeenCalled();
    window.removeEventListener(CONSENT_EVENT, heard);
    delete (window as { __tcfapi?: unknown }).__tcfapi;
    delete (window as { googlefc?: unknown }).googlefc;
  });
});

it('opens the return application from the menu only for Silent Space', () => {
  const { wrapper } = harness();
  const onOpen = vi.fn();
  const view = render(<MenuPanel galaxy="Silent Space" shard="WAIT-1" endsAt={null} onOpen={onOpen} onSignOut={vi.fn()} />, { wrapper });
  expect(screen.queryByRole('button', { name: /Return application/i })).toBeNull();
  view.rerender(<MenuPanel galaxy="Silent Space" shard="WAIT-1" endsAt={null} inSilentSpace onOpen={onOpen} onSignOut={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Return application/i }));
  expect(onOpen).toHaveBeenCalledWith('return');
});

/**
 * THE SUPPORT ROW IS OPEN, AND IT IS MEANT TO BE FOUND. Owner instruction:
 * *"Menüdeki destek butonunu aç, tasarımını birazcık daha göze görünür yap. Çok
 * fazla göze batmasın ama biriside göremedim demesin."*
 *
 * It shipped commented out behind a `TODO`, so the one surface in the game that
 * asks for anything could not be reached at all. Opening it is half the
 * instruction; the other half is that it must not sit in the list as the seventh
 * identical grey row — hence `attention`, which is this menu's OWN existing
 * accent (the announcements row wears it) rather than a new badge or a louder
 * colour. A tinted glyph is the compact answer: no second line, no shouting.
 */
/*
  PARKED WITH THE ROW ITSELF. The support row is commented out in `MenuPanel.tsx`
  behind *"TODO: for now its closed. Ödeme linkleri eklenince açılacak."* — the
  owner's decision to hold it until the Shopier addresses exist, so that the door
  and what is behind it open together.

  SKIPPED RATHER THAN DELETED, because the contract it states is the one that will
  be wanted the moment the row comes back: reachable, opens the donate sheet, and
  wearing this menu's own `attention` accent so it is findable without shouting.
  Uncomment the row and drop the `.skip`.
*/
describe.skip('the support row', () => {
  it('is reachable and opens the donate sheet', () => {
    const { wrapper } = harness();
    const open = vi.fn();
    render(<MenuPanel galaxy="Vantage" shard="EU-1" endsAt={null} onOpen={open} onSignOut={vi.fn()} />, { wrapper });

    const row = screen.getByRole('button', {
      name: new RegExp(i18n.t('community.donate.menuLabel'), 'i'),
    });
    fireEvent.click(row);
    expect(open).toHaveBeenCalledWith('donate');
  });

  /*
    Asserted on the accent the menu already owns, so "a little more visible" is a
    property of the row rather than a colour someone has to eyeball.
  */
  it('wears the menu accent so it is not the seventh identical grey row', () => {
    show();

    const row = screen.getByRole('button', {
      name: new RegExp(i18n.t('community.donate.menuLabel'), 'i'),
    });
    expect(row.querySelector('[data-attention]')).not.toBeNull();
  });
});
