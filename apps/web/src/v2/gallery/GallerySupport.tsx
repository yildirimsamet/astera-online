import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Api } from '../../api/client.js';
import { ApiProvider } from '../../api/context.js';
import {
  clanSupportWaveSchema,
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
import { LaunchSheet } from '../../screens/LaunchSheet.js';
import { EscapeReadout } from '../../ui/EscapeReadout.js';
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

function hangarWorld(posture: 'ESCAPE' | 'SUPPORT' | 'HOLD', locked: boolean): PlanetView {
  const base = planetView({
    buildings: { CORE: 6, REFINERY: 5, EXTRACTOR: 5, VAULT: 2, SHIPYARD: 4, HANGAR: 6 },
    fleet: { DART: 40, TALON: 12, RAMPART: 4 },
  });
  const waves = posture === 'SUPPORT' ? hostWaves : [];
  return planetSchema.parse(JSON.parse(JSON.stringify({
    ...base,
    rulesetVersion: 15,
    defencePosture: { posture, escape: posture === 'ESCAPE', support: posture === 'SUPPORT',
      supportLocked: locked ? 'NOT_IN_CLAN' : null },
    clanSupport: { room: { used: 192, reserved: 40, total: 470 }, waves },
  })));
}

function Hangar({ posture, locked = false }: { posture: 'ESCAPE' | 'SUPPORT' | 'HOLD'; locked?: boolean }) {
  const world = hangarWorld(posture, locked);
  return (
    <div className="mx-auto flex max-w-[440px] flex-col gap-3 p-3">
      <DefencePostureCard planet={world} />
      <ClanSupportBay planet={world} />
      <EscapeReadout fleet={world.fleet} ground={world.ground} deuterium={world.planet.deuterium}
        rulesetVersion={15} posture={posture} />
    </div>
  );
}

/** The send sheet against a stub that prices every route the same. */
function SendSheet() {
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
        <ClanSupportSheet host={{ planetId: 'p-mira', planetName: 'Kestrel', ownerName: 'Mira' }}
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
      flights={[]} worlds={[]} recalling={null} onFocus={noop} onRecall={noop} onOpenRepairStation={noop} onClose={noop}
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

export function GallerySupport({ view }: { view: string }) {
  if (view === 'support-hangar') return <Hangar posture="SUPPORT" />;
  if (view === 'support-hangar-escape') return <Hangar posture="ESCAPE" />;
  if (view === 'support-hangar-locked') return <Hangar posture="ESCAPE" locked />;
  if (view === 'support-hangar-hold') return <Hangar posture="HOLD" />;
  if (view === 'support-sheet') return <SendSheet />;
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
