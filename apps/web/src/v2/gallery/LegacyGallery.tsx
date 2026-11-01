/**
 * Komutan Mirası fixtures for the gallery camera. Never shipped.
 *   ?view=legacy-shelf(-b|-c)  one shelf
 *   ?view=legacy-peek          the galaxy name → small showcase (add &self=1 for your own)
 *   ?view=legacy-profile       the whole profile as a page (add &self=1 for your own)
 *   ?view=legacy-reveal        the reveal of won pieces (&n=1 one piece, default five)
 */
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { legacyAwardRarity, LEGACY_CATALOGUE } from '@astera/rules';
import { Api } from '../../api/client.js';
import { ApiProvider } from '../../api/context.js';
import type { LegacyAward, LegacyProfile, LegacySeasons } from '../../api/legacySchemas.js';
import { galaxySchema } from '../../api/schemas.js';
import { GalaxyCommanderName } from '../../galaxy/GalaxyCanvas.js';
import { planetNodes } from '../../galaxy/scene.js';
import { LegacyRevealHost } from '../../legacy/AwardReveal.js';
import { CommanderLegacy, LegacyEntryCard, LegacyProfileSheet } from '../../legacy/LegacyPeek.js';
import { AwardSheet } from '../../legacy/AwardSheet.js';
import { ShowcaseShelf } from '../../legacy/ShowcaseShelf.js';
import { ATMOSPHERE } from '../../ui/atmosphere.js';

let serial = 0;
export const fixtureAward = (definitionId: string, over: Partial<LegacyAward> = {}): LegacyAward => {
  const definition = LEGACY_CATALOGUE.find(row => row.id === definitionId);
  const tier = over.tier ?? 1;
  return {
    id: `00000000-0000-4000-8000-${String(++serial).padStart(12, '0')}`, definitionId, tier, edition: 'career',
    category: definition?.category ?? 'COMBAT', form: definition?.form ?? 'MEDAL', rarity: legacyAwardRarity(definitionId, tier),
    sourceSeasonId: null, earnedAt: new Date('2026-10-12T10:00:00Z'), grantedAt: new Date('2026-10-12T10:00:00Z'),
    seasonOrdinal: null, rank: null, ...over,
  };
};

const SEASON_12 = '00000000-0000-4000-9000-000000000012';
const SEASON_11 = '00000000-0000-4000-9000-000000000011';
const SEASON_10 = '00000000-0000-4000-9000-000000000010';

export const FIXTURE_SHELF: (LegacyAward | null)[] = [
  fixtureAward('honor-podium', { tier: 1, edition: `season:${SEASON_12}`, sourceSeasonId: SEASON_12, seasonOrdinal: 12, rank: 1 }),
  fixtureAward('dominion-podium', { tier: 2, edition: `season:${SEASON_11}`, sourceSeasonId: SEASON_11, seasonOrdinal: 11, rank: 2 }),
  fixtureAward('colony-pioneer', { tier: 2 }),
  fixtureAward('pirate-hunter', { tier: 4 }),
  fixtureAward('asteroid-hunter', { tier: 1 }),
  fixtureAward('missile-hunter', { tier: 3 }),
];

export const FIXTURE_SHELF_B: (LegacyAward | null)[] = [
  fixtureAward('season-memento', { edition: 'cycle:x', sourceSeasonId: SEASON_12, seasonOrdinal: 12, category: 'SEASON', form: 'COIN' }),
  fixtureAward('year-of-service', { edition: 'year:2026', category: 'CAREER', form: 'PIN' }),
  fixtureAward('science-horizon', { category: 'PRODUCTION', form: 'ARTIFACT', sourceSeasonId: SEASON_11, seasonOrdinal: 11 }),
  fixtureAward('pirate-hunter', { tier: 3, rarity: 'EPIC' }),
  fixtureAward('deep-sight', { tier: 2, rarity: 'RARE', category: 'EXPLORATION' }),
  fixtureAward('colony-hunter', { tier: 1, form: 'MINIATURE' }),
];

