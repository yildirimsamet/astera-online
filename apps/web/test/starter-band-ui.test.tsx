import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { STARTER, openingProgress } from '@astera/rules';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import type { GalaxyPlanet, IntelView, PlanetView } from '../src/api/schemas.js';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { PlanetFocus } from '../src/galaxy/FocusPanel.js';
import { FleetPage } from '../src/v2/hud/FleetPage.js';
import { planetNodes } from '../src/galaxy/scene.js';
import { dossier } from '../src/lib/dossier.js';
import { vesselToPlanetView } from '../src/starter/adapter.js';
import { TempoNote } from '../src/starter/TempoNote.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { wireVessel } from './starterVesselFixture.js';

afterEach(cleanup);

const NOW = new Date('2026-11-05T12:00:00.000Z').getTime();
const aboard = (): PlanetView => vesselToPlanetView(vesselSchema.parse(wireVessel({ fleet: { DART: 6 } })));
const intel: IntelView = { watching: [], probeReports: [], probeCooldowns: [], radarLog: [], probeCost: { alloy: 25, crystal: 25, deuterium: 0 } };

const outpost = (over: Partial<GalaxyPlanet> = {}): GalaxyPlanet => ({
  id: 'post', name: 'OP-3A1F', body: 'OUTPOST', position: { x: 60, y: 0, z: 0 }, coreTier: 1, coreLevel: 1, intel: 'RESOLVED',
  state: { kind: 'NORMAL' }, satellites: [], shielded: false, isSelf: false, kind: 'NEUTRAL', ...over,
}) as GalaxyPlanet;
const ship = (over: Partial<GalaxyPlanet> = {}): GalaxyPlanet => outpost({
  id: 'them', name: 'Other', owner: 'Other', body: 'VESSEL', kind: 'CAPITAL', controller: { kind: 'PLAYER' }, ...over,
} as Partial<GalaxyPlanet>);

const open = (target: GalaxyPlanet, children?: ReactNode) => {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queries}><ApiProvider api={api}><ToastProvider>
    <PlanetFocus target={target} planet={aboard()} intel={intel} reports={[]} now={NOW} onClose={vi.fn()} onAttack={vi.fn()}
      onInstallTelescope={vi.fn()} onLaunched={vi.fn()} onSettle={vi.fn()} outOfBand open onToggle={vi.fn()} />
    {children}
  </ToastProvider></ApiProvider></QueryClientProvider>);
  return document.body.textContent;
};

describe('a galaxy with no tier', () => {
  it('states no development row about another ship', () => {
    const read = dossier({ target: ship(), planet: aboard(), intel, reports: [], ownPeakCore: 1, now: NOW });
    expect(read.facts.map(fact => fact.key)).not.toContain('development');
  });

  it('talks about a ship as a ship in everything it says it does not know', () => {
    for (const reading of ['UNKNOWN', 'REMEMBERED', 'RESOLVED'] as const) {
      const read = dossier({ target: ship({ intel: reading }), planet: aboard(), intel, reports: [], ownPeakCore: 1, now: NOW });
      const said = read.gaps.map(gap => `${gap.label} ${gap.missing} ${gap.why} ${gap.blocked ?? ''}`).join(' ');
      expect(said.length).toBeGreaterThan(0);
      expect(said).not.toMatch(/world|planet|down there/i);
    }
  });

  describe('how far a ship\'s telescope reaches', () => {
    const fleetGap = (distance: number, telescope: number) => {
      const planet = aboard();
      const read = dossier({
        target: ship({ position: { x: planet.planet.position.x + distance, y: planet.planet.position.y, z: planet.planet.position.z } }),
        planet: { ...planet, instruments: { ...planet.instruments, TELESCOPE: telescope } },
        intel, reports: [], ownPeakCore: 1, now: NOW,
      });
      return read.gaps.find(gap => gap.key === 'fleet');
    };

    it('reads the ship\'s own range, where the main ladder would see nearly the whole galaxy', () => {
      expect(fleetGap(STARTER.telescope[1] + 100, 1)?.blocked).toMatch(new RegExp(String(STARTER.telescope[1])));
    });

    it('offers the watch inside it, as the server will', () => {
      expect(fleetGap(STARTER.telescope[1] - 100, 1)?.blocked).toBeUndefined();
    });
  });

  it('never refuses a target for its tier: a stray out-of-band flag has no effect here', () => {
    const body = open(ship());
    expect(body).not.toMatch(/\btier\b/iu);
    expect(screen.queryByText(/out of band|outside your/iu)).toBeNull();
  });
});

