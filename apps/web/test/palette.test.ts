import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * THE PALETTE, AND THE THREE THINGS ABOUT IT THAT ARE NOT TASTE.
 *
 * `docs/visual-design.md` states the law — HUE carries category, LUMINANCE carries
 * certainty, LIGHT carries state — and until this file existed nothing held the
 * stylesheet to it. What actually happened without a guard is visible in the diff
 * this file was written against: ONE cyan was spelled thirteen times as a raw
 * `rgb(89 200 255 / …)`, one red twice under two different triplets, and the
 * machined edge sixteen times. A hue spread over sixteen literals is a hue nobody
 * can change, which is how a palette stops being a palette and becomes a habit.
 *
 * So three claims are asserted here, in the order they cost the most:
 *
 *   1. ONE HUE IS STATED ONCE. Every semantic colour in the chrome resolves
 *      through a channel token, so opacity is the only thing a surface varies.
 *   2. THE FOUR STATES ARE ONE MECHANISM. lit / threat / opportunity / alloy
 *      differ by which hue they name and by nothing else — no per-tone body
 *      colour, no per-tone edge recipe.
 *   3. INK STAYS READABLE ON BOTH GROUNDS a plate is drawn over.
 *
 * Plus one performance clause, because the material this palette came from used
 * `backdrop-filter: blur(18px)` on every plate and a live WebGL canvas sits
 * behind all of it. The look was taken; the blur was deliberately not.
 */

const theme = readFileSync('src/styles.css', 'utf8');
const chrome = readFileSync('src/styles/chrome.css', 'utf8');

/** The body of one CSS rule, by selector, so a claim can be made about it alone. */
function rule(css: string, selector: string): string {
  const at = css.indexOf(`\n  ${selector} {`);
  expect(at, `no rule for ${selector}`).toBeGreaterThan(-1);
  const open = css.indexOf('{', at);
  return css.slice(open + 1, css.indexOf('\n  }', open));
}

type Rgb = readonly [number, number, number];

function channel(name: string): Rgb {
  const found = new RegExp(`--ch-${name}:\\s*(\\d+) (\\d+) (\\d+);`).exec(theme);
  if (!found) throw new Error(`--ch-${name} is not declared`);
  const [, r, g, b] = found;
  return [Number(r), Number(g), Number(b)];
}

