import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import i18n from '../src/i18n/index.js';
import AdminPanel from '../src/screens/AdminPanel.js';
import { AnnouncementsScreen } from '../src/screens/AnnouncementsScreen.js';
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

afterEach(async () => {
  await i18n.changeLanguage('en');
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
});
