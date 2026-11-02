import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { galaxySchema } from '../src/api/schemas.js';
import { GalaxyCommanderName } from '../src/galaxy/GalaxyCanvas.js';
import { planetNodes } from '../src/galaxy/scene.js';
import { LegacyPeek } from '../src/legacy/LegacyPeek.js';
import i18n from '../src/i18n/index.js';

// The pictures are drawn by an offscreen WebGL renderer jsdom does not have.
vi.mock('../src/legacy/snapshot.js', () => ({ useAwardSnapshot: () => null }));

beforeEach(async () => { await i18n.changeLanguage('en'); });

const PLAYER = '11111111-1111-4111-8111-111111111111';
const PUBLIC = '22222222-2222-4222-8222-222222222222';
const SEASON = '33333333-3333-4333-8333-333333333333';
const award = (id: string, definitionId: string, over: Record<string, unknown> = {}) => ({
  id, definitionId, tier: 1, edition: '', category: 'COMBAT', form: 'MEDAL', rarity: 'RARE',
  sourceSeasonId: null, earnedAt: '2026-10-01T00:00:00.000Z', grantedAt: '2026-10-01T00:00:00.000Z',
  seasonOrdinal: null, rank: null, ...over,
});
const honor = award('44444444-4444-4444-8444-444444444444', 'honor-podium', {
  category: 'SEASON', form: 'TROPHY', rarity: 'LEGENDARY', edition: SEASON, sourceSeasonId: SEASON, seasonOrdinal: 12, rank: 1,
});
const pirate = award('55555555-5555-4555-8555-555555555555', 'pirate-hunter', { tier: 3 });
const profile = {
  publicId: PUBLIC, commanderName: 'Mira', country: 'JP', joinedAt: '2026-01-05T00:00:00.000Z',
  portrait: 'default', backdrop: 'default', self: false, activeTitle: honor,
  collection: { count: 14 }, career: { seasons: 5, bestHonorRank: 1, bestDominionRank: 7 },
  showcase: [{ slot: 0, awardId: honor.id, award: honor }, { slot: 1, awardId: pirate.id, award: pirate }],
};
const seasons = {
  seasons: [{
    resultId: '66666666-6666-4666-8666-666666666666', seasonId: SEASON, ordinal: 12, galaxy: 'Andromeda',
    startsAt: '2026-09-01T00:00:00.000Z', closedAt: '2026-10-01T00:00:00.000Z', endReason: 'SCHEDULED_END',
    honorRank: 1, honorScore: 80, dominionRank: 7, dominion: 900, stats: null,
  }],
  nextCursor: null,
};

function show(answer: (path: string) => Response) {
  const paths: string[] = [];
  const api = new Api({ fetch: (input) => {
    const path = new URL(input instanceof Request ? input.url : input, 'http://x').pathname;
    paths.push(path);
    return Promise.resolve(answer(path));
  } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>;
  const onClose = vi.fn(), onOpenProfile = vi.fn();
  render(<LegacyPeek source={{ kind: 'player', playerId: PLAYER }} name="Mira" onClose={onClose} onOpenProfile={onOpenProfile} />, { wrapper });
  return { paths, onClose, onOpenProfile };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('the commander name on a planet label', () => {
  const input = { id: 'world', name: 'Kestrel', owner: 'Mira', kind: 'CAPITAL', position: { x: 0, y: 0, z: 0 },
    isSelf: false, intel: 'RESOLVED', state: { kind: 'NORMAL' } };
  const node = (over: Record<string, unknown> = {}) =>
    planetNodes([galaxySchema.shape.planets.element.parse({ ...input, ...over })])[0]!;

  it('opens the commander showcase when the seat is a player the map can name', () => {
    const onOpen = vi.fn();
    const known = node({ controller: { kind: 'PLAYER', playerId: PLAYER, displayName: 'Mira' } });
    render(<GalaxyCommanderName node={known} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open the profile of Mira' }));
    expect(onOpen).toHaveBeenCalledWith(known);
    expect(screen.getByRole('button').querySelector('.galaxy-commander-cup')).toBeNull();
  });

  it('stays plain text without a player behind the name or without a place to open it', () => {
    const { rerender } = render(<GalaxyCommanderName node={node()} onOpen={vi.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<GalaxyCommanderName node={node({ controller: { kind: 'PLAYER', playerId: PLAYER, displayName: 'Mira' } })} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Mira')).toBeInTheDocument();
  });
});

describe('the small showcase over the galaxy', () => {
  it('shows the title, the shelf, the career and the last season, and hands over to the whole profile', async () => {
    const { paths, onOpenProfile } = show(path => path.endsWith('/seasons') ? json(seasons) : json(profile));
    expect(await screen.findByRole('button', { name: 'Honor Champion · (S. 12)' })).toBeInTheDocument();
    expect(screen.getByText('(S. 12)')).toBeVisible();
    expect(paths[0]).toBe(`/api/legacy/players/${PLAYER}`);
    const shelf = screen.getByRole('list', { name: i18n.t('legacy.shelf.heading') });
    expect(shelf.querySelectorAll('[data-legacy-peek-piece]')).toHaveLength(2);
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#7')).toBeInTheDocument();
    expect(await screen.findByText(/Andromeda/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('legacy.profile.full') }));
    expect(onOpenProfile).toHaveBeenCalledOnce();
  });

  it('says so when the commander has put nothing on the shelf', async () => {
    show(path => path.endsWith('/seasons') ? json({ seasons: [], nextCursor: null }) : json({ ...profile, showcase: [], activeTitle: null }));
    expect(await screen.findByText(i18n.t('legacy.shelf.emptyOther'))).toBeInTheDocument();
  });

  it('keeps the name it was opened with while loading and states a failure', async () => {
    show(() => json({ code: 'LEGACY_PROFILE_NOT_FOUND', message: 'x' }, 404));
    expect(screen.getByRole('dialog', { name: 'Mira' })).toBeInTheDocument();
    await waitFor(() => { expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('legacy.profile.failed')); });
  });
});
