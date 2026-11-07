import { COMMUNITY_POLICY_VERSION } from '@astera/rules';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { ChatScreen } from '../src/screens/ChatScreen.js';
import { vesselToPlanetView } from '../src/starter/adapter.js';
import { starterFetch } from '../src/starter/transport.js';
import { urlOf, wireVessel } from './starterVesselFixture.js';

afterEach(cleanup);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const message = { id: 'm1', authorPlayerId: 'them', username: 'Other', clanTag: null, content: 'hello', media: null, language: 'en', createdAt: new Date('2026-11-05T10:00:00Z'), self: false, replyTo: null, reactions: [], admin: false };

function aboard() {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.planet, vesselToPlanetView(vesselSchema.parse(wireVessel())));
  client.setQueryData(keys.communityPolicy, { version: COMMUNITY_POLICY_VERSION, acceptedAt: new Date('2026-10-19T00:00:00Z') });
  client.setQueryData(keys.chatMessagesFor('en'), { pages: [{ messages: [message], nextBefore: null }], pageParams: [null] });
  client.setQueryData(keys.chatUnreadFor('en'), { count: 0 });
  client.setQueryData(keys.clanBadge, { available: false, membership: null, clanChatUnread: 0 });
  client.setQueryData(keys.dmUnread, { count: 0 });
  render(<QueryClientProvider client={client}><ApiProvider api={api}><ChatScreen onFocusPlanet={vi.fn()} isAdmin /></ApiProvider></QueryClientProvider>);
}

describe('the chat aboard', () => {
  it('has one room: no clan tab, no private messages', () => {
    aboard();
    expect(screen.queryByRole('tab', { name: /clan/i })).toBeNull();
    expect(screen.queryByRole('tab', { name: /message/i })).toBeNull();
    expect(screen.getByText('hello')).toBeTruthy();
  });

  it('offers what this room has: report and block stay, a reaction and a reply are gone', () => {
    aboard();
    fireEvent.contextMenu(document.querySelector('[data-chat-message="m1"]')!);
    expect(screen.queryByRole('button', { name: /add.*reaction/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^reply/i })).toBeNull();
    expect(screen.getByRole('button', { name: /report/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /block/i })).toBeTruthy();
  });

  it('has no picture upload, even for an operator', () => {
    aboard();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});

describe('the chat through the transport', () => {
  const harness = () => {
    const base = vi.fn((input: RequestInfo | URL) => { void input; return Promise.resolve(json({ ok: true })); });
    return { base, fetch: starterFetch(base, () => true) };
  };
  const asked = (base: ReturnType<typeof harness>['base']) => urlOf(base.mock.calls[0]![0]);

  it.each([
    ['/api/chat/messages?language=tr&before=abc', 'GET', '/api/starter/chat/messages?language=tr&before=abc'],
    ['/api/chat/unread?language=tr', 'GET', '/api/starter/chat/unread?language=tr'],
    ['/api/chat/messages', 'POST', '/api/starter/chat/messages'],
    ['/api/chat/read', 'POST', '/api/starter/chat/read'],
    ['/api/community/reports', 'POST', '/api/starter/chat/report'],
    ['/api/community/blocks', 'POST', '/api/starter/chat/block'],
  ])('%s %s goes to this galaxy, with its question intact', async (path, method, target) => {
    const { base, fetch } = harness();
    await fetch(path, { method });
    expect(asked(base)).toBe(target);
  });

  it.each(['/api/chat/reactions', '/api/chat/mute', '/api/dm/conversations'])('keeps %s on the device', async (path) => {
    const { base, fetch } = harness();
    const answer = await fetch(path, { method: 'POST' });
    expect(answer.status).toBe(404);
    expect(base).not.toHaveBeenCalled();
  });

  it('leaves a list of blocks on the account: it answers the same aboard', async () => {
    const { base, fetch } = harness();
    await fetch('/api/community/blocks', { method: 'GET' });
    expect(asked(base)).toBe('/api/community/blocks');
  });
});