describe('an outpost is not a world to settle', () => {
  it('offers no settlement and no colony steps', () => {
    const body = open(outpost({ neutral: { claimUntil: new Date(NOW + 3_600_000) } }));
    expect(body).not.toMatch(/settle|colon|claim/iu);
    expect(document.querySelector('[data-settle-reason]')).toBeNull();
  });
});

describe('an outpost says what it is', () => {
  it('names itself and what taking it pays, in this galaxy\'s words', () => {
    // A name to remember, and the code that tells two alike apart beside the kind (player test).
    const body = open(outpost({ id: '3a1f0b2c', name: 'Velara', coreLevel: 3 }));
    expect(body).toContain('Velara');
    expect(body).toContain('Abandoned outpost · OP-3A1F');
    expect(body).toContain(String(STARTER.sites.outposts.stock[2]));
    expect(body).not.toMatch(/Neutral|World ·/i);
  });

  it('tells the map label it is an outpost, and no world that is not', () => {
    const [post, them] = planetNodes([outpost(), ship()]);
    expect(post!.outpost).toBe(true);
    expect(them!.outpost).toBeUndefined();
  });

  it('marks a part only when the map says there is one', () => {
    expect(open(outpost())).not.toContain('thrust part');
    cleanup();
    expect(open(outpost({ hasPart: true }))).toContain('thrust part');
  });
});

/**
 * A CLOSED ATTACK SAYS WHY, AND HOW IT OPENS (player test A-05, owner K1 2026-11-05). The card showed
 * what an outpost pays and no way to take it, and a first-time player looked for the button for an hour.
 */
describe('what opens an attack', () => {
  type Progress = ReturnType<typeof openingProgress>;
  const openAs = (target: GalaxyPlanet, progress: Partial<Progress>) => {
    const planet = aboard();
    const opened = vesselToPlanetView(vesselSchema.parse(wireVessel({ fleet: { DART: 6 }, progress: { ...openingProgress(), ...progress } })));
    const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
    render(<QueryClientProvider client={new QueryClient()}><ApiProvider api={api}><ToastProvider>
      <PlanetFocus target={target} planet={{ ...planet, ...opened }} intel={intel} reports={[]} now={NOW} onClose={vi.fn()} onAttack={vi.fn()}
        onInstallTelescope={vi.fn()} onLaunched={vi.fn()} onSettle={vi.fn()} open onToggle={vi.fn()} />
    </ToastProvider></ApiProvider></QueryClientProvider>);
    return document.body.textContent;
  };
  const yard = { ...openingProgress().modules, REFINERY: 3, EXTRACTOR: 2, SURVEY: 1, SHIPYARD: 1 };

  it('says an outpost opens with the Shipyard', () => {
    const body = open(outpost());
    expect(document.querySelector('[data-attack]')).toBeNull();
    expect(screen.getByTestId('attack-locked').textContent).toBe(
      'Outpost raids open with the Shipyard. Repair it, and the ships it builds can raid here.');
    expect(body).toContain('Abandoned outpost');
  });

  // Owner 2026-11-08 (N2): the outpost is the shipyard's first fight, with no battle and no shield behind it.
  it('offers the outpost to a shipyard with no battle and no shield', () => {
    openAs(outpost(), { modules: yard });
    expect(document.querySelector('[data-attack]')).not.toBeNull();
    expect(screen.queryByTestId('attack-locked')).toBeNull();
  });

  // N3: attacking a ship asks for the attacker's own Aegis, which opens its ship to attack too.
  it('keeps a ship shut to a fleet whose own Aegis is down, and says what opens it', () => {
    openAs(ship(), { modules: yard, facts: ['FIRST_BATTLE_REPORT'] });
    expect(document.querySelector('[data-attack]')).toBeNull();
    expect(screen.getByTestId('attack-locked').textContent).toBe(
      'Attacking ships needs your own Aegis repaired and one battle behind you. With the Aegis up, your ship can be attacked too.');
  });

  it('offers a ship once the Aegis is up and a battle is behind it', () => {
    openAs(ship(), { modules: { ...yard, RADAR: 1, AEGIS: 1 }, facts: ['FIRST_BATTLE_REPORT'] });
    expect(document.querySelector('[data-attack]')).not.toBeNull();
    expect(screen.queryByTestId('attack-locked')).toBeNull();
  });
});

