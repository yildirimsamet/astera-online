import { describe, expect, it } from 'vitest';
import type { AuditedTarget, AuditedText, SurfaceAudit } from '../src/audit.js';
import { mergeParts, readingStats } from '../src/merge.js';

const box = { left: 0, top: 0, right: 40, bottom: 20 };

const text = (id: string, over: Partial<AuditedText> = {}): AuditedText => ({
  id, key: null, label: 'p', text: id, fontSize: 12, renderedSize: 12, fontWeight: 400, uppercase: false, letterSpacing: 0, lineHeight: 1.4, lines: 1,
  truncated: false, clipped: false, gradient: false, placeholder: false, inactive: false, box, rendered: true, charsPerLine: 2, contrast: null, ...over,
});

const target = (id: string, over: Partial<AuditedTarget> = {}): AuditedTarget => ({
  id, key: null, label: 'button', name: id, visibleText: true, disabled: false, hasIcon: false, box,
  region: { target: '0', area: 800, box, width: 40, height: 20, fill: 1 }, coverage: 1, spacingFail: false, nearestGap: null, iconContrast: null, feedback: 'none', ...over,
});

const part = (over: Partial<SurfaceAudit>): SurfaceAudit => ({
  surface: 's', viewport: { width: 350, height: 812, dpr: 2 }, texts: [], targets: [], sceneArea: 0,
  stats: { words: 0, sentences: 0, longestSentence: 0, atesman: null }, palette: [], hues: [], spacing: { values: {}, offGrid: 0, total: 0 },
  overflow: { page: false, elements: [] }, motion: { transitions: [], animations: [] }, parts: 1, partsCapped: false, ...over,
});

describe('merging the parts of a scrolled surface', () => {
  const top = part({
    texts: [text('header'), text('row1'), text('row5', { rendered: false })],
    targets: [target('close'), target('row1-btn'), target('row5-btn', { region: null, feedback: null })],
    sceneArea: 600,
    palette: [{ rgb: [200, 40, 40], weight: 10 }],
    spacing: { values: { '4': 2, '5': 1 }, offGrid: 1, total: 3 },
    motion: { transitions: [{ key: null, label: 'a', seconds: 0.2 }], animations: [] },
  });
  const below = part({
    texts: [text('header'), text('row5'), text('row9')],
    targets: [target('close'), target('row5-btn'), target('row9-btn')],
    sceneArea: 0,
    palette: [{ rgb: [40, 40, 200], weight: 10 }],
    spacing: { values: { '4': 1, '6': 1 }, offGrid: 1, total: 2 },
    motion: { transitions: [{ key: null, label: 'b', seconds: 0.5 }], animations: [] },
    overflow: { page: true, elements: ['wide'] },
  });
  const merged = mergeParts([top, below], true);

  it('keeps each text once, taking the part where it showed', () => {
    expect(merged.texts.map((t) => `${t.id}:${String(t.rendered)}`)).toEqual(['header:true', 'row1:true', 'row5:true', 'row9:true']);
  });

  it('keeps each target once, taking the part where a press could reach it', () => {
    expect(merged.targets.map((t) => `${t.id}:${t.region ? 'reach' : 'none'}`)).toEqual(['close:reach', 'row1-btn:reach', 'row5-btn:reach', 'row9-btn:reach']);
  });

  it('takes a target from the part that shows most of it, not where a fixed bar half covered it', () => {
    const cut = { target: '0', area: 120, box, width: 40, height: 3, fill: 1 };
    const covered = part({ targets: [target('max', { region: cut, coverage: 0.15 })] });
    const clear = part({ targets: [target('max')] });
    expect(mergeParts([covered, clear], false).targets[0]?.coverage).toBe(1);
    expect(mergeParts([clear, covered], false).targets[0]?.coverage).toBe(1);
  });

  it('judges a text that scrolls where it reads best, and a fixed one where it reads worst', () => {
    const contrast = (p5: number) => ({ min: p5, p5, median: p5, apcaP5: 60 });
    const low = { left: 0, top: 700, right: 40, bottom: 720 };
    const high = { left: 0, top: 300, right: 40, bottom: 320 };
    const scrolled = mergeParts([part({ texts: [text('row', { box: low, contrast: contrast(1.5) })] }), part({ texts: [text('row', { box: high, contrast: contrast(12) })] })], false);
    expect(scrolled.texts[0]?.contrast?.p5).toBe(12);
    const fixed = mergeParts([part({ texts: [text('title', { contrast: contrast(12) })] }), part({ texts: [text('title', { contrast: contrast(2) })] })], false);
    expect(fixed.texts[0]?.contrast?.p5).toBe(2);
  });

  it('keeps the press answer from the part where the target was pressed', () => {
    const cut = { target: '0', area: 120, box, width: 40, height: 3, fill: 1 };
    const pressed = part({ targets: [target('max', { region: cut, coverage: 0.15, feedback: 'active' })] });
    const later = part({ targets: [target('max', { feedback: null })] });
    expect(mergeParts([pressed, later], false).targets[0]).toMatchObject({ coverage: 1, feedback: 'active' });
  });

  it('adds up what each part counted only once: spacing, palette, motion', () => {
    expect(merged.spacing).toEqual({ values: { '4': 3, '5': 1, '6': 1 }, offGrid: 2, total: 5 });
    expect(merged.palette).toHaveLength(2);
    expect(merged.hues.length).toBe(2);
    expect(merged.motion.transitions.map((t) => t.label)).toEqual(['a', 'b']);
  });

  it('keeps the first part\'s viewport and scene, and any overflow', () => {
    expect(merged.sceneArea).toBe(600);
    expect(merged.overflow).toEqual({ page: true, elements: ['wide'] });
  });

  it('says how many parts it took and whether the scroll was cut short', () => {
    expect(merged).toMatchObject({ parts: 2, partsCapped: true });
    expect(mergeParts([top], false)).toMatchObject({ parts: 1, partsCapped: false });
  });

  it('reads the merged text again for the reading statistics', () => {
    expect(merged.stats.words).toBe(4);
  });
});

describe('reading statistics', () => {
  it('counts words and sentences over shown text, and scores prose only', () => {
    const stats = readingStats([
      text('a', { text: 'Filo hazır' }),
      text('b', { text: 'Filon yola çıktı. Varış iki saat sonra.' }),
      text('c', { text: 'Gizli metin burada', rendered: false }),
    ]);
    expect(stats.words).toBe(9);
    expect(stats.atesman).not.toBeNull();
  });
});
