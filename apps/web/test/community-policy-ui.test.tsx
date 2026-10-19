import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import { ChatScreen } from '../src/screens/ChatScreen.js';
import { ClaimDialog } from '../src/onboarding/ClaimDialog.js';

const version = '2026-10-19'; const at = new Date('2026-10-19T00:00:00Z');
function chat(options: { fail?: boolean; accepted?: boolean; unavailable?: boolean; future?: boolean; delay?: boolean } = {}) {
  const posts: unknown[] = []; let accepted = options.accepted ?? false;
  const api = new Api({ fetch: (input, init) => {
    const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (path === '/api/community/policy' && init?.method === 'POST') {
      posts.push(typeof init.body === 'string' ? JSON.parse(init.body) as unknown : null);
      if (options.delay) return new Promise(() => undefined); if (!options.fail) accepted = true;
    }
    const bad = options.unavailable === true || options.fail === true && init?.method === 'POST';
    return Promise.resolve(new Response(JSON.stringify(bad ? { error: 'UNAVAILABLE', message: 'Fixture' } : { version: options.future ? 'future-policy' : version, acceptedAt: accepted ? at : null }), { status: bad ? 503 : 200 }));
  } });
  vi.spyOn(api, 'markChatRead').mockResolvedValue({ ok: true, readAt: at });
  const q = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  q.setQueryData(keys.chatMessagesFor('en'), { pages: [{ messages: [{ id: 'message', authorPlayerId: 'other', username: 'Scout', content: 'Readable history', createdAt: at, self: false, language: 'en' }], nextBefore: null }], pageParams: [null] });
  q.setQueryData(keys.chatUnreadFor('en'), { count: 0 }); q.setQueryData(keys.dmUnread, { count: 0 }); q.setQueryData(keys.clanBadge, { membership: null });
  render(<QueryClientProvider client={q}><ApiProvider api={api}><ChatScreen onFocusPlanet={vi.fn()} /></ApiProvider></QueryClientProvider>);
  return posts;
}
it('requires a new commander to explicitly agree before claim and forwards version and display language', async () => {
  const onClaim = vi.fn(() => Promise.resolve()); render(<ClaimDialog planetName="Kestrel" onClaim={onClaim} onSignIn={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Commander name'), { target: { value: 'PolicyCommander' } }); fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'fixture-password' } });
  const submit = screen.getByRole('button', { name: /claim/i }); expect(submit).toBeDisabled();
  expect(screen.getByRole('link', { name: 'Community guidelines' })).toHaveAttribute('href', '/community-guidelines.html');
  expect(screen.getByRole('link', { name: 'Terms of use' })).toHaveAttribute('href', '/terms.html');
  expect(screen.getByRole('checkbox')).not.toBeChecked(); fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(submit);
  await waitFor(() => { expect(onClaim).toHaveBeenCalledWith('PolicyCommander', 'fixture-password', expect.any(String), { version, locale: 'en' }); });
});
it('keeps history readable and enables posting only after the server confirms explicit agreement', async () => {
  const posts = chat(); expect(screen.getByText('Readable history')).toBeInTheDocument();
  const agreement = await screen.findByRole('checkbox'); expect(agreement).not.toBeChecked(); expect(screen.queryByRole('textbox')).toBeNull();
  const accept = screen.getByRole('button', { name: 'Accept and continue' }); expect(accept).toBeDisabled();
  fireEvent.click(agreement); fireEvent.click(accept); expect(await screen.findByRole('textbox')).toBeInTheDocument();
  expect(posts).toEqual([{ version, locale: 'en' }]);
});
it('does not invent consent during an outage and offers retry without hiding readable history', async () => {
  chat({ unavailable: true }); expect(await screen.findByRole('alert')).toHaveTextContent('The rules could not be checked');
  expect(screen.getByText('Readable history')).toBeInTheDocument(); expect(screen.queryByRole('textbox')).toBeNull(); expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
});
it('keeps a failed agreement editable and never opens the composer as a false success', async () => {
  chat({ fail: true }); fireEvent.click(await screen.findByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Accept and continue' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Your agreement could not be confirmed');
  expect(screen.queryByRole('textbox')).toBeNull(); expect(screen.getByRole('button', { name: 'Accept and continue' })).toBeEnabled();
});
it('coalesces agreement taps while the confirmation is in flight', async () => {
  const posts = chat({ delay: true }); fireEvent.click(await screen.findByRole('checkbox'));
  const accept = screen.getByRole('button', { name: 'Accept and continue' }); fireEvent.click(accept); fireEvent.click(accept);
  await waitFor(() => { expect(posts).toHaveLength(1); }); expect(accept).toBeDisabled();
});
it('honors existing server evidence without asking for acceptance again', async () => {
  const posts = chat({ accepted: true }); expect(await screen.findByRole('textbox')).toBeInTheDocument(); expect(screen.queryByRole('checkbox')).toBeNull(); expect(posts).toHaveLength(0);
});
it('does not send an obsolete acceptance when the server requires a policy newer than this app', async () => {
  const posts = chat({ future: true }); expect(await screen.findByRole('alert')).toHaveTextContent('Update or reopen the app');
  expect(screen.queryByRole('button', { name: 'Accept and continue' })).toBeNull(); expect(posts).toHaveLength(0);
});
