/**
 * THE IN-PAGE HALF OF THE AUDIT.
 *
 * Bundled by esbuild and injected with `addScriptTag`; it never runs in Node. It reads
 * what the browser computed and rendered — sizes after transforms, colours after the
 * cascade, which element a touch at each point would reach — and hands plain data back.
 * The judging happens in Node, in pure functions with their own tests.
 */

import { ICON, TARGET } from './attributes.js';
import type { Box } from './targets.js';

export interface CollectOptions {
  gridStep: number;
  /**
   * The first part of a surface. Later parts (after a scroll) count colours, spacing and
   * motion only for elements no earlier part counted, so the parts add up.
   */
  fresh: boolean;
}

export type Rgba = [number, number, number, number];

export interface RawText {
  /** Stable for the life of the page, so a text seen in two scroll parts is one text. */
  id: string;
  key: string | null;
  label: string;
  text: string;
  fontSize: number;
  renderedSize: number;
  fontWeight: number;
  uppercase: boolean;
  letterSpacing: number;
  lineHeight: number | null;
  lines: number;
  truncated: boolean;
  clipped: boolean;
  /** Gradient-filled text: its colour is not a single value. */
  gradient: boolean;
  placeholder: boolean;
  /** Inside a disabled control: WCAG 1.4.3 does not judge its contrast. */
  inactive: boolean;
  color: Rgba;
  /** Product of the element's and its ancestors' opacity. */
  opacity: number;
  /** Glyph boxes, clipped to the viewport. */
  rects: Box[];
  /** The same boxes cut to where the letters are drawn: contrast is judged there. */
  inkRects: Box[];
  /** Something unrelated is on top of every one of its boxes: a lid, a fixed bar. */
  covered: boolean;
  /**
   * A stroke of 2 px or more rings the letters at least 1 px wide: WCAG 1.4.3 takes such a
   * halo as their ground. A hairline stroke is part of the letter.
   */
  halo: Rgba | null;
}

export interface RawTarget {
  /** Stable for the life of the page. */
  id: string;
  key: string | null;
  label: string;
  name: string;
  visibleText: boolean;
  disabled: boolean;
  box: Box;
  /** An icon drawn in one colour (an SVG in currentColor), or null. */
  icon: { color: Rgba; opacity: number; box: Box } | null;
}

export interface RawCollect {
  viewport: { width: number; height: number; dpr: number };
  texts: RawText[];
  targets: RawTarget[];
  /** Grid of hit-test answers, row-major: a target index, -1 nothing, -2 the 3D scene. */
  grid: { step: number; cols: number; rows: number; cells: number[] };
  colors: { rgb: [number, number, number]; weight: number }[];
  /** Padding, gap and vertical margin values in px → how often each occurs. */
  spacing: Record<string, number>;
  overflow: { page: boolean; elements: string[] };
  transitions: { key: string | null; label: string; seconds: number }[];
  animations: { key: string | null; label: string; name: string; seconds: number; infinite: boolean }[];
}

export interface UiAuditApi {
  collect(options: CollectOptions): RawCollect;
  /** Make every glyph and one-colour icon transparent, so a screenshot shows only what is behind them. */
  hideText(on: boolean): void;
  /** Hide the 3D scene and pause endless animations, so a press is the only thing that changes. */
  freeze(on: boolean): void;
  /** Scroll the largest visible scroller that has more below by 85 % of its height; false when none has. */
  scrollStep(): boolean;
}

declare global {
  interface Window {
    __uiAudit?: UiAuditApi;
  }
}

const ROLES = new Set(['button', 'link', 'tab', 'switch', 'checkbox', 'radio', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'slider', 'spinbutton', 'combobox', 'treeitem', 'textbox', 'searchbox']);

const keyOf = (start: Element | null): string | null => {
  for (let el = start; el; el = el.parentElement) {
    const key = el.getAttribute('data-testid') ?? (el.id || null);
    if (key) return key;
  }
  return null;
};

