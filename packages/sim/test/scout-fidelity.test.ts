import { describe, expect, it } from 'vitest';
import { GROUND_HULLS, INTEL, classReading, mulberry32, probeAccuracy, type ClassReading } from '@astera/rules';
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
/** Combat v3 (owner 2026-10-25): every class as a range, as wide as the accuracy leaves. */
const widest = (reading: ClassReading) => {
  if (reading.kind !== 'RANGES') throw new Error(`expected ranges, got ${reading.kind}`);
  return Math.max(...Object.values(reading.shares).map((r) => r.high - r.low));
};

describe('what a simulated scout may learn', () => {
  const wall = { BALLISTA: 100, TEMPEST: 10 };

  it('reads only what a probe of that accuracy sells', () => {
    const par = probeAccuracy(4, 4);
    expect(readingOfLine(wall, par, mulberry32(1))).toEqual(classReading(wall, par, mulberry32(1)));
  });

  it('reads each class to about ±22 points at par accuracy', () => {
    expect(widest(readingOfLine(wall, probeAccuracy(4, 4), mulberry32(2)))).toBeLessThanOrEqual(46);
  });

  it('narrows the ranges to ±10 points only when the probe outclasses the veil', () => {
    expect(probeAccuracy(7, 4)).toBe(INTEL.accuracyMax);
    expect(widest(readingOfLine(wall, probeAccuracy(7, 4), mulberry32(3)))).toBeLessThanOrEqual(21);
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
    const shape = classReading(line, INTEL.accuracyMax, () => 0.5);
    if (shape.kind !== 'RANGES') throw new Error('expected ranges');
    expect(shape.shares.LANCE.low).toBeGreaterThan(shape.shares.BULWARK.low);
    expect(shape.shares.SKIRMISHER.low).toBe(0);
  });

  it('falls back to nothing when no reading resolved a class', () => {
    expect(expectedLineFromReadings([{ kind: 'EVEN' }, { kind: 'UNREAD' }])).toEqual({});
  });

  it('reads a range by its middle', () => {
    const line = expectedLineFromReadings([{ kind: 'RANGES', shares: {
      SKIRMISHER: { low: 0, high: 20 }, BULWARK: { low: 10, high: 30 }, LANCE: { low: 60, high: 80 },
    } }]);
    const shape = classReading(line, INTEL.accuracyMax, () => 0.5);
    if (shape.kind !== 'RANGES') throw new Error('expected ranges');
    expect(shape.shares.LANCE.low).toBeGreaterThan(shape.shares.BULWARK.high);
    expect(shape.shares.BULWARK.low).toBeGreaterThanOrEqual(shape.shares.SKIRMISHER.low);
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

  it('reads wider ranges through a veil that matches the probe than past one it outclasses', () => {
    const par = probeIntel(4, { ...target, instruments: { VEIL: 4 } }, 0, () => 0.5);
    const sharp = probeIntel(7, { ...target, instruments: { VEIL: 4 } }, 0, () => 0.5);
    expect(widest(par.reading)).toBeGreaterThan(widest(sharp.reading));
  });

  it('reads almost nothing from a world whose veil outclasses the probe', () => {
    const intel = probeIntel(1, { ...target, instruments: { VEIL: 9 } }, 0, () => 0.5);
    expect(widest(intel.reading)).toBeGreaterThanOrEqual(69);
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
