import { describe, expect, it } from 'vitest';
import { directives, primary, type Situation } from '../src/lib/directives.js';
import type { GalaxyView, IntelView, PlanetView } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';

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
 * The first version spread `...over.instruments` over a default that already held
 * a Telescope, so `instruments: {}` — the arrangement for "this player is blind" —
 * silently produced a player who could see. The test failed for the right reason
 * and the helper was lying, which is the worse of the two bugs.
 */
interface PlanetOver {
  stock?: Partial<PlanetView['planet']>;
  buildings?: PlanetView['buildings'];
  instruments?: PlanetView['instruments'];
  fleet?: PlanetView['fleet'];
  ground?: PlanetView['ground'];
}

const planet = (over: PlanetOver = {}): PlanetView =>
  planetView(
    {
      buildings: over.buildings ?? { CORE: 3, REFINERY: 1, EXTRACTOR: 1, VAULT: 0, SHIPYARD: 0 },
      instruments: over.instruments ?? { TELESCOPE: 1, RADAR: 3 },
      fleet: over.fleet ?? { DART: 6 },
      ground: over.ground ?? {},
      score: { wealth: 4_000, dominion: 0 },
    },
    {
      alloy: 400,
      crystal: 100,
      alloyCap: 5000,
      crystalCap: 1000,
      alloyPerHour: 58,
      crystalPerHour: 20,
      bufferAlloyCap: 3200,
      bufferCrystalCap: 640,
      vaultFloor: 300,
      ...over.stock,
    },
  );

/**
 * `flight` and `pending` are two views of the same fact, so the fixture derives one
 * from the other rather than letting a test set them to disagree. D28 moved the
 * idle directive onto `flight.used` — `pending` carries missions only, so a miner
 * with three bays occupied showed an empty list — and a fixture that still hard-set
 * `used: 0` would be asserting against a world that cannot exist.
 */
const situation = (over: Partial<Situation> = {}): Situation => {
  const pending = over.pending ?? [
    { kind: 'fleet' as const, targetName: 'Grimhold', minutesRemaining: 12, arriveAt: new Date(Date.now() + 12 * 60_000) },
  ];
  const base = over.planet ?? planet();
  return {
    planet: { ...base, flight: { used: pending.length, total: 3 } },
    galaxy: over.galaxy,
    intel: over.intel,
    pending,
    held: over.held ?? { alloy: 400, crystal: 100 },
    ...(over.shieldUntil === undefined ? {} : { shieldUntil: over.shieldUntil }),
    ...(over.now === undefined ? {} : { now: over.now }),
  };
};

const galaxyWith = (status: 'HOME' | 'AWAY'): GalaxyView => ({
  you: { planetId: 'p1', playerId: 'pl1' },
  planets: [
    {
      id: 'p2',
      name: 'Grimhold',
      owner: 'Sable',
      position: { x: 100, y: 0, z: 0 },
      coreTier: 2,
      coreLevel: 6,
      intel: 'RESOLVED' as const,
      state: { kind: 'NORMAL' as const },
      satellites: [],
      shielded: false,
      isSelf: false,
      fleet: { status, staleMinutes: 3, etaMinutes: 18, clarity: 'FULL' },
    },
  ],
});

