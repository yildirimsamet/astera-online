import { describe, expect, it } from 'vitest';
import { contrastVerdict, distinctSizes, edgeBand, fastBlink, gestureZone, isLargeText, shoutedSmall, sizeBucket, slowTransition, targetBand, thinSmall, tightLines, wideLines } from '../src/criteria.js';

const text = (over: Partial<{ renderedSize: number; fontWeight: number; uppercase: boolean; text: string; lines: number; lineHeight: number | null; charsPerLine: number; contrast: { p5: number } | null }>) => ({
  renderedSize: 12, fontWeight: 400, uppercase: false, text: 'Filo', lines: 1, lineHeight: 1.4, charsPerLine: 4, contrast: { p5: 10 }, ...over,
});

describe('text size buckets (report §1.2 thresholds)', () => {
  it('puts each size in the bucket the floors are argued over', () => {
    expect(sizeBucket(7)).toBe('<9');
    expect(sizeBucket(9)).toBe('9–10');
    expect(sizeBucket(10.5)).toBe('10–11');
    expect(sizeBucket(11)).toBe('11–12');
    expect(sizeBucket(12)).toBe('12–13');
    expect(sizeBucket(13.9)).toBe('13–14');
    expect(sizeBucket(14)).toBe('≥14');
  });
});

describe('WCAG large text and the contrast verdict', () => {
  it('counts 24 px, or 18.66 px bold, as large', () => {
    expect(isLargeText(text({ renderedSize: 24 }))).toBe(true);
    expect(isLargeText(text({ renderedSize: 19, fontWeight: 700 }))).toBe(true);
    expect(isLargeText(text({ renderedSize: 19, fontWeight: 600 }))).toBe(false);
  });

  it('holds normal text to 4.5:1 and large text to 3:1 on the worst five percent', () => {
    expect(contrastVerdict(text({ contrast: { p5: 4.4 } }))).toBe('fail');
    expect(contrastVerdict(text({ contrast: { p5: 4.5 } }))).toBe('pass');
    expect(contrastVerdict(text({ renderedSize: 24, contrast: { p5: 3.1 } }))).toBe('pass');
    expect(contrastVerdict(text({ contrast: null }))).toBeNull();
  });

  it('leaves text on a disabled control unjudged, as WCAG 1.4.3 does', () => {
    expect(contrastVerdict({ ...text({ contrast: { p5: 1.5 } }), inactive: true })).toBeNull();
  });
});

describe('type habits', () => {
  it('flags small uppercase runs longer than two words', () => {
    expect(shoutedSmall(text({ uppercase: true, text: 'FİLO YOLA ÇIKTI' }))).toBe(true);
    expect(shoutedSmall(text({ uppercase: true, text: 'FİLO HAZIR' }))).toBe(false);
    expect(shoutedSmall(text({ uppercase: true, renderedSize: 13, text: 'FİLO YOLA ÇIKTI' }))).toBe(false);
  });

  it('flags cramped multi-line text, and leaves "normal" line height unjudged', () => {
    expect(tightLines(text({ lines: 2, lineHeight: 1.2 }))).toBe(true);
    expect(tightLines(text({ lines: 1, lineHeight: 1.0 }))).toBe(false);
    expect(tightLines(text({ lines: 3, lineHeight: null }))).toBe(false);
  });

  it('flags lines longer than fifty characters on a phone', () => {
    expect(wideLines(text({ lines: 2, charsPerLine: 51 }))).toBe(true);
    expect(wideLines(text({ lines: 2, charsPerLine: 50 }))).toBe(false);
  });

  it('flags thin weights below 16 px', () => {
    expect(thinSmall(text({ fontWeight: 300 }))).toBe(true);
    expect(thinSmall(text({ fontWeight: 300, renderedSize: 16 }))).toBe(false);
  });

  it('counts distinct sizes to the half pixel', () => {
    expect(distinctSizes([text({ renderedSize: 12 }), text({ renderedSize: 12.2 }), text({ renderedSize: 9 }), text({ renderedSize: 16 })])).toBe(3);
  });
});

describe('touch target bands', () => {
  const region = (width: number, height: number) => ({ width, height });

  it('bands a target by its smaller side', () => {
    expect(targetBand(region(80, 20))).toBe('<24');
    expect(targetBand(region(30, 40))).toBe('24–44');
    expect(targetBand(region(46, 60))).toBe('44–48');
    expect(targetBand(region(48, 48))).toBe('≥48');
  });

  it('places a target in the top, middle or bottom of the screen (Hoober: edges need larger targets)', () => {
    expect(edgeBand({ top: 10, bottom: 40 }, 812)).toBe('top');
    expect(edgeBand({ top: 400, bottom: 440 }, 812)).toBe('middle');
    expect(edgeBand({ top: 760, bottom: 800 }, 812)).toBe('bottom');
  });
});

describe('system gesture zones (K4)', () => {
  const viewport = { width: 350, height: 812 };

  it('names the Android back-gesture strips and the home bar a target reaches into', () => {
    expect(gestureZone({ left: 0, top: 300, right: 40, bottom: 340 }, viewport)).toBe('left');
    expect(gestureZone({ left: 320, top: 300, right: 350, bottom: 340 }, viewport)).toBe('right');
    expect(gestureZone({ left: 100, top: 790, right: 200, bottom: 812 }, viewport)).toBe('bottom');
  });

  it('leaves targets clear of them alone', () => {
    expect(gestureZone({ left: 24, top: 300, right: 326, bottom: 780 }, viewport)).toBeNull();
  });
});

describe('motion', () => {
  it('flags endless animations that cycle more than three times a second', () => {
    expect(fastBlink({ seconds: 0.2, infinite: true })).toBe(true);
    expect(fastBlink({ seconds: 0.4, infinite: true })).toBe(false);
    expect(fastBlink({ seconds: 0.2, infinite: false })).toBe(false);
  });

  it('flags interface transitions over 300 ms', () => {
    expect(slowTransition(0.6)).toBe(true);
    expect(slowTransition(0.3)).toBe(false);
  });
});
