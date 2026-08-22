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

function show(unread: number, onOpen = vi.fn()) {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.chatUnread, { count: unread });
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
  it('opens chat directly from the Galaxy and owns the unread dot', async () => {
    const onOpen = show(3);
    const launcher = screen.getByRole('button', { name: 'Open galaxy chat — 3 unread' });
    expect(launcher).toHaveClass('bottom-3', 'right-3');
    expect(launcher.querySelector('.bg-threat')).not.toBeNull();
    await userEvent.setup().click(launcher);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('has no alert dot when everything is read and localises in Turkish', async () => {
    await i18n.changeLanguage('tr');
    show(0);
    const launcher = screen.getByRole('button', { name: 'Galaksi sohbetini aç' });
    expect(launcher.querySelector('.bg-threat')).toBeNull();
  });
});
