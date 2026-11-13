import { describe, expect, it } from 'vitest';
import type { AuditedText, SurfaceAudit } from '../src/audit.js';
import type { Entry } from '../src/report.js';
import { WHAT_IF, renderWhatIf, whatIfCss, whatIfSummary } from '../src/whatif.js';

const text = (t: string, over: Partial<AuditedText> = {}): AuditedText => ({
  id: t, key: null, label: 'p', text: t, fontSize: 9, renderedSize: 9, fontWeight: 400, uppercase: false, letterSpacing: 0, lineHeight: 1.2, lines: 1,
  truncated: false, clipped: false, gradient: false, placeholder: false, inactive: false, box: { left: 0, top: 0, right: 10, bottom: 10 }, rendered: true, charsPerLine: 4, contrast: null, ...over,
});

const audit = (texts: AuditedText[], over: Partial<SurfaceAudit> = {}): SurfaceAudit => ({
  surface: 'a', viewport: { width: 350, height: 812, dpr: 2 }, texts, targets: [], sceneArea: 0, stats: { words: 0, sentences: 0, longestSentence: 0, atesman: null },
  palette: [], hues: [], spacing: { values: {}, offGrid: 0, total: 0 }, overflow: { page: false, elements: [] }, motion: { transitions: [], animations: [] }, parts: 1, partsCapped: false, ...over,
});

const entry = (lang: string, a: SurfaceAudit | null): Entry => ({ surface: 'a', reach: 'gallery:x', lang, profile: 'phone', audit: a, error: a ? null : 'boom' });

describe('the what-if type scales (plan §1.3)', () => {
  it('raises micro, caption and body in A, and leaves body in B', () => {
    expect(WHAT_IF.A).toEqual({ micro: 11, caption: 12, body: 14 });
    expect(WHAT_IF.B).toEqual({ micro: 11, caption: 12 });
  });

  it('writes them as root custom properties, which win over Tailwind\'s theme layer', () => {
    expect(whatIfCss('B')).toBe(':root { --text-micro: 11px !important; --text-caption: 12px !important; }');
  });
});

describe('comparing a what-if run with the baseline', () => {
  const base = [
    entry('tr', audit([text('Filo'), text('Kargo yükü', { lines: 1 })])),
    entry('de', audit([text('Flotte')])),
    entry('fr', null),
  ];
  const raised = [
    entry('tr', audit([text('Filo', { truncated: true }), text('Kargo yükü', { lines: 2 })], { parts: 2 })),
    entry('de', audit([text('Flotte', { clipped: true })], { overflow: { page: true, elements: ['row'] } })),
    entry('fr', audit([text('Flotte')])),
  ];
  const summary = whatIfSummary(base, raised);

  it('compares only measurements present in both runs', () => {
    expect(summary.pairs).toBe(2);
  });

  it('counts truncation, clipping, wrapping, scrolling and sideways overflow before and after', () => {
    expect(summary.before).toEqual({ truncated: 0, clipped: 0, wrapped: 0, scrolling: 0, parts: 2, overflowing: 0 });
    expect(summary.after).toEqual({ truncated: 1, clipped: 1, wrapped: 1, scrolling: 1, parts: 3, overflowing: 1 });
  });

  it('names the texts that break only under the raised scale', () => {
    expect(summary.broken.map((b) => `${b.lang}:${b.text}:${b.how}`)).toEqual(['tr:Filo:truncated', 'de:Flotte:clipped']);
  });

  it('renders a section the owner can read', () => {
    const md = renderWhatIf({ A: summary });
    expect(md).toMatch(/Seçenek A/);
    expect(md).toMatch(/\| Kesilen metin \| 0 \| 1 \|/);
    expect(md).toContain('"Filo"');
  });
});
