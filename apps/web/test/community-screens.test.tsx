import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import i18n from '../src/i18n/index.js';
import AdminPanel from '../src/screens/AdminPanel.js';
import { AnnouncementsScreen } from '../src/screens/AnnouncementsScreen.js';
import { DonateScreen } from '../src/screens/DonateScreen.js';
import { FeedbackScreen } from '../src/screens/FeedbackScreen.js';

const publishedAt = new Date('2026-08-30T12:00:00.000Z');

function setup() {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
  return { api, client, Wrapper };
}

/*
  `userEvent.setup()` installs an async clipboard on `navigator` and leaves it
  there for the rest of the file. One test in here has to run WITHOUT one — that
  is the whole point of it — so the stubs are cleared between tests rather than
  inherited by whichever test happens to run next.
*/
afterEach(async () => {
  await i18n.changeLanguage('en');
  Reflect.deleteProperty(navigator, 'clipboard');
  Reflect.deleteProperty(document, 'execCommand');
});

describe('community surfaces', () => {
  it('renders rich announcements and marks only unseen rows as read', async () => {
    const { api, client, Wrapper } = setup();
    const page = {
      announcements: [{
        id: '9f17dddc-7e43-4ba5-99b0-41c93df7c890',
        title: 'Orbit update',
        bodyHtml: '<p>New <strong>flight controls</strong>.</p>',
        publishedAt,
        seen: false,
      }],
    };
    client.setQueryData(keys.announcements, page);
    vi.spyOn(api, 'announcements').mockResolvedValue({
      announcements: page.announcements.map((announcement) => ({ ...announcement, seen: true })),
    });
    const mark = vi.spyOn(api, 'markAnnouncementsRead').mockResolvedValue({ marked: 1 });
    render(<Wrapper><AnnouncementsScreen /></Wrapper>);

    expect(screen.getByRole('heading', { name: 'Orbit update' })).toBeInTheDocument();
    expect(screen.getByText('flight controls').tagName).toBe('STRONG');
    await waitFor(() => {
      expect(mark).toHaveBeenCalledWith(['9f17dddc-7e43-4ba5-99b0-41c93df7c890']);
    });
  });

  it('sends the selected feedback kind as plain text and clears the form', async () => {
    const { api, Wrapper } = setup();
    const send = vi.spyOn(api, 'sendFeedback').mockResolvedValue({
      feedback: { id: '4ec4b146-7870-4766-8583-1ad4f7993168', createdAt: publishedAt },
    });
    render(<Wrapper><FeedbackScreen /></Wrapper>);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Idea' }));
    const message = screen.getByRole('textbox', { name: 'Your message' });
    await user.type(message, '<script>literal player report</script>');
    await user.click(screen.getByRole('button', { name: 'Send feedback' }));

    await waitFor(() => {
      expect(send).toHaveBeenCalledWith('SUGGESTION', '<script>literal player report</script>');
    });
    expect(message).toHaveValue('');
    expect(screen.getByText(/Received/)).toBeInTheDocument();
  });

  it('shows one WYSIWYG composer with simultaneous mobile and desktop previews', () => {
    const { Wrapper } = setup();
    render(<Wrapper><AdminPanel /></Wrapper>);
    expect(screen.getByRole('toolbar', { name: 'Announcement formatting' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Content' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Announcement' })).toHaveAttribute(
      'aria-controls', 'admin-compose-panel',
    );
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby', 'admin-compose-tab',
    );
    expect(screen.getByText('Mobile · 360 px')).toBeInTheDocument();
    expect(screen.getByText('Desktop · 720 px')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'YouTube' })).toBeInTheDocument();
  });

  /**
   * THE ASK IS THE SCREEN.
   *
   * A donate sheet that shows only a wallet address is a payment form; what makes
   * this one answerable is the four lines of prose around it — who pays for the
   * game today, what it costs, what a contribution changes, and the line that says
   * a player who gives nothing is still welcome. If a rewrite ever drops one of
   * those, the surface has quietly become a checkout and this fails.
   *
   * The wallet strings are asserted CHARACTER FOR CHARACTER on purpose. A truncated
   * or re-typed address is money sent into nothing, and it is the one bug on this
   * screen that no player could report.
   */
  it('states the case in prose, hands over both wallets verbatim and holds the card amounts', async () => {
    // `userEvent.setup()` installs its own clipboard, so the assertion below reads
    // what a player's clipboard would actually hold rather than what a spy saw.
    const user = userEvent.setup();
    render(<DonateScreen />);

    expect(screen.getByText(/no investment and no income/i)).toBeInTheDocument();
    expect(screen.getByText(/out of my own pocket/i)).toBeInTheDocument();
    expect(screen.getByText(/even a small contribution/i)).toBeInTheDocument();
    expect(screen.getByText(/server and development costs/i)).toBeInTheDocument();
    expect(screen.getByText(/telling a friend/i)).toBeInTheDocument();

    expect(screen.getByText('TPDV6p6QctXvL7nwiW7AMkPzqNqkrG2kGS')).toBeInTheDocument();
    expect(screen.getByText('3z84BrV8nzzbZkGuDmWczjn6vd6Z1tKis9PHimZSae9J')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Copy USDT · TRC-20 address' }));
    expect(await navigator.clipboard.readText()).toBe('TPDV6p6QctXvL7nwiW7AMkPzqNqkrG2kGS');
    expect(await screen.findByRole('button', { name: 'USDT · TRC-20 address copied' }))
      .toBeInTheDocument();

    // The İyzico link does not exist yet, so every amount is a stated intention
    // rather than a control that silently does nothing when pressed.
    for (const amount of ['$1', '$5', '$10', '$20']) {
      expect(screen.getByRole('button', { name: amount })).toBeDisabled();
    }
  });

  /**
   * THE CLIPBOARD IS THE CONVENIENCE, NOT THE PATH. Owner instruction.
   *
   * `navigator.clipboard` needs a secure context and a permission, and an in-app
   * webview can refuse it outright — so the address has to be readable and
   * selectable by hand whatever the button does. Selection is off game-wide in
   * `styles.css` (a drag on the disc must not paint a planet name blue), which is
   * exactly why `.selectable` here is a contract rather than styling, and why
   * `truncate` must never come back: a tail a player cannot see is an address they
   * cannot check.
   *
   * A refused clipboard must also never report success. "Copied" over an empty
   * clipboard is the failure mode that loses the donation silently.
   */
  /**
   * THE PRESS HAS TO ANSWER, AND ON A PHONE IT USUALLY IS NOT THE MODERN API
   * ANSWERING. Owner instruction: "kopyala butonlara basınca kopyalandı şeklinde
   * buton state'i değişmeli."
   *
   * `navigator.clipboard` needs a secure context and does not exist over plain
   * HTTP, which is exactly how a phone opens a LAN dev build — so a button wired
   * only to it does nothing at all, with no error to explain why. `fireEvent`
   * rather than `userEvent` here on purpose: `userEvent.setup()` installs its own
   * async clipboard, which is the one thing this test must NOT have.
   */
  it('flips to the copied state through the legacy path when there is no async clipboard', async () => {
    Object.defineProperty(document, 'execCommand', { value: () => true, configurable: true });
    expect('clipboard' in navigator).toBe(false);
    render(<DonateScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy SOLANA address' }));

    const copied = await screen.findByRole('button', { name: 'SOLANA address copied' });
    expect(copied).toHaveTextContent('Copied');
  });

  it('keeps the whole address readable and selectable when the clipboard refuses', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    render(<DonateScreen />);

    const address = screen.getByText('3z84BrV8nzzbZkGuDmWczjn6vd6Z1tKis9PHimZSae9J');
    expect(address).toHaveClass('selectable');
    expect(address).not.toHaveClass('truncate');

    await user.click(screen.getByRole('button', { name: 'Copy SOLANA address' }));
    expect(screen.getByRole('button', { name: 'Copy SOLANA address' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'SOLANA address copied' })).not.toBeInTheDocument();
    expect(screen.getByText('3z84BrV8nzzbZkGuDmWczjn6vd6Z1tKis9PHimZSae9J')).toBeInTheDocument();
  });
});
