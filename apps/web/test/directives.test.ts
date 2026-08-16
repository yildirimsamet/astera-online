import { describe, expect, it } from 'vitest';
import { directives, primary, type Situation } from '../src/lib/directives.js';
import type { GalaxyView, PlanetView } from '../src/api/schemas.js';

/**
 * The situation engine decides what the player is told to care about, which makes
 * it the closest thing this client has to game logic. Its failure modes are both
 * bad and quiet:
 *
 *   - crying wolf, until the player stops reading the one line that matters
 *   - staying silent while a fleet is inbound
 *   - ranking a build tip above an open attack window
 *
 * None of those show up in a screenshot, so they are pinned here.
 */

/**
 * Sub-objects REPLACE rather than merge.
 *
 * The first version spread `...over.satellites` over a default that already held
 * a Telescope, so `satellites: {}` — the arrangement for "this player is blind" —
 * silently produced a player who could see. The test failed for the right reason
 * and the helper was lying, which is the worse of the two bugs.
 */
interface PlanetOver {
  stock?: Partial<PlanetView['planet']>;
  buildings?: PlanetView['buildings'];
  satellites?: PlanetView['satellites'];
  fleet?: PlanetView['fleet'];
  ground?: PlanetView['ground'];
}

const planet = (over: PlanetOver = {}): PlanetView => ({
  planet: {
    id: 'p1',
    name: 'Kestrel-12',
    position: { x: 0, y: 0, z: 0 },
    alloy: 400,
    crystal: 100,
    alloyCap: 5000,
    crystalCap: 1000,
    alloyPerHour: 58,
    crystalPerHour: 20,
    vaultFloor: 300,
    shield: 0,
    disruptedUntil: null,
    ...over.stock,
  },
  buildings: over.buildings ?? { CORE: 3, REFINERY: 1, EXTRACTOR: 1, VAULT: 0, SHIPYARD: 0, RING: 0 },
  nextCosts: {},
  satellites: over.satellites ?? { TELESCOPE: 1, RADAR: 3 },
  satelliteSlots: 2,
  fleet: over.fleet ?? { WASP: 12 },
  ground: over.ground ?? { BASTION: 6 },
  score: { wealth: 1000, dominion: 0 },
});

const situation = (over: Partial<Situation> = {}): Situation => ({
  planet: over.planet ?? planet(),
  galaxy: over.galaxy,
  intel: over.intel,
  pending: over.pending ?? [{ kind: 'fleet', targetName: 'Grimhold', minutesRemaining: 12 }],
  held: over.held ?? { alloy: 400, crystal: 100 },
});

const galaxyWith = (status: 'HOME' | 'AWAY'): GalaxyView => ({
  you: { planetId: 'p1', playerId: 'pl1' },
  planets: [
    {
      id: 'p2',
      name: 'Grimhold',
      owner: 'Sable',
      position: { x: 100, y: 0, z: 0 },
      coreTier: 2,
      satellites: [],
      isSelf: false,
      fleet: { status, staleMinutes: 3, etaMinutes: 18, clarity: 'FULL' },
    },
  ],
});