const labelOf = (el: Element): string => {
  const classes = [...el.classList].slice(0, 2).join('.');
  const testId = el.getAttribute('data-testid');
  return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${testId ? `[${testId}]` : ''}${classes ? `.${classes}` : ''}`;
};

const toBox = (r: DOMRect | Box): Box => ('x' in r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : r);

/**
 * The layout viewport. Under mobile emulation `innerWidth` grows with content that runs
 * past the edge (401 for a 350 px screen with a 400 px element); the screen does not.
 */
const viewWidth = () => document.documentElement.clientWidth;
const viewHeight = () => document.documentElement.clientHeight;

const clipToViewport = (b: Box): Box | null => {
  const box = { left: Math.max(0, b.left), top: Math.max(0, b.top), right: Math.min(viewWidth(), b.right), bottom: Math.min(viewHeight(), b.bottom) };
  return box.right - box.left > 0.5 && box.bottom - box.top > 0.5 ? box : null;
};

const swatch = document.createElement('canvas');
swatch.width = 1;
swatch.height = 1;
const ink = swatch.getContext('2d', { willReadFrequently: true });
const colorCache = new Map<string, Rgba>();

/** Any CSS colour, oklch and color-mix included, as the sRGB bytes the browser paints. */
const rgba = (css: string): Rgba => {
  const cached = colorCache.get(css);
  if (cached) return cached;
  let out: Rgba = [0, 0, 0, 0];
  if (ink) {
    ink.clearRect(0, 0, 1, 1);
    ink.fillStyle = '#000';
    ink.fillStyle = css;
    ink.fillRect(0, 0, 1, 1);
    const [r = 0, g = 0, b = 0, a = 0] = ink.getImageData(0, 0, 1, 1).data;
    out = [r, g, b, a / 255];
  }
  colorCache.set(css, out);
  return out;
};

const opacityOf = (start: Element): number => {
  let product = 1;
  for (let el: Element | null = start; el; el = el.parentElement) product *= Number(getComputedStyle(el).opacity);
  return product;
};

/** Vertical scale from `transform` and `scale` on the element and its ancestors. */
const scaleOf = (start: Element): number => {
  let product = 1;
  for (let el: Element | null = start; el; el = el.parentElement) {
    const style = getComputedStyle(el);
    if (style.transform !== 'none') {
      const m = new DOMMatrixReadOnly(style.transform);
      product *= Math.hypot(m.c, m.d);
    }
    if (style.scale !== 'none' && style.scale !== '') {
      const [x = '1', y = x] = style.scale.split(' ');
      product *= parseFloat(y);
    }
  }
  return product;
};

const seconds = (list: string): number[] =>
  list.split(',').map((value) => {
    const v = value.trim();
    return v.endsWith('ms') ? parseFloat(v) / 1000 : parseFloat(v);
  });

const isTruncated = (start: Element): boolean => {
  let el: Element | null = start;
  for (let depth = 0; el && depth < 4; depth += 1, el = el.parentElement) {
    const style = getComputedStyle(el);
    if (style.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) return true;
    if (style.webkitLineClamp !== 'none' && style.webkitLineClamp !== '' && el.scrollHeight > el.clientHeight + 1) return true;
  }
  return false;
};

const inkCanvas = document.createElement('canvas').getContext('2d');

/**
 * How far the drawn letters sit inside the box a text range reports, top and bottom. That box
 * is the font's whole height; tight leading lets it spill past a hiding box while every letter
 * still shows.
 */
const inkInset = (el: Element, text: string): { top: number; bottom: number } => {
  if (!inkCanvas) return { top: 0, bottom: 0 };
  const style = getComputedStyle(el);
  inkCanvas.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const shown = style.textTransform === 'uppercase' ? text.toLocaleUpperCase(document.documentElement.lang || undefined) : text;
  const m = inkCanvas.measureText(shown);
  const scale = scaleOf(el);
  return {
    top: Math.max(0, m.fontBoundingBoxAscent - m.actualBoundingBoxAscent) * scale,
    bottom: Math.max(0, m.fontBoundingBoxDescent - m.actualBoundingBoxDescent) * scale,
  };
};

/** Some drawn letter reaches past an ancestor that hides its overflow. */
const isClipped = (start: Element, rects: readonly Box[], ink: { top: number; bottom: number }): boolean => {
  // Past a scroller, text beyond an edge is scrolled out of view, not clipped: the player
  // scrolls to it. A rounded sheet that hides its scroller's overflow is the common case.
  let scrollsX = false;
  let scrollsY = false;
  for (let el: Element | null = start; el && el !== document.body; el = el.parentElement) {
    const style = getComputedStyle(el);
    const clipX = !scrollsX && (style.overflowX === 'hidden' || style.overflowX === 'clip');
    const clipY = !scrollsY && (style.overflowY === 'hidden' || style.overflowY === 'clip');
    scrollsX ||= style.overflowX === 'auto' || style.overflowX === 'scroll';
    scrollsY ||= style.overflowY === 'auto' || style.overflowY === 'scroll';
    if (!clipX && !clipY) continue;
    const box = el.getBoundingClientRect();
    for (const r of rects) {
      if (clipX && (r.left < box.left - 1 || r.right > box.right + 1)) return true;
      if (clipY && (r.top + ink.top < box.top - 1 || r.bottom - ink.bottom > box.bottom + 1)) return true;
    }
  }
  return false;
};

const lineCount = (rects: readonly Box[]): number => new Set(rects.map((r) => Math.round(r.top))).size;

const visibleStyle = (el: Element): boolean => getComputedStyle(el).visibility === 'visible';

/**
 * Each box cut to the rows where a press would land on this text's own element: the part no
 * lid or fixed bar hides. null where nothing of it shows.
 */
const shownParts = (el: Element, rects: readonly Box[]): (Box | null)[] => {
  if (!(el instanceof HTMLElement) && !(el instanceof SVGElement)) return [...rects];
  // Its own text is hit-tested even when presses pass through it (pointer-events: none).
  const style = el.style;
  const before = [style.getPropertyValue('pointer-events'), style.getPropertyPriority('pointer-events')] as const;
  style.setProperty('pointer-events', 'auto', 'important');
  try {
    return rects.map((r) => {
      const x = (r.left + r.right) / 2;
      let top: number | null = null;
      let bottom = 0;
      for (let y = Math.floor(r.top); y < r.bottom; y += 1) {
        const hit = document.elementFromPoint(x, y + 0.5);
        if (hit !== null && (el.contains(hit) || hit.contains(el))) {
          top ??= y;
          bottom = y + 1;
        }
      }
      return top === null ? null : { ...r, top: Math.max(r.top, top), bottom: Math.min(r.bottom, bottom) };
    });
  } finally {
    if (before[0]) style.setProperty('pointer-events', before[0], before[1]);
    else style.removeProperty('pointer-events');
  }
};

/** Inside a box of one pixel that hides its overflow: a name only a screen reader hears (sr-only). */
const screenReaderOnly = (start: Element): boolean => {
  for (let el: Element | null = start; el && el !== document.body; el = el.parentElement) {
    const style = getComputedStyle(el);
    if (style.overflowX === 'visible' || style.overflowY === 'visible') continue;
    const box = el.getBoundingClientRect();
    if (box.width <= 1 || box.height <= 1) return true;
  }
  return false;
};

/** Page-lifetime ids kept off the DOM: the page under audit is not changed to name its nodes. */
const ids = new WeakMap<Node, string>();
let nextId = 0;
const idOf = (node: Node): string => {
  let id = ids.get(node);
  if (id === undefined) {
    id = String(nextId++);
    ids.set(node, id);
  }
  return id;
};

/** What earlier parts of this surface already counted. */
let countedElements = new WeakSet<Element>();
let countedTexts = new WeakSet<Node>();

function textItem(id: string, el: Element, text: string, rawRects: Box[], placeholder: boolean): RawText | null {
  const rects = rawRects.map(clipToViewport).filter((r): r is Box => r !== null);
  if (rects.length === 0 || !visibleStyle(el) || screenReaderOnly(el)) return null;
  const opacity = opacityOf(el);
  if (opacity <= 0.01) return null;
  const style = getComputedStyle(el);
  const color = rgba(placeholder ? getComputedStyle(el, '::placeholder').color : style.color);
  const clip = style.backgroundClip === 'text';
  const fontSize = parseFloat(style.fontSize);
  const ink = placeholder ? { top: 0, bottom: 0 } : inkInset(el, text);
  const shown = placeholder ? rects : shownParts(el, rects);
  const stroke = parseFloat(style.getPropertyValue('-webkit-text-stroke-width')) || 0;
  const halo = rgba(style.getPropertyValue('-webkit-text-stroke-color'));
  return {
    id,
    key: keyOf(el),
    label: labelOf(el),
    text,
    fontSize,
    renderedSize: Math.round(fontSize * scaleOf(el) * 100) / 100,
    fontWeight: Number(style.fontWeight),
    uppercase: style.textTransform === 'uppercase',
    letterSpacing: style.letterSpacing === 'normal' ? 0 : parseFloat(style.letterSpacing),
    lineHeight: style.lineHeight === 'normal' ? null : parseFloat(style.lineHeight) / fontSize,
    lines: placeholder ? 1 : lineCount(rawRects),
    truncated: !placeholder && isTruncated(el),
    clipped: !placeholder && isClipped(el, rawRects, ink),
    gradient: clip && color[3] === 0,
    placeholder,
    inactive: el.closest(':disabled, [aria-disabled="true"]') !== null,
    color,
    opacity,
    rects,
    inkRects: rects.flatMap((r, i) => {
      const part = shown[i];
      if (!part) return [];
      const top = Math.max(part.top, r.top + ink.top);
      const bottom = Math.min(part.bottom, r.bottom - ink.bottom);
      return bottom - top >= 1 ? [{ ...r, top, bottom }] : [];
    }),
    covered: shown.every((part) => part === null),
    halo: !placeholder && stroke >= 2 && halo[3] >= 0.9 ? halo : null,
  };
}

/** Every text on screen, and those whose colour no earlier part counted. */
function collectTexts(): { texts: RawText[]; uncounted: RawText[] } {
  const out: RawText[] = [];
  const uncounted: RawText[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
    const el = node.parentElement;
    if (!text || !el || el.closest('script, style, noscript, template, title')) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0).map(toBox);
    const item = textItem(idOf(node), el, text, rects, false);
    if (item) {
      out.push(item);
      if (!countedTexts.has(node)) uncounted.push(item);
      countedTexts.add(node);
    }
  }
  for (const field of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')) {
    if (field instanceof HTMLInputElement && ['hidden', 'checkbox', 'radio', 'range', 'color', 'file', 'submit', 'button', 'image'].includes(field.type)) continue;
    const showing = field.value || field.placeholder;
    if (!showing) continue;
    const item = textItem(`${idOf(field)}:placeholder`, field, showing, [toBox(field.getBoundingClientRect())], !field.value);
    if (item) {
      out.push(item);
      if (!countedElements.has(field)) uncounted.push(item);
    }
  }
  return { texts: out, uncounted };
}

/** What a text field shows: its value, else its placeholder. */
const typed = (el: Element): string | null =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value || el.placeholder : null;

/**
 * A label around its control, or beside one too small to press, is what the player presses.
 * Beside a control that is pressable on its own it is the same target (WCAG 2.5.8 "equivalent").
 */
const labelIsOwnTarget = (label: HTMLLabelElement): boolean => {
  const control = label.control;
  if (!control) return false;
  if (label.contains(control)) return true;
  const box = control.getBoundingClientRect();
  return box.width < 24 || box.height < 24;
};

const isSemantic = (el: Element): boolean => {
  const tag = el.tagName;
  if (tag === 'BUTTON' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'SUMMARY') return true;
  if (tag === 'A' && el.hasAttribute('href')) return true;
  if (el instanceof HTMLInputElement) return el.type !== 'hidden';
  if (el instanceof HTMLLabelElement) return labelIsOwnTarget(el);
  const role = el.getAttribute('role');
  if (role && ROLES.has(role)) return true;
  const tabindex = el.getAttribute('tabindex');
  return tabindex !== null && Number(tabindex) >= 0;
};

const insideControl = (el: Element): boolean => {
  for (let up = el.parentElement; up && up !== document.body; up = up.parentElement) if (isSemantic(up)) return true;
  return false;
};

/** The control a press on `hit` reaches: a semantic one, else the outermost of a pointer-cursor run. */
const targetOf = (hit: Element): Element | 'scene' | null => {
  if (hit instanceof HTMLCanvasElement) return 'scene';
  let pointerTop: Element | null = null;
  for (let el: Element | null = hit; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    if (isSemantic(el)) return el;
    if (getComputedStyle(el).cursor === 'pointer') pointerTop = el;
    else if (pointerTop) break;
  }
  return pointerTop;
};

const nameOf = (el: Element): string => {
  const aria = el.getAttribute('aria-label');
  if (aria) return aria.trim();
  const by = el.getAttribute('aria-labelledby');
  if (by) {
    const named = by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim();
    if (named) return named;
  }
  const labelled = el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement || el instanceof HTMLButtonElement;
  const labels = labelled ? [...(el.labels ?? [])].map((l) => l.textContent.trim()).join(' ').trim() : '';
  if (labels) return labels;
  const own = el instanceof HTMLElement ? el.innerText.replace(/\s+/g, ' ').trim() : '';
  if (own) return own;
  return el.getAttribute('title') ?? el.querySelector('img')?.getAttribute('alt') ?? '';
};

function iconOf(el: Element): RawTarget['icon'] {
  const svg = el.querySelector('svg');
  if (!svg) return null;
  const box = clipToViewport(toBox(svg.getBoundingClientRect()));
  if (!box) return null;
  svg.setAttribute(ICON, '');
  return { color: rgba(getComputedStyle(svg).color), opacity: opacityOf(svg), box };
}

function collectTargets(step: number): { targets: RawTarget[]; grid: RawCollect['grid'] } {
  const cols = Math.ceil(viewWidth() / step);
  const rows = Math.ceil(viewHeight() / step);
  const cells: number[] = [];
  const index = new Map<Element, number>();
  const elements: Element[] = [];
  const cache = new Map<Element, number>();
  // Numbers restart each part: a number left from an earlier part would answer for a twin.
  for (const stale of document.querySelectorAll(`[${TARGET}]`)) stale.removeAttribute(TARGET);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const hit = document.elementFromPoint(col * step + step / 2, row * step + step / 2);
      if (!hit) {
        cells.push(-1);
        continue;
      }
      let cell = cache.get(hit);
      if (cell === undefined) {
        const target = targetOf(hit);
        if (target === 'scene') cell = -2;
        else if (target === null) cell = -1;
        else {
          cell = index.get(target);
          if (cell === undefined) {
            cell = elements.length;
            index.set(target, cell);
            elements.push(target);
          }
        }
        cache.set(hit, cell);
      }
      cells.push(cell);
    }
  }
  const targets = elements.map((el, i): RawTarget => {
    el.setAttribute(TARGET, String(i));
    const own = typed(el) ?? (el instanceof HTMLElement ? el.innerText : el.textContent);
    const visibleText = /[\p{L}\p{N}]/u.test(own);
    return {
      id: idOf(el),
      key: keyOf(el),
      label: labelOf(el),
      name: nameOf(el),
      visibleText,
      disabled: (el instanceof HTMLButtonElement && el.disabled) || el.getAttribute('aria-disabled') === 'true',
      box: toBox(el.getBoundingClientRect()),
      icon: visibleText ? null : iconOf(el),
    };
  });
  return { targets, grid: { step, cols, rows, cells } };
}

function collectStyles(uncountedTexts: readonly RawText[]) {
  const colors: RawCollect['colors'] = [];
  const spacing: Record<string, number> = {};
  const transitions: RawCollect['transitions'] = [];
  const animations: RawCollect['animations'] = [];
  const overflowing: string[] = [];
  const count = (px: string) => {
    const v = Math.abs(Math.round(parseFloat(px) * 2) / 2);
    if (v > 0) spacing[String(v)] = (spacing[String(v)] ?? 0) + 1;
  };

  for (const text of uncountedTexts) {
    const area = text.rects.reduce((sum, r) => sum + (r.right - r.left) * (r.bottom - r.top), 0);
    if (text.color[3] > 0) colors.push({ rgb: [text.color[0], text.color[1], text.color[2]], weight: area * text.color[3] });
  }

  for (const el of document.body.querySelectorAll('*')) {
    const rect = el.getBoundingClientRect();
    const box = clipToViewport(toBox(rect));
    if (!box || !visibleStyle(el)) continue;
    const style = getComputedStyle(el);
    // Sideways overflow is judged on every part; the counts below once per element.
    if (rect.right > viewWidth() + 1 && rect.left < viewWidth() && !clippedSideways(el)) {
      const parent = el.parentElement;
      const parentOverflows = parent !== null && parent !== document.body && parent.getBoundingClientRect().right > viewWidth() + 1;
      if (!parentOverflows) overflowing.push(keyOf(el) ?? labelOf(el));
    }
    if (countedElements.has(el)) continue;
    countedElements.add(el);
    const area = (box.right - box.left) * (box.bottom - box.top);
    const bg = rgba(style.backgroundColor);
    if (bg[3] > 0) colors.push({ rgb: [bg[0], bg[1], bg[2]], weight: area * bg[3] });
    const borderWidth = parseFloat(style.borderTopWidth);
    if (borderWidth > 0 && style.borderTopStyle !== 'none') {
      const border = rgba(style.borderTopColor);
      if (border[3] > 0) colors.push({ rgb: [border[0], border[1], border[2]], weight: 2 * (rect.width + rect.height) * borderWidth * border[3] });
    }
    if (el instanceof SVGElement && !(el instanceof SVGSVGElement)) {
      for (const paint of [style.fill, style.stroke]) {
        if (!paint || paint === 'none' || paint.startsWith('url(')) continue;
        const c = rgba(paint);
        if (c[3] > 0) colors.push({ rgb: [c[0], c[1], c[2]], weight: area * c[3] * 0.5 });
      }
    }
    // Standard 2.7: the grid holds between blocks. A control's or an inline chip's own
    // padding and gap are its interior, and everything inside a control is too.
    if (!insideControl(el)) {
      for (const side of [style.marginTop, style.marginBottom]) count(side);
      if (!isSemantic(el) && !style.display.startsWith('inline')) {
        for (const side of [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft]) count(side);
        if (style.display.includes('flex') || style.display.includes('grid')) {
          if (style.rowGap !== 'normal') count(style.rowGap);
          if (style.columnGap !== 'normal') count(style.columnGap);
        }
      }
    }

    const transition = Math.max(...seconds(style.transitionDuration));
    if (transition > 0) transitions.push({ key: keyOf(el), label: labelOf(el), seconds: transition });
    if (style.animationName !== 'none') {
      const durations = seconds(style.animationDuration);
      style.animationName.split(',').forEach((name, i) => {
        animations.push({ key: keyOf(el), label: labelOf(el), name: name.trim(), seconds: durations[i] ?? durations[0] ?? 0, infinite: style.animationIterationCount.split(',')[i]?.trim() === 'infinite' });
      });
    }
  }

  const scroller = document.scrollingElement ?? document.documentElement;
  return { colors, spacing, transitions, animations, overflow: { page: scroller.scrollWidth > viewWidth() + 1, elements: overflowing.slice(0, 20) } };
}

/** An ancestor below the body hides or scrolls sideways overflow, so the page does not grow. */
const clippedSideways = (start: Element): boolean => {
  for (let el = start.parentElement; el && el !== document.body; el = el.parentElement) {
    if (getComputedStyle(el).overflowX !== 'visible') return true;
  }
  return false;
};

const HIDE_ID = 'ui-audit-hide';
const HIDE_CSS = `
  *, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; caret-color: transparent !important; text-decoration-color: transparent !important; transition: none !important; }
  ::placeholder { color: transparent !important; -webkit-text-fill-color: transparent !important; }
  [${ICON}] { visibility: hidden !important; }
