import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Api } from '../../api/client.js';
import { ApiProvider } from '../../api/context.js';
import {
  clanSupportWaveSchema,
  clanWarSchema,
  planetSchema,
  reportsSchema,
  type GalaxyPlanet,
  type IntelView,
  type PlanetView,
} from '../../api/schemas.js';
import { PlanetFocus } from '../../galaxy/FocusPanel.js';
import { BattleReports } from '../../screens/BattleReports.js';
import { ClanSupportBay, DefencePostureCard } from '../../screens/ClanSupportBay.js';
import { ClanSupportSheet } from '../../screens/ClanSupportSheet.js';
import { ClanBanner } from '../../screens/ClanBanner.js';
import { ChatScreen } from '../../screens/ChatScreen.js';
import { keys } from '../../api/keys.js';
import { COMMUNITY_POLICY_VERSION, clanLevelUpgradeCost } from '@astera/rules';
import { LaunchSheet } from '../../screens/LaunchSheet.js';
import { EscapeReadout } from '../../ui/EscapeReadout.js';
import { sumFleets } from '../../lib/fleetPage.js';
import { planetView } from '../../../test/fixtures.js';
import { FleetPage, type FleetTab } from '../hud/FleetPage.js';
import { Sheet } from '../kit/Sheet.js';

/**
 * KLAN SAVUNMA DESTEĞİ IN THE GALLERY (`docs/clan-defense-support-plan.md`, P12): every
 * surface the feature added, drawn with fixture data so the camera can photograph it at
 * 350 px — the Hangar's posture card and support bay, the Defend tab's retreat line, the
 * send sheet (its quote answered by a stub), the Fleet page group, the defending line in
 * a report, and a supported world as the raider's Focus and launch read it.
 *
 * Development only (`v2-gallery.html`); nothing here is imported by the game.
 */

const NOW = Date.now();
const MIN = 60_000;
const noop = (): void => undefined;
const iso = (offsetMinutes: number): string => new Date(NOW + offsetMinutes * MIN).toISOString();

const wave = (over: Record<string, unknown>) => clanSupportWaveSchema.parse({
  id: 'w-1', status: 'STATIONED',
  sender: { playerId: 'mira', name: 'Mira' }, host: { playerId: 'me', name: 'Vantage' },
  originPlanetId: 'p-mira', hostPlanetId: 'p-1', hostPlanetName: 'Thistle',
  fleet: { PIKE: 24, RAMPART: 6 }, bulk: 132, damaged: false,
  sentAt: iso(-90), arriveAt: iso(-70), stationedAt: iso(-70), expiresAt: iso(10 * 60 + 50),
  returnAt: null, returnReason: null, outOfBand: false, battles: 0,
  ...over,
});

const hostWaves = [
  wave({}),
  wave({ id: 'w-2', sender: { playerId: 'orin', name: 'Orin' }, fleet: { DART: 30 }, bulk: 60, damaged: true,
    outOfBand: true, expiresAt: iso(3 * 60 + 5) }),
  wave({ id: 'w-3', status: 'OUTBOUND', sender: { playerId: 'tarn', name: 'Tarn' }, fleet: { TALON: 10 }, bulk: 40,
    stationedAt: null, expiresAt: null, sentAt: iso(-4), arriveAt: iso(12) }),
];

type Stance = 'ESCAPE' | 'SUPPORT' | 'HOLD' | 'ESCAPE_SUPPORT';

const ALARM_ID = '00000000-0000-4000-8000-0000000000a1';

