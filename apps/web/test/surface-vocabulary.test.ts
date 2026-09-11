import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ONE VOCABULARY, AND THE TWO WAYS A SCREEN LEAVES IT. Owner report.
 *
 * *"Projenin her yerini farklı biri tasarlamış gibi. Bir UI/UX bütünlüğü yok.
 * Bazıları opak, bazıları hafif saydam renkler farklı."*
 *
 * `chrome.css` opens by saying there are three words and deliberately only three
 * — PLATE, SLAB, SOCKET — and that this is what stops a redesign turning into
 * forty unrelated card styles. It turned into them anyway, in two ways that a
 * type error can never catch because both are strings:
 *
 * 1 · A CLASS THAT RESOLVES TO NOTHING. `plate-crystal` (no such tone),
 *     `rounded-panel` (no such radius), `text-muted` and `text-amber` (no such
 *     colours) were all live in shipped screens. Tailwind emits nothing for an
 *     unknown token and the browser drops an unknown class in silence, so the
 *     surface simply renders without the thing its author believed they wrote —
 *     which is exactly how one sheet ends up opaque beside another that is not.
 *
 * 2 · A CARD BUILT BY HAND BESIDE THE ONE THAT EXISTS. "A recessed area inside a
 *     sheet" is `plate-inset`, defined once, lit by the same lamp as everything
 *     around it. It was ALSO written out as `bg-deep/55`, as `bg-deep/90` and as
 *     `bg-void/15` — three different grounds at three different opacities for one
 *     idea, which is the owner's "some opaque, some slightly transparent" in the
 *     source that produces it.
 *
 * The guard is on the SOURCE rather than on a render because that is where the
 * drift happens, and because it must fail for a screen nobody wrote a test for.
 */

const ROOT = 'src';
const theme = readFileSync(`${ROOT}/styles.css`, 'utf8');
const chrome = readFileSync(`${ROOT}/styles/chrome.css`, 'utf8');

/** Every class the two stylesheets actually define. */
const defined = new Set(
  [...`${theme}\n${chrome}`.matchAll(/^\s*\.([a-z][\w-]*)/gm)].map((m) => m[1] ?? ''),
);

/** Every token `@theme` publishes, grouped by the utility prefix it feeds. */
const tokens = (kind: string): Set<string> =>
  new Set(
    [...theme.matchAll(new RegExp(`--${kind}-([\\w-]+?)(?:--[\\w-]+)?:`, 'g'))].map((m) => m[1] ?? ''),
  );
const colours = tokens('color');
const sizes = tokens('text');
const radii = tokens('radius');

const sources = (): string[] => {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(path)) found.push(path);
    }
  };
  walk(ROOT);
  return found;
};

/** Every class named in a `className`, with its file, one per occurrence. */
function classNames(): { cls: string; file: string }[] {
  const out: { cls: string; file: string }[] = [];
  for (const file of sources()) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      for (const raw of (match[1] ?? match[2] ?? '').split(/[\s${}?:'"()]+/)) {
        // A variant prefix (`hover:`, `data-[open=true]:`) is not part of the name.
        const cls = raw.replace(/^(?:[a-z-]+|data-\[[^\]]*\]|group-[a-z-]+):/g, '');
        if (/^[a-z][\w./[\]-]*$/.test(cls)) out.push({ cls, file });
      }
    }
  }
  return out;
}