`;
const FREEZE_ID = 'ui-audit-freeze';
const paused: Animation[] = [];

window.__uiAudit = {
  collect({ gridStep, fresh }) {
    if (fresh) {
      countedElements = new WeakSet();
      countedTexts = new WeakSet();
    }
    const { texts, uncounted } = collectTexts();
    const { targets, grid } = collectTargets(gridStep);
    return { viewport: { width: viewWidth(), height: viewHeight(), dpr: devicePixelRatio }, texts, targets, grid, ...collectStyles(uncounted) };
  },
  scrollStep() {
    const doc = document.scrollingElement ?? document.documentElement;
    const scrollers: { el: Element; area: number }[] = [];
    const consider = (el: Element, box: Box | null) => {
      if (!box || el.scrollHeight - el.clientHeight <= 20 || el.scrollTop >= el.scrollHeight - el.clientHeight - 2) return;
      const width = box.right - box.left;
      const height = box.bottom - box.top;
      if (width >= 100 && height >= 60) scrollers.push({ el, area: width * height });
    };
    for (const el of document.body.querySelectorAll('*')) {
      if (/(auto|scroll)/.test(getComputedStyle(el).overflowY)) consider(el, clipToViewport(toBox(el.getBoundingClientRect())));
    }
    consider(doc, { left: 0, top: 0, right: viewWidth(), bottom: viewHeight() });
    const next = scrollers.sort((a, b) => b.area - a.area)[0];
    if (!next) return false;
    const { el } = next;
    el.scrollTo({ top: Math.min(el.scrollHeight - el.clientHeight, el.scrollTop + Math.round(el.clientHeight * 0.85)), behavior: 'instant' });
    return true;
  },
  hideText(on) {
    document.getElementById(HIDE_ID)?.remove();
    if (!on) return;
    const style = document.createElement('style');
    style.id = HIDE_ID;
    style.textContent = HIDE_CSS;
    document.head.append(style);
  },
  freeze(on) {
    document.getElementById(FREEZE_ID)?.remove();
    if (!on) {
      for (const animation of paused.splice(0)) animation.play();
      return;
    }
    const style = document.createElement('style');
    style.id = FREEZE_ID;
    style.textContent = 'canvas { visibility: hidden !important; }';
    document.head.append(style);
    for (const animation of document.getAnimations()) {
      if (animation.effect?.getTiming().iterations === Infinity && animation.playState === 'running') {
        animation.pause();
        paused.push(animation);
      }
    }
  },
};
