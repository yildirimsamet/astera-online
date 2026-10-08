import { describe, expect, it } from 'vitest';
import { flightSlots, satelliteSlots, groundSlots, telescopeRange, telescopeWatchRange, researchEffectAt, HULLS, TRAVEL } from '@astera/rules';
import { getWikiArticle } from '../src/wiki/catalog.js';
import { number, subjectReference } from '../src/wiki/facts.js';

describe('Wiki values a new player can interpret', () => {
  it('names the three independent Core capacities in separate columns', () => {
    for (const language of ['en', 'tr'] as const) {
      const table = subjectReference({ kind: 'building', id: 'CORE' }, language).blocks.find(b => b.kind === 'table');
      if (table?.kind !== 'table') throw new Error('Missing Core table');
      const labels = language === 'en' ? ['Flight bays', 'Orbit slots', 'Ground-defence capacity'] : ['Uçuş rampaları', 'Yörünge yuvaları', 'Yer savunması kapasitesi'];
      for (const [i, rule] of [flightSlots, satelliteSlots, groundSlots].entries()) {
        const column = table.columns.indexOf(labels[i]!);
        expect(column).toBeGreaterThanOrEqual(0);
        for (const [index, row] of table.rows.entries()) expect(row[column]).toBe(number(rule(index + 1), language));
      }
    }
  });

  it('separates contact identification and watch range, with map units', () => {
    for (const language of ['en', 'tr'] as const) {
      const table = subjectReference({ kind: 'instrument', id: 'TELESCOPE' }, language).blocks.find(b => b.kind === 'table');
      if (table?.kind !== 'table') throw new Error('Missing Telescope table');
      const labels = language === 'en' ? ['Contact range (map units)', 'Watch range (map units)'] : ['Tanımlama menzili (harita birimi)', 'Gözlem menzili (harita birimi)'];
      for (const [i, rule] of [telescopeRange, telescopeWatchRange].entries()) {
        const column = table.columns.indexOf(labels[i]!);
        expect(column).toBeGreaterThanOrEqual(0);
        for (const [index, row] of table.rows.entries()) expect(row[column]).toBe(number(rule(index + 1), language));
      }
    }
  });

  it('distinguishes time remaining from a capacity multiplier and an extra Core requirement', () => {
    for (const id of ['AI_ROBOTS', 'YARD_AUTOMATION'] as const) {
      const reference = subjectReference({ kind: 'research', id }, 'en');
      const tables = reference.blocks.filter(b => b.kind === 'table');
      expect(tables[0]?.rows[0]?.at(-1)).toBe(`${number(researchEffectAt(id, 1) * 100, 'en')}% of base build time`);
      expect(tables[1]?.rows.find(r => r[0] === 'Capital Core requirement')?.[1]).toBe('No additional level requirement');
    }
    const cargo = subjectReference({ kind: 'research', id: 'CARGO_HOLDS' }, 'en').blocks.find(b => b.kind === 'table');
    if (cargo?.kind !== 'table') throw new Error('Missing cargo table');
    expect(cargo.rows[0]?.at(-1)).toBe(`${number(researchEffectAt('CARGO_HOLDS', 1), 'en')}× cargo capacity`);
  });

  it('quotes movement speed in map units per minute, rather than the internal tempo scale', () => {
    for (const language of ['en', 'tr'] as const) {
      const stats = subjectReference({ kind: 'hull', id: 'DART' }, language).blocks.find(b => b.kind === 'stats');
      if (stats?.kind !== 'stats') throw new Error('Missing speed');
      const speed = stats.items.find(s => s.key === 'speed');
      expect(speed?.label).toBe(language === 'en' ? 'Speed (map units/min)' : 'Hız (harita birimi/dakika)');
      expect(speed?.value).toBe(number(HULLS.DART.speed / TRAVEL.distanceFactor, language));
    }
  });

  it('keeps Turkish ordinal numbers intact in a complete catalogue description', () => {
    const article = getWikiArticle('instrument.TELESCOPE');
    if (!article) throw new Error('Missing Telescope');
    expect(article.description.tr).not.toMatch(/\d\.$/);
    expect(article.description.tr).toMatch(/(?:seviye|gözlem|hareket|tanıml)/i);
    expect(article.description.tr).toMatch(/[.!?]$/);
  });
});