describe('every class a screen writes resolves to something', () => {
  /** Tailwind's own always-valid keywords, which are not tokens. */
  const KEYWORD = /^(transparent|current|inherit|black|white|none|auto|full)$/;
  const TEXT_LAYOUT = /^(left|right|center|justify|start|end|balance|pretty|nowrap|wrap|clip|ellipsis)$/;
  const BORDER_SIDE = /^(t|b|l|r|x|y|s|e)(-\d+)?$/;
  const BORDER_STYLE = /^(solid|dashed|dotted|double|hidden)$/;

  const dead = classNames().filter(({ cls }) => {
    if (defined.has(cls)) return false;
    const parsed = /^(text|bg|border|fill|stroke|rounded)-(.+)$/.exec(cls);
    if (!parsed) return false;
    const [, kind = '', rest = ''] = parsed;
    // `/40` is an opacity, `[…]` is an arbitrary value the lint rule polices.
    const base = rest.split('/')[0] ?? '';
    if (KEYWORD.test(base) || base.startsWith('[') || /^\d/.test(base)) return false;
    if (kind === 'bg' && base.startsWith('gradient')) return false;
    if (kind === 'text') return !(colours.has(base) || sizes.has(base) || TEXT_LAYOUT.test(base));
    if (kind === 'rounded') {
      const tail = base.replace(/^(t|b|l|r|tl|tr|bl|br|s|e|ss|se|es|ee)-/, '');
      return !(radii.has(tail) || KEYWORD.test(tail));
    }
    if (kind === 'border') {
      return !(colours.has(base) || BORDER_SIDE.test(base) || BORDER_STYLE.test(base));
    }
    return !colours.has(base);
  });

  it('names no colour, size or radius the theme does not publish', () => {
    const report = [...new Set(dead.map(({ cls, file }) => `${cls} (${file})`))].sort();
    expect(report, 'these classes render as nothing at all').toEqual([]);
  });
});

describe('a recess inside a sheet is `plate-inset`, not a fourth hand-built card', () => {
  /**
   * The signature of the hand-built one: a rounded, outlined box filled with a
   * translucent GROUND colour. `plate-inset` is exactly that object, lit by the
   * same lamp as the plate it sits in, and there is one of it.
   *
   * Deliberately narrow, and the narrowing is the whole design of the guard:
   *
   * · `border-line`/`border-line-soft` ONLY. A box whose outline carries a
   *   semantic hue (`border-opportunity`, `border-alert`) is stating a STATE and
   *   is a lit plate's job, not this one's.
   * · A GROUND colour fill only. `bg-crystal/[0.06]` on a held satellite slot is
   *   a state as well; `bg-deep/55` is somebody rebuilding the metal by hand.
   * · A RADIUS, so a bare row band with no corners stays furniture.
   *
   * What is left after those three is exactly one object: a neutral recessed
   * card inside a sheet, which is `plate-inset` and has been all along.
   */
  const HAND_BUILT = /rounded-\w+[^"`]*\bborder-line(?:-soft)?\b[^"`]*\bbg-(?:deep|void|panel|well)\/[\d[]/;
  /**
   * AND IT HOLDS SOMETHING. A card has padding because content sits inside it;
   * the two floating launchers over the disc are fixed-size buttons that happen
   * to share the fill, and a button is a SLAB's argument rather than this one's.
   */
  const HOLDS_CONTENT = /\bp[xy]?-\d/;

  /*
    A PLAIN STRING ONLY, AND THAT IS DELIBERATE. A template literal holds several
    mutually exclusive BRANCHES — `watch ? 'border-crystal/25 …' : 'border-line
    …'` — and reading it as one string joins classes that never appear together,
    which reports a state-carrying box as a hand-built card. A surface written as
    a constant is asserting one appearance unconditionally, which is the thing
    this rule is about.
  */
  const offenders = sources().flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    return [...source.matchAll(/className="([^"]*)"/g)]
      .map((m) => m[1] ?? '')
      .filter((value) => HAND_BUILT.test(value)
        && HOLDS_CONTENT.test(value)
        && !/\bsize-\d|\bh-\d/.test(value)
        && !value.includes('plate'))
      .map((value) => `${file}: ${value.trim().slice(0, 72)}`);
  });

  it('builds no recessed card out of a ground colour and a border', () => {
    expect(offenders, 'use `plate plate-inset` — one object, one light').toEqual([]);
  });
});