describe('the situation engine', () => {
  it('says nothing urgent when a planet is defended, seeing, and busy', () => {
    const list = directives(situation());
    expect(list.filter((d) => d.kind === 'threat')).toHaveLength(0);
    // A quiet planet still offers a direction, but never a fake alarm.
    expect(list.every((d) => d.kind !== 'threat')).toBe(true);
  });

  /** The only moment in this game with a deadline. Nothing may outrank it. */
  it('puts an inbound fleet above everything else', () => {
    const list = directives(
      situation({
        planet: planet({ ground: {}, satellites: {} }),
        galaxy: galaxyWith('AWAY'),
        pending: [{ kind: 'incoming', targetName: 'inbound fleet', minutesRemaining: 6 }],
        held: { alloy: 4800, crystal: 900 },
      }),
    );

    expect(primary(list)?.id).toBe('inbound');
    expect(primary(list)?.kind).toBe('threat');
    expect(primary(list)?.title).toContain('6m');
  });

  /** An open window is worth more than any amount of self-improvement advice. */
  it('ranks an open attack window above every growth suggestion', () => {
    const list = directives(
      situation({ planet: planet({ satellites: {} }), galaxy: galaxyWith('AWAY') }),
    );

    const top = primary(list);
    expect(top?.kind).toBe('opportunity');
    expect(top?.id).toBe('window-p2');
    expect(top?.action.planetId).toBe('p2');
    expect(top?.action.screen).toBe('galaxy');
  });

  it('does not invent a window when their fleet is home', () => {
    const list = directives(situation({ galaxy: galaxyWith('HOME') }));
    expect(list.some((d) => d.id.startsWith('window-'))).toBe(false);
  });

  it('never reports a window for your own planet', () => {
    const own: GalaxyView = {
      you: { planetId: 'p1', playerId: 'pl1' },
      planets: [
        {
          id: 'p1',
          name: 'Kestrel-12',
          owner: 'you',
          position: { x: 0, y: 0, z: 0 },
          coreTier: 2,
          satellites: [],
          isSelf: true,
          fleet: { status: 'AWAY', staleMinutes: 0, etaMinutes: null, clarity: 'FULL' },
        },
      ],
    };
    expect(directives(situation({ galaxy: own })).some((d) => d.id.startsWith('window-'))).toBe(
      false,
    );
  });

  describe('being undefended', () => {
    it('is called out when there is something worth taking', () => {
      const list = directives(
        situation({ planet: planet({ ground: {} }), held: { alloy: 4000, crystal: 400 } }),
      );
      expect(list.some((d) => d.id === 'undefended')).toBe(true);
    });

    /** A new commander holding nothing is not in danger, and must not be nagged. */
    it('is not called out when there is nothing to lose', () => {
      const list = directives(
        situation({ planet: planet({ ground: {} }), held: { alloy: 120, crystal: 10 } }),
      );
      expect(list.some((d) => d.id === 'undefended')).toBe(false);
    });
  });

  it('states the exact amount a raid could take', () => {
    const list = directives(
      situation({ planet: planet({ ground: {} }), held: { alloy: 4000, crystal: 300 } }),
    );
    const exposed = list.find((d) => d.id === 'exposed-stock');
    // 4,300 held − 300 vault floor.
    expect(exposed?.title).toBe('4,000 can be taken from you');
  });

  it('notices production being thrown away at the cap', () => {
    const list = directives(
      situation({
        held: { alloy: 5000, crystal: 100 },
        planet: planet({ stock: { alloy: 5000 } }),
      }),
    );
    expect(list.some((d) => d.id === 'storage-full')).toBe(true);
  });

  it('tells a blind player that they are blind', () => {
    const list = directives(situation({ planet: planet({ satellites: {} }) }));
    const blind = list.find((d) => d.id === 'no-telescope');
    expect(blind).toBeDefined();
    expect(blind?.action.group).toBe('see');
  });

  it('does not mention the telescope once one is installed', () => {
    expect(directives(situation()).some((d) => d.id === 'no-telescope')).toBe(false);
  });

  it('flags the Core only when it is blocking more than one thing', () => {
    const oneBlocked = planet({ buildings: { CORE: 3, REFINERY: 3, EXTRACTOR: 1, VAULT: 0, SHIPYARD: 0, RING: 0 } });
    expect(directives(situation({ planet: oneBlocked })).some((d) => d.id === 'core-ceiling')).toBe(
      false,
    );

    const manyBlocked = planet({ buildings: { CORE: 1, REFINERY: 1, EXTRACTOR: 1, VAULT: 1, SHIPYARD: 0, RING: 0 } });
    const found = directives(situation({ planet: manyBlocked })).find((d) => d.id === 'core-ceiling');
    expect(found?.title).toContain('3 upgrades');
  });

  /** DESIGN LAW #1, surfaced: an empty pending list is itself the prompt. */
  it('says so when nothing is in flight', () => {
    const list = directives(situation({ pending: [] }));
    expect(list.some((d) => d.id === 'idle')).toBe(true);
  });

  it('stays quiet about idleness while something is still in the air', () => {
    expect(directives(situation()).some((d) => d.id === 'idle')).toBe(false);
  });

  it('returns directives in descending order of weight, always', () => {
    const list = directives(
      situation({
        planet: planet({ ground: {}, satellites: {} }),
        galaxy: galaxyWith('AWAY'),
        pending: [],
        held: { alloy: 5000, crystal: 900 },
      }),
    );
    const weights = list.map((d) => d.weight);
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
  });
});