function hangarWorld(posture: Stance, locked: boolean, alarm = false): PlanetView {
  const base = planetView({
    buildings: { CORE: 6, REFINERY: 5, EXTRACTOR: 5, VAULT: 2, SHIPYARD: 4, HANGAR: 6 },
    fleet: { DART: 40, TALON: 12, RAMPART: 4 },
  });
  const support = posture === 'SUPPORT' || posture === 'ESCAPE_SUPPORT';
  const escape = posture === 'ESCAPE' || posture === 'ESCAPE_SUPPORT';
  const waves = support ? (alarm ? [...hostWaves, wave({ id: 'w-4', status: 'OUTBOUND', sender: { playerId: 'sable', name: 'Sable' },
    fleet: { PIKE: 18 }, bulk: 72, stationedAt: null, expiresAt: null, sentAt: iso(-2), arriveAt: iso(9), alarmId: ALARM_ID })] : hostWaves) : [];
  return planetSchema.parse(JSON.parse(JSON.stringify({
    ...base,
    rulesetVersion: 15,
    defencePosture: { posture: posture === 'ESCAPE_SUPPORT' ? 'ESCAPE' : posture, stance: posture, escape, support,
      supportLocked: locked ? 'NOT_IN_CLAN' : null },
    clanSupport: { room: { used: 192, reserved: 40, total: 470 }, waves,
      ...(alarm ? { alarms: [{ id: ALARM_ID, missionId: 'm-raid', arriveAt: iso(13), called: 4, seen: 3, answered: 1 }] } : {}) },
  })));
}

function Hangar({ posture, locked = false, alarm = false }: { posture: Stance; locked?: boolean; alarm?: boolean }) {
  const world = hangarWorld(posture, locked, alarm);
  return (
    <div className="mx-auto flex max-w-[440px] flex-col gap-3 p-3">
      <DefencePostureCard planet={world} />
      <ClanSupportBay planet={world} />
      <EscapeReadout fleet={world.fleet} ground={world.ground} deuterium={world.planet.deuterium}
        rulesetVersion={15} posture={posture}
        support={sumFleets(...(world.clanSupport?.waves ?? []).filter((row) => row.status === 'STATIONED').map((row) => row.fleet))} />
    </div>
  );
}

/** The send sheet against a stub that prices every route the same. */
function SendSheet({ alarm = false }: { alarm?: boolean }) {
  const [api] = useState(() => new Api({
    fetch: () => Promise.resolve(new Response(JSON.stringify({
      refusals: [], arriveAt: iso(18), travelMinutes: 18, returnMinutes: 18, fuel: 412,
      bays: { used: 2, total: 5 }, hostRoom: { used: 192, reserved: 40, total: 470, after: 312 },
      band: { ok: true, mine: 3, theirs: 3 }, stationUntil: iso(12 * 60 + 18), seasonClipped: false,
      personalHangar: { used: 612, total: 810 }, senderShieldUntil: null,
    }), { status: 200, headers: { 'content-type': 'application/json' } })),
  }));
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const origin = planetView({ fleet: { PIKE: 40, DART: 60, RAMPART: 8, COURIER: 6 } }, { deuterium: 12_000 });
  return (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <ClanSupportSheet host={{ planetId: 'p-mira', planetName: 'Kestrel', ownerName: 'Mira',
          ...(alarm ? { alarm: { id: ALARM_ID, arriveAt: new Date(NOW + 22 * MIN) } } : {}) }}
          worlds={[origin]} onClose={noop} onSent={noop} />
      </ApiProvider>
    </QueryClientProvider>
  );
}

function Fleet() {
  const [tab, setTab] = useState<FleetTab>('air');
  const mine = (over: Record<string, unknown>) => wave({ sender: { playerId: 'me', name: 'Vantage' },
    host: { playerId: 'mira', name: 'Mira' }, hostPlanetId: 'p-mira', hostPlanetName: 'Kestrel', ...over });
  return (
    <FleetPage tab={tab} onTab={setTab} now={NOW} bays={{ used: 3, total: 5 }} hangar={{ used: 612, total: 810 }}
      flights={[]} worlds={[]} recalling={null} onFocus={noop} onRecall={noop} onOpenRepairStation={noop} onFocusWorld={noop} onClose={noop}
      support={{
        recalling: null,
        onRecall: noop,
        waves: [
          mine({}),
          mine({ id: 'w-out', status: 'OUTBOUND', stationedAt: null, expiresAt: null, sentAt: iso(-6), arriveAt: iso(9),
            hostPlanetName: 'Vega', host: { playerId: 'orin', name: 'Orin' } }),
          mine({ id: 'w-home', status: 'RETURNING', returnReason: 'SENT_BACK', returnAt: iso(22), hostPlanetName: 'Altair' }),
        ],
      }}
    />
  );
}

