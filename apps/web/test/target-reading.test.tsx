import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { GalaxyPlanet, IntelView } from '../src/api/schemas.js';
import { useTargetReading } from '../src/lib/useTargetReading.js';

/**
 * THE TARGET'S READING, AGAINST WHATEVER WING IS ASKED ABOUT. F3.5a.
 *
 * The launch sheet asks it about the fleet being packed; the dossier (E2) about what
 * stands home. Its behaviour inside the launch is pinned by the launch suites; this
 * pins the two things the dossier leans on: no probe draws no enemy band and no
 * lines, and an empty wing draws no lines even against a reading.
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

const read = (intel: IntelView | undefined, wing: Record<string, number>) =>
  renderHook(() => useTargetReading({
    target: { kind: 'world', world },
    intel,
    reports: [],
    tech: {},
    wing,
    rulesetVersion: 0,
  })).result.current;

describe('the target reading', () => {
  it('puts the probe band on the axis, dated, and draws lines for a wing that can fight', () => {
    const reading = read(probed, { DART: 40 });
    expect(reading.opposing).toMatchObject({ low: 27_000, high: 53_000 });
    expect(reading.opposing?.ageMinutes).toBeGreaterThanOrEqual(119);
    expect(reading.lines).not.toBeNull();
  });

  it('draws no enemy band and no lines where nobody has looked', () => {
    const reading = read(undefined, { DART: 40 });
    expect(reading.opposing).toBeNull();
    expect(reading.lines).toBeNull();
    expect(reading.classReading).toBeNull();
  });

  it('draws no lines for an empty wing, even against a reading', () => {
    expect(read(probed, {}).lines).toBeNull();
  });
});