function hex(token: string): Rgb {
  const found = new RegExp(`--color-${token}:\\s*#([0-9a-f]{6});`).exec(theme);
  if (!found) throw new Error(`--color-${token} is not declared`);
  const n = Number.parseInt(found[1] ?? '', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG 2.x relative luminance, so the thresholds below mean what they say. */
function luminance([r, g, b]: Rgb): number {
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(ink: Rgb, ground: Rgb): number {
  const a = luminance(ink);
  const b = luminance(ground);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe('one hue, stated once', () => {
  /**
   * The literals this replaced, kept by value rather than by name: a future
   * author reaching for one of them is reaching past the token that owns it.
   */
  it.each([
    ['the machined edge', 'rgb(74 98 136'],
    ['crystal light', 'rgb(89 200 255'],
    ['threat light', 'rgb(255 106 77'],
    ['threat fill', 'rgb(226 65 44'],
    ['opportunity light', 'rgb(111 245 182'],
    ['opportunity fill', 'rgb(90 211 155'],
    ['alloy light', 'rgb(255 190 82'],
    ['alloy fill', 'rgb(217 164 65'],
  ])('does not spell %s as a raw triplet', (_what, literal) => {
    expect(chrome).not.toContain(literal);
  });

  it('publishes every hue the chrome modulates as a channel token', () => {
    for (const name of ['crystal', 'threat', 'opportunity', 'alloy', 'edge']) {
      expect(channel(name).every((c) => c >= 0 && c <= 255)).toBe(true);
    }
  });

  /** A channel is only worth having if the chrome actually resolves through it. */
  it.each(['crystal', 'threat', 'opportunity', 'alloy', 'edge'])(
    'modulates --ch-%s by opacity in the chrome',
    (name) => {
      expect(chrome).toContain(`rgb(var(--ch-${name}) /`);
    },
  );
});

describe('one metal, whichever way a surface names it', () => {
  /**
   * `--color-plate-*` (opaque, for a surface that has something behind it
   * already) and `--ch-plate-*` (translucent, for one held up in front of the
   * galaxy) are the SAME metal stated twice, because Tailwind's `@theme` cannot
   * publish a channel and `rgb(… / …)` cannot take a hex. Two spellings of one
   * material is exactly the drift this file exists to catch, so they are pinned
   * to each other: change one and this fails.
   */
  it.each(['plate-hi', 'plate', 'plate-lo'])('states --%s once', (name) => {
    expect(hex(name)).toEqual(channel(name));
  });

  /** The cut plate is the same object with two corners sheared off it. */
  it('cuts the plate out of the plate', () => {
    const face = rule(chrome, '.plate-cut::before');
    expect(face).toContain('radial-gradient(140% 100% at 0% 0%');
    expect(face).toContain('rgb(var(--ch-plate-hi) /');
  });
});

describe('the four states are one mechanism', () => {
  const tones = ['plate-lit', 'plate-threat', 'plate-opportunity', 'plate-alloy'];

  it.each(tones)('.%s names a hue and nothing else', (tone) => {
    expect(rule(chrome, `.${tone}`)).toMatch(/^\s*--plate-accent: var\(--ch-[a-z]+\);\s*$/);
  });

  /** All four together, which is what stops a fifth tone growing its own recipe. */
  it('draws every tone from one accent-driven rule', () => {
    const shared = rule(chrome, tones.map((t) => `.${t}`).join(',\n  '));
    expect(shared).toContain('rgb(var(--plate-accent) /');
    expect(shared).toContain('background:');
    expect(shared).toContain('box-shadow:');
  });

  /**
   * The half that was missing. `lit` and `alloy` carried an edge and no wash, so
   * two of the four states put their colour only on the outline — the colour has
   * to reach the middle of the plate or the state is a hairline on a phone.
   */
  it('lets the colour reach the middle of the plate, not just its edge', () => {
    const shared = rule(chrome, tones.map((t) => `.${t}`).join(',\n  '));
    const wash = shared.slice(shared.indexOf('background:'), shared.indexOf('box-shadow:'));
    expect(wash.match(/rgb\(var\(--plate-accent\) \//g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});

describe('the world stays visible through the interface', () => {
  /**
   * interface.md I5: the galaxy never closes. A plate is a machined pane held up
   * in front of it, so its body is translucent — every layer of the material
   * carries an alpha and none of them is a flat opaque token.
   */
  it('builds the plate body from translucent metal', () => {
    const body = rule(chrome, '.plate');
    expect(body).toContain('rgb(var(--ch-plate-hi) /');
    expect(body).not.toContain('var(--color-plate-hi)');
  });

  /** One light, and it enters the plate from a corner rather than from a band. */
  it('lights the plate from a corner', () => {
    expect(rule(chrome, '.plate')).toContain('radial-gradient(140% 100% at 0% 0%');
  });
});

describe('ink survives both grounds a plate is drawn on', () => {
  const void_ = hex('void');
  /** The lit top edge of a plate: the lightest thing text is ever set on. */
  const plate: Rgb = [24, 34, 54];

  it.each([
    ['bone', 10, 7],
    ['dim', 4.5, 3],
    ['faint', 4.5, 3],
    ['threat-ink', 4.5, 3],
  ])('keeps --color-%s legible', (token, onVoid, onPlate) => {
    expect(contrast(hex(token), void_)).toBeGreaterThanOrEqual(onVoid);
    expect(contrast(hex(token), plate)).toBeGreaterThanOrEqual(onPlate);
  });

  /**
   * THE INK IS COOL. It was a warm bone (#e9e4d8) on the argument that the one
   * thing on screen which is not machinery should not be machine-coloured; the
   * owner's own palette answers that the light in this galaxy is blue, and a warm
   * paper white under a blue instrument reads as an aged screenshot rather than
   * as a lit deck. Cool also happens to be brighter on a near-black ground.
   */
  it('reads the ink as light off a blue instrument, never as warm paper', () => {
    const [r, , b] = hex('bone');
    expect(b).toBeGreaterThanOrEqual(r);
  });
});

describe('the material is taken, the cost is not', () => {
  /**
   * A live WebGL canvas is behind every plate. `backdrop-filter` re-reads and
   * blurs that canvas per plate per frame, which is the one thing on this list
   * that would be paid for on every frame of a scene the game is played in.
   */
  it('never asks the browser to blur the galaxy behind a plate', () => {
    // The declaration, not the word — both files explain in prose why it is absent.
    const declared = /^\s*(?:-webkit-)?backdrop-filter:/m;
    expect(chrome).not.toMatch(declared);
    expect(theme).not.toMatch(declared);
  });

  /**
   * The performance note at the top of chrome.css, finally asserted.
   *
   * It is the RASTERISING filters that are counted — a blur or a drop-shadow
   * forces a layer per element, and `.cut-shadow` is the one place with no
   * alternative because `clip-path` clips `box-shadow`. `brightness` on a press
   * is not in that class and is not what the note is about.
   */
  it('keeps a rasterising filter to the one place a clipped silhouette needs it', () => {
    const layers = [...chrome.matchAll(/^\s*filter: (?:blur|drop-shadow)/gm)];
    expect(layers.map((m) => m[0].trim())).toEqual(['filter: drop-shadow']);
    const only = layers[0];
    if (!only) throw new Error('unreachable: asserted above');
    expect(chrome.slice(0, only.index)).toMatch(/\.cut-shadow \{[^}]*$/);
  });
});
