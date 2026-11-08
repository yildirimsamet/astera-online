import { STARTER, type VesselProgress } from '@astera/rules';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import type { BattleReport, GalaxyPlanet, IntelView } from '../src/api/schemas.js';
import { vesselSchema, type VesselView } from '../src/api/starterSchemas.js';
import { WorldProvider } from '../src/api/world.js';
import { DebrisFocus, PlanetFocus } from '../src/galaxy/FocusPanel.js';
import i18n from '../src/i18n/index.js';
import { describeNotification } from '../src/lib/notifications.js';
import { REPAIR_STATION_ITEM } from '../src/lib/repairStation.js';
import { BattleReports } from '../src/screens/BattleReports.js';
import { DESTINATION } from '../src/shell/Signals.js';
import { vesselToPlanetView } from '../src/starter/adapter.js';
import { wreckWorthProbing } from '../src/starter/partMarks.js';
import { VesselScreen } from '../src/starter/VesselScreen.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { FleetPage, type FleetWorld } from '../src/v2/hud/FleetPage.js';
import { wireVessel } from './starterVesselFixture.js';

const NOW = new Date('2026-11-05T12:00:00.000Z').getTime();
const intel: IntelView = { watching: [], probeReports: [], probeCooldowns: [], radarLog: [], probeCost: { alloy: 65, crystal: 40, deuterium: 0 } };
const yardOpen: VesselProgress = { modules: { REFINERY: 3, SURVEY: 1, SHIPYARD: 1, AEGIS: 1 }, facts: ['FIRST_BATTLE_REPORT'], parts: 0, fuel: 0 };
const ship = (fleet: Record<string, number> = {}, damage: unknown[] = []): VesselView =>
  vesselSchema.parse(wireVessel({ progress: yardOpen, fleet, damage }));

const providers = (children: ReactNode, fetch: typeof globalThis.fetch = vi.fn<typeof globalThis.fetch>()) => {
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queries}><ApiProvider api={new Api({ fetch, authTransport: null })}><WorldProvider><ToastProvider>
    {children}
  </ToastProvider></WorldProvider></ApiProvider></QueryClientProvider>);
};

const scrolled = vi.fn();
beforeAll(() => { Element.prototype.scrollIntoView = scrolled; });
beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(cleanup);

describe('what the signals say about a fight aboard', () => {
  const say = (payload: unknown) => describeNotification({ id: 'n', kind: 'BATTLE_REPORT', refId: 'r', payload, seen: false, createdAt: new Date(NOW), at: new Date(NOW) } as never, NOW);

  it('calls pirates pirates', () => {
    expect(say({ attacking: false, opponent: 'PIRATE', opponentKind: 'PIRATES', loot: {} })).toBe('Pirates attacked your ship. Read the report.');
  });

  it('leaves a commander who took that name their name', () => {
    expect(say({ attacking: false, opponent: 'PIRATE', opponentKind: 'SHIP', loot: {} })).toBe('PIRATE attacked your ship. Read the report.');
  });

  it('opens the report it tells the player to read', () => {
    expect(DESTINATION.BATTLE_REPORT).toEqual({ panel: 'report', stop: 'battles' });
  });
});

describe('hurt ships on the Fleet page', () => {
  const world: FleetWorld = {
    id: 'ship-1', name: 'Newcomer', capital: true, active: true, fleet: { DART: 2 },
    damage: [{ hull: 'DART', count: 1, damageBp: 3000 }], away: 0,
    room: { hangar: { used: 6, total: 20, full: false }, ground: { used: 0, total: 0, full: false } } as FleetWorld['room'], docked: 0,
  };
  const page = (aboard: boolean, onOpenRepairStation = vi.fn()) => {
    render(<FleetPage aboard={aboard} tab="home" onTab={vi.fn()} now={NOW} bays={null} hangar={null} flights={[]} worlds={[world]}
      recalling={null} onFocus={vi.fn()} onRecall={vi.fn()} onOpenRepairStation={onOpenRepairStation} onFocusWorld={vi.fn()} onClose={vi.fn()} onDock={vi.fn()} />);
    return onOpenRepairStation;
  };

  it('offers a ship the station it has, not a transfer it refuses', () => {
    const open = page(true);
    expect(screen.queryByRole('button', { name: /workshop/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Repair Station/ }));
    expect(open).toHaveBeenCalledWith('ship-1');
  });

  // Player test F-01: the ship's own row, pressed to find the station, flew the camera to the map.
  it('takes the ship\'s own row to the station while ships are hurt', () => {
    const open = page(true);
    fireEvent.click(screen.getByRole('button', { name: /Newcomer/ }));
    expect(open).toHaveBeenCalledWith('ship-1');
  });

  it('asks a ship for no quantities: the station takes everything hurt', () => {
    page(true);
    expect(screen.queryByText('−')).toBeNull();
  });

  it('keeps the transfer for a world', () => {
    page(false);
    expect(screen.getByRole('button', { name: /Move to workshop/ })).toBeTruthy();
  });
});

