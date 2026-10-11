import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import AdminPanel from '../src/screens/AdminPanel.js';
import { ChatScreen } from '../src/screens/ChatScreen.js';

const seasonId = '00000000-0000-4000-8000-000000000001';
const clanId = '00000000-0000-4000-8000-000000000002';
const secondClan = '00000000-0000-4000-8000-000000000003';
beforeAll(() => { Element.prototype.scrollIntoView = () => { /* jsdom has no scrolling layout */ }; });
const scopes = {
  galaxies: [{ seasonId, name: 'Andromeda', code: 'andromeda' }],
  clans: [{ id: clanId, seasonId, name: 'Orion', tag: 'ORI', galaxy: 'Andromeda', galaxyCode: 'andromeda' },
    { id: secondClan, seasonId, name: 'Lyra', tag: 'LYR', galaxy: 'Andromeda', galaxyCode: 'andromeda' }],
};
const players = { measuredAt: '2026-10-11T08:00:00Z', onlineWindowMinutes: 5, nextBefore: null, players: [{
  playerId: 'commander', username: 'izci', displayName: 'İzci', seasonId, galaxy: 'Andromeda', galaxyCode: 'andromeda',
  lastActiveAt: '2026-10-11T07:59:00Z', mutes: [],
  resources: { storage: { alloy: 1234, crystal: 456, deuterium: 78 }, buffer: { alloy: 12, crystal: 34, deuterium: 0 } },
  activity: { asteroidDispatches: 4, minersSent: 20, pirateDispatches: 3, pirateShipsSent: 17 },
}] };

function show(chat = false, failure = false) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ url, body });
    let response: unknown = {};
    let status = 200;
    if (url.startsWith('/api/admin/players')) response = players;
    else if (url === '/api/admin/clans') response = scopes;
    else if (url === '/api/admin/chat/mute') { response = failure ? { error: 'ACCOUNT_NOT_FOUND', message: 'Account not found' }
      : { username: 'izci', channels: ['clan', 'dm'], duration: '15m', expiresAt: '2026-10-11T08:15:00Z' }; status = failure ? 404 : 200; }
    else if (url === '/api/admin/chat/mask') response = { masked: 3 };
    else if (url.includes('/api/admin/clans/') && url.endsWith('/chat') && init?.method === 'POST') response = {
      message: { id: 'sent', authorPlayerId: 'admin', username: 'Operator', admin: true, content: 'Selected room', createdAt: '2026-10-11T08:00:00Z', self: true },
    };
    else if (url.includes('/api/admin/clans/')) response = { messages: [{ id: url.includes(secondClan) ? 'second' : 'first',
      authorPlayerId: 'commander', planetId: 'planet', username: 'İzci', clanTag: 'ORI',
      content: url.includes(secondClan) ? 'Lyra room' : 'Orion room', createdAt: '2026-10-11T08:00:00Z', self: false }], nextBefore: null };
    else if (url.startsWith('/api/chat/messages')) response = { messages: [], nextBefore: null };
    else if (url === '/api/clan/badge') response = { membership: null, attention: false, attentionCount: 0, clanChatUnread: 0 };
    else if (url.includes('unread')) response = { count: 0 };
    return Promise.resolve(new Response(JSON.stringify(response), { status, headers: { 'content-type': 'application/json' } }));
  };
  const api = new Api({ fetch });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><ApiProvider api={api}>
    {chat ? <ChatScreen isAdmin initialChannel="clan" onFocusPlanet={() => { /* no camera in this fixture */ }} /> : <AdminPanel />}
  </ApiProvider></QueryClientProvider>);
  if (!chat) fireEvent.click(screen.getByRole('tab', { name: 'Players' }));
  return { calls, client };
}

describe('admin player operations', () => {
  it('shows scoped resources/activity and submits exactly the checked mute channels and selected duration', async () => {
    const { calls } = show();
    expect(await screen.findByText('İzci')).toBeInTheDocument();
    expect(screen.getByText(/Last 5 minutes/)).toBeInTheDocument();
    expect(screen.getByText(/20 miners/)).toBeInTheDocument();
    expect(screen.getByText(/17 ships/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Moderate İzci' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'General' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Clan' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'DM' }));
    fireEvent.change(screen.getByLabelText('Mute duration'), { target: { value: '15m' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mute player' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/Mute saved/);
    expect(calls.find(call => call.url === '/api/admin/chat/mute')?.body).toEqual({ username: 'izci', channels: ['clan', 'dm'], duration: '15m' });
  });

  it('masks only the selected clan, bounds the count and does not submit an empty channel selection', async () => {
    const { calls } = show();
    await screen.findByText('İzci');
    fireEvent.change(screen.getByLabelText('Commander username'), { target: { value: 'izci' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'General' }));
    expect(screen.getByRole('button', { name: 'Mute player' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Mask channel'), { target: { value: 'clan' } });
    fireEvent.change(screen.getByLabelText('Clan channel'), { target: { value: secondClan } });
    fireEvent.change(screen.getByLabelText('Message count'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mask messages' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/3 messages masked/);
    expect(calls.find(call => call.url === '/api/admin/chat/mask')?.body).toEqual({ username: 'izci', channel: 'clan', clanId: secondClan, count: 3 });
  });

  it('does not announce success when moderation fails', async () => {
    show(false, true);
    await screen.findByText('İzci');
    fireEvent.change(screen.getByLabelText('Commander username'), { target: { value: 'missing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mute player' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('switches admin clan history and posts to the selected clan without requiring membership', async () => {
    const { calls } = show(true);
    expect(await screen.findByText('Orion room')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Clan channel'), { target: { value: secondClan } });
    expect(await screen.findByText('Lyra room')).toBeInTheDocument();
    expect(screen.queryByText('Orion room')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Selected room' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => { expect(calls.some(call => call.url === `/api/admin/clans/${secondClan}/chat` && call.body !== undefined)).toBe(true); });
    expect(calls.find(call => call.url === `/api/admin/clans/${secondClan}/chat` && call.body !== undefined)?.body).toEqual({ content: 'Selected room' });
  });
});
