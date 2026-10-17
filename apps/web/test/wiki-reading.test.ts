import { describe, expect, it } from 'vitest';
import { flightSlots, satelliteSlots, groundSlots, telescopeRange, telescopeWatchRange, researchEffectAt, hullWorkMinutes, HULLS, TRAVEL, DEUTERIUM } from '@astera/rules';
import { getWikiArticle } from '../src/wiki/catalog.js';
import { conceptReference, number, subjectReference } from '../src/wiki/facts.js';

describe('Wiki values a new player can interpret', () => {
  it('explains personal signals, all odds, losses, radar, delivery and the production collector in both editions', () => {
    const article = getWikiArticle('galaxy.unknown-signals');
    expect(article).toBeDefined();
    for (const language of ['en', 'tr'] as const) {
      const text = JSON.stringify(article?.sections[language]);
      for (const value of ['56', '15', '12', '16', '1', '60', '2.5', '200', '100']) expect(text).toContain(value);
      expect(text).toMatch(/1[,.]?000/);
      expect(text).toMatch(language === 'en' ? /offline/i : /çevrimdışı/i);
      expect(text).toMatch(language === 'en' ? /Courier/ : /Kurye/);
      expect(text).toMatch(language === 'en' ? /capacity stays|capacity does not/i : /kapasite.*(değişmez|büyümez)/i);
    }
  });
  it('teaches manual maintenance, the 5% combat limit and scrap returns', () => {
    for (const language of ['en', 'tr'] as const) {
      const article = getWikiArticle('fleet.repairs');
      const text = JSON.stringify(article?.sections[language]);
      expect(text).toMatch(language === 'en' ? /manual|yourself/i : /kendin|manuel/i);
      expect(text).toMatch(language === 'en' ? /5%/ : /%5/);
      expect(text).toMatch(language === 'en' ? /scrap/i : /parçala/i);
      expect(text).not.toMatch(/repaired free on landing/i);
    }
  });
  it('publishes the new Aegis invoice and capacity together in English and Turkish', () => {
    for (const language of ['en', 'tr'] as const) {
      const table = subjectReference({ kind: 'instrument', id: 'AEGIS' }, language).blocks
        .find(block => block.kind === 'table');
      if (table?.kind !== 'table') throw new Error('Missing Aegis table');
      expect(table.rows[0]).toEqual([number(1, language), number(197, language), number(148, language), number(0, language), number(150, language)]);
      expect(table.rows[7]).toEqual([number(8, language), number(5288, language), number(3973, language), number(0, language), number(2563, language)]);
    }
  });
  it('compares Easy and Hard monuments and explains repeated support and per-ship refunds', () => {
    for (const language of ['en', 'tr'] as const) {
      const blocks = conceptReference('galaxy.monuments', language)?.blocks;
      const easy = language === 'en' ? 'Easy' : 'Kolay';
      const hard = language === 'en' ? 'Hard' : 'Zor';
      const table = blocks?.find(block => block.kind === 'table' && block.columns.includes(easy));
      if (table?.kind !== 'table') throw new Error('Missing monument difficulty comparison');
      expect(table.columns).toContain(hard);
      expect(table.rows).toContainEqual([language === 'en' ? 'Commander tiers allowed to send' : 'Yeni filo gönderebilen komutan tier’ları', '1–3', '4+']);
      expect(table.rows.some(row => row.includes(number(1550, language)) && row.includes(number(7270, language)))).toBe(true);
      expect(table.rows.at(-1)).toEqual([language === 'en' ? 'Probe loss chance' : 'Sonda kayıp şansı',
        language === 'en' ? '75%' : '%75', language === 'en' ? '75%' : '%75']);
      const article = getWikiArticle('galaxy.monuments');
      const text = article?.sections[language].flatMap(section => section.blocks.flatMap(block => block.kind === 'text' ? [block.text] : [])).join(' ');
      expect(text).toMatch(language === 'en'
        ? /combat and cargo reinforcements while earlier fleets are outbound, holding or returning/i
        : /filolar yoldayken, anıtta beklerken veya dönerken savaş ve yük gemisi desteği/i);
      expect(text).toMatch(language === 'en'
        ? /unused reserve is refunded only when it reaches home; ships that never return lose their share/i
        : /kullanılmayan payı yalnız o gemi eve varınca iade edilir; dönemeyen geminin payı yanar/i);
      if (language === 'tr') expect(text).not.toMatch(/\bEasy\b|\bHard\b/);
    }
  });
  it('separates monument capture, battle grade and score without exposing enemy survivors', () => {
    const article = getWikiArticle('galaxy.monuments');
    if (!article) throw new Error('Missing monument article');
    const text = (language: 'en' | 'tr') => article.sections[language].flatMap(section =>
      section.blocks.flatMap(block => block.kind === 'text' ? [block.text] : [])).join(' ');
    expect(text('en')).toMatch(/whole defence.*armed ship/i);
    expect(text('en')).toMatch(/positive.*Dominion.*without.*captur/i);
    expect(text('tr')).toMatch(/savunmanın tamamını/);
    expect(text('tr')).toMatch(/Hâkimiyet.*ele geçireme/);
  });
  it('compares Shipyard levels by time saved from each preceding level, for all units', () => {
    for (const language of ['en', 'tr'] as const) {
      const reference = subjectReference({ kind: 'building', id: 'SHIPYARD' }, language);
      const table = reference.blocks.find(block => block.kind === 'table');
      if (table?.kind !== 'table') throw new Error('Missing Shipyard levels');
      const column = table.columns.indexOf(language === 'en' ? 'Production time saved vs previous level' : 'Önceki seviyeye göre üretim süresindeki azalma');
      expect(column).toBeGreaterThanOrEqual(0);
      for (const [index, row] of table.rows.entries()) {
        const saved = 1 - hullWorkMinutes('CITADEL', 2, index + 1, {}) / hullWorkMinutes('CITADEL', 2, index, {});
        const percentage = number(Math.round(saved * 1000) / 10, language);
        expect(row[column]).toBe(language === 'tr' ? `%${percentage}` : `${percentage}%`);
      }
      expect(JSON.stringify(reference.blocks)).not.toMatch(/1 Dart|1 Ok/);
    }
  });
  it('explains that a zero minimum Shipyard level does not require an upgrade', () => {
    const article = getWikiArticle('hull.DART');
    if (!article) throw new Error('Missing Dart requirements');
    for (const language of ['en', 'tr'] as const) {
      const text = article.sections[language].find(section => section.id === 'requirements')?.blocks.flatMap(block => block.kind === 'text' ? [block.text] : []).join(' ');
      expect(text).toContain(language === 'en' ? 'No Shipyard upgrade is required' : 'Tersane yükseltmesi gerekmez');
      expect(text).not.toMatch(/level 0|0\. seviye/);
    }
  });
  it('formats Turkish percentages with the sign before the value in prose and tables', () => {
    const article = getWikiArticle('research.GRAVITIC_CHARGES');
    if (!article) throw new Error('Missing discovery explanation');
    const prose = article.sections.tr.flatMap(section => section.blocks.flatMap(block => block.kind === 'text' ? [block.text] : [])).join(' ');
    expect(prose).toContain(`%${number(DEUTERIUM.graviticDiscoveryShieldShare * 100, 'tr')}`);
    const table = conceptReference('combat.model', 'tr')?.blocks.find(block =>
      block.kind === 'table' && block.columns.includes('Depo koruması üzerindeki stok'));
    if (table?.kind !== 'table') throw new Error('Missing combat percentages');
    expect(table.rows).toHaveLength(4);
    for (const row of table.rows) for (const value of row.slice(2)) expect(value).toMatch(/^%\d+(?:,\d+)?$/);
  });
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