/** A defence the reader's clanmate stood in, opened on the report sheet — as the host, or the supporter. */
function Report({ supporter = false }: { supporter?: boolean }) {
  const client = useQueryClient();
  useState(() => {
    client.setQueryData(['reports'], reportsSchema.parse({
      rivals: [],
      reports: [{
        kind: 'BATTLE', id: 'r-sup', missionId: 'm-sup', at: iso(-12), grade: 'PARTIAL',
        rounds: [], attacking: false, opponentName: 'VEX', opponentPlanet: 'Kestrel', opponentPlanetId: 'p-vex',
        yourPlanet: supporter ? '' : 'Thistle', yourPlanetId: supporter ? null : 'p-1', neutral: false,
        ...(supporter ? { supportedAt: { planetId: 'p-1', planetName: 'Thistle', hostName: 'Vantage' } } : {}),
        yourLosses: { DART: 14 }, theirLosses: { DART: 22, TALON: 6 }, yourFleet: { DART: 40, TALON: 12 },
        theirFleet: { DART: 60, TALON: 20 }, lootAlloy: -1_200, lootCrystal: -400, lootDeuterium: 0, dominion: -84,
        shieldAbsorbed: 0, cargoLimited: false, defenceSalvage: {},
        defenseLine: {
          defenderCount: 3,
          dominionFactor: 1.8,
          members: [
            { playerId: 'me', name: 'Vantage', role: 'HOST', losses: { DART: 14 }, sent: { DART: 40, TALON: 12 },
              survivors: { DART: 26, TALON: 12 }, dominion: -84 },
            { playerId: 'mira', name: 'Mira', role: 'SUPPORT', losses: { PIKE: 9 }, sent: { PIKE: 24, RAMPART: 6 },
              survivors: { PIKE: 15, RAMPART: 6 }, dominion: 0 },
            { playerId: 'orin', name: 'Orin', role: 'SUPPORT', losses: { DART: 30 }, sent: { DART: 30 },
              survivors: {}, dominion: 0 },
          ],
        },
      }],
    }));
    return null;
  });
  return <BattleReports open={{ missionId: 'm-sup', request: 1 }} />;
}

/** A clanmate-supported rival, as the raider's probe read it. */
const supported: GalaxyPlanet = {
  id: 'p2', name: 'Tharsis', owner: 'Sable', position: { x: 120, y: 0, z: 80 }, coreTier: 2, coreLevel: 6,
  intel: 'RESOLVED', state: { kind: 'NORMAL' }, satellites: [], shielded: false, isSelf: false,
};
const supportedIntel: IntelView = {
  watching: [], radarLog: [], probeCooldowns: [], probeCost: { alloy: 25, crystal: 25, deuterium: 0 },
  probeReports: [{
    targetPlanetId: 'p2', targetName: 'Tharsis', targetUsername: 'Sable', at: new Date(NOW - 40 * MIN),
    accuracy: 0.8, detected: false, stock: { low: 13_000, high: 17_000 }, deuteriumStock: { low: 1_000, high: 2_000 },
    defence: { low: 2_700, high: 5_300 }, fleetSize: { low: 20, high: 40 }, fleetHome: true,
    classReading: { kind: 'DOMINANT', cls: 'LANCE' },
    posture: 'SUPPORT',
    support: { supporters: 2, defence: { low: 3_100, high: 4_400 }, fleetSize: { low: 30, high: 45 }, classReading: null },
  }],
};
const raider = planetSchema.parse(JSON.parse(JSON.stringify({
  ...planetView({ fleet: { DART: 40, TALON: 12, RAMPART: 4, COURIER: 6 } }, { alloy: 40_000, crystal: 20_000, deuterium: 12_000 }),
  rulesetVersion: 15,
})));