export const FIXTURE_SHELF_C: (LegacyAward | null)[] = [
  fixtureAward('radiation-master', { tier: 2, rarity: 'RARE', form: 'ARTIFACT' }),
  fixtureAward('missile-hunter', { tier: 4, rarity: 'LEGENDARY' }),
  fixtureAward('asteroid-hunter', { tier: 1, category: 'EXPLORATION', form: 'ARTIFACT' }),
  fixtureAward('colony-pioneer', { tier: 2, rarity: 'RARE', category: 'EXPLORATION', form: 'MINIATURE' }),
  fixtureAward('astera-supporter', { category: 'SUPPORT' }),
  null,
];

/** New author-supplied pieces, shown without displacing the first six-family comparison. */
export const FIXTURE_SHELF_NEW: (LegacyAward | null)[] = [
  fixtureAward('radiation-master', { tier: 4 }), fixtureAward('clan-comrade', { tier: 3 }),
  fixtureAward('monument-warden', { tier: 2 }), fixtureAward('radiation-master', { tier: 1 }),
  fixtureAward('clan-comrade', { tier: 4 }), fixtureAward('monument-warden', { tier: 4 }),
];

export function LegacyShelfGallery({ set }: { set: 'a' | 'b' | 'c' | 'new' }) {
  const slots = set === 'new' ? FIXTURE_SHELF_NEW : set === 'a' ? FIXTURE_SHELF : set === 'b' ? FIXTURE_SHELF_B : FIXTURE_SHELF_C;
  return <div className="mx-auto max-w-[480px] p-4"><ShowcaseShelf slots={slots} onOpen={() => undefined} onEmpty={() => undefined} /></div>;
}

const PLAYER = '00000000-0000-4000-a000-000000000001';
const owned = (list: readonly (LegacyAward | null)[]) => list.flatMap(award => award ? [award] : []);
const modelVariants = ['honor-podium', 'dominion-podium', 'colony-pioneer', 'pirate-hunter', 'asteroid-hunter', 'missile-hunter',
  'radiation-master', 'clan-comrade', 'monument-warden']
  .flatMap(definitionId => [1, 2, 3, 4].map(tier => fixtureAward(definitionId, {
    tier, ...(definitionId.endsWith('-podium') ? { edition: `season:${SEASON_12}`, sourceSeasonId: SEASON_12,
      seasonOrdinal: 12, rank: tier === 4 ? 8 : tier } : {}),
  })));
const examples = [...owned(FIXTURE_SHELF_NEW), ...owned(FIXTURE_SHELF), ...owned(FIXTURE_SHELF_B), ...owned(FIXTURE_SHELF_C), ...modelVariants,
  fixtureAward('monument-warden', { tier: 4 }), fixtureAward('final-verdict', { tier: 3 }),
  fixtureAward('loyal-commander'), fixtureAward('shipwright-dart', { tier: 2 }),
  fixtureAward('troublemaker', { tier: 4 }), fixtureAward('show-off', { tier: 3 }),
  ...[1, 2, 3, 4].map(tier => fixtureAward('final-verdict', { tier })), fixtureAward('shipwright-cataclysm', { tier: 3 })];
// Keep the shelf's original instance when another fixture repeats the same degree.
export const COLLECTION = [...new Map([...examples].reverse().map(award => [
  `${award.definitionId}:${String(award.tier)}:${award.edition}`, award,
])).values()];

const stats = (battles: number, built: number, runs: number) => ({
  version: 1 as const,
  competition: { battles, attacks: Math.ceil(battles * 0.6), defences: Math.floor(battles * 0.4), damageDealt: battles * 1_500, damageTaken: battles * 600,
    playerLoot: { alloy: 3_000, crystal: 900, deuterium: 40 }, shipsBuilt: built, shipsLost: Math.floor(built / 3),
    shipsBuiltByHull: { DART: built }, shipsLostByHull: { DART: Math.floor(built / 3) } },
  economy: { produced: { alloy: 50_000, crystal: 18_000, deuterium: 400 }, productiveSeconds: 72_000 },
  exploration: { asteroidRuns: runs, asteroidMined: { alloy: 50_000, crystal: 12_000, deuterium: 500 }, convoyAttempts: 3, convoySuccesses: 2,
    convoyDelivered: { alloy: 2_000, crystal: 700, deuterium: 30 } },
});

