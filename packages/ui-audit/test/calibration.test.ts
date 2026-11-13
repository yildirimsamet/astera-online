import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditPage, type SurfaceAudit } from '../src/audit.js';
import { contrastVerdict } from '../src/criteria.js';

/**
 * THE AUDIT AGAINST A PAGE WHOSE ANSWERS ARE KNOWN.
 *
 * Every planted violation must be found and every good control left alone; a measuring
 * tool that is not calibrated produces numbers nobody should act on.
 */

const CALIBRATION = pathToFileURL(fileURLToPath(new URL('./fixtures/calibration.html', import.meta.url))).href;

let browser: Browser;
let audit: SurfaceAudit;

beforeAll(async () => {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 350, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(CALIBRATION);
  audit = await auditPage(page, { surface: 'calibration', frames: 2, feedback: true });
});

afterAll(async () => {
  await browser.close();
});

const text = (key: string) => {
  const found = audit.texts.find((t) => t.key === key);
  if (!found) throw new Error(`no text for #${key}`);
  return found;
};
const target = (key: string) => {
  const found = audit.targets.find((t) => t.key === key);
  if (!found) throw new Error(`no target for #${key}`);
  return found;
};

describe('text', () => {
  it('reads computed and rendered sizes, transforms included', () => {
    expect(text('tiny').fontSize).toBe(9);
    expect(text('scaled').fontSize).toBe(12);
    expect(text('scaled').renderedSize).toBeCloseTo(9, 1);
    expect(text('good-text').renderedSize).toBe(16);
  });

  it('sees uppercase and tracking', () => {
    expect(text('upper').uppercase).toBe(true);
    expect(text('upper').letterSpacing).toBeCloseTo(1, 1);
    expect(text('good-text').uppercase).toBe(false);
  });

  it('finds the truncated label and the clipped block, and nothing on good text', () => {
    expect(text('trunc').truncated).toBe(true);
    expect(text('clip').clipped).toBe(true);
    expect(text('clip').lines).toBe(2);
    expect(text('good-text').truncated).toBe(false);
    expect(text('good-text').clipped).toBe(false);
  });

  it('does not call a row clipped when it is only scrolled out of view, but still sees a clip inside a scroller', () => {
    expect(text('scroll-edge').clipped).toBe(false);
    expect(text('scroll-row').clipped).toBe(false);
    expect(text('clip-in-scroller').clipped).toBe(true);
  });

  it('judges clipping by the drawn letters, not by the taller line box of the font', () => {
    expect(text('tight-leading').clipped).toBe(false);
    expect(text('half-cut').clipped).toBe(true);
  });

  it('leaves out a name only a screen reader hears, and keeps the label it sits on', () => {
    expect(audit.texts.find((t) => t.key === 'sr-hidden')).toBeUndefined();
    expect(text('sr-host').rendered).toBe(true);
    expect(text('sr-host').clipped).toBe(false);
  });

  it('knows text hidden under an opaque lid is not on screen, even when the lid carries words of its own', () => {
    expect(text('buried').rendered).toBe(false);
    expect(text('good-text').rendered).toBe(true);
  });

  it('measures contrast where the letters are drawn, not over the rim their line box touches', () => {
    expect(text('inked').contrast?.p5).toBeGreaterThan(15);
  });

  it('judges a word a bar half hides only over the part that shows', () => {
    expect(text('part-hidden').rendered).toBe(true);
    expect(text('part-hidden').contrast?.p5).toBeGreaterThan(15);
  });

  it('judges letters inside a dark halo against the halo (WCAG 1.4.3)', () => {
    expect(text('halo').contrast?.p5).toBeGreaterThan(15);
  });

  it('measures contrast against the real background, gradient and alpha included', () => {
    expect(text('good-text').contrast?.p5).toBeGreaterThan(15);
    expect(text('low').contrast?.min).toBeLessThan(2);
    expect(text('low').contrast?.median).toBeLessThan(4.5);
    expect(text('faded').contrast?.median).toBeCloseTo(5.28, 0);
  });

  it('measures placeholders as text', () => {
    const placeholder = audit.texts.find((t) => t.key === 'field' && t.placeholder);
    expect(placeholder?.text).toBe('Komutan adı');
    expect(placeholder?.contrast?.median).toBeLessThan(2);
  });
});

