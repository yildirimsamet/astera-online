import { describe, expect, it } from 'vitest';
import { MOON, RESEARCH_PROJECTS } from '@astera/rules';
import { planetSchema } from '../src/api/schemas.js';
import { RESEARCH_ART } from '../src/ui/assets.js';
import { buildOrderArt, buildOrderLabel } from '../src/lib/orders.js';
import { orderMinutes } from '../src/lib/orderTime.js';
import i18n from '../src/i18n/index.js';
import { planetView } from './fixtures.js';

/*
  V34 slice (S7, S8, V28, V29): the client reads a Common moon order on the construction line, names it and
  pictures it, and quotes Lunar Capture's set four hours rather than the Core's research clock.
*/
describe('the moon on the construction line', () => {
  const order = {
    id: 'm-1', queue: 'CONSTRUCTION' as const, slot: 0, kind: 'MOON' as const, subject: 'COMMON', count: 1,
    cost: MOON.build.cost, startedAt: new Date('2026-11-20T10:00:00Z'), finishesAt: new Date('2026-11-20T18:00:00Z'),
  };

  it('parses a moon order in a world’s queue', () => {
    const view = planetView();
    const parsed = planetSchema.parse({ ...view, queues: { CONSTRUCTION: [order], YARD: [] } });
    expect(parsed.queues?.CONSTRUCTION[0]?.kind).toBe('MOON');
  });

  it('names the order as a Common moon and pictures it with the capture rig', async () => {
    await i18n.changeLanguage('en');
    expect(buildOrderLabel(order)).toBe('Common moon');
    expect(buildOrderArt(order)).toBe(RESEARCH_ART.LUNAR_CAPTURE);
  });

  it('quotes Lunar Capture’s four hours whatever the Core', () => {
    const cost = RESEARCH_PROJECTS.LUNAR_CAPTURE.costAt(1);
    for (const CORE of [9, 14]) {
      expect(orderMinutes('RESEARCH', cost, { buildings: { CORE, SHIPYARD: 1 }, research: [] }, 1,
        { research: 'LUNAR_CAPTURE', level: 1 })).toBe(MOON.capture.minutes);
    }
  });
});