function fixtureProfile(self: boolean): LegacyProfile {
  return {
    publicId: '00000000-0000-4000-b000-000000000001', commanderName: self ? 'Adminlesh' : 'Kestrel Sable', country: 'TR',
    joinedAt: new Date('2026-03-14T00:00:00Z'), portrait: 'default', backdrop: 'default', self,
    activeTitle: FIXTURE_SHELF[0] ?? null, collection: { count: COLLECTION.length },
    career: { seasons: 7, bestHonorRank: 1, bestDominionRank: 2 },
    showcase: owned(new URLSearchParams(window.location.search).get('awards') === 'new' ? FIXTURE_SHELF_NEW : FIXTURE_SHELF).map((award, slot) => ({ slot, awardId: award.id, award })),
  };
}

const SEASONS: LegacySeasons = { nextCursor: null, seasons: [
  { resultId: '00000000-0000-4000-c000-000000000012', seasonId: SEASON_12, ordinal: 12, galaxy: 'Andromeda', startsAt: new Date('2026-09-01T00:00:00Z'),
    closedAt: new Date('2026-10-01T00:00:00Z'), endReason: 'SCHEDULED_END', honorRank: 1, honorScore: 840, dominionRank: 4, dominion: 12_400, stats: stats(46, 212, 31) },
  { resultId: '00000000-0000-4000-c000-000000000011', seasonId: SEASON_11, ordinal: 11, galaxy: 'Andromeda', startsAt: new Date('2026-08-01T00:00:00Z'),
    closedAt: new Date('2026-08-31T00:00:00Z'), endReason: 'SCHEDULED_END', honorRank: 6, honorScore: 310, dominionRank: 2, dominion: 15_100, stats: stats(28, 160, 44) },
  { resultId: '00000000-0000-4000-c000-000000000010', seasonId: SEASON_10, ordinal: 10, galaxy: 'Orion', startsAt: new Date('2026-07-01T00:00:00Z'),
    closedAt: new Date('2026-07-16T00:00:00Z'), endReason: 'FORCED_WIPE', honorRank: null, honorScore: 0, dominionRank: 38, dominion: 2_100, stats: null },
] };

/** Local fixtures only; a write changes the fixture, nothing reaches a server. */
export function legacyGalleryApi(self: boolean): Api {
  const api = new Api({ fetch: () => Promise.reject(new Error('This gallery has no server connection')) });
  let profile = fixtureProfile(self);
  const read = () => Promise.resolve(profile);
  api.legacyMe = read; api.legacyPlayer = read; api.legacyProfile = read; api.legacyResult = read;
  api.legacyCollection = () => Promise.resolve({ awards: COLLECTION.map((award, index) => ({ ...award, owners: 3 + index * 7 })), nextCursor: null });
  api.legacySeasons = () => Promise.resolve(SEASONS);
  api.legacyAward = (_, awardId) => {
    const award = COLLECTION.find(row => row.id === awardId) ?? COLLECTION[0]!;
    const definition = LEGACY_CATALOGUE.find(row => row.id === award.definitionId);
    const season = SEASONS.seasons.find(row => row.seasonId === award.sourceSeasonId);
    return Promise.resolve({ award, owners: 12,
      condition: { metric: definition?.metric ?? 'X', goal: definition?.goals[award.tier - 1] ?? 1, scope: definition?.scope ?? 'CAREER' },
      season: season ? { seasonId: season.seasonId, ordinal: season.ordinal, galaxy: season.galaxy, startsAt: season.startsAt, closedAt: season.closedAt } : null });
  };
  api.legacyProgress = () => Promise.resolve({ achievements: LEGACY_CATALOGUE.map((definition, index) => ({ ...definition, goals: [...definition.goals],
    progress: Math.max(Math.floor((definition.goals.at(-1) ?? 1) * ((index % 5) + 1) / 6),
      ...COLLECTION.filter(award => award.definitionId === definition.id).map(award => definition.goals[award.tier - 1] ?? 0)) })) });
  api.setLegacyShowcase = ids => {
    profile = { ...profile, showcase: ids.flatMap((id, slot) => { const award = COLLECTION.find(row => row.id === id); return award ? [{ slot, awardId: id, award }] : []; }) };
    return Promise.resolve({ ok: true as const });
  };
  const count = Number(new URLSearchParams(window.location.search).get('n') ?? '5');
  let waiting = [FIXTURE_SHELF[0], FIXTURE_SHELF_B[3], FIXTURE_SHELF[3], FIXTURE_SHELF_B[0], FIXTURE_SHELF_B[1], FIXTURE_SHELF_C[1]]
    .flatMap(award => award ? [award] : []).slice(0, count);
  api.legacyReveals = () => Promise.resolve({ awards: waiting, total: waiting.length });
  api.revealLegacyAwards = ids => { waiting = waiting.filter(award => !ids.includes(award.id)); return Promise.resolve({ revealed: ids.length }); };
  api.setLegacyTitle = id => { profile = { ...profile, activeTitle: COLLECTION.find(row => row.id === id) ?? null }; return Promise.resolve({ ok: true as const }); };
  return api;
}

