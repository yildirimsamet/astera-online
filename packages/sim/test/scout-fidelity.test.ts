import { describe, expect, it } from 'vitest';
import { GROUND_HULLS, INTEL, classReading, probeAccuracy, type ClassReading } from '@astera/rules';
import {
  expectedDefence,
  expectedLineFromReadings,
  probeIntel,
  readingOfLine,
  type SimIntel,
} from '../src/season.js';
import type { Composition } from '../src/archetypes.js';

/**
 * THE SIMULATOR'S SCOUT KNEW TOO MUCH, AND EVERY COMPOSITION FINDING RESTED ON IT.
 *
 * `p.intel.set` recorded `{ ...q.fleet, ...q.ground }` — the defender's EXACT roster, every hull
 * and every count — and never consulted `probeAccuracy` or `classReading`. The shipped probe sells
 * far less: at par accuracy (0.55, what an equal Shipyard buys) it names the majority CLASS and
 * nothing else, and only two rungs above the target's Veil does it read the whole split.
 *
 * So any experiment about informed play run on that model measured omniscience. The one result
 * the archetype ladder rests on — that the adaptive archetype out-ranks the blind one — was taken
 * against a scout that could not miss.
 */
describe('what a simulated scout may learn', () => {
  const wall = { BALLISTA: 100, TEMPEST: 10 };

  it('reads only what a probe of that accuracy sells', () => {
    const par = probeAccuracy(4, 4);
    expect(readingOfLine(wall, par)).toEqual(classReading(wall, par));
  });

  it('names no more than the majority at par accuracy', () => {
    const reading = readingOfLine(wall, probeAccuracy(4, 4));
    expect(reading.kind).toBe('DOMINANT');
  });

  /** Two Shipyard rungs above the Veil is what buys the whole split — and nothing less. */
  it('reads the full split only when the probe outclasses the veil', () => {
    expect(probeAccuracy(4, 4)).toBeLessThan(INTEL.classSharesAccuracy);
    expect(probeAccuracy(6, 4)).toBeGreaterThanOrEqual(INTEL.classSharesAccuracy);
    expect(readingOfLine(wall, probeAccuracy(6, 4)).kind).toBe('SHARES');
  });

  /** A veiled world gives up less to the same probe. */
  it('gives up less against a veil', () => {
    expect(probeAccuracy(4, 6)).toBeLessThan(probeAccuracy(4, 4));
  });

  /**
   * The roster prior is rebuilt from class readings alone. The hull identities it returns are a
   * modelling convenience — `adaptiveMix` scores through `counterMult`, which reads only the class.
   */
  it('turns readings into a line whose CLASS shape matches what was read', () => {
    const line = expectedLineFromReadings([
      { kind: 'DOMINANT', cls: 'LANCE' },
      { kind: 'DOMINANT', cls: 'LANCE' },
      { kind: 'DOMINANT', cls: 'BULWARK' },
    ]);
    const shape = classReading(line, 1);
    expect(shape.kind).toBe('SHARES');
    if (shape.kind !== 'SHARES') throw new Error('unreachable');
    expect(shape.shares.LANCE).toBeGreaterThan(shape.shares.BULWARK);
    expect(shape.shares.SKIRMISHER).toBe(0);
  });

  it('falls back to nothing when no reading resolved a class', () => {
    expect(expectedLineFromReadings([{ kind: 'EVEN' }, { kind: 'UNREAD' }])).toEqual({});
  });
});

/**
 * WHAT ONE SIMULATED PROBE RECORDS.
 *
 * The same three questions the shipped probe answers — how much is there, how much fires, what
 * SHAPE fires — except the third was not being asked. These pin the third to `probeAccuracy`, so
 * a Veil buys a simulated wall the same privacy it buys a real one.
 */