describe('the situation engine', () => {
  it('routes an inbound warning to the world being defended', () => {
    const next = primary(directives(situation({ pending: [{
      kind: 'incoming', targetName: 'Colony', targetPlanetId: 'colony',
      minutesRemaining: 3, arriveAt: new Date(Date.now() + 180_000),
    }] })));
    expect(next?.action.planetId).toBe('colony');
  });
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
        planet: planet({ ground: {}, instruments: {} }),
        galaxy: galaxyWith('AWAY'),
        pending: [
          {
            kind: 'incoming',
            targetName: 'inbound fleet',
            minutesRemaining: 6,
            arriveAt: new Date(Date.now() + 6 * 60_000),
          },
        ],
        held: { alloy: 4800, crystal: 900 },
      }),
    );

    expect(primary(list)?.id).toBe('inbound');
    expect(primary(list)?.kind).toBe('threat');
    expect(primary(list)?.title).toContain('6m');
  });

  /** An open window is the card a quiet planet shows. */
  it('puts an open attack window on top', () => {
    const list = directives(
      situation({ planet: planet({ instruments: {} }), galaxy: galaxyWith('AWAY') }),
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
          coreLevel: 6,
          intel: 'RESOLVED' as const,
          state: { kind: 'NORMAL' as const },
          satellites: [],
          shielded: false,
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

    /**
     * A SHIELD IS NOT A THREAT. Spec H1 (docs/ui-v2/gozlemevi.md).
     *
     * A newcomer opens the game behind a day of protection and was met with a red
     * THREAT card telling them a raid takes everything — while no raid could be
     * launched at them at all. Red is for something happening to you; under the
     * shield the same facts are preparation, and the card says when that ends.
     */
    describe('while the attack shield holds', () => {
      const now = Date.parse('2026-09-23T12:00:00Z');
      const shieldUntil = new Date(now + 2 * 60 * 60_000);
      const scannedIntel: IntelView = {
        watching: [],
        probeReports: [],
        probeCooldowns: [],
        radarLog: [{ at: new Date(now - 60_000), bearing: 'N', originPlanetName: null }],
        probeCost: { alloy: 25, crystal: 25, deuterium: 0 },
      };
      const exposedWorld: Partial<Situation> = {
        planet: planet({ ground: {} }),
        held: { alloy: 4000, crystal: 400 },
        intel: scannedIntel,
      };

      /*
        Owner, 2026-10-20: the shielded variants of these were the "Weakness" cards a new
        commander closed one after another. Under the shield there is no card at all.
      */
      it('raises no card on an undefended, exposed, scanned world', () => {
        const list = directives(situation({ ...exposedWorld, shieldUntil, now }));
        expect(list.filter((d) => ['undefended', 'exposed-stock', 'scanned'].includes(d.id))).toEqual([]);
      });

      it('turns back into a threat the moment the shield ends', () => {
        const list = directives(situation({ ...exposedWorld, shieldUntil, now: shieldUntil.getTime() }));
        expect(list.find((d) => d.id === 'undefended')?.kind).toBe('threat');
        expect(list.find((d) => d.id === 'undefended')?.title).toBe('This world has no ground defence');
      });

      /** A fleet already in the air is real whatever the shield says. */
      it('keeps an inbound fleet a threat', () => {
        const list = directives(situation({
          ...exposedWorld, shieldUntil, now,
          pending: [{ kind: 'incoming', targetName: 'Home', minutesRemaining: 5, arriveAt: new Date(now + 300_000) }],
        }));
        expect(list.find((d) => d.id === 'inbound')?.kind).toBe('threat');
      });
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

  /**
   * A FULL STORE IS ONLY A PROBLEM WHEN SOMETHING IS WAITING TO GO INTO IT.
   *
   * Under D16 production fills the works, not storage, so a full store does not
   * throw anything away — it blocks the next collection. The directive said the
   * opposite for two phases, and D22's opening grant (which is larger than a
   * level-one refinery's own store) put that false sentence in front of every new
   * commander as the first thing the game ever said to them.
   */
  it('flags a full store when it is blocking a collection', () => {
    const list = directives(
      situation({
        held: { alloy: 5000, crystal: 100 },
        planet: planet({ stock: { alloy: 5000, bufferAlloy: 900 } }),
      }),
    );
    const full = list.find((d) => d.id === 'storage-full');
    expect(full).toBeDefined();
    expect(full?.title).toMatch(/cannot be collected/i);
    expect(full?.title).not.toMatch(/throwing away/i);
  });

  it('says nothing about a full store with nothing waiting to enter it', () => {
    const list = directives(
      situation({
        held: { alloy: 5000, crystal: 100 },
        planet: planet({ stock: { alloy: 5000, bufferAlloy: 0, bufferCrystal: 0 } }),
      }),
    );
    expect(list.some((d) => d.id === 'storage-full')).toBe(false);
  });

  /*
    Owner, 2026-10-20: "Bu weakness kartlarını iptal et sil istemiyorum", and no "Nothing is in
    flight" card either. A blind, Core-capped, idle world with free bays gets no advice card.
  */
  it('offers no weakness or idle advice, only threats and opportunities', () => {
    const blindCappedIdle = planet({ instruments: {}, buildings: { CORE: 1, REFINERY: 1, EXTRACTOR: 1, VAULT: 1, SHIPYARD: 0 } });
    for (const pending of [[], situation().pending]) {
      const list = directives(situation({ planet: blindCappedIdle, pending }));
      expect(list.map((d) => d.id)).toEqual([]);
    }
    const busy = directives(situation({ planet: planet({ ground: {} }), held: { alloy: 4000, crystal: 400 }, galaxy: galaxyWith('AWAY') }));
    expect(busy.length).toBeGreaterThan(0);
    expect(busy.map((d) => d.id)).toContain('undefended');
  });

  it('returns directives in descending order of weight, always', () => {
    const list = directives(
      situation({
        planet: planet({ ground: {}, instruments: {} }),
        galaxy: galaxyWith('AWAY'),
        pending: [],
        held: { alloy: 5000, crystal: 900 },
      }),
    );
    const weights = list.map((d) => d.weight);
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
  });
});