function Seeded({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  useState(() => {
    client.setQueryData(['galaxy'], { you: { planetId: 'p-1', playerId: 'me' }, planets: [], sensors: [], radiation: [] });
    client.setQueryData(['reports'], { reports: [], rivals: [] });
    // The launch reads the season's ruleset, and the posture rows live from 15.
    client.setQueryData(['season'], { rulesetVersion: 15, rivals: [], shieldUntil: null, shieldKind: null });
    return null;
  });
  return <>{children}</>;
}

/** F2 Klan Sancağı + Katkı Defteri, against a stub ledger. */
function Banner({ gold }: { gold: boolean }) {
  const ledger = {
    members: [
      { playerId: 'mira', name: 'Mira', donated: { alloy: 18_400, crystal: 5_200, deuterium: 0 }, towardNext: { alloy: 9_100, crystal: 2_300, deuterium: 0 },
        supportWaves: 7, supportShips: 210, supportBattles: 3, alarmAnswers: 4, aidSent: 2, jointWar: 1 },
      { playerId: 'me', name: 'Vantage', donated: { alloy: 9_800, crystal: 2_600, deuterium: 0 }, towardNext: { alloy: 4_000, crystal: 1_000, deuterium: 0 },
        supportWaves: 2, supportShips: 40, supportBattles: 1, alarmAnswers: 1, aidSent: 0, jointWar: 0 },
      { playerId: 'orin', name: 'Orin', donated: { alloy: 0, crystal: 0, deuterium: 0 }, towardNext: { alloy: 0, crystal: 0, deuterium: 0 },
        supportWaves: 0, supportShips: 0, supportBattles: 0, alarmAnswers: 0, aidSent: 0, jointWar: 0 },
    ],
  };
  const [api] = useState(() => new Api({
    fetch: () => Promise.resolve(new Response(JSON.stringify(ledger), { status: 200, headers: { 'content-type': 'application/json' } })),
  }));
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const war = clanWarSchema.parse({
    available: true, level: gold ? 10 : 4, maxLevel: gold,
    treasury: gold ? { alloy: 0, crystal: 0, deuterium: 0 } : { alloy: 21_300, crystal: 5_100, deuterium: 0 },
    nextCost: gold ? null : clanLevelUpgradeCost(4), room: gold ? null : clanLevelUpgradeCost(4), canUpgrade: false,
    hangar: { used: 0, reserved: 0, total: 1_620 }, serverNow: new Date(NOW).toISOString(), operation: null,
  });
  return (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <div className="mx-auto max-w-[440px] p-3">
          <ClanBanner war={war} role="LEADER" selfPlayerId="me" canGive onDonate={noop} />
        </div>
      </ApiProvider>
    </QueryClientProvider>
  );
}

/** F2: the clan room — the events the clan's own actions write, and tags in their metal. */
function ClanRoom() {
  const [client] = useState(() => {
    const seeded = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const at = (minutes: number) => new Date(NOW - minutes * 60_000);
    const message = (id: string, minutes: number, over: Record<string, unknown>) => ({
      id, authorPlayerId: 'mira', planetId: 'p', username: 'Mira', content: '', createdAt: at(minutes), self: false, ...over,
    });
    seeded.setQueryData(keys.communityPolicy, { version: COMMUNITY_POLICY_VERSION, acceptedAt: new Date(NOW) });
    seeded.setQueryData(keys.clanBadge, {
      available: true, membership: { clanId: 'c', name: 'Orbit Wardens', tag: 'ORB', role: 'MEMBER', matureAt: at(9_000), mature: true },
      attention: false, attentionCount: 0, clanChatUnread: 0,
    });
    seeded.setQueryData(keys.clanChat, {
      pages: [{ messages: [
        message('e4', 1, { event: { kind: 'DEFENCE', params: { hostName: 'Ayşe', hostPlanetName: 'Kuzgun', grade: 'REPELLED', supporters: 2, attackerLost: 41, heroName: 'Mira' } } }),
        message('m3', 3, { content: 'Geliyorum, 6 dk', clanTag: 'ORB', clanTier: 'GOLD' }),
        message('e3', 4, { event: { kind: 'SUPPORT_SENT', params: { senderName: 'Mira', hostName: 'Ayşe', hostPlanetName: 'Kuzgun', ships: 60, arriveAt: new Date(NOW + 6 * 60_000).toISOString(), answering: true } } }),
        message('e2', 5, { event: { kind: 'ALARM', params: { hostName: 'Ayşe', hostPlanetName: 'Kuzgun', arriveAt: new Date(NOW + 9 * 60_000).toISOString() } } }),
        message('m1', 30, { username: 'Orin', authorPlayerId: 'orin', content: 'Sancak 6 oldu!', clanTag: 'ORB', clanTier: 'SILVER' }),
        message('e1', 31, { event: { kind: 'LEVEL_UP', params: { level: 6 } } }),
      ].reverse(), nextBefore: null }],
      pageParams: [null],
    });
    return seeded;
  });
  const [api] = useState(() => new Api({ fetch: () => Promise.resolve(new Response('{}', { status: 404 })) }));
  return (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <div className="h-[812px]"><ChatScreen initialChannel="clan" onFocusPlanet={noop} /></div>
      </ApiProvider>
    </QueryClientProvider>
  );
}

export function GallerySupport({ view }: { view: string }) {
  if (view === 'support-chat') return <ClanRoom />;
  if (view === 'support-hangar') return <Hangar posture="SUPPORT" />;
  if (view === 'support-hangar-escape') return <Hangar posture="ESCAPE" />;
  if (view === 'support-hangar-locked') return <Hangar posture="ESCAPE" locked />;
  if (view === 'support-hangar-hold') return <Hangar posture="HOLD" />;
  if (view === 'support-hangar-both') return <Hangar posture="ESCAPE_SUPPORT" />;
  if (view === 'support-sheet') return <SendSheet />;
  // F2 Klan Alarmı: the sheet opened from the bell, and the host's bay answering it.
  if (view === 'support-sheet-alarm') return <SendSheet alarm />;
  if (view === 'support-hangar-alarm') return <Hangar posture="SUPPORT" alarm />;
  if (view === 'support-banner' || view === 'support-banner-gold') return <Banner gold={view === 'support-banner-gold'} />;
  if (view === 'support-fleet') return <Fleet />;
  if (view === 'support-report') return <Report />;
  if (view === 'support-report-supporter') return <Report supporter />;
  if (view === 'support-focus') {
    return (
      <Seeded>
        <PlanetFocus target={supported} planet={raider} intel={supportedIntel} reports={[]} now={NOW}
          onClose={noop} onAttack={noop} onInstallTelescope={noop} onLaunched={noop} open onToggle={noop} />
      </Seeded>
    );
  }
  if (view === 'support-launch') {
    return (
      <Seeded>
        <LaunchSheet planet={raider} intel={supportedIntel} target={{ kind: 'world', world: supported }}
          onClose={noop} onLaunched={noop} />
      </Seeded>
    );
  }
  if (view === 'support-clanmate' || view === 'support-clanmate-closed') {
    const mate: GalaxyPlanet = { ...supported, owner: 'Mira', clanmate: true,
      supportOpen: view === 'support-clanmate' };
    return (
      <Seeded>
        <PlanetFocus target={mate} planet={raider} intel={undefined} reports={[]} now={NOW} onSendSupport={noop}
          onClose={noop} onAttack={noop} onInstallTelescope={noop} onLaunched={noop} open onToggle={noop} />
      </Seeded>
    );
  }
  return <Sheet title="?" onClose={noop}>{view}</Sheet>;
}
