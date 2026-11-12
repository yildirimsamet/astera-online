import { describe, expect, it } from 'vitest';
import type { AuditedTarget, AuditedText, SurfaceAudit } from '../src/audit.js';
import type { Surface } from '../src/inventory.js';
import { compareSummaries, renderComparison, renderReport, summarize, type Entry } from '../src/report.js';

const box = { left: 0, top: 300, right: 40, bottom: 340 };

let next = 0;
const text = (renderedSize: number, over: Partial<AuditedText> = {}): AuditedText => ({
  id: String(next++), key: null, label: 'p', text: 'Filo hazır', fontSize: renderedSize, renderedSize, fontWeight: 400, uppercase: false, letterSpacing: 0,
  lineHeight: 1.4, lines: 1, truncated: false, clipped: false, gradient: false, placeholder: false, inactive: false, box, rendered: true, charsPerLine: 10,
  contrast: { min: 10, p5: 10, median: 12, apcaP5: 80 }, ...over,
});

const target = (side: number, over: Partial<AuditedTarget> = {}): AuditedTarget => ({
  id: String(next++), key: null, label: 'button', name: 'Tamam', visibleText: true, disabled: false, hasIcon: false, box,
  region: { target: '0', area: side * side, box: { left: 0, top: 300, right: side, bottom: 300 + side }, width: side, height: side, fill: 1 },
  coverage: 1, spacingFail: false, nearestGap: null, iconContrast: null, feedback: 'active', ...over,
});

const audit = (over: Partial<SurfaceAudit>): SurfaceAudit => ({
  surface: 'a', viewport: { width: 350, height: 812, dpr: 2 }, texts: [], targets: [], sceneArea: 0,
  stats: { words: 2, sentences: 1, longestSentence: 2, atesman: null }, palette: [], hues: [], spacing: { values: {}, offGrid: 0, total: 0 },
  overflow: { page: false, elements: [] }, motion: { transitions: [], animations: [] }, parts: 1, partsCapped: false, ...over,
});

const surfaces: Surface[] = [
  { id: 'a', what: 'A', files: [], reach: ['gallery:x', 'gallery:y'] },
  { id: 'b', what: 'B', files: [], reach: ['client:b'] },
];

const entries: Entry[] = [
  {
    surface: 'a', reach: 'gallery:x', lang: 'tr', profile: 'phone', error: null,
    audit: audit({
      texts: [text(9), text(14), text(9, { rendered: false }), text(11, { contrast: { min: 1, p5: 2, median: 3, apcaP5: 20 }, truncated: true })],
      targets: [
        target(20, { feedback: 'none', spacingFail: true }), target(48),
        target(40, { name: '', visibleText: false, hasIcon: true }), target(200, { name: '', visibleText: false }),
      ],
    }),
  },
  { surface: 'a', reach: 'gallery:y', lang: 'tr', profile: 'phone', error: 'Timeout 30000ms', audit: null },
  { surface: 'a', reach: 'gallery:x', lang: 'de', profile: 'narrow', error: null, audit: audit({ texts: [text(12, { truncated: true })], overflow: { page: true, elements: ['wide'] }, parts: 8, partsCapped: true }) },
];

describe('summarising a run', () => {
  const summary = summarize(entries, surfaces);

  it('accounts for every reach in the inventory: measured, failed or not run', () => {
    expect(summary.coverage).toEqual([
      { surface: 'a', reach: 'gallery:x', status: 'measured', runs: ['tr/phone', 'de/narrow'], error: null },
      { surface: 'a', reach: 'gallery:y', status: 'error', runs: [], error: 'Timeout 30000ms' },
      { surface: 'b', reach: 'client:b', status: 'not-run', runs: [], error: null },
    ]);
  });

  it('counts rendered phone text by size bucket, leaving hidden text out', () => {
    expect(summary.phone.sizes).toMatchObject({ '9–10': 1, '11–12': 1, '≥14': 1 });
  });

  it('counts contrast failures, small targets, missing press answers and spacing failures on the phone', () => {
    expect(summary.phone.contrastFails).toHaveLength(1);
    expect(summary.phone.targets).toMatchObject({ '<24': 1, '24–44': 1, '≥48': 2 });
    expect(summary.phone.noFeedback).toHaveLength(1);
    expect(summary.phone.spacingFails).toHaveLength(1);
  });

  it('counts targets reaching into the system gesture zones', () => {
    expect(summary.phone.gestureZone.map((t) => t.detail)).toEqual(['left', 'left', 'left', 'left']);
  });

  it('tells unnamed icon buttons from bare tap areas such as backdrops', () => {
    expect(summary.phone.iconOnly).toBe(1);
    expect(summary.phone.unnamedIcons.map((t) => t.width)).toEqual([40]);
    expect(summary.phone.unnamedAreas.map((t) => t.width)).toEqual([200]);
  });

  it('names measurements the part limit cut short, so unmeasured content is not silent', () => {
    expect(summary.capped).toEqual([{ surface: 'a', reach: 'gallery:x', lang: 'de', profile: 'narrow', parts: 8 }]);
  });

  it('leaves the press answer of a run that pressed nothing unknown, not zero', () => {
    const [first] = entries;
    if (!first?.audit) throw new Error('the fixture needs a measured entry');
    const unpressed: Entry = { ...first, lang: 'en', audit: { ...first.audit, targets: first.audit.targets.map((t) => ({ ...t, feedback: null })) } };
    const rows = summarize([first, unpressed], surfaces).phone.rows;
    expect(rows.map((r) => [r.lang, r.noFeedback])).toEqual([['tr', 1], ['en', null]]);
    const markdown = renderReport(summarize([unpressed], surfaces), { title: 'Test', date: '2026-11-11' });
    expect(markdown).toMatch(/\| a \| `gallery:x` \| en \|(?: [^|]+ \|){5} — \|/);
  });

  it('scores Ateşman readability on Turkish only, the language the formula is made for', () => {
    const [first] = entries;
    if (!first?.audit) throw new Error('the fixture needs a measured entry');
    const scored = { ...first.audit, stats: { ...first.audit.stats, atesman: 70 } };
    const rows = summarize([{ ...first, audit: scored }, { ...first, lang: 'en', audit: scored }], surfaces).phone.rows;
    expect(rows.map((r) => [r.lang, r.atesman])).toEqual([['tr', 70], ['en', null]]);
  });

  it('collects truncation and sideways overflow from every language and size', () => {
    expect(summary.overflow.truncated.map((t) => `${t.lang}/${t.profile}`)).toEqual(['tr/phone', 'de/narrow']);
    expect(summary.overflow.pages).toEqual([{ surface: 'a', reach: 'gallery:x', lang: 'de', profile: 'narrow', elements: ['wide'] }]);
  });
});

