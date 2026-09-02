import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import i18n from '../src/i18n/index.js';
import { ClanScreen } from '../src/screens/ClanScreen.js';
import type { ClanHome } from '../src/api/schemas.js';

const now = new Date(Date.now() - 1_000);
const later = new Date(now.getTime() + 6 * 60 * 60 * 1_000);

const outside = {
  state: 'OUTSIDE' as const,
  requests: [{
    id: 'invite-1',
    clanId: 'clan-orbit',
    clanName: 'Orbit Wardens',
    clanTag: 'ORB',
    kind: 'INVITATION' as const,
    status: 'PENDING' as const,
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1_000),
    resolvedAt: null,
  }],
  depot: { alloy: 90, crystal: 30, deuterium: 0 },
  creation: {
    capitalPlanetId: 'planet-me',
    coreLevel: 6,
    intel: 'RESOLVED' as const,
    requiredCoreLevel: 7,
    cost: { alloy: 5_000, crystal: 3_000, deuterium: 0 },
    affordable: false,
    unlockedAt: null,
  },
};

const member = {
  state: 'MEMBER' as const,
  clan: {
    id: 'clan-orbit',
    name: 'Orbit Wardens',
    tag: 'ORB',
    description: 'Watch the rim. Bring everyone home.',
    recruiting: true,
    score: 840,
    role: 'LEADER' as const,
    matureAt: later,
    mature: false,
    aidEnabled: true,
  },
  members: [
    {
      playerId: 'player-me', username: 'Vantage', role: 'LEADER' as const, slot: 0,
      joinedAt: now, matureAt: now, mature: true, aidEnabled: true, lastActiveAt: now,
      activeRecently: true,
    },
    {
      playerId: 'player-ada', username: 'Ada', role: 'MEMBER' as const, slot: 1,
      joinedAt: now, matureAt: later, mature: false, aidEnabled: true, lastActiveAt: now,
      activeRecently: true,
    },
  ],
  requests: [],
};

const directory = {
  clans: [
    {
      id: 'clan-orbit', name: 'Orbit Wardens', tag: 'ORB',
      description: 'Watch the rim. Bring everyone home.', recruiting: true,
      leaderName: 'Vantage', memberCount: 2, score: 840,
    },
    {
      id: 'clan-night', name: 'Night Couriers', tag: 'N7',
      description: 'Cargo before glory.', recruiting: false,
      leaderName: 'Ada', memberCount: 5, score: 120,
    },
  ],
  total: 2,
};