/**
 * A SHIP'S BAYS ARE ATTACK BAYS (player test B-01). With a probe and a Prospector in the air the page
 * read "Flight bays 0/1": aboard only attacks and outpost raids take one (`vessel.ts`, `fleet.ts`).
 */
describe('the bays on a ship\'s Fleet page', () => {
  const bays = (aboard: boolean) => {
    render(<FleetPage aboard={aboard} tab="air" onTab={vi.fn()} now={NOW} bays={{ used: 0, total: 1 }} hangar={null} flights={[]} worlds={[]}
      recalling={null} onFocus={vi.fn()} onRecall={vi.fn()} onOpenRepairStation={vi.fn()} onFocusWorld={vi.fn()} onClose={vi.fn()} onDock={vi.fn()} />);
    return document.body.textContent;
  };

  it('names what they count aboard', () => {
    expect(bays(true)).toContain('Attack bays');
    expect(bays(true)).not.toContain('Flight bays');
  });

  it('keeps the main game\'s name', () => {
    expect(bays(false)).toContain('Flight bays');
  });
});

describe('where the ship screen opens', () => {
  const screenAt = (focusGroup?: string, focusItem?: string) => providers(
    <VesselScreen vessel={ship({ DART: 2 }, [{ hull: 'DART', count: 1, damageBp: 3000 }])} fetchedAt={NOW}
      {...(focusGroup ? { focusGroup } : {})} {...(focusItem ? { focusItem } : {})} />,
  );

  it('opens the yard when a raid says prepare: a three-minute hull, not a long repair', async () => {
    screenAt('defend');
    await waitFor(() => { expect(screen.getAllByTestId('yard-hull').length).toBeGreaterThan(0); });
  });

  it('opens the yard and goes to the station when the station is asked for', async () => {
    screenAt('reach', REPAIR_STATION_ITEM);
    await waitFor(() => { expect(screen.getByTestId('ship-dock')).toBeTruthy(); });
    expect(scrolled).toHaveBeenCalled();
  });

  it('stays on the repairs for anything else', () => {
    screenAt('grow');
    expect(screen.queryAllByTestId('yard-hull')).toHaveLength(0);
  });
});

describe('an outpost\'s dossier aboard', () => {
  const outpost = { id: 'post', name: 'OP-3A1F', body: 'OUTPOST', position: { x: 60, y: 0, z: 0 }, coreTier: 1, coreLevel: 1, intel: 'RESOLVED',
    state: { kind: 'NORMAL' }, satellites: [], shielded: false, isSelf: false, kind: 'NEUTRAL' } as unknown as GalaxyPlanet;
  const open = (fleet: Record<string, number>) => {
    providers(<PlanetFocus target={outpost} planet={vesselToPlanetView(ship(fleet))} intel={intel} reports={[]} now={NOW} onClose={vi.fn()} onAttack={vi.fn()}
      onInstallTelescope={vi.fn()} onLaunched={vi.fn()} onSettle={vi.fn()} open onToggle={vi.fn()} />);
    return document.body.textContent;
  };

  it('says nothing of a weapon this galaxy does not have', () => {
    const said = open({ DART: 2 });
    expect(said).not.toMatch(/What a strike does/);
    expect(said).not.toMatch(/EMP/);
  });

  it('does not call a place out of reach because the hangar is empty', () => {
    expect(open({})).not.toMatch(/Out of reach/);
  });
});