/** A world label as the map draws it, over the galaxy art; the name opens the showcase. */
export function LegacyPeekGallery({ page }: { page: 'peek' | 'profile' }) {
  const self = new URLSearchParams(window.location.search).get('self') === '1';
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const [api] = useState(() => legacyGalleryApi(self));
  const [open, setOpen] = useState(new URLSearchParams(window.location.search).get('closed') !== '1');
  const name = self ? 'Adminlesh' : 'Kestrel Sable';
  const node = planetNodes([galaxySchema.shape.planets.element.parse({
    id: 'world', name: 'KESTREL-144', owner: name, country: 'TR', kind: 'CAPITAL', position: { x: 0, y: 0, z: 0 },
    isSelf: self, intel: 'RESOLVED', state: { kind: 'NORMAL' }, controller: { kind: 'PLAYER', playerId: PLAYER, displayName: name },
  })])[0]!;
  return (
    <QueryClientProvider client={client}><ApiProvider api={api}>
      <div className="relative h-dvh overflow-hidden bg-v2-void">
        <img src={ATMOSPHERE.season.src} alt="" className="absolute inset-0 size-full object-cover opacity-60" />
        {page === 'profile' && !open && <div className="absolute inset-x-4 top-24"><LegacyEntryCard onOpen={() => { setOpen(true); }} /></div>}
        <span className="galaxy-world-label absolute left-1/2 top-[38%] flex -translate-x-1/2 flex-col items-center gap-0.5 text-center"
          style={{ textShadow: '0 1px 4px var(--color-v2-void), 0 0 12px var(--color-v2-void)' }}>
          <span className="legend text-micro text-crystal">CAPITAL{self ? ' · YOURS' : ''}</span>
          <GalaxyCommanderName node={node} onOpen={() => { setOpen(true); }} />
          <span className="legend text-micro text-v2-ink-2">KESTREL-144</span>
        </span>
        {open && (page === 'peek'
          ? <CommanderLegacy source={{ kind: 'player', playerId: PLAYER }} name={name} onClose={() => { setOpen(false); }} />
          : <LegacyProfileSheet source={{ kind: 'player', playerId: PLAYER }} name={name} onClose={() => { setOpen(false); }} />)}
      </div>
    </ApiProvider></QueryClientProvider>
  );
}

/** The reveal over the galaxy art, exactly as the galaxy mounts it. */
export function LegacyRevealGallery() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const [api] = useState(() => legacyGalleryApi(true));
  return (
    <QueryClientProvider client={client}><ApiProvider api={api}>
      <div className="relative h-dvh overflow-hidden bg-v2-void">
        <img src={ATMOSPHERE.season.src} alt="" className="absolute inset-0 size-full object-cover opacity-60" />
        <LegacyRevealHost ready />
      </div>
    </ApiProvider></QueryClientProvider>
  );
}


/** A direct inspection of real award UI, available only on the development gallery. */
export function LegacyAwardGallery() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const [api] = useState(() => legacyGalleryApi(true));
  const params = new URLSearchParams(window.location.search);
  const id = params.get('award') ?? 'year-of-service';
  const tier = params.has('tier') ? Number(params.get('tier')) : null;
  const award = COLLECTION.filter(row => row.definitionId === id && (tier === null || row.tier === tier)).sort((a, b) => b.tier - a.tier)[0];
  if (!award) return <p>Unknown preview award</p>;
  return <QueryClientProvider client={client}><ApiProvider api={api}>
    <AwardSheet profile={fixtureProfile(true)} award={award} onClose={() => { window.history.back(); }} />
  </ApiProvider></QueryClientProvider>;
}