describe('what one simulated probe records', () => {
  const target = {
    alloy: 1_000, crystal: 500, deuterium: 100,
    bufferAlloy: 40, bufferCrystal: 20, bufferDeuterium: 10,
    fleet: { BALLISTA: 100, TEMPEST: 10, HAULER: 30 },
    ground: {},
    instruments: {},
    buildings: { CORE: 8, REFINERY: 6, EXTRACTOR: 6, DEUTERIUM_PLANT: 2, SHIPYARD: 3, HANGAR: 3, VAULT: 4 },
  };

  it('names only the majority class when the probe merely matches the veil', () => {
    const intel = probeIntel(4, { ...target, instruments: { VEIL: 4 } }, 0, () => 0.5);
    expect(intel.reading.kind).toBe('DOMINANT');
  });

  it('reads nothing at all from a world whose veil outclasses the probe', () => {
    const intel = probeIntel(1, { ...target, instruments: { VEIL: 9 } }, 0, () => 0.5);
    expect(intel.reading.kind).toBe('UNREAD');
  });

  it('gives up the whole split only to a probe two rungs over the veil', () => {
    const intel = probeIntel(6, { ...target, instruments: { VEIL: 4 } }, 0, () => 0.5);
    expect(intel.reading.kind).toBe('SHARES');
  });

  /**
   * WHAT A RAID COULD TAKE, NOT WHAT THE WORLD IS HOLDING. The server's own rule, and the sim used
   * to break it twice over: it recorded the EXACT raw pile, so the Vault bought a simulated world
   * no privacy and the probe's accuracy bought its owner nothing.
   */
  it('reports what a raid could carry off, with the vault floor already out', () => {
    const vaulted = { ...target, buildings: { ...target.buildings, VAULT: 8 } };
    const open = { ...target, buildings: { ...target.buildings, VAULT: 0 } };
    const raw = 1_000 + 500 + 100 + 40 + 20 + 10;
    const perfect = () => 0.5;
    expect(probeIntel(9, vaulted, 0, perfect).takeable)
      .toBeLessThan(probeIntel(9, open, 0, perfect).takeable);
    expect(probeIntel(9, open, 0, perfect).takeable).toBeLessThanOrEqual(raw);
  });

  /** And the figure itself is a fuzzed reading: two probes of different strength do not agree. */
  it('reads the figure less precisely through a veil', () => {
    const clear = { ...target, instruments: { VEIL: 0 } };
    const veiled = { ...target, instruments: { VEIL: 9 } };
    const roll = () => 0.9;
    expect(probeIntel(8, clear, 0, roll).takeable)
      .not.toBe(probeIntel(1, veiled, 0, roll).takeable);
  });

  /** Ground guns never leave, so they are part of the wall a probe is reading. */
  it('reads the ground guns as part of the line', () => {
    const grounded = { ...target, fleet: {}, ground: { BASTION: 20 } };
    expect(probeIntel(6, grounded, 0, () => 0.5).reading.kind).not.toBe('NONE');
    expect(probeIntel(6, grounded, 0, () => 0.5).defence).toBeGreaterThan(0);
  });

  /** A probe is a flight, and the reading lands when it lands. */
  it('dates the reading to the probe’s arrival, not its launch', () => {
    expect(probeIntel(4, target, 500, () => 0.5).at).toBe(508);
  });
});

/**
 * THE PRIOR A COMMANDER ACTUALLY FLIES ON.
 *
 * `expectedDefence` used to average the exact rosters its scout had photographed. It now averages
 * CLASS READINGS, which is the only thing a probe sells — so `adaptiveMix` can still counter what
 * it saw, and can still be wrong about it.
 */
describe('the roster prior a simulated commander flies on', () => {
  const fallback: Composition = { DART: 1 };
  const at = (reading: ClassReading, when: number) =>
    new Map([[1, { takeable: 0, defence: 5_000, reading, at: when }]]);

  it('shapes the prior from what was read, not from what is there', () => {
    const line = expectedDefence(at({ kind: 'DOMINANT', cls: 'LANCE' }, 0), 100, fallback);
    expect(line.PIKE ?? 0).toBeGreaterThan(0);
    expect(line.DART ?? 0).toBe(0);
    expect(line.RAMPART ?? 0).toBe(0);
  });

  it('falls back to its own habits once a reading is a day stale', () => {
    const line = expectedDefence(at({ kind: 'DOMINANT', cls: 'LANCE' }, 0), 1_441, fallback);
    expect(line.PIKE ?? 0).toBe(0);
    expect(line.DART ?? 0).toBeGreaterThan(0);
  });

  /** A probe that resolved no class taught the commander nothing to counter. */
  it('falls back when every reading failed to resolve a class', () => {
    /*
      ANNOTATED RATHER THAN ASSERTED. Without a contextual type TypeScript widens `kind` to
      `string` and the Map stops being a `ReadonlyMap<number, SimIntel>`; with a per-element
      `as ClassReading` the linter calls the assertion unnecessary. The annotation satisfies both,
      and unlike an assertion it would catch a literal that is not a reading at all.
    */
    const readings = new Map<number, SimIntel>([
      [1, { takeable: 0, defence: 5_000, reading: { kind: 'UNREAD' }, at: 0 }],
      [2, { takeable: 0, defence: 5_000, reading: { kind: 'EVEN' }, at: 0 }],
    ]);
    const line = expectedDefence(readings, 100, fallback);
    expect(line.DART ?? 0).toBeGreaterThan(0);
  });

  it('always meets the ground guns', () => {
    const line = expectedDefence(new Map(), 100, fallback);
    for (const id of GROUND_HULLS) expect(line[id] ?? 0).toBeGreaterThan(0);
  });
});