describe('the markdown report', () => {
  it('opens with coverage and names what was not measured', () => {
    const markdown = renderReport(summarize(entries, surfaces), { title: 'Test', date: '2026-11-11' });
    expect(markdown).toContain('# Test');
    expect(markdown).toMatch(/Kapsam/);
    expect(markdown).toMatch(/client:b.*çalıştırılmadı/);
    expect(markdown).toMatch(/gallery:y.*Timeout 30000ms/);
    expect(markdown).toMatch(/kaydırma sınırı.*\n+- a · `gallery:x` · de\/narrow — 8 parça/);
  });

  it('says a screen size nothing was pressed on was not measured for press answers, rather than "none"', () => {
    const markdown = renderReport(summarize(entries, surfaces), { title: 'Test', date: '2026-11-11' });
    const sections = markdown.split('### Basma tepkisi (F1)').slice(1).map((s) => s.split('###')[0] ?? '');
    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatch(/\| Yok \| 1 \|/);
    expect(sections[1]).toMatch(/basılmadı/);
    expect(sections[1]).not.toMatch(/_Yok\._/);
  });
});

describe('text load per screenful (W1)', () => {
  const long = 'Bu hedefe karşı tartmak için gemi seç.';
  const stats = (words: number) => ({ words, sentences: 1, longestSentence: 7, atesman: null });
  const loaded: Entry = {
    surface: 'a', reach: 'gallery:x', lang: 'tr', profile: 'phone', error: null,
    audit: audit({ texts: [text(12, { text: long }), text(12, { text: long, rendered: false }), text(12)], stats: stats(120), parts: 2 }),
  };
  const light: Entry = { ...loaded, reach: 'gallery:y', audit: audit({ texts: [text(12)], stats: stats(10), parts: 1 }) };
  const english: Entry = { ...loaded, lang: 'en', audit: audit({ texts: [], stats: stats(900), parts: 1 }) };
  const summary = summarize([light, loaded, english], surfaces);
  const section = renderReport(summary, { title: 'Test', date: '2026-11-11' }).split('## Metin yükü (W1')[1]?.split('\n## ')[0] ?? '';

  it('keeps the scroll parts and counts shown blocks of six words or more', () => {
    const row = summary.phone.rows.find((r) => r.reach === 'gallery:x' && r.lang === 'tr');
    expect(row).toMatchObject({ words: 120, screens: 2, longBlocks: 1 });
  });

  it('lists Turkish phone screens by words per screenful, heaviest first, with the medians', () => {
    expect(section).toMatch(/2 ölçüm/);
    expect(section).toMatch(/kelime ortancası 35/);
    expect(section).toMatch(/\| a \| `gallery:x` \| 120 \| 2 \| 60 \| 1 \|/);
    expect(section.indexOf('`gallery:x`')).toBeLessThan(section.indexOf('`gallery:y`'));
    expect(section).not.toMatch(/900/);
  });

  it('weighs the medians against the text budget and names the screens over it (owner 2026-11-12, 2.3)', () => {
    expect(section).toMatch(/Bütçe \(2\.3\)[^\n]*kelime ortancası 35 \/ 55 ✅[^\n]*uzun blok ortancası 0,3 \/ 1 ✅/);
    const over = (section.split('Bütçeyi aşan')[1] ?? '').split('| Yüzey')[0] ?? '';
    expect(over).toMatch(/^[^\n]*\n+- a · `gallery:x` · 60 kelime\/ekran · 0,5 uzun blok\/ekran/);
    expect(over).not.toMatch(/gallery:y/);
  });
});

describe('the difference from the previous baseline', () => {
  const [first, second] = entries;
  if (!first || !second) throw new Error('the fixture needs two entries');
  const before = summarize(entries, surfaces);
  const after = summarize([{ ...first, audit: audit({ texts: [text(14)], targets: [target(48)] }) }, second], surfaces);
  const rows = compareSummaries(before, after);

  it('lines up each headline number before and after', () => {
    expect(rows.find((r) => r.metric === 'Görünen metin (telefon)')).toMatchObject({ before: 3, after: 1 });
    expect(rows.find((r) => r.metric === '12 px altı metin (telefon)')).toMatchObject({ before: 2, after: 0 });
    expect(rows.find((r) => r.metric === 'Kontrastı yetmeyen metin')).toMatchObject({ before: 1, after: 0 });
    expect(rows.find((r) => r.metric === 'Ölçülen giriş yolu')).toMatchObject({ before: 1, after: 1 });
  });

  it('renders as a table with the change', () => {
    expect(renderComparison(rows, '2026-11-01')).toMatch(/\| 12 px altı metin \(telefon\) \| 2 \| 0 \| −2 \|/);
  });
});
