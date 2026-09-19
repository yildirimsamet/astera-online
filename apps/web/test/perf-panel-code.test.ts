import { describe, expect, it } from 'vitest';
import { PERF_PANEL_CODES, perfPanelCode } from '../src/screens/GalaxyView.js';

/** The recording names the open sheet by a stable number; none is zero. */
describe('the sheet a recording names', () => {
  it('is zero for none and a distinct positive number for each sheet', () => {
    expect(perfPanelCode(null)).toBe(0);
    const codes = PERF_PANEL_CODES.map((panel) => perfPanelCode(panel));
    expect(new Set(codes).size).toBe(PERF_PANEL_CODES.length);
    expect(Math.min(...codes)).toBe(1);
    expect(perfPanelCode('leaderboard')).toBe(5);
    expect(perfPanelCode('intel')).toBe(3);
  });
});
