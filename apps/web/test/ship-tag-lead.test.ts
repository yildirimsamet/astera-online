import { describe, expect, it } from 'vitest';
import { VESSEL_SYSTEMS } from '@astera/rules';
import { TAG_REACH, TAG_STEP_SECONDS, tagLead } from '../src/galaxy/shipTags.js';
import { REPORT_ROUND_MS } from '../src/starter/director/scenes.js';

/** Live playthrough 2026-11-18: with the stern to the left the drive's chip ran off the screen. */
describe('which way a hull tag leads', () => {
  const width = 350;

  it('keeps its own way while the chip fits on the screen', () => {
    expect(tagLead(200, width, -44)).toBe(-44);
    expect(tagLead(150, width, 42)).toBe(42);
  });

  it('turns to the other side where its own would leave the screen', () => {
    expect(tagLead(40, width, -44)).toBe(44);
    expect(tagLead(width - 40, width, 42)).toBe(-42);
  });

  it('turns only when the whole chip would not fit, not at the first pixel', () => {
    const edge = 44 + TAG_REACH + 8;
    expect(tagLead(edge, width, -44)).toBe(-44);
    expect(tagLead(edge - 1, width, -44)).toBe(44);
  });

  it('leaves a tag that stands above or below its pin as it is', () => {
    expect(tagLead(10, width, 0)).toBe(0);
  });
});

// Owner 2026-11-18: the report's names went by too fast. They are called over the round, the last
// one with time left to be read before the shot moves on.
describe('when the report names each system', () => {
  it('spreads the names over the round and leaves the last one time to be read', () => {
    const last = (VESSEL_SYSTEMS.length - 1) * TAG_STEP_SECONDS * 1000;
    expect(last).toBeGreaterThanOrEqual(REPORT_ROUND_MS * 0.4);
    expect(REPORT_ROUND_MS - last).toBeGreaterThanOrEqual(3000);
  });
});
