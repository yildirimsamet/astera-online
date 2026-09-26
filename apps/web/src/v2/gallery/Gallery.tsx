import { useState, type CSSProperties, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import type { BuildOrderView, PendingThread } from '../../api/schemas.js';
import { nowEntries } from '../../lib/nowLine.js';
import { roomOf } from '../../lib/fleetPage.js';
import type { GalaxyPlanet, IntelView } from '../../api/schemas.js';
import { LaunchSheet } from '../../screens/LaunchSheet.js';
import { SettlementSheet } from '../../screens/SettlementSheet.js';
import { IntergalacticConvoySheet } from '../../screens/IntergalacticConvoySheet.js';
import { TransferSheet } from '../../screens/TransferSheet.js';
import { IntelScreen } from '../../screens/IntelScreen.js';
import { ClanScreen } from '../../screens/ClanScreen.js';
import { keys } from '../../api/keys.js';
import { TradeSheet } from '../../screens/TradeSheet.js';
import { ClanWarPanel } from '../../screens/ClanWarPanel.js';
import { StrikeSheet } from '../../galaxy/FocusPanel.js';
import i18n from '../../i18n/index.js';
import { ReportScene } from '../hud/ReportScene.js';
import { AwaySheet } from '../hud/AwaySheet.js';
import { PlanetModelsGallery } from './PlanetModelsGallery.js';
import { WorldProvider } from '../../api/world.js';
import { clanWarSchema } from '../../api/schemas.js';
import { TRADE } from '@astera/rules';
// Development only: the same world the tests draw, so the gallery needs no server.
import { planetView } from '../../../test/fixtures.js';
import type { AirborneItem } from '../../shell/PendingStrip.js';
import type { DockBadges } from '../../lib/dock.js';
import { BellSheet } from '../hud/BellSheet.js';
import { ContextSlot, type ContextSlotProps } from '../hud/ContextSlot.js';
import { FleetPage, type FleetTab } from '../hud/FleetPage.js';
import { Dock } from '../hud/Dock.js';
import { NowLine, type NowLineProps } from '../hud/NowLine.js';
import { TopBar, type TopBarProps } from '../hud/TopBar.js';
import { ViewChip, ViewSheet } from '../hud/ViewSheet.js';
import { ClassEmblem } from '../kit/ClassEmblem.js';
import { ForceRuler } from '../kit/ForceRuler.js';
import { AgeStamp, AgedThumb, ClarityMark } from '../kit/Freshness.js';
import { HoldButton } from '../kit/HoldButton.js';
import { MatchupLine } from '../kit/MatchupLine.js';
import { QueueLane } from '../kit/QueueLane.js';
import { QueueSheet } from '../kit/QueueSheet.js';
import { ResourceMeter } from '../kit/ResourceMeter.js';
import { Segmented } from '../kit/Segmented.js';
import { Sheet } from '../kit/Sheet.js';
import { Api } from '../../api/client.js';
import { ApiProvider } from '../../api/context.js';
import { MenuPanel } from '../../shell/MenuPanel.js';
import { LeaderboardScreen } from '../../screens/LeaderboardScreen.js';
import { SeasonArchiveScreen } from '../../screens/SeasonArchiveScreen.js';
import { CountryPicker } from '../identity/CountryPicker.js';
import { SkinShopContent } from '../../screens/SkinsScreen.js';
import { SkinPreview } from '../../screens/SkinPreview.js';
import { PLANET_SKIN_CATALOG } from '../../ui/skinCatalog.js';
import { PLANET_SKIN_IDS, type PlanetSkinId } from '@astera/rules';

/**
 * THE v2 GALLERY — every kit and HUD piece with fixture data, for the camera.
 * Development only (`v2-gallery.html`); nothing here is imported by the game.
 */

const NOW = Date.now();
const MIN = 60_000;
const at = (minutes: number): Date => new Date(NOW + minutes * MIN);
const PLANET = '/assets/images/planets/planet_9.png';
const noop = (): void => undefined;

const thread = (kind: PendingThread['kind'], minutes: number, extra: Partial<PendingThread> = {}): PendingThread => ({
  kind,
  targetName: 'Kestrel',
  targetPlanetId: 'p-1',
  minutesRemaining: minutes,
  arriveAt: at(minutes),
  ...extra,
});

const cost = { alloy: 2_400, crystal: 600, deuterium: 0 };
const building = (id: string, subject: string, from: number, to: number): BuildOrderView => ({
  id, queue: 'CONSTRUCTION', slot: 0, kind: 'BUILDING', subject, count: 1, startedAt: at(from), finishesAt: at(to), cost,
});
const hull = (id: string, subject: string, from: number, to: number, count: number): BuildOrderView => ({
  id, queue: 'YARD', slot: 0, kind: 'HULL', subject, count, startedAt: at(from), finishesAt: at(to), cost,
});

const construction = [building('c1', 'REFINERY', -30, 12), building('c2', 'VAULT', 12, 95)];
const yard = [hull('y1', 'DART', -4, 5, 12)];

/** The works as the top bar reads them (owner, 2026-09-25): a gallery shape of `collectState`. */
const works = (
  each: { alloy: number; crystal: number; deuterium: number },
  over: { stopped?: ('alloy' | 'crystal' | 'deuterium')[]; noRoom?: ('alloy' | 'crystal' | 'deuterium')[]; ripe?: boolean; blocked?: boolean } = {},
): NonNullable<TopBarProps['works']> => {
  const waiting = each.alloy + each.crystal + each.deuterium;
  const noRoom = over.noRoom ?? [];
  const stopped = over.stopped ?? [];
  return {
    state: {
      waiting,
      ripe: over.ripe ?? waiting > 500,
      full: stopped.length > 0,
      movable: over.blocked ? 0 : waiting,
      blocked: over.blocked ?? false,
      each,
      noRoom,
      stopped,
    },
    fullInMinutes: stopped.length > 0 ? null : 140,
    pending: false,
    onCollect: noop,
    onOpenBase: noop,
  };
};

const topBar: TopBarProps = {
  commander: 'Samet',
  shield: null,
  now: NOW,
  world: null,
  stock: {
    alloy: { value: 12_400, cap: 20_000, safe: 6_000 },
    crystal: { value: 3_105, cap: 8_000, safe: 2_400 },
    deuterium: { value: 860, cap: 4_000, safe: 1_200 },
  },
  works: works({ alloy: 2_200, crystal: 862, deuterium: 40 }),
  bell: { unseen: 0, urgent: false },
  rewards: 0,
  boosted: false,
  onCommander: noop,
  onRewards: noop,
  onWorld: noop,
  onResource: noop,
  onBell: noop,
};

const slotBase: ContextSlotProps = {
  now: NOW,
  selected: false,
  threats: [],
  contacts: [],
  events: [],
  suggestion: null,
  onPrepare: noop,
  onLook: noop,
  onShowEvent: noop,
  onAct: noop,
  onClearSelection: noop,
  dismissed: new Set(),
  onDismiss: noop,
};

const quiet: DockBadges = { base: false, fleet: { airborne: 0, progress: null }, intel: 0, clan: 0 };

/** The Now line with its sheet held here, as the shell holds it in the game. */
function GalleryNow(props: Pick<NowLineProps, 'entries' | 'now'>) {
  const [open, setOpen] = useState(false);
  return <NowLine {...props} open={open} onOpen={() => { setOpen(true); }} onClose={() => { setOpen(false); }} />;
}

const airborne: AirborneItem[] = [
  {
    key: 'in', title: 'Attack → Thistle', detail: 'Heavy mass · 90 craft', arrival: NOW + 6 * MIN,
    incoming: true, engages: false, mark: 'incoming', span: null,
  },
  {
    key: 'raid', title: 'Your fleet → Kestrel', detail: '24 craft', arrival: NOW + 8 * MIN, leg: 'outbound', pace: 0.75,
    incoming: false, engages: true, mark: 'fleet', span: { from: NOW - 5 * MIN, to: NOW + 8 * MIN },
    focus: { kind: 'thread', key: 'raid' }, recallMission: { missionId: 'm-1' },
  },
  {
    key: 'home', title: 'Your fleet home from Hollow', detail: '12 craft', arrival: NOW + 14 * MIN, leg: 'return',
    incoming: false, engages: false, mark: 'fleet', span: { from: NOW - 6 * MIN, to: NOW + 14 * MIN },
    focus: { kind: 'thread', key: 'home' },
  },
  {
    key: 'run', title: 'Prospector → Rock 7', detail: '1 drill', arrival: NOW + 3 * MIN, leg: 'outbound',
    incoming: false, engages: false, mark: 'mining', span: { from: NOW - 2 * MIN, to: NOW + 3 * MIN },
    focus: { kind: 'run', id: 'run-1' }, recall: { runId: 'run-1', originPlanetId: 'p-1' },
  },
];

const rival: GalaxyPlanet = {
  id: 'p2', name: 'Tharsis', owner: 'Sable', position: { x: 120, y: 0, z: 80 }, coreTier: 2, coreLevel: 6,
  intel: 'RESOLVED', state: { kind: 'NORMAL' }, satellites: [], shielded: false, isSelf: false,
};
const launchWorld = planetView(
  { fleet: { DART: 40, TALON: 12, RAMPART: 4, COURIER: 6 }, fleetAway: { DART: 8 } },
  { alloy: 40_000, crystal: 20_000, deuterium: 12_000 },
);
/** The probe the mock's launch is drawn against: the band, the shape and the haul. */
const launchIntel: IntelView = {
  watching: [], radarLog: [], probeCooldowns: [], probeCost: { alloy: 25, crystal: 25, deuterium: 0 },
  probeReports: [{
    targetPlanetId: 'p2', targetName: 'Tharsis', targetUsername: 'Sable', at: new Date(NOW - 2 * 60 * MIN),
    accuracy: 0.8, detected: false, stock: { low: 13_000, high: 17_000 }, deuteriumStock: { low: 1_000, high: 2_000 },
    defence: { low: 2_700, high: 5_300 }, fleetSize: { low: 20, high: 40 }, fleetHome: true,
    classReading: { kind: 'DOMINANT', cls: 'LANCE' },
  }],
};

/** The Fleet page with its tab held here, as the host holds it in the game. */
function GalleryFleet({ first }: { first: FleetTab }) {
  const [tab, setTab] = useState<FleetTab>(first);
  return (
    <FleetPage
      tab={tab}
      onTab={setTab}
      now={NOW}
      bays={{ used: 2, total: 3 }}
      hangar={{ used: 612, total: 810 }}
      flights={airborne}
      worlds={[
        {
          id: 'p-1', name: 'Thistle', capital: true, active: true,
          fleet: { DART: 40, TALON: 12, COURIER: 6, WARDEN: 2 }, away: 36,
          room: roomOf({ hangar: 810, hangarUsed: 612, hangarCeiling: 1550, ground: 60, groundUsed: 48 }),
        },
        {
          id: 'p-2', name: 'Hollow', capital: false, active: false,
          fleet: {}, away: 12,
          room: roomOf({ hangar: 180, hangarUsed: 180, hangarCeiling: 470, ground: 20, groundUsed: 4 }),
        },
      ]}
      recalling={null}
      onFocus={noop}
      onRecall={noop}
      onClose={noop}
    />
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-v2-mono text-micro uppercase tracking-wide text-v2-ink-3">{title}</h2>
      {children}
    </section>
  );
}

const reading = { low: 4_000, high: 9_000, source: 'Probe', ageMinutes: 132 };
const lines = { clears: { low: 20_000, high: 26_000 }, breaks: { low: 31_000, high: 38_000 } };

/**
 * THE INTEL SHEET WITH SOMETHING IN IT. D4. The live commander the camera signs in as
 * has no Telescope and no Radar, so this is where the full shelves are photographed.
 */
function GalleryIntel() {
  const client = useQueryClient();
  useState(() => {
    const watch = (slot: number, target: string, owner: string, reading: Record<string, unknown>) => ({
      observerPlanetId: 'p-1', slot, targetPlanetId: target, targetName: target === 'p-orin' ? 'Orin' : 'Kestrel',
      ownerName: owner, cooldownUntil: null,
      reading: { status: 'HOME', staleMinutes: 0, etaMinutes: null, state: 'FULL', clarity: 1, ...reading },
    });
    const probe = (target: string, name: string, owner: string, hours: number, over: Record<string, unknown> = {}) => ({
      targetPlanetId: target, targetName: name, targetUsername: owner, at: new Date(NOW - hours * 60 * MIN),
      accuracy: 0.82, stock: { low: 18_000, high: 26_000 }, deuteriumStock: null,
      defence: { low: 4_000, high: 7_000 }, fleetSize: { low: 12, high: 20 }, fleetHome: true, detected: false, ...over,
    });
    client.setQueryData(['planet'], planetView({ instruments: { TELESCOPE: 4, RADAR: 4 } }, { id: 'p-1' }));
    client.setQueryData(['galaxy'], { you: { planetId: 'p-1', playerId: 'me' }, planets: [], sensors: [] });
    client.setQueryData(['reports'], { reports: [], rivals: [] });
    client.setQueryData(['intel'], {
      watching: [
        watch(0, 'p-kestrel', 'VEX', {}),
        watch(1, 'p-orin', 'NOVA', { status: 'AWAY', etaMinutes: 72 }),
      ],
      probeReports: [
        probe('p-t206', 'T2-06', 'Neutral', 4),
        probe('p-hollow', 'Hollow-88', 'Rook', 19, { fleetHome: false, accuracy: 0.55, detected: true, stock: { low: 3_000, high: 14_000 } }),
      ],
      probeCooldowns: [],
      radarLog: [
        { at: new Date(NOW - 50 * MIN), planetId: 'p-1', planetName: 'Thistle-131', bearing: 'NW', originPlanetName: 'Kestrel' },
        { at: new Date(NOW - 7 * 60 * MIN), planetId: 'p-1', planetName: 'Hollow', bearing: 'S', originPlanetName: null },
        { at: new Date(NOW - 26 * 60 * MIN), planetId: 'p-1', planetName: 'Thistle-131', bearing: null, originPlanetName: null },
      ],
      probeCost: { alloy: 50, crystal: 50 },
    });
    return null;
  });
  return (
    <Sheet title="Intel" eyebrow="What you know" onClose={noop} detents={['full']} bleed>
      <IntelScreen
        rivals={[
          { planetId: 'p-kestrel', slot: 0, owner: 'VEX', name: 'Kestrel', lost: false },
          { planetId: 'p-vega', slot: 1, owner: 'Vega', name: 'Mira', lost: false },
        ]}
        onFocusRival={noop}
        onOpenDossier={noop}
        onOpenOrbit={noop}
      />
    </Sheet>
  );
}

/**
 * A CLAN FROM THE INSIDE. D5. The camera's commander is clanless, so the member room —
 * the identity card, the seats, the treasury, forces, the crew, aid and the war room —
 * is photographed here.
 */
function GalleryClan({ tab }: { tab: 'overview' | 'strength' | 'members' | 'aid' | 'war' }) {
  const client = useQueryClient();
  useState(() => {
    const ago = (minutes: number) => new Date(NOW - minutes * MIN);
    const person = (playerId: string, username: string, slot: number, active: number, role: 'LEADER' | 'MEMBER' = 'MEMBER') => ({
      playerId, username, role, slot, joinedAt: ago(9000), matureAt: ago(8000), mature: true, aidEnabled: true,
      lastActiveAt: ago(active), activeRecently: active < 30,
    });
    const clan = { id: 'c-nova', name: 'Nova Collective', tag: 'NOVA' };
    client.setQueryData(keys.clanHome, {
      state: 'MEMBER',
      clan: { ...clan, description: 'We send together, we come home together.', recruiting: true, score: 1_240,
        role: 'LEADER', matureAt: ago(8000), mature: true, aidEnabled: true },
      members: [
        person('me', 'Vantage', 0, 0, 'LEADER'), person('mira', 'Mira', 1, 4), person('orin', 'Orin', 2, 12), person('tarn', 'Tarn', 3, 180),
      ],
      requests: [],
    });
    client.setQueryData(keys.clanDepot, {
      resources: { alloy: 12_400, crystal: 3_100, deuterium: 860 },
      purseRemaining: { alloy: 3_100, crystal: 800, deuterium: 200 },
    });
    client.setQueryData(keys.clanLeaderboard, {
      clans: [
        { id: 'c-orb', name: 'Orbital Guild', tag: 'ORB', rank: 1, self: false, score: 2_900, memberCount: 5, level: null, recruiting: false, leaderName: 'Ada', description: '', members: [] },
        { id: 'c-nova', name: 'Nova Collective', tag: 'NOVA', rank: 2, self: true, score: 1_240, memberCount: 4, level: null, recruiting: true, leaderName: 'Vantage', description: '', members: [] },
      ],
    });
    client.setQueryData(keys.clanStrength, {
      clan,
      totals: { clanDominion: 1_240, memberDominion: 41_500, ships: 252, fleetValue: 128_000, groundDefences: 46, worlds: 7, activeFlights: 3 },
      composition: [{ hull: 'DART', count: 142 }, { hull: 'PIKE', count: 60 }, { hull: 'RAMPART', count: 38 }, { hull: 'COURIER', count: 12 }],
      members: [
        { playerId: 'me', username: 'Vantage', role: 'LEADER', dominion: 14_200, ships: 90, worlds: 2 },
        { playerId: 'mira', username: 'Mira', role: 'MEMBER', dominion: 11_800, ships: 70, worlds: 2 },
        { playerId: 'orin', username: 'Orin', role: 'MEMBER', dominion: 9_100, ships: 52, worlds: 2 },
        { playerId: 'tarn', username: 'Tarn', role: 'MEMBER', dominion: 6_400, ships: 40, worlds: 1 },
      ],
    });
    client.setQueryData(keys.leaderboard, { ladder: [], you: null });
    client.setQueryData(keys.clanEvents, { pages: [{ events: [], nextBefore: null }], pageParams: [null] });
    client.setQueryData(keys.clanAid, { transfers: [] });
    // Two worlds of the commander's own, so the wave page has a world to send from and a choice.
    client.setQueryData(keys.planets, {
      playerId: 'me', seasonId: 's-gallery', capitalPlanetId: launchWorld.planet.id,
      planets: [launchWorld, planetView({ fleet: { DART: 12, PIKE: 4 } }, { id: 'p-hollow', name: 'Hollow', alloy: 3_400, crystal: 1_200, deuterium: 600 })],
    });
    // The war room (E9): an operation assembling on a rival, three waves in, one staged.
    const wave = (id: string, playerId: string, username: string, status: 'OUTBOUND' | 'STAGED', hulls: Record<string, number>, minutes: number, mine = false) => ({
      id, playerId, username, originPlanetId: `o-${id}`, originPlanetName: `${username}'s world`, sourceKind: 'PHYSICAL',
      status, fleet: hulls, bulk: Object.values(hulls).reduce((a, b) => a + b, 0), fuelPaid: 40,
      sentAt: ago(minutes).toISOString(), arrivesAt: status === 'OUTBOUND' ? new Date(NOW + 40 * MIN).toISOString() : null,
      mine, canRecall: mine,
    });
    client.setQueryData(keys.clanWar, clanWarSchema.parse({
      available: true, level: 3, maxLevel: false,
      treasury: { alloy: 18_000, crystal: 6_000, deuterium: 900 },
      nextCost: { alloy: 30_000, crystal: 10_000, deuterium: 1_500 },
      room: { alloy: 40_000, crystal: 12_000, deuterium: 2_000 }, canUpgrade: false,
      hangar: { used: 184, reserved: 12, total: 360 },
      serverNow: new Date(NOW).toISOString(),
      operation: {
        id: 'op', status: 'ASSEMBLING', closeReason: null, leaderPlayerId: 'me',
        target: { playerId: 'vex', username: 'VEX', planetId: 'p-kestrel', planetName: 'Kestrel', position: { x: 40, y: 0, z: 30 } },
        staging: { planetId: 'p-mira', name: 'Mira', position: { x: 0, y: 0, z: 0 } },
        createdAt: ago(60).toISOString(), expiresAt: new Date(NOW + 23 * 60 * MIN + 48 * MIN).toISOString(),
        startedAt: null, resolvedAt: null, completedAt: null,
        contributions: [
          wave('w1', 'mira', 'Mira', 'STAGED', { RAMPART: 38 }, 50),
          wave('w2', 'orin', 'Orin', 'OUTBOUND', { DART: 22 }, 10),
          wave('w3', 'me', 'Vantage', 'OUTBOUND', { DART: 30, PIKE: 8 }, 5, true),
        ],
        pool: { combatHulls: 98, waves: 3, participants: 3 },
      },
    }));
    client.setQueryData(keys.galaxy, { you: { planetId: 'p-1', playerId: 'me' }, planets: [], sensors: [] });
    return null;
  });
  return (
    <Sheet title="Clan" eyebrow="Seasonal clans" onClose={noop} detents={['full']} bleed>
      <WorldProvider>
        <ClanScreen initialTab={tab} onOpenClanChat={noop} />
      </WorldProvider>
    </Sheet>
  );
}

/** The commander surface and live ladder, staged together so their v2 density can be inspected. */
const ARCHIVE_ID = '11111111-1111-4111-8111-111111111111';

function GalleryCommander({ page }: { page: 'menu' | 'leaderboard' | 'leaderboard-archive' }) {
  const [client] = useState(() => {
    const next = new QueryClient();
    next.setQueryData(keys.rewards, { chains: [], claimable: 2 });
    next.setQueryData(keys.announcements, { announcements: [] });
    next.setQueryData(keys.leaderboard, {
      ladder: Array.from({ length: 8 }, (_, index) => ({
        rank: index + 1, playerId: `gallery-${index}`, username: index === 0 ? 'Samet' : `Commander ${index + 1}`,
        country: index % 2 === 0 ? 'TR' : 'DE', planetId: `gallery-planet-${index}`, planetName: `World ${index + 1}`,
        coreTier: (index % 4) + 1, score: 420 - index * 37, clan: index === 1 ? { id: 'c1', name: 'Nova', tag: 'NOVA' } : null,
      })),
      you: { rank: 1, playerId: 'gallery-0', username: 'Samet', country: 'TR', planetId: 'gallery-planet-0', planetName: 'World 1', coreTier: 1, score: 420, clan: null, isBot: false },
    });
    if (page === 'leaderboard-archive') {
      next.setQueryData(keys.season, {
        seasonId: ARCHIVE_ID,
        shard: 'EU-1',
        shardName: 'Vantage',
        seed: 11,
        status: 'frozen',
        startsAt: new Date(NOW - 14 * 24 * 60 * MIN),
        endsAt: new Date(NOW - 24 * 60 * MIN),
        playerCap: 1_000,
        players: 188,
        rivals: [],
        shieldUntil: null,
        shieldKind: null,
      });
      next.setQueryData(keys.seasonArchive, {
        pages: [{
          cycles: [{
            ordinal: 11,
            startsAt: new Date(NOW - 14 * 24 * 60 * MIN),
            endsAt: new Date(NOW - 24 * 60 * MIN),
            status: 'frozen',
            galaxies: [{ seasonId: ARCHIVE_ID, shard: 'EU-1', shardName: 'Vantage', status: 'frozen' }],
          }],
          nextCursor: null,
        }],
        pageParams: [undefined],
      });
      next.setQueryData(keys.archivedLeaderboard(ARCHIVE_ID), {
        season: {
          seasonId: ARCHIVE_ID,
          ordinal: 11,
          shard: 'EU-1',
          shardName: 'Vantage',
          status: 'frozen',
          startsAt: new Date(NOW - 14 * 24 * 60 * MIN),
          endsAt: new Date(NOW - 24 * 60 * MIN),
          closedAt: new Date(NOW - 24 * 60 * MIN),
          endReason: 'SCHEDULED_END',
        },
        record: null,
        ladder: Array.from({ length: 8 }, (_, index) => ({
          resultId: `22222222-2222-4222-8222-${String(index + 1).padStart(12, '0')}`,
          rank: index + 1,
          commanderName: index === 0 ? 'Samet' : `Commander ${index + 1}`,
          country: index % 2 === 0 ? 'TR' : 'DE',
          dominion: 420 - index * 37,
          title: index === 0 ? 'The Cartographer' : 'Frontier Hand',
          self: index === 0,
          reward: null,
        })),
      });
    }
    return next;
  });
  const [api] = useState(() => new Api());
  return (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        {page === 'menu' ? (
          <Sheet title="Commander" eyebrow="Your account" onClose={noop} detents={['full']} bleed>
            <div className="p-3">
              <MenuPanel galaxy="Vantage" shard="EU-1" endsAt={new Date(NOW + 11 * 60 * MIN)} country="TR" onOpen={noop} onSignOut={noop} />
            </div>
          </Sheet>
        ) : page === 'leaderboard' ? (
          <Sheet title="Dominion" eyebrow="Season ladder" onClose={noop} detents={['full']} bleed>
            <LeaderboardScreen onFocusPlanet={noop} />
          </Sheet>
        ) : (
          <Sheet title="Dominion" eyebrow="Season archive" onClose={noop} detents={['full']} bleed>
            <SeasonArchiveScreen onFocusPlanet={noop} initialSeasonId={ARCHIVE_ID} />
          </Sheet>
        )}
      </ApiProvider>
    </QueryClientProvider>
  );
}

function GalleryCountryPicker() {
  return <CountryPicker value="TR" onSelect={noop} onClose={noop} />;
}

function Views({ view }: { view: string }) {
  if (view === 'intel') return <GalleryIntel />;
  if (view === 'clan') return <GalleryClan tab="overview" />;
  if (view === 'clan-strength') return <GalleryClan tab="strength" />;
  if (view === 'clan-members') return <GalleryClan tab="members" />;
  if (view === 'clan-aid') return <GalleryClan tab="aid" />;
  if (view === 'clan-war') return <GalleryClan tab="war" />;
  if (view === 'menu') return <GalleryCommander page="menu" />;
  if (view === 'leaderboard') return <GalleryCommander page="leaderboard" />;
  if (view === 'leaderboard-archive') return <GalleryCommander page="leaderboard-archive" />;
  if (view === 'country-picker') return <GalleryCountryPicker />;
  if (view === 'skin-shop') {
    return <SkinShopContent collection={{ ownedSkinIds: [], planets: [] }} commander="Samet" onOpenInventory={noop} />;
  }
  if (view === 'queue') {
    return <QueueSheet queues={{ CONSTRUCTION: construction, YARD: yard }} now={NOW} onCancel={noop} onClose={noop} />;
  }
  if (view === 'bell') {
    return (
      <BellSheet
        tab="signals"
        onTab={noop}
        onClose={noop}
        unseen={2}
        signals={<p className="text-caption text-v2-ink-2">Signal rows draw here (SignalsFeed).</p>}
        chronicle={null}
      />
    );
  }
  if (view === 'view') {
    return (
      <ViewSheet
        shard="EU-1"
        telescope
        onToggleTelescope={noop}
        radar={false}
        onToggleRadar={noop}
        onOpenEvents={noop}
        onClose={noop}
      />
    );
  }
  if (view === 'launch' || view === 'launch-pirate') {
    return (
      <LaunchSheet
        planet={launchWorld}
        {...(view === 'launch' ? { intel: launchIntel } : {})}
        target={view === 'launch'
          ? { kind: 'world', world: rival }
          : { kind: 'pirate', pirate: {
              id: 'pirate-1', callsign: 'VEX7', zone: 'IDENTIFIED', at: { x: 400, y: 0, z: 0 },
              expiresInMinutes: 180, reachMinutes: 12,
              reach: [{ hull: 'DART', minutes: 12, distance: 900, at: { x: 900, y: 0, z: 0 } }],
              level: 2, fleet: { VIPER: 3, COURIER: 1 }, damageMult: 0.65, mass: 'MEDIUM' } }}
        onClose={noop}
        onLaunched={noop}
      />
    );
  }
  if (view === 'transfer') {
    return (
      <TransferSheet
        target={{ id: 'p-9', name: 'Hollow', position: { x: 600, y: 0, z: 200 } }}
        planet={launchWorld}
        onClose={noop}
        onLaunched={noop}
      />
    );
  }
  if (view === 'convoy') {
    return (
      <IntergalacticConvoySheet
        event={{
          id: '2f0a2e0e-6e64-4b1e-9c0e-3b3a5f6f4d11', kind: 'INTERGALACTIC_CONVOY',
          startsAt: new Date(NOW - 10 * MIN), endsAt: new Date(NOW + 110 * MIN),
          appearsAtMinute: 1140, expiresAtMinute: 1260,
          route: { from: { x: -2000, y: 0, z: 0 }, to: { x: 2000, y: 0, z: 0 }, velocity: { x: 100 / 3, y: 0, z: 0 }, speed: 100 / 3 },
          visual: { formationVersion: 1 },
          rewardPolicy: { resourceCapHours: 4, fullRewardForceRatio: 1, shipDropFullFirepower: 5780, shipDropChanceAtFullQuality: 0.15, maxAwardedShips: 3 },
        }}
        seasonStart={new Date(NOW - 1150 * MIN)}
        planet={launchWorld}
        onClose={noop}
        onLaunched={noop}
      />
    );
  }
  if (view === 'planet-models') return <PlanetModelsGallery />;
  if (view === 'away') {
    // The mock's return story: a raid held, a convoy home, a Telescope opening, a world to repair.
    return (
      <AwaySheet
        story={{
          awayMinutes: 432,
          asOf: new Date(NOW),
          entries: [
            { kind: 'raided', params: { grade: 'REPELLED', loot: 0, lost: 3 }, at: new Date(NOW - 90 * MIN) },
            { kind: 'fleet_returned', params: { ships: 6, resources: 5_300 }, at: new Date(NOW - 40 * MIN) },
            { kind: 'scan_detected', params: { count: 2 }, at: new Date(NOW - 20 * MIN) },
          ],
          pending: [],
          newUnlocks: [],
        }}
        sightings={[{ planetId: 'p-orin', planetName: 'Orin', owner: 'NOVA', etaMinutes: 72 }]}
        care={{ planetId: 'p-88', name: 'Thistle-88', faults: 2, loyalty: 50 }}
        onDoor={noop}
        onAll={noop}
        onDismiss={noop}
      />
    );
  }
  if (view === 'report') {
    return (
      <Sheet title={i18n.t('reports.verdict.title.attacking.PARTIAL')} quietTitle onClose={noop} detents={['full']}>
        <ReportScene
          word={i18n.t('reports.verdict.title.attacking.PARTIAL')}
          colonyTarget
          rivalSlot={0}
          onAttackAgain={noop}
          onWatch={noop}
          onShare={noop}
          report={{
            id: 'b1', missionId: 'm1', at: new Date(NOW - 20 * MIN), grade: 'PARTIAL', attacking: true,
            opponentName: 'VEX', opponentPlanet: 'Kestrel', opponentPlanetId: 'p-kestrel', neutral: false, yourPlanet: 'Bellwether',
            rounds: [
              { round: 1, attackerDamage: 800, defenderDamage: 300, shieldAbsorbed: 0, shieldBreakerDamage: 0, attackerLosses: { DART: 6 }, defenderLosses: { PIKE: 10 } },
              { round: 2, attackerDamage: 640, defenderDamage: 120, shieldAbsorbed: 0, shieldBreakerDamage: 0, attackerLosses: { DART: 3, TALON: 1 }, defenderLosses: { PIKE: 8, RAMPART: 8 } },
              { round: 3, attackerDamage: 90, defenderDamage: 40, shieldAbsorbed: 0, shieldBreakerDamage: 0, attackerLosses: {}, defenderLosses: { BASTION: 2 } },
            ],
            yourLosses: { DART: 9, TALON: 1 },
            theirLosses: { PIKE: 18, RAMPART: 8, BASTION: 2 },
            yourFleet: { DART: 23, TALON: 19, RAMPART: 10, COURIER: 8 },
            theirFleet: {},
            lootAlloy: 3_100, lootCrystal: 1_000, lootDeuterium: 240,
            dominion: 120, dominionBreakdown: null, shieldAbsorbed: 0, cargoLimited: true,
            defenceSalvage: {}, disruptedMinutes: 0, wreckValue: 0, fuelPaid: 320,
          }}
        />
      </Sheet>
    );
  }
  if (view === 'strike') {
    return <StrikeSheet target={rival} onConfirm={noop} onClose={noop} />;
  }
  if (view === 'wave') {
    const war = clanWarSchema.parse({
      available: true, level: 2, maxLevel: false,
      treasury: { alloy: 1200, crystal: 800, deuterium: 90 },
      nextCost: { alloy: 4000, crystal: 3000, deuterium: 300 },
      room: { alloy: 2800, crystal: 2200, deuterium: 210 }, canUpgrade: false,
      hangar: { used: 184, reserved: 40, total: 360 },
      serverNow: new Date(NOW).toISOString(),
      operation: {
        id: 'op', status: 'ASSEMBLING', closeReason: null, leaderPlayerId: 'leader',
        target: { playerId: 'enemy', username: 'VEX', planetId: 'target', planetName: 'Kestrel', position: { x: 1, y: 2, z: 3 } },
        staging: { planetId: 'home', name: 'Mira', position: { x: 0, y: 0, z: 0 } },
        createdAt: new Date(NOW - 60 * MIN).toISOString(), expiresAt: new Date(NOW + 23 * 60 * MIN).toISOString(),
        startedAt: null, resolvedAt: null, completedAt: null,
        contributions: [{ id: 'w1', playerId: 'p1', username: 'Orin', originPlanetId: 'o1', originPlanetName: 'Orin', sourceKind: 'PHYSICAL',
          status: 'STAGED', fleet: { DART: 22 }, bulk: 22, fuelPaid: 40, sentAt: new Date(NOW - 30 * MIN).toISOString(), arrivesAt: null, mine: false, canRecall: false }],
        pool: { combatHulls: 22, waves: 1, participants: 1 },
      },
    });
    return <div className="mx-auto max-w-[420px] p-3"><ClanWarPanel war={war} role="MEMBER" mature worlds={[launchWorld]} /></div>;
  }
  if (view === 'trade') {
    return (
      <TradeSheet
        merchant={{
          id: '2f0a2e0e-6e64-4b1e-9c0e-3b3a5f6f4d11', kind: 'TRADE_SHIP',
          startsAt: new Date(NOW - 30 * MIN), endsAt: new Date(NOW + 150 * MIN),
          rate: TRADE.rate, appearsAtMinute: 570, expiresAtMinute: 750,
          orbit: { radius: 1_100, period: (2 * Math.PI * 1_100) / TRADE.speed, phase: 0.7, inclination: 0.4, ascendingNode: 1.9, speed: TRADE.speed },
        }}
        seasonStart={new Date(NOW - 600 * MIN)}
        planet={planetView({ fleet: { ATLAS: 12, COURIER: 3, DART: 4 } }, { alloy: 5_000, crystal: 5_000, deuterium: 5_000 })}
        onClose={noop}
        onLaunched={noop}
      />
    );
  }
  if (view === 'settlement') {
    return (
      <SettlementSheet
        target={{ ...rival, kind: 'NEUTRAL', owner: '', name: 'Neutral T1-50',
          neutral: { tier: 1, claimUntil: new Date(NOW + 42 * MIN) } } satisfies GalaxyPlanet}
        planet={launchWorld}
        now={NOW}
        pending={false}
        onClose={noop}
        onConfirm={noop}
      />
    );
  }
  if (view === 'fleet' || view === 'fleet-home' || view === 'fleet-room') {
    return <GalleryFleet first={view === 'fleet-home' ? 'home' : view === 'fleet-room' ? 'room' : 'air'} />;
  }
  if (view === 'peek') {
    return (
      <Sheet title="Kestrel" eyebrow="VEX · rival" onClose={noop} detents={['peek', 'half', 'full']}>
        <p className="text-caption text-v2-ink-2">The context card sits here at peek; the galaxy stays undimmed.</p>
      </Sheet>
    );
  }
  return null;
}

export function Gallery({ view }: { view: string | null }) {
  if (view?.startsWith('skin-card:')) {
    const skinId = view.slice('skin-card:'.length);
    if (!PLANET_SKIN_IDS.includes(skinId as PlanetSkinId)) return null;
    const look = PLANET_SKIN_CATALOG[skinId as PlanetSkinId];
    return (
      <div data-skin-card className="relative h-[320px] w-[400px] overflow-hidden bg-v2-deep" style={{ '--look': look.accent, '--look-glow': look.glow } as CSSProperties}>
        <div aria-hidden className="v2-store-aura absolute inset-[3%] rounded-full" />
        <SkinPreview skinId={skinId} status="NORMAL" className="h-[320px]"
          {...(new URLSearchParams(window.location.search).has('offset')
            ? { phaseOffset: Number(new URLSearchParams(window.location.search).get('offset')) }
            : {})} />
      </div>
    );
  }
  if (view) {
    return (
      <div className="min-h-dvh bg-v2-void">
        <TopBar {...topBar} />
        <Views view={view} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col gap-5 bg-v2-void pb-10 text-v2-ink">
      <Section title="B1 · top bar">
        <TopBar {...topBar} />
        <TopBar {...topBar} works={works({ alloy: 60, crystal: 12, deuterium: 0 }, { ripe: false })} />
        <TopBar {...topBar} works={works({ alloy: 0, crystal: 0, deuterium: 0 }, { ripe: false })} />
        <TopBar
          {...topBar}
          shield={{ until: NOW + 7 * 60 * MIN, kind: 'RECOVERY' }}
          world={{ capital: false, name: 'Hollow' }}
          stock={{ ...topBar.stock, alloy: { value: 20_000, cap: 20_000, safe: 6_000 }, crystal: { value: 184_000, cap: 250_000, safe: 60_000 } }}
          works={works({ alloy: 4_000, crystal: 9_000, deuterium: 0 }, { stopped: ['crystal'], noRoom: ['alloy'] })}
          bell={{ unseen: 12, urgent: true }}
          rewards={2}
          boosted
        />
      </Section>

      <Section title="B2 · now line">
        <GalleryNow entries={nowEntries({ now: NOW, threads: [thread('incoming', 4.2), thread('transfer', 9)], runs: [], builds: [], research: [], events: [], shieldUntil: null })} now={NOW} />
        <GalleryNow entries={nowEntries({ now: NOW, threads: [thread('fleet', 18, { leg: 'outbound', fleet: { DART: 12 } })], runs: [], builds: construction, research: [], events: [], shieldUntil: null })} now={NOW} />
      </Section>

      <div className="flex flex-col gap-5 px-3">
        <Section title="B12 · queue lanes">
          <QueueLane label="Construction" orders={construction} now={NOW} onOpen={noop} />
          <QueueLane label="Yard" orders={yard} now={NOW} onOpen={noop} />
        </Section>

        <Section title="B5 · force ruler + B6 matchup">
          <ForceRuler
            yours={30_000}
            theirs={reading}
            lines={lines}
            loss={{ low: 0.35, high: 0.6 }}
            escape={{ at: 10_000, verdict: 'RUN' }}
          >
            <MatchupLine wing={{ DART: 40 }} reading={{ kind: 'DOMINANT', cls: 'LANCE' }} />
          </ForceRuler>
          <ForceRuler yours={30_000} theirs={null} lines={lines} onProbe={noop} />
        </Section>

        <Section title="B6 · matchup readings">
          <MatchupLine wing={{}} reading={{ kind: 'SHARES', shares: { LANCE: 60, BULWARK: 30, SKIRMISHER: 10 } }} />
          <MatchupLine wing={{}} reading={{ kind: 'EVEN' }} />
          <MatchupLine wing={{}} reading={{ kind: 'UNREAD' }} />
        </Section>

        <Section title="B7 · clarity and age">
          <div className="flex flex-wrap gap-3">
            {(['FULL', 'CLEAR', 'INTERMITTENT', 'DEGRADED', 'BLIND'] as const).map((state) => (
              <ClarityMark key={state} state={state} />
            ))}
          </div>
          <div className="flex items-end gap-3">
            {[5, 120, 600, 3_000].map((minutes) => (
              <div key={minutes} className="flex flex-col items-center gap-1">
                <AgedThumb src={PLANET} alt="Kestrel" ageMinutes={minutes} className="size-14" />
                <AgeStamp minutes={minutes} />
              </div>
            ))}
            <div className="flex flex-col items-center gap-1">
              <AgedThumb src={PLANET} alt="Hollow" clarity="BLIND" className="size-14" />
              <ClarityMark state="BLIND" />
            </div>
          </div>
        </Section>

        <Section title="B8 · class emblems · B9 hold">
          <div className="flex items-center gap-3 text-v2-ink-2">
            {(['SKIRMISHER', 'BULWARK', 'LANCE', 'SUPPORT'] as const).map((cls) => (
              <ClassEmblem key={cls} cls={cls} className="size-5" />
            ))}
          </div>
          <HoldButton label="Launch 74 ships" onCommit={noop} />
          <HoldButton label="Fire the Death Star" onCommit={noop} tone="hostile" />
          <HoldButton label="Launch" onCommit={noop} disabledReason="Not enough Deuterium: 240 short" />
        </Section>

        <Section title="resource meter · segmented">
          <div className="grid grid-cols-3 gap-2">
            <ResourceMeter resource="alloy" value={12_400} cap={20_000} safe={6_000} />
            <ResourceMeter resource="crystal" value={8_000} cap={8_000} safe={2_400} />
            <ResourceMeter resource="deuterium" value={0} cap={0} />
          </div>
          <Segmented
            label="Bell"
            value="signals"
            onChange={noop}
            options={[
              { id: 'signals', label: 'Signals' },
              { id: 'chronicle', label: 'Chronicle' },
              { id: 'chat', label: 'Chat', dot: true, dotLabel: '4 unread' },
            ]}
          />
        </Section>
      </div>

      <Section title="B3 · context slot">
        <div className="relative h-36">
          <ContextSlot {...slotBase} threats={[thread('incoming', 9)]} />
        </div>
        <div className="relative h-32">
          <ContextSlot
            {...slotBase}
            events={[{ id: 'e1', kind: 'ASTEROID_SHOWER', startsAt: at(-60), endsAt: at(30), asteroidSpawnMultiplier: 2 }]}
          />
        </div>
        <div className="relative h-36">
          <ContextSlot
            {...slotBase}
            suggestion={{
              id: 'undefended',
              kind: 'growth',
              title: 'Your shield ends in 3h 00m: build a ground defence',
              detail: '456 is exposed to raids. Build Thorns or Bastions for permanent defence.',
              action: { label: 'Build defence', screen: 'planet', group: 'defend' },
              weight: 820,
            }}
          />
        </div>
        <div className="relative h-12">
          <ContextSlot {...slotBase} selected threats={[thread('incoming', 9), thread('incoming', 20)]} />
        </div>
      </Section>

      <Section title="view chip">
        <div className="flex gap-2 px-3">
          <ViewChip layersOn onOpen={noop} />
          <ViewChip layersOn={false} onOpen={noop} />
        </div>
      </Section>

      <Section title="B4 · dock">
        <Dock active="galaxy" badges={quiet} onSelect={noop} />
        <Dock active="fleet" badges={{ base: true, fleet: { airborne: 3, progress: 0.4 }, intel: 2, clan: 12 }} onSelect={noop} />
      </Section>
    </div>
  );
}
