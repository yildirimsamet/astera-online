import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import i18n from '../src/i18n/index.js';
import { ChatLauncher } from '../src/screens/ChatLauncher.js';

function show(generalUnread: number, clanUnread = 0, onOpen = vi.fn()) {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.chatUnread, { count: generalUnread });
  client.setQueryData(keys.clanBadge, {
    available: true,
    membership: clanUnread > 0
      ? {
          clanId: 'clan-war', name: 'War Fleet', tag: 'WAR', role: 'MEMBER',
          matureAt: new Date('2026-08-26T00:00:00Z'), mature: true,
        }
      : null,
    attention: clanUnread > 0,
    attentionCount: clanUnread,
    clanChatUnread: clanUnread,
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
  render(<Wrapper><ChatLauncher onOpen={onOpen} /></Wrapper>);
  return onOpen;
}

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('Galaxy chat launcher', () => {
  it('opens chat directly from the Galaxy and owns the general unread light', async () => {
    const onOpen = show(3, 0);
    const launcher = screen.getByRole('button', { name: 'Open galaxy chat — 3 unread' });
    expect(launcher).toHaveClass('bottom-3', 'right-3');
    expect(launcher.querySelector('.bg-threat')).not.toBeNull();
    await userEvent.setup().click(launcher);
    expect(onOpen).toHaveBeenCalledWith('general');
  });

  it('shows both differently coloured lights side by side and opens the unread clan tab', async () => {
    const onOpen = show(0, 2);
    const launcher = screen.getByRole('button', { name: 'Open chat — 2 unread in Clan' });
    expect(launcher.querySelector('.bg-threat')).toBeNull();
    expect(launcher.querySelector('.bg-opportunity')).not.toBeNull();
    await userEvent.setup().click(launcher);
    expect(onOpen).toHaveBeenCalledWith('clan');

    const both = show(3, 2);
    const bothLauncher = screen.getByRole('button', { name: 'Open chat — 3 unread in General, 2 in Clan' });
    expect(bothLauncher.querySelector('.bg-threat')).not.toBeNull();
    expect(bothLauncher.querySelector('.bg-opportunity')).not.toBeNull();
    expect(both).not.toHaveBeenCalled();
  });

  it('has no alert dot when everything is read and localises in Turkish', async () => {
    await i18n.changeLanguage('tr');
    show(0);
    const launcher = screen.getByRole('button', { name: 'Galaksi sohbetini aç' });
    expect(launcher.querySelector('.bg-threat')).toBeNull();
  });
});