/**
 * ONE NAME, ONE MEASURE (player test B-04). The closed card put the ships' price under "Power", and
 * the dossier behind it a power range in the same word: two numbers, one name, and no way to relate them.
 */
describe('the closed card\'s figures', () => {
  it('calls the price of the armed ships a value, not power', () => {
    const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
    render(<QueryClientProvider client={new QueryClient()}><ApiProvider api={api}><ToastProvider>
      <PlanetFocus target={outpost()} planet={aboard()} intel={intel} reports={[]} now={NOW} onClose={vi.fn()} onAttack={vi.fn()}
        onInstallTelescope={vi.fn()} onLaunched={vi.fn()} onSettle={vi.fn()} open={false} onToggle={vi.fn()} />
    </ToastProvider></ApiProvider></QueryClientProvider>);
    const row = screen.getByTestId('peek-value');
    expect(row.textContent).toMatch(/^Value/u);
    expect(row.textContent).not.toMatch(/Power/u);
  });
});

/**
 * A SHIP IS NOT A CAPITAL (player test: "ANA GEZEGEN" on another ship's card). Every ship carries the
 * CAPITAL kind on the wire, and the card printed it as a world's.
 */
describe('another ship\'s card', () => {
  it('names no world kind for a ship', () => {
    const body = open(ship({ intel: 'RESOLVED' }));
    expect(body).not.toMatch(/Capital|Colony(?! ship)/u);
  });
});

/**
 * NO WORLD WORDS ON A SHIP'S SURFACES (player test B-06). A ship's launch warning, its Hangar rule and
 * its fleetsave line spoke of planets and a formal "you" the rest of the game does not use.
 */
describe('the words a ship\'s surfaces use', () => {
  it('warns of the fleet\'s absence without calling the ship a planet', async () => {
    const { default: i18n } = await import('../src/i18n/index.js');
    const tr = i18n.getFixedT('tr');
    for (const key of ['launch.warningWorld', 'launch.warningPirate', 'launch.warningWorldOpen', 'launch.warningPirateOpen'] as const) {
      expect(tr(key, { world: 'Kara Şahin', duration: '5 dk' })).not.toMatch(/gezegen/u);
    }
    expect(tr('starter.launchFleetsave')).not.toMatch(/geminiz/u);
  });

  it('states the Hangar rule for a ship', () => {
    render(<FleetPage aboard tab="room" onTab={vi.fn()} now={NOW} bays={null} hangar={{ used: 6, total: 20 }} flights={[]} worlds={[]}
      recalling={null} onFocus={vi.fn()} onRecall={vi.fn()} onOpenRepairStation={vi.fn()} onFocusWorld={vi.fn()} onClose={vi.fn()} onDock={vi.fn()} />);
    expect(document.body.textContent).toContain('Room for every ship this ship carries');
    expect(document.body.textContent).not.toMatch(/a world owns/u);
  });
});

describe('the half tempo is said where it decides something', () => {
  it('stands on the launch sheet and in a battle report from here', () => {
    render(<TempoNote aboard />);
    expect(screen.getByRole('note').textContent).toBe('Damage and Aegis are half here. In the main galaxy the same battle runs twice as fast.');
  });

  // Player test D-07: that a ship's shield is whole again for every battle was learned after the raid.
  it('says before the launch what a ship carries into the next battle', () => {
    render(<TempoNote aboard beforeLaunch />);
    expect(screen.getByTestId('ship-shield-note').textContent).toBe('Ship shields start every battle full. Hull wounds stay until the Repair Station mends them.');
    cleanup();
    render(<TempoNote aboard />);
    expect(screen.queryByTestId('ship-shield-note')).toBeNull();
  });

  it('is absent in the main game', () => {
    const { container } = render(<TempoNote aboard={false} />);
    expect(container.textContent).toBe('');
  });
});