describe('finding a part on a wreck', () => {
  const hunting = { features: ['drive'], parts: 1 };

  it('is worth a probe on a standing wreck, to a ship hunting a part', () => {
    expect(wreckWorthProbing(hunting, 5000)).toBe(true);
  });

  it('is not worth one on a battle\'s debris, which never holds a part', () => {
    expect(wreckWorthProbing(hunting, STARTER.battleDebris.decayMinutes)).toBe(false);
  });

  it('is not worth one before the hunt, after it, or to a commander with no ship', () => {
    expect(wreckWorthProbing({ features: [], parts: 0 }, 5000)).toBe(false);
    expect(wreckWorthProbing({ features: ['drive'], parts: STARTER.parts.needed }, 5000)).toBe(false);
    expect(wreckWorthProbing(undefined, 5000)).toBe(false);
  });

  const field = (hasPart?: boolean) => ({ id: 'wreck-1', planetId: null, at: { x: 1, y: 0, z: 0 }, alloy: 100, crystal: 50, deuterium: 0, minutesLeft: 900, ...(hasPart ? { hasPart } : {}) });
  const card = (over: ReturnType<typeof field>, probe: boolean, fetch?: typeof globalThis.fetch, onLaunched = vi.fn()) => {
    providers(<DebrisFocus field={over} planetName={undefined} craftAvailable={1} craftHold={200} reachMinutes={5} atHome={() => ({ room: 9999, lost: { alloy: 0, crystal: 0, deuterium: 0 } })}
      run={undefined} craftReadyAt={null} onSend={vi.fn()} onClose={vi.fn()} busy={false} open onToggle={vi.fn()}
      {...(probe ? { probe: { intel, onLaunched } } : {})} />, fetch);
    return onLaunched;
  };

  it('sends the probe the Engine panel asks for', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(new Response(JSON.stringify({ missionId: 'm', arriveAt: new Date(NOW).toISOString(), flightMinutes: 1 }), { status: 200, headers: { 'content-type': 'application/json' } })));
    const launched = card(field(), true, fetch);
    fireEvent.click(screen.getByRole('button', { name: /Send a probe/ }));
    await waitFor(() => { expect(launched).toHaveBeenCalled(); });
    const sent = fetch.mock.calls.find(([url]) => typeof url === 'string' && url.includes('/api/intel/probe'));
    expect(sent?.[1]?.body).toContain('wreck-1');
  });

  it('has nothing left to ask once the part is known', () => {
    card(field(true), true);
    expect(screen.queryByRole('button', { name: /Send a probe/ })).toBeNull();
  });

  it('offers none to a commander who is not hunting', () => {
    card(field(), false);
    expect(screen.queryByRole('button', { name: /Send a probe/ })).toBeNull();
  });
});

describe('a report whose raid killed the guard', () => {
  const base = {
    id: 'b1', missionId: 'm1', at: new Date(NOW), grade: 'DECISIVE', attacking: true, opponentKind: 'OUTPOST',
    opponentName: 'OP-3A1F', opponentPlanet: 'OP-3A1F', opponentPlanetId: 'site-1', neutral: true, yourPlanet: 'Newcomer',
    rounds: [{ round: 1, attackerDamage: 80, defenderDamage: 30, shieldAbsorbed: 0, shieldBreakerDamage: 0, attackerLosses: {}, defenderLosses: {}, attackerDamageLots: [], defenderDamageLots: [] }],
    yourLosses: { DART: 3 }, theirLosses: { PIKE: 2 }, yourFleet: { DART: 3 }, theirFleet: { PIKE: 2 },
    lootAlloy: 0, lootCrystal: 0, lootDeuterium: 0, dominion: null, shieldAbsorbed: 0, cargoLimited: false,
    defenceSalvage: {}, yourDamage: [], disruptedMinutes: 0, wreckValue: 0,
  } as unknown as BattleReport;

  const sheet = async (one: BattleReport, aboard = false) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['reports'], { reports: [one] });
    if (aboard) {
      const vessel = vesselSchema.parse(wireVessel({ modules: { REFINERY: 3, EXTRACTOR: 2, SURVEY: 1, VAULT: 1, SHIPYARD: 1 } }));
      client.setQueryData(['planet'], { ...vesselToPlanetView(vessel), vessel });
    }
    const api = { reports: () => Promise.resolve({ reports: [one] }) } as unknown as Api;
    render(<QueryClientProvider client={client}><ApiProvider api={api}><BattleReports /></ApiProvider></QueryClientProvider>);
    fireEvent.click(screen.getByRole('button', { name: /abandoned outpost/i }));
    await waitFor(() => { expect(document.body.textContent).toMatch(/Newcomer/); });
    return document.body.textContent;
  };

  it('says the outpost stands empty, and for how long', async () => {
    const said = await sheet({ ...base, guardDownUntil: new Date(Date.now() + 2 * 3_600_000) });
    expect(said).toMatch(/guard is down/i);
    expect(said).toMatch(/1h 59m|2h 00m/);
  });

  it('says nothing once the guard is back', async () => {
    expect(await sheet({ ...base, guardDownUntil: new Date(Date.now() - 60_000) })).not.toMatch(/guard is down/i);
  });

  it('says nothing about a guard that still stands', async () => {
    expect(await sheet(base)).not.toMatch(/guard is down/i);
  });

  // F4f: the raid's lesson is read where its numbers are, aboard.
  it('says why the raid went as it did and what the lost ships cost', async () => {
    const said = await sheet(base, true);
    expect(said).toMatch(/outclassed by the Lance guard \(×0\.625\)\. Against it, send Warden/);
    expect(said).toMatch(/Lost 3 Dart: building them again costs/);
  });

  it('tells the first win where its crate is, and who got there first when someone did', async () => {
    expect(await sheet({ ...base, firstVictory: true }, true)).toMatch(/victory crate is waiting at the Shipyard/);
    cleanup();
    expect(await sheet({ ...base, theirFleet: {}, beatenBy: 'Early' }, true)).toMatch(/Early got there first/);
  });
});
