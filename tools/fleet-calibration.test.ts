import { expect, it } from 'vitest';
import {
  DEFAULT_FLEET_CALIBRATION_SAMPLES,
  calibrationReport,
  maxCoreLevel,
} from './fleet-calibration.js';

it('uses the 64 deterministic samples stated by the published D208 audit', () => {
  expect(DEFAULT_FLEET_CALIBRATION_SAMPLES).toBe(64);
});

it('reads the final live Core level rather than a nonexistent cached peak', () => {
  expect(maxCoreLevel([{ buildings: { CORE: 7 } }, { buildings: { CORE: 12 } }])).toBe(12);
  expect(maxCoreLevel([])).toBe(0);
});

it('reports the live table, complete ordered comparisons and physical mission budgets reproducibly', () => {
  const report = calibrationReport({ seasons: false, samples: 4, budgets: [50_000] });
  expect(report.resourceValue).toEqual({ alloy: 1, crystal: 2, deuterium: 32 });
  expect(report.merchantRate).toEqual(report.resourceValue);
  expect(report.matrix.pairs).toHaveLength(17 ** 2 * 2);
  expect(report.matrix.progression).toHaveLength(12);
  expect(report.physical.length).toBeGreaterThan(100);
  expect(report.specialists.length).toBeGreaterThan(0);
  expect(report.seasons).toEqual([]);
  expect(report.sourceHashes['valuation.ts']).toMatch(/^[a-f0-9]{64}$/);
  expect(report.sourceHashes['score.ts']).toMatch(/^[a-f0-9]{64}$/);
  expect(report.sourceHashes['fleet-calibration.ts']).toMatch(/^[a-f0-9]{64}$/);
  expect(report.sourceHashes['fleet-calibration-tool.ts']).toMatch(/^[a-f0-9]{64}$/);
  expect(report).toEqual(calibrationReport({ seasons: false, samples: 4, budgets: [50_000] }));
  for (const row of report.physical) {
    expect(row.lowerBuild.deuterium + row.lowerFuel).toBeLessThanOrEqual(row.wallet.deuterium);
    expect(row.higherBuild.deuterium + row.higherFuel).toBeLessThanOrEqual(row.wallet.deuterium);
  }
});