function show(home: ClanHome) {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  vi.spyOn(api, 'clanHome').mockResolvedValue(home);
  vi.spyOn(api, 'clans').mockResolvedValue(directory);
  vi.spyOn(api, 'clanDepot').mockResolvedValue({
    resources: { alloy: 120, crystal: 40, deuterium: 5 },
    purseRemaining: { alloy: 500, crystal: 200, deuterium: 20 },
  });
  vi.spyOn(api, 'clanLeaderboard').mockResolvedValue({
    clans: directory.clans.map((clan, index) => ({
      ...clan,
      rank: index + 1,
      self: clan.id === 'clan-orbit',
    })),
  });
  vi.spyOn(api, 'clanStrength').mockResolvedValue({
    clan: { id: 'clan-orbit', name: 'Orbit Wardens', tag: 'ORB' },
    totals: {
      clanDominion: 840,
      memberDominion: 1_240,
      ships: 73,
      fleetValue: 98_400,
      groundDefences: 12,
      worlds: 3,
      activeFlights: 2,
    },
    composition: [{ hull: 'DART', count: 50 }, { hull: 'PIKE', count: 23 }],
    members: [
      { playerId: 'player-me', username: 'Vantage', role: 'LEADER', dominion: 800, ships: 50, worlds: 2 },
      { playerId: 'player-ada', username: 'Ada', role: 'MEMBER', dominion: 440, ships: 23, worlds: 1 },
    ],
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(keys.clanHome, home);
  client.setQueryData(keys.clanBadge, {
    available: true,
    membership: home.state === 'MEMBER'
      ? { clanId: home.clan.id, name: home.clan.name, tag: home.clan.tag, role: home.clan.role, matureAt: home.clan.matureAt, mature: home.clan.mature }
      : null,
    attention: false,
    attentionCount: 0,
    clanChatUnread: 0,
  });
  client.setQueryData(keys.clanDirectory(''), { pages: [directory], pageParams: [0] });
  client.setQueryData(keys.clanDepot, {
    resources: { alloy: 120, crystal: 40, deuterium: 5 },
    purseRemaining: { alloy: 500, crystal: 200, deuterium: 20 },
  });
  client.setQueryData(keys.clanLeaderboard, {
    clans: directory.clans.map((clan, index) => ({
      ...clan,
      rank: index + 1,
      self: clan.id === 'clan-orbit',
    })),
  });
  client.setQueryData(keys.clanStrength, {
    clan: { id: 'clan-orbit', name: 'Orbit Wardens', tag: 'ORB' },
    totals: {
      clanDominion: 840, memberDominion: 1_240, ships: 73, fleetValue: 98_400,
      groundDefences: 12, worlds: 3, activeFlights: 2,
    },
    composition: [{ hull: 'DART', count: 50 }, { hull: 'PIKE', count: 23 }],
    members: [
      { playerId: 'player-me', username: 'Vantage', role: 'LEADER', dominion: 800, ships: 50, worlds: 2 },
      { playerId: 'player-ada', username: 'Ada', role: 'MEMBER', dominion: 440, ships: 23, worlds: 1 },
    ],
  });
  client.setQueryData(keys.leaderboard, {
    ladder: [
      { rank: 1, playerId: 'player-me', username: 'Vantage', score: 800, clan: { id: 'clan-orbit', name: 'Orbit Wardens', tag: 'ORB' } },
      { rank: 2, playerId: 'player-ada', username: 'Ada', score: 440, clan: { id: 'clan-orbit', name: 'Orbit Wardens', tag: 'ORB' } },
      { rank: 3, playerId: 'player-nova', username: 'Nova', score: 300, clan: null },
    ],
    you: { rank: 1, playerId: 'player-me', username: 'Vantage', score: 800, clan: { id: 'clan-orbit', name: 'Orbit Wardens', tag: 'ORB' } },
  });
  client.setQueryData(keys.clanEvents, { pages: [{ events: [], nextBefore: null }], pageParams: [null] });
  client.setQueryData(keys.clanAid, { transfers: [] });
  client.setQueryData(keys.clanChat, {
    pages: [{
      messages: [{
        id: 'message-1', authorPlayerId: 'player-ada', planetId: 'planet-ada', username: 'Ada',
        content: 'Rim temiz.', createdAt: now, self: false,
      }],
      nextBefore: null,
    }],
    pageParams: [null],
  });
  client.setQueryData(keys.galaxy, {
    you: { planetId: 'planet-me', playerId: 'player-me', capitalPlanetId: 'planet-me', planetIds: ['planet-me'] },
    planets: [
      {
        id: 'planet-me', name: 'Kestrel-12', owner: 'Vantage', position: { x: 0, y: 0, z: 0 },
        coreTier: 3, satellites: [], shielded: false, isSelf: true,
        controller: { kind: 'PLAYER' as const, playerId: 'player-me', displayName: 'Vantage' },
        clan: { id: 'clan-orbit', name: 'Orbit Wardens', tag: 'ORB' },
      },
      {
        id: 'planet-ada', name: 'Lantern', owner: 'Ada', position: { x: 1, y: 0, z: 0 },
        coreTier: 2, satellites: [], shielded: false, isSelf: false,
        controller: { kind: 'PLAYER' as const, playerId: 'player-ada', displayName: 'Ada' },
        clan: { id: 'clan-orbit', name: 'Orbit Wardens', tag: 'ORB' },
      },
    ],
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>
  );
  render(<Wrapper><ClanScreen /></Wrapper>);
  return { api, client };
}

afterEach(async () => {
  vi.restoreAllMocks();
  await i18n.changeLanguage('en');
});

describe('clan command surface', () => {
  it('answers why a clan matters and shows the exact founding gate', () => {
    show(outside);

    expect(screen.getByText('Five commanders, one safe crew.')).toBeInTheDocument();
    expect(screen.getByText(/Clanmates cannot attack each other/)).toBeInTheDocument();
    expect(screen.getByText(/10% of returned raid loot/)).toBeInTheDocument();
    expect(screen.getByText('Command Core 6 / 7')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Found a clan' })).toBeDisabled();
    expect(screen.getByText('5,000')).toBeInTheDocument();
    expect(screen.getByText('3,000')).toBeInTheDocument();
  });

  it('lets a clanless commander apply from the directory', async () => {
    const { api } = show({ ...outside, requests: [] });
    const apply = vi.spyOn(api, 'applyToClan').mockResolvedValue({ requestId: 'application-1', expiresAt: later });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Apply to Orbit Wardens' }));

    await waitFor(() => { expect(apply).toHaveBeenCalledWith('clan-orbit'); });
    expect(screen.getByText('Application sent. The leader has 24 hours to answer.')).toBeInTheDocument();
  });

  it('states exactly what adaptation changes and shows the crew strength together', async () => {
    show(member);

    expect(screen.getByText('Adapting to the crew')).toBeInTheDocument();
    expect(screen.getByText(/Chat and friendly-fire protection work now/)).toBeInTheDocument();
    expect(screen.getByText(/Aid, shared loot and clan history open/)).toBeInTheDocument();

    expect(screen.queryByRole('tab', { name: 'Chat' })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Strength' }));
    expect(screen.getByText('How strong are we together?')).toBeInTheDocument();
    expect(screen.getByText('1,240')).toBeInTheDocument();
    expect(screen.getByText('73')).toBeInTheDocument();
    expect(screen.getByText('Vantage')).toBeInTheDocument();
    expect(screen.getByText('Ada')).toBeInTheDocument();
  });

  it('unlocks adaptation at its timestamp while the clan room stays open', async () => {
    const matureAt = new Date(Date.now() + 100);
    show({
      ...member,
      clan: { ...member.clan, mature: false, matureAt },
      members: member.members.map((entry) => entry.playerId === 'player-me'
        ? { ...entry, mature: false, matureAt }
        : entry),
    });

    expect(screen.getByText('Adapting to the crew')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Fully linked')).toBeInTheDocument();
    }, { timeout: 1_000 });
  });

  it('keeps leader removals and leadership transfer behind a second explicit press', async () => {
    const { api } = show({ ...member, clan: { ...member.clan, mature: true, matureAt: now } });
    const kick = vi.spyOn(api, 'kickClanMember').mockResolvedValue({ kickedPlayerId: 'player-ada', lockedUntil: later });

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Members' }));
    await user.click(screen.getByRole('button', { name: 'Remove Ada' }));

    expect(kick).not.toHaveBeenCalled();
    expect(screen.getByText('Remove Ada from the clan?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Yes, remove Ada' }));
    await waitFor(() => { expect(kick).toHaveBeenCalledWith('player-ada'); });
  });

  it('offers clanless commanders from the public ladder even when sight has not resolved them', async () => {
    show({ ...member, clan: { ...member.clan, mature: true, matureAt: now } });

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Members' }));

    expect(screen.getByRole('option', { name: 'Nova' })).toBeInTheDocument();
  });

  it('gives only the leader applications, invitations, settings and disband controls', async () => {
    show({ ...member, clan: { ...member.clan, mature: true, matureAt: now } });

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Members' }));

    expect(screen.getByText('Applications')).toBeInTheDocument();
    expect(screen.getByText('Invite a commander')).toBeInTheDocument();
    expect(screen.getByText('Clan settings')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disband clan' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Leave clan' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Ada' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Transfer leadership to Ada' })).toBeInTheDocument();
  });

  it('keeps a maximum-length clan identity readable on a phone-sized header', () => {
    const name = 'ABCDEFGHIJKLMNOPQRSTUVWX';
    show({ ...member, clan: { ...member.clan, name } });

    const heading = screen.getByRole('heading', { name });
    expect(heading).toHaveClass('break-words');
    expect(heading).not.toHaveClass('truncate');
  });

  it('keeps a regular member out of leader controls and gives them a leave route', async () => {
    show({
      ...member,
      clan: { ...member.clan, role: 'MEMBER', mature: true, matureAt: now },
      members: member.members.map((entry) => entry.playerId === 'player-me'
        ? { ...entry, role: 'MEMBER' as const }
        : { ...entry, role: 'LEADER' as const }),
    });

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Members' }));

    expect(screen.queryByText('Applications')).not.toBeInTheDocument();
    expect(screen.queryByText('Invite a commander')).not.toBeInTheDocument();
    expect(screen.queryByText('Clan settings')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove Ada/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Transfer leadership/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leave clan' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Disband clan' })).not.toBeInTheDocument();
  });

  it('enables founding only for an eligible clanless commander with a valid identity', async () => {
    const { api } = show({
      ...outside,
      requests: [],
      creation: {
        ...outside.creation,
        coreLevel: 7,
        affordable: true,
      },
    });
    const create = vi.spyOn(api, 'createClan').mockImplementation(
      () => new Promise<never>(() => undefined),
    );
    const user = userEvent.setup();

    const submit = screen.getByRole('button', { name: 'Found a clan' });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText('Clan name'), 'Nova Guard');
    await user.type(screen.getByLabelText('Short tag'), 'nvg');
    expect(submit).toBeEnabled();
    await user.click(submit);

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        name: 'Nova Guard',
        tag: 'NVG',
        description: '',
        recruiting: true,
      });
    });
  });

  it('localises the simple entry points in Turkish', async () => {
    await i18n.changeLanguage('tr');
    show(outside);

    expect(screen.getByText('Beş komutan, tek güvenli ekip.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Klan kur' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Orbit Wardens klanına başvur' })).toBeInTheDocument();
  });
});