describe('touch targets', () => {
  it('measures the real hit area of each control', () => {
    expect(target('small').region?.width).toBe(30);
    expect(target('good-button').region?.width).toBe(120);
    expect(target('good-button').region?.height).toBe(48);
  });

  it('finds a pointer-cursor div that has no role', () => {
    expect(target('clickable-div').region?.area).toBe(4000);
  });

  it('shrinks a target that something covers, and says how much of its own box is left', () => {
    expect(target('covered').region?.width).toBe(40);
    expect(target('covered').coverage).toBeCloseTo(0.5, 2);
    expect(target('good-button').coverage).toBe(1);
  });

  it('fails the two tight buttons on WCAG 2.5.8 and nothing else', () => {
    expect(audit.targets.filter((t) => t.spacingFail).map((t) => t.key).sort()).toEqual(['tight-a', 'tight-b']);
  });

  it('names an icon-only button by its label and says it shows no text', () => {
    expect(target('icon-only').visibleText).toBe(false);
    expect(target('icon-only').name).toBe('Kapat');
    expect(target('good-button').visibleText).toBe(true);
  });

  it('names a field by its label and counts its words as text it shows', () => {
    expect(target('field').name).toBe('Ad');
    expect(target('field').visibleText).toBe(true);
  });

  it('takes a label beside its field as the same target, but a label around a hidden box as its own', () => {
    expect(audit.targets.some((t) => t.key === 'field-label')).toBe(false);
    expect(target('wrap-toggle').region?.height).toBe(44);
  });

  it('tells an icon button from a bare tap area such as a backdrop', () => {
    expect(target('icon-only').hasIcon).toBe(true);
    expect(target('good-button').hasIcon).toBe(false);
    expect(target('backdrop')).toMatchObject({ hasIcon: false, visibleText: false, name: '' });
  });

  it('measures an icon against what is behind it', () => {
    expect(target('icon-only').iconContrast?.median).toBeGreaterThan(10);
    expect(target('good-button').iconContrast).toBeNull();
  });

  it('marks disabled controls and the text inside them, and keeps the 3D scene out of the targets', () => {
    expect(target('disabled').disabled).toBe(true);
    expect(text('disabled').inactive).toBe(true);
    expect(text('good-button').inactive).toBe(false);
    expect(audit.targets.some((t) => t.key === 'scene')).toBe(false);
    expect(audit.sceneArea).toBe(6000);
  });

  it('sees which controls answer a press, and how', () => {
    // A pointerdown handler answers within 100 ms of the touch. Chrome applies CSS
    // :active to a held touch only through its show-press gesture, which emulated touch
    // never sends, so :active is measured by forcing the state instead.
    expect(target('js-feedback').feedback).toBe('immediate');
    expect(target('feedback').feedback).toBe('active');
    expect(target('good-button').feedback).toBe('active');
    expect(target('nofeedback').feedback).toBe('none');
    expect(target('disabled').feedback).toBeNull();
  });
});

describe('layout, colour, motion and words', () => {
  it('catches the page scrolling sideways and names the element that does it', () => {
    expect(audit.overflow.page).toBe(true);
    expect(audit.overflow.elements).toContain('wide');
  });

  it('counts spacing values off the 4 px grid', () => {
    expect(audit.spacing.values['5']).toBe(4);
    expect(audit.spacing.offGrid).toBeGreaterThanOrEqual(4);
  });

  it('counts spacing between blocks only, not inside a control or an inline chip (standard 2.7)', () => {
    expect(audit.spacing.values['3']).toBeUndefined();
    expect(audit.spacing.values['6']).toBeUndefined();
    expect(audit.spacing.values['7']).toBeUndefined();
  });

  it('counts the hue families on the surface', () => {
    expect(audit.hues.length).toBeGreaterThanOrEqual(5);
  });

  it('lists slow transitions and fast infinite animations', () => {
    expect(audit.motion.transitions).toContainEqual(expect.objectContaining({ key: 'slow', seconds: 0.6 }));
    expect(audit.motion.animations).toContainEqual(expect.objectContaining({ key: 'blink', seconds: 0.2, infinite: true }));
  });

  it('counts words and sentences, and scores Turkish readability', () => {
    expect(audit.stats.sentences).toBeGreaterThanOrEqual(3);
    expect(audit.stats.longestSentence).toBeGreaterThanOrEqual(7);
    expect(audit.stats.atesman).not.toBeNull();
  });
});

/**
 * NO FALSE ALARM, ANYWHERE (review of stage 1, 2026-11-13): each check flags exactly the planted
 * cases, so a control the audit wrongly flags fails here, not only in spacing.
 */
describe('exactly what is planted', () => {
  const keys = (list: readonly { key: string | null }[]) => list.map((x) => x.key).sort();
  it('fails contrast only on the faint text and the faint placeholder', () => {
    // #blink is F2's planted fast blink: its contrast depends on the frame that caught it, so it is left out.
    const fails = audit.texts.filter((t) => t.key !== 'blink' && t.rendered && contrastVerdict(t) === 'fail');
    expect(keys(fails)).toEqual(['field', 'low']);
  });
  it('finds cut text only where text is cut', () => {
    expect(keys(audit.texts.filter((t) => t.truncated || t.clipped))).toEqual(['clip', 'clip-in-scroller', 'half-cut', 'trunc']);
  });
  it('calls small only the small targets', () => {
    expect(keys(audit.targets.filter((t) => t.region !== null && Math.min(t.region.width, t.region.height) < 44)))
      .toEqual(['clickable-div', 'covered', 'disabled', 'field', 'small', 'tight-a', 'tight-b']);
  });
  it('calls silent only the controls with no press answer', () => {
    expect(keys(audit.targets.filter((t) => t.feedback === 'none'))).toEqual([
      'backdrop', 'clickable-div', 'covered', 'field', 'icon-only', 'nofeedback', 'padded-control', 'small', 'tight-a', 'tight-b', 'wrap-toggle',
    ]);
  });
});
