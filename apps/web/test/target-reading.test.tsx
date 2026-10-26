import { renderHook } from '@testing-library/react';
import { readPowerRange, shieldHp } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import type { GalaxyPlanet, IntelView } from '../src/api/schemas.js';
import { useTargetReading } from '../src/lib/useTargetReading.js';

/**
 * THE TARGET'S READING, AGAINST WHATEVER WING IS ASKED ABOUT. F3.5a.
 *
 * The launch sheet asks it about the fleet being packed; the dossier (E2) about what
 * stands home. Combat v3: it weighs the wing against the reading with `readPowerRange`,
 * fed everything the probe read and nothing it did not.
 */

const NOW = Date.now();

const world: GalaxyPlanet = {
  id: 'p2',
  name: 'Grimhold',
  owner: 'Sable',
  position: { x: 200, y: 0, z: 0 },
  coreTier: 2,
  coreLevel: 6,
  intel: 'RESOLVED',
  state: { kind: 'NORMAL' },
  satellites: [],
  shielded: false,
  isSelf: false,
};

const probed: IntelView = {
  watching: [],
  probeReports: [{
    targetPlanetId: 'p2',
    targetName: 'Grimhold',
    targetUsername: 'Sable',
    at: new Date(NOW - 2 * 60 * 60_000),
    accuracy: 0.8,
    detected: false,
    stock: { low: 18_000, high: 24_000 },
    deuteriumStock: null,
    defence: { low: 27_000, high: 53_000 },
    fleetSize: { low: 20, high: 40 },
    fleetHome: true,
  }],
  probeCooldowns: [],
  radarLog: [],
  probeCost: { alloy: 25, crystal: 25, deuterium: 0 },
};

const read = (intel: IntelView | undefined, wing: Record<string, number>, over: Partial<GalaxyPlanet> = {}) =>
  renderHook(() => useTargetReading({
    target: { kind: 'world', world: { ...world, ...over } },
    intel,
    reports: [],
    tech: {},
    wing,
    rulesetVersion: 0,
  })).result.current;

const report = probed.probeReports[0]!;

describe('the target reading', () => {
  it('stamps the reading and weighs the wing against it as the rules read it', () => {
    const reading = read(probed, { DART: 40 });
    expect(reading.opposing?.ageMinutes).toBeGreaterThanOrEqual(119);
    // An old report with no research read: anything the ladders allow.
    expect(reading.power).toEqual(readPowerRange({ fleet: { DART: 40 }, tech: {} },
      [{ value: report.defence, shape: undefined, research: undefined }], { low: 0, high: 0 }));
  });

  it('reads the research windows a v3 probe brought home', () => {
    const research = { SHIP_POWER: { low: 2, high: 3 } };
    const reading = read({ ...probed, probeReports: [{ ...report, research }] }, { DART: 40 });
    expect(reading.power).toEqual(readPowerRange({ fleet: { DART: 40 }, tech: {} },
      [{ value: report.defence, shape: undefined, research }], { low: 0, high: 0 }));
  });

  it('reads the doctrines of a report written before v3 as exact levels', () => {
    const reading = read({ ...probed, probeReports: [{ ...report, doctrines: { SHIP_ARMOR: 2 } }] }, { DART: 40 });
    expect(reading.power).toEqual(readPowerRange({ fleet: { DART: 40 }, tech: {} },
      [{ value: report.defence, shape: undefined, research: { SHIP_ARMOR: { low: 2, high: 2 } } }], { low: 0, high: 0 }));
  });

  it('meets an unmeasured dome as anything up to the most this world can hold', () => {
    const reading = read(probed, { DART: 40 }, { shielded: true });
    expect(reading.power).toEqual(readPowerRange({ fleet: { DART: 40 }, tech: {} },
      [{ value: report.defence, shape: undefined, research: undefined }], { low: 0, high: shieldHp(world.coreLevel) }));
  });

  it('weighs the wing alone where nobody has looked', () => {
    const reading = read(undefined, { DART: 40 });
    expect(reading.opposing).toBeNull();
    expect(reading.classReading).toBeNull();
    expect(reading.power?.mine.low).toBeGreaterThan(0);
    expect(reading.power?.theirs).toEqual({ low: 0, high: 0 });
  });

  it('weighs nothing for an empty wing, even against a reading', () => {
    expect(read(probed, {}).power).toBeNull();
  });
});
