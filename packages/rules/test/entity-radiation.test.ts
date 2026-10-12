import { describe, expect, it } from 'vitest';
import { segmentsExposureHp, segmentsUntil, type HpRadiationSource, type Segment } from '../src/index.js';

const minute = 60_000;
const monument = { kind: 'MONUMENT' as const, id: 'monument-a' };
const planet = { kind: 'PLANET' as const, id: 'planet-a' };
const source: HpRadiationSource = {
  id: 'emit', target: monument, center: { x: 6000, y: 0, z: 0 }, radius: 1000,
  mode: 'EMIT', intensityHpPerMinute: 5, activeFromMs: 0, activeUntilMs: null,
};
const waiting: Segment = {
  target: monument, from: { x: -6000, y: 0, z: 0 }, to: { x: -6000, y: 0, z: 0 },
  startMs: 0, endMs: 20 * minute,
};

describe('radiation belongs to the occupied entity', () => {
  it('does not damage a flight through the visual cloud, even one ending at its centre', () => {
    const outbound: Segment = { from: source.center, to: source.center, startMs: 0, endMs: 20 * minute };
    expect(segmentsExposureHp([outbound], [source])).toBe(0);
  });
  it('damages a docked fleet for its waiting time independently of coordinates and cloud radius', () => {
    expect(segmentsExposureHp([waiting], [source])).toBe(100);
    expect(segmentsExposureHp([waiting], [{ ...source, radius: 1 }])).toBe(100);
  });
  it('keeps planet and monument identities distinct and ignores another occupied target', () => {
    expect(segmentsExposureHp([{ ...waiting, target: { ...monument, id: 'other' } }], [source])).toBe(0);
    expect(segmentsExposureHp([{ ...waiting, target: { kind: 'PLANET', id: monument.id } }], [source])).toBe(0);
    expect(segmentsExposureHp([{ ...waiting, target: planet }], [{ ...source, target: planet }])).toBe(100);
  });
  it('adds the entity sources, clips historical windows and applies only its own shelter', () => {
    const extra = { ...source, id: 'extra', intensityHpPerMinute: 2, activeFromMs: 5 * minute, activeUntilMs: 15 * minute };
    const shelter: HpRadiationSource = { ...source, id: 'shelter', mode: 'SHELTER', activeFromMs: 10 * minute, activeUntilMs: 12 * minute };
    expect(segmentsExposureHp([waiting], [source, extra, shelter])).toBe(106);
    expect(segmentsExposureHp([waiting], [source, { ...shelter, target: planet }])).toBe(100);
  });
  it('keeps fractional waits and repeated projections invariant when a path is split', () => {
    const cut = segmentsUntil([waiting], 12_345);
    expect(segmentsExposureHp(cut, [source])).toBeCloseTo(5 * 12_345 / minute, 12);
    expect(segmentsExposureHp([...cut, { ...waiting, startMs: 12_345 }], [source])).toBeCloseTo(100, 12);
    expect(segmentsExposureHp([{ ...waiting, endMs: 0 }], [source])).toBe(0);
  });
  it('retains the static geometry of previously dealt sources', () => {
    const legacy = { ...source, target: undefined };
    expect(segmentsExposureHp([waiting], [legacy])).toBe(0);
    expect(segmentsExposureHp([{ ...waiting, from: source.center, to: source.center }], [legacy])).toBe(100);
  });
});
