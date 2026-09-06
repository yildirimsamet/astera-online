import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { MenuPanel } from '../src/shell/MenuPanel.js';
import { GUIDE_URL } from '../src/shell/guide.js';
import i18n from '../src/i18n/index.js';

/**
 * THE QUICK-START GUIDE, REACHABLE. Owner request, and deliberately the small
 * version of it.
 *
 * `public/hizli-baslangic-rehberi.html` is a finished standalone page that Vite
 * already copies into the build and Nginx already serves — so it has been
 * ADDRESSABLE all along and simply had no door. What was missing was one row.
 *
 * IT LEAVES THE GAME, AND IT SAYS SO. The row carries `ExternalIcon` and opens a
 * new tab rather than an in-game sheet: the page is its own document with its own
 * stylesheet, and wrapping it in an iframe would be pretending it is part of the
 * interface while it is still styled like a separate site. A player reading a
 * guide has not lost their place either — the game is still sitting in the tab
 * behind it, which is the behaviour a guide wants and a sheet cannot give.
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
  it('is a named row in the menu, not a glyph on its own', () => {
    show();

    expect(
      screen.getByRole('button', { name: new RegExp(i18n.t('menu.guideLabel'), 'i') }),
    ).toBeInTheDocument();
  });

  /*
    AND IT KEEPS ITS OPENER, which is the whole reason the guide's back control
    can be cheap. With `noopener` the new tab is not script-closable, so "back"
    could only NAVIGATE — reloading a 3D galaxy and 79MB of assets on a phone to
    return a player to a screen that was still sitting in the other tab. The page
    is our own static file on our own origin, so there is nothing an opener
    reference gives away here.
  */
  it('opens the guide in a tab that can close itself again', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const user = userEvent.setup();
    show();

    await user.click(
      screen.getByRole('button', { name: new RegExp(i18n.t('menu.guideLabel'), 'i') }),
    );

    expect(open).toHaveBeenCalledWith(GUIDE_URL, '_blank');
  });

  /*
    The one thing that would make this row a lie is the file not being there. It
    is a static asset rather than a route, so nothing in the type system connects
    the two — this is the connection.
  */
  it('points at a file that exists in public/', () => {
    const page = readFileSync(resolve(process.cwd(), `public${GUIDE_URL}`), 'utf8');
    expect(page).toContain('<html');
  });

  /*
    THE WAY BACK IS STICKY, and that is the point of it. Owner request. The guide
    is one long scroll, so a way back that lives at the top is a way back only
    for somebody who has not read anything — the reader who most wants to return
    is the one furthest down the page.

    It is an ANCHOR to `/` first and a tab-close second: a player who arrived
    from the menu gets their galaxy back untouched, and one who opened the link
    cold — shared to them, or a bookmark — still lands in the game rather than
    on a dead control.
  */
  it('carries a sticky way back into the game', () => {
    const page = readFileSync(resolve(process.cwd(), `public${GUIDE_URL}`), 'utf8');

    expect(page).toMatch(/<a[^>]+class="back"[^>]+href="\/"/);
    expect(page).toContain('position:sticky');
    expect(page).toContain('window.close()');
  });

  /*
    APPENDED. Rewards was the last standing row before this; if the guide ever
    moves above it, every commander who learned the menu has to read it again.
  */
  it('sits after the rows that were already there', () => {
    const view = show();
    const labels = [...view.container.querySelectorAll('button[aria-label]')]
      .map((node) => node.getAttribute('aria-label') ?? '');

    const rewards = labels.findIndex((label) => label.startsWith(i18n.t('menu.rewardsLabel')));
    const guide = labels.findIndex((label) => label.startsWith(i18n.t('menu.guideLabel')));

    expect(rewards).toBeGreaterThan(-1);
    expect(guide).toBeGreaterThan(rewards);
  });
});
