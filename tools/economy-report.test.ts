import { describe, expect, it } from 'vitest';
import { buildEconomyReportXml } from './economy-report.js';

describe('economy report workbook', () => {
  it('contains the requested report sections and the level-20 ceiling', () => {
    const xml = buildEconomyReportXml();

    expect(xml).toContain('Binalar');
    expect(xml).toContain('Araştırmalar');
    expect(xml).toContain('Gemiler ve Savunma');
    expect(xml).toContain('Binalar 1–20');
  });
});
