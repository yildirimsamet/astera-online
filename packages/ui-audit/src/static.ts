/**
 * WHAT THE SOURCE SAYS, WHERE THE RUNNING PAGE CANNOT SHOW IT.
 *
 * Plan §1.4: every type size declared (CSS, Tailwind, inline, 3D, canvas), every animation
 * that changes light faster than three times a second, every hold duration, which files
 * answer an action with sound or haptics, and the push and local alert copy that is read
 * on a lock screen. Pure functions over source text; the CLI feeds them files.
 */

import { dirname, join, normalize } from 'node:path/posix';
import { GROUPS, type GameSurface } from './inventory.js';

export type SizeKind = 'css' | 'token' | 'tailwind' | 'arbitrary' | 'inline' | '3d' | 'canvas';

export interface FontSize {
  file: string;
  line: number;
  kind: SizeKind;
  /** CSS px; for 3D text, world units; null when computed at run time. */
  px: number | null;
  token?: string;
  /** Responsive or state prefix, e.g. `md`. */
  variant?: string;
  raw: string;
}

/** Tailwind's default type scale, used where the theme does not define the name. */
const TAILWIND: Record<string, number> = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36, '5xl': 48, '6xl': 60, '7xl': 72, '8xl': 96, '9xl': 128 };

const toPx = (value: string, unit: string | undefined): number => Number(value) * (unit === 'rem' ? 16 : 1);

/** Comments blanked to spaces, newlines kept, so indices and line numbers still hold. */
const uncomment = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));

const TOKEN = /--text-([a-z0-9]+(?:-[a-z0-9]+)*):\s*(\d*\.?\d+)(px|rem)\s*;/g;

/** The selectors (or at-rules) enclosing a position in CSS, outermost first. */
function enclosing(css: string, index: number): string[] {
  const stack: string[] = [];
  let start = 0;
  for (let i = 0; i < index; i += 1) {
    const c = css[i];
    if (c === '{') {
      stack.push(css.slice(start, i).trim());
      start = i + 1;
    } else if (c === '}') {
      stack.pop();
      start = i + 1;
    } else if (c === ';') start = i + 1;
  }
  return stack;
}

const inTheme = (css: string, index: number) => enclosing(css, index).some((s) => s.startsWith('@theme'));

/** `--text-body: 12px` in a `@theme` block; `--text-body--line-height` is not a size. */
export function typeTokens(source: string): Record<string, number> {
  const css = uncomment(source);
  const out: Record<string, number> = {};
  for (const m of css.matchAll(TOKEN)) if (inTheme(css, m.index)) out[m[1] ?? ''] = toPx(m[2] ?? '0', m[3]);
  return out;
}

export interface TokenOverride {
  file: string;
  line: number;
  selector: string;
  token: string;
  px: number;
}

/** A type token re-pointed inside a selector: a scope with its own scale. */
export function tokenOverrides(file: string, source: string): TokenOverride[] {
  const css = uncomment(source);
  return [...css.matchAll(TOKEN)].filter((m) => !inTheme(css, m.index)).map((m) => ({
    file,
    line: css.slice(0, m.index).split('\n').length,
    selector: enclosing(css, m.index).at(-1) ?? ':root',
    token: m[1] ?? '',
    px: toPx(m[2] ?? '0', m[3]),
  }));
}

export function fontSizes(file: string, source: string, tokens: Record<string, number>): FontSize[] {
  const out: FontSize[] = [];
  const css = file.endsWith('.css');
  (css ? uncomment(source) : source).split('\n').forEach((text, i) => {
    const line = i + 1;
    const found: (FontSize & { at: number })[] = [];
    const add = (at: number, size: Omit<FontSize, 'file' | 'line'>) => found.push({ file, line, at, ...size });
    if (css) {
      for (const m of text.matchAll(/font-size:\s*(\d*\.?\d+)(px|rem)\b/g)) add(m.index, { kind: 'css', px: toPx(m[1] ?? '0', m[2]), raw: m[0] });
      for (const m of text.matchAll(/\bfont:\s*[^;]*?(?<![\w.])(\d*\.?\d+)(px|rem)\b/g)) add(m.index, { kind: 'css', px: toPx(m[1] ?? '0', m[2]), raw: m[0] });
    } else {
      for (const m of text.matchAll(/(?<![\w-])((?:[a-z0-9-]+:)*)text-([a-z0-9]+)(?:\/[\w.]+)?(?![\w-])/g)) {
        const name = m[2] ?? '';
        const variant = (m[1] ?? '').replace(/:$/, '');
        const token = tokens[name];
        const base = token ?? TAILWIND[name];
        if (base === undefined) continue;
        add(m.index, { kind: token === undefined ? 'tailwind' : 'token', px: base, ...(token === undefined ? {} : { token: name }), ...(variant ? { variant } : {}), raw: m[0] });
      }
      for (const m of text.matchAll(/(?<![\w-])((?:[a-z0-9-]+:)*)text-\[(\d*\.?\d+)(px|rem)\]/g)) {
        const variant = (m[1] ?? '').replace(/:$/, '');
        add(m.index, { kind: 'arbitrary', px: toPx(m[2] ?? '0', m[3]), ...(variant ? { variant } : {}), raw: m[0] });
      }
      for (const m of text.matchAll(/\bfontSize:\s*['"]?(\d*\.?\d+)(px|rem)?['"]?/g)) add(m.index, { kind: 'inline', px: toPx(m[1] ?? '0', m[2]), raw: m[0] });
      for (const m of text.matchAll(/\bfontSize=\{(\d*\.?\d+)\}/g)) add(m.index, { kind: '3d', px: Number(m[1]), raw: m[0] });
    }
    for (const m of text.matchAll(/\.font\s*=\s*([`'"])(.*?)\1/g)) {
      const literal = /(?<![\w.$])(\d*\.?\d+)px/.exec(m[2] ?? '');
      add(m.index, { kind: 'canvas', px: literal ? Number(literal[1]) : null, raw: m[0] });
    }
    out.push(...found.sort((a, b) => a.at - b.at).map(({ at: _at, ...size }) => size));
  });
  return out;
}

/** Keyframes by name → whether they change light (opacity, colour, brightness, glow). */
export function keyframes(source: string): Map<string, boolean> {
  const css = uncomment(source);
  const out = new Map<string, boolean>();
  for (const m of css.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
    let depth = 1;
    let end = m.index + m[0].length;
    while (depth > 0 && end < css.length) {
      const c = css[end];
      if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      end += 1;
    }
    const body = css.slice(m.index + m[0].length, end);
    const light = /(?<![\w-])(opacity|filter|background(?:-color)?|color|box-shadow|fill|stroke)\s*:/.test(body);
    out.set(m[1] ?? '', (out.get(m[1] ?? '') ?? false) || light);
  }
  return out;
}

export interface AnimationUse {
  file: string;
  line: number;
  /** null for a bare `animation-duration` override, whose name is set elsewhere. */
  name: string | null;
  seconds: number;
  /** null when set by another rule. */
  repeats: number | null;
  raw: string;
}

const KEYWORDS = new Set(['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'infinite', 'alternate', 'alternate-reverse', 'reverse', 'normal', 'forwards', 'backwards', 'both', 'none', 'running', 'paused', 'step-start', 'step-end', 'initial', 'inherit', 'unset']);

function splitTop(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const c of value) {
    if (c === '(') depth += 1;
    if (c === ')') depth -= 1;
    if (c === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else current += c;
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function shorthand(value: string): { name: string | null; seconds: number; repeats: number }[] {
  return splitTop(value).map((part) => {
    const tokens = part.replace(/\([^)]*\)/g, '()').split(/\s+/).filter(Boolean);
    const time = tokens.find((t) => /^\d*\.?\d+m?s$/.test(t));
    const seconds = time ? (time.endsWith('ms') ? Number(time.slice(0, -2)) / 1000 : Number(time.slice(0, -1))) : 0;
    const count = tokens.find((t) => t === 'infinite' || /^\d*\.?\d+$/.test(t));
    const name = tokens.find((t) => /^[a-z_][\w-]*$/i.test(t) && !KEYWORDS.has(t) && !t.endsWith('()')) ?? null;
    return { name, seconds, repeats: count === 'infinite' ? Infinity : count ? Number(count) : 1 };
  });
}

export function animationUses(file: string, source: string): AnimationUse[] {
  const out: AnimationUse[] = [];
  (file.endsWith('.css') ? uncomment(source) : source).split('\n').forEach((text, i) => {
    const line = i + 1;
    const push = (value: string, raw: string) => {
      for (const use of shorthand(value)) out.push({ file, line, ...use, raw });
    };
    for (const m of text.matchAll(/--animate-[\w-]+:\s*([^;]+)/g)) push(m[1] ?? '', m[0]);
    for (const m of text.matchAll(/(?<![\w-])animation:\s*([^;'"`}]+)/g)) push(m[1] ?? '', m[0]);
    for (const m of text.matchAll(/(?<![\w-])animation:\s*['"`]([^'"`]+)['"`]/g)) push(m[1] ?? '', m[0]);
    for (const m of text.matchAll(/animate-\[([^\]]+)\]/g)) push((m[1] ?? '').replace(/_/g, ' '), m[0]);
    for (const m of text.matchAll(/animation-duration:\s*(\d*\.?\d+)(m?s)/g)) {
      out.push({ file, line, name: null, seconds: Number(m[1]) / (m[2] === 'ms' ? 1000 : 1), repeats: null, raw: m[0] });
    }
  });
  return out;
}

export interface HoldDuration {
  file: string;
  line: number;
  name: string;
  ms: number;
}

export function holdDurations(file: string, source: string): HoldDuration[] {
  const out: HoldDuration[] = [];
  source.split('\n').forEach((text, i) => {
    for (const m of text.matchAll(/\b(\w*(?:hold|Hold|HOLD|longPress|LongPress|LONG_PRESS)\w*?(?:ms|Ms|MS|duration|Duration|DURATION))\b\s*[=:]\s*\{?\s*(\d[\d_]*)/g)) {
      out.push({ file, line: i + 1, name: m[1] ?? '', ms: Number((m[2] ?? '0').replace(/_/g, '')) });
    }
  });
  return out;
}

export interface ActionCoverage {
  file: string;
  /** Press handlers: click, pointer down/up, confirm, submit. Typing is not counted. */
  actions: number;
  sound: number;
  haptic: number;
  /** Uses of kit controls that play sound or haptics themselves. */
  kit: number;
}

export function actionCoverage(file: string, source: string, kit: ReadonlySet<string>): ActionCoverage {
  const count = (pattern: RegExp) => [...source.matchAll(pattern)].length;
  return {
    file,
    actions: count(/\bon(?:Click|PointerDown|PointerUp|Confirm|Submit)=\{/g),
    sound: count(/\bplaySound\(/g),
    haptic: count(/\bhaptic\(/g),
    kit: [...source.matchAll(/<([A-Z]\w*)\b/g)].filter((m) => kit.has(m[1] ?? '')).length,
  };
}

export interface PushCopy {
  file: string;
  line: number;
  lang: string;
  kind: string;
  title: string;
  body: string;
}

/** `kind: { title: '…', body: '…' }` rows, or `kind: ['title', 'body']` tuples, inside `tr: { … }` language blocks. */
export function pushCopies(file: string, source: string): PushCopy[] {
  const out: PushCopy[] = [];
  let lang = '?';
  source.split('\n').forEach((text, i) => {
    const block = /^\s*(tr|en|de|es|fr|ja):\s*\{/.exec(text);
    if (block) lang = block[1] ?? '?';
    const rows = [
      ...text.matchAll(/(\w+):\s*\{\s*title:\s*(['"])((?:\\.|(?!\2)[^\\])*)\2,\s*body:\s*(['"])((?:\\.|(?!\4)[^\\])*)\4/g),
      ...text.matchAll(/(\w+):\s*\[\s*(['"])((?:\\.|(?!\2)[^\\])*)\2,\s*(['"])((?:\\.|(?!\4)[^\\])*)\4\s*\]/g),
    ].sort((a, b) => a.index - b.index);
    for (const row of rows) out.push({ file, line: i + 1, lang, kind: row[1] ?? '', title: row[3] ?? '', body: row[5] ?? '' });
  });
  return out;
}

const SAMPLE: Record<string, string> = { world: 'Kestrel', minutes: '12', name: 'Tersane', count: '2', hours: '3', commander: 'Orion', planet: 'Kestrel' };

/** `{world}` and i18next's `{{world}}` with typical values, so lengths are what a player reads. */
export function fillPlaceholders(text: string): string {
  return text.replace(/\{\{?\s*(\w+)\s*\}?\}/g, (_, name: string) => SAMPLE[name] ?? name);
}

/**
 * Which design dialect a screen file still speaks (stage 4.A, 2026-11-13). A surface is
 * rebuilt when its files carry no v1, v2 or own-stylesheet mark. Counts are marks: each
 * kit import and each class.
 */
export type DialectKey = 'v1' | 'v2' | 'own' | 'kit';

export interface Dialect {
  file: string;
  /** The old chrome: `ui/kit` imports, `styles.css` and `styles/` classes, bone/dim/faint colours, the old type scale. */
  v1: number;
  /** `v2/kit` imports, `v2/*.css` classes and `*-v2-*` colour utilities. */
  v2: number;
  /** Classes from a screen's own stylesheet (simulator, wiki, arena, landing…). */
  own: number;
  /** The game kit: `game-ui` imports and `gk-` classes. */
  kit: number;
}

/** The classes a stylesheet's selectors name, in order and once each. */
export function cssClasses(source: string): string[] {
  return [...new Set([...uncomment(source).matchAll(/(?:^|[\s,>+~(}])\.([a-zA-Z_][\w-]*)/g)].map((m) => m[1] ?? ''))];
}

/** `styles/atmosphere.css` came with the v2 scene art (2026-10-15); `styles.css` and the chrome are v1. */
const sheetDialect = (path: string): DialectKey =>
  path.startsWith('game-ui/') ? 'kit' : path.startsWith('v2/') || path === 'styles/atmosphere.css' ? 'v2' : path === 'styles.css' || path.startsWith('styles/') ? 'v1' : 'own';
const PRIORITY: DialectKey[] = ['v1', 'v2', 'kit', 'own'];
/** Tailwind utilities a sheet restyles inside its own scope (`.simulator .sr-only`): still Tailwind's. */
const TAILWIND_UTILITY = /^(?:sr-only|not-sr-only|(?:overflow|overscroll)(?:-[xy])?-[a-z]+)$/;

/** Each class under its `v2-`/`gk-` name or the sheet that defines it; a class two sheets name goes to the older dialect. */
export function classDialects(sheets: readonly { path: string; text: string }[]): Map<string, DialectKey> {
  const out = new Map<string, DialectKey>();
  const ordered = [...sheets].sort((a, b) => PRIORITY.indexOf(sheetDialect(a.path)) - PRIORITY.indexOf(sheetDialect(b.path)));
  for (const sheet of ordered) {
    for (const name of cssClasses(sheet.text)) {
      if (out.has(name) || TAILWIND_UTILITY.test(name)) continue;
      // A `v2-` class written into the old global sheet is still v2.
      out.set(name, name.startsWith('v2-') ? 'v2' : name.startsWith('gk-') ? 'kit' : sheetDialect(sheet.path));
    }
  }
  return out;
}

/** Comments and string literals in source order; a comment is skipped whole, so a quote inside it opens nothing. */
const LITERAL = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;
/** The v1 ink colours and type scale, Tailwind utilities from `styles.css`'s theme rather than classes it defines. */
const V1_TOKEN = /^(?:(?:text|bg|border|ring|fill|stroke|from|via|to|divide|outline|decoration|placeholder|shadow|caret|accent)-(?:bone|dim|faint)|text-(?:body|label|caption|micro))$/;
const V2_TOKEN = /^[a-z]+(?:-[a-z]+)*-v2-[a-z0-9-]+$/;
const KIT_CLASS = /^gk-[a-z0-9-]+$/;

/** Where `className={…}` expressions run. */
function classRanges(source: string): [number, number][] {
  return [...source.matchAll(/className=\{/g)].map((m) => {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < source.length && depth > 0; i += 1) depth += source[i] === '{' ? 1 : source[i] === '}' ? -1 : 0;
    return [m.index, i];
  });
}

export function dialectOf(file: string, source: string, classes: ReadonlyMap<string, DialectKey>): Dialect {
  const out: Dialect = { file, v1: 0, v2: 0, own: 0, kit: 0 };
  const ranges = classRanges(source);
  for (const m of source.matchAll(LITERAL)) {
    const text = m[0];
    if (text.startsWith('/')) continue;
    const inner = text.slice(1, -1);
    if (inner.startsWith('./') || inner.startsWith('../')) {
      const path = normalize(join(dirname(file), inner));
      if (/^ui\/kit(?:\/|$)/.test(path)) out.v1 += 1;
      else if (/^v2\/kit(?:\/|$)/.test(path)) out.v2 += 1;
      else if (/^game-ui(?:\/|$)/.test(path)) out.kit += 1;
      continue;
    }
    // A lone string (`'name'`, `kind: 'works-full'`) is data unless a className takes it;
    // only a token shape (`'text-dim'`, `'gk-row'`) reads as a class anywhere.
    const words = inner.split(/\s+/).filter((w) => w.length > 0);
    const classy = words.length > 1 || source.slice(Math.max(0, m.index - 10), m.index) === 'className=' || ranges.some(([a, b]) => m.index > a && m.index < b);
    for (const word of words) {
      // `hover:text-dim/70`, and a quoted class inside a template's `${a ? 'plate-lit' : ''}`.
      const name = word.replace(/^['"{(]+|['"})]+$/g, '').replace(/^(?:[a-z0-9-]+:)+/, '').replace(/\/\d+$/, '');
      const key = KIT_CLASS.test(name) ? 'kit' : V2_TOKEN.test(name) ? 'v2' : V1_TOKEN.test(name) ? 'v1' : classy ? (classes.get(name) ?? null) : null;
      if (key !== null) out[key] += 1;
    }
  }
  return out;
}

export interface StaticScan {
  tokens: Record<string, number>;
  overrides: TokenOverride[];
  /** The selector a document-wide click listener answers with a generic tap sound, if any. */
  globalTap: string | null;
  fontSizes: FontSize[];
  /** Every animation use; `light` is null when the keyframes are named elsewhere or unknown. */
  animations: (AnimationUse & { light: boolean | null })[];
  holds: HoldDuration[];
  coverage: ActionCoverage[];
  notifications: (PushCopy & { source: 'push' | 'local' })[];
  dialects: Dialect[];
}

/** Changes light, repeats, and cycles more than three times a second (WCAG 2.3.1 territory). */
const fastLight = (a: StaticScan['animations'][number]) => a.seconds > 0 && a.seconds < 1 / 3 && a.light !== false && (a.repeats === null || a.repeats > 1);

const where = (x: { file: string; line: number }) => `${x.file}:${String(x.line)}`;

type ReportedSurface = Pick<GameSurface, 'id' | 'group' | 'files' | 'unreached'>;

/** One row per surface, in group order: its files' dialect marks added up, and what no way in reaches yet. */
function surfaceRows(dialects: readonly Dialect[], surfaces: readonly ReportedSurface[]) {
  const byFile = new Map(dialects.map((d) => [d.file, d]));
  return [...surfaces].sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group)).map((s) => {
    const marks = s.files.map((f) => byFile.get(f)).filter((d) => d !== undefined);
    const sum = (key: DialectKey) => marks.reduce((n, d) => n + d[key], 0);
    const has = s.files.length > 0;
    const counts = has ? [sum('v1'), sum('v2'), sum('own'), sum('kit')].map(String) : ['—', '—', '—', '—'];
    const left = s.unreached ?? [];
    return { has, old: has && sum('v1') + sum('v2') + sum('own') > 0, left: left.length, line: `| ${s.group} | ${s.id} | ${counts.join(' | ')} | ${left.length > 0 ? left.join('; ') : '—'} |` };
  });
}

export function renderStatic(scan: StaticScan, { date, surfaces }: { date: string; surfaces: readonly ReportedSurface[] }): string {
  const rows = surfaceRows(scan.dialects, surfaces);
  const shown = scan.fontSizes.filter((f) => f.kind !== '3d');
  const tokenRows = Object.entries(scan.tokens).sort((a, b) => a[1] - b[1]).map(([name, px]) => {
    const uses = shown.filter((f) => f.token === name);
    return `| ${name} | ${String(px)} px | ${String(uses.length)} | ${String(new Set(uses.map((u) => u.file)).size)} |`;
  });
  const byPx = new Map<number, number>();
  for (const f of shown) if (f.px !== null) byPx.set(f.px, (byPx.get(f.px) ?? 0) + 1);
  const pxRows = [...byPx.entries()].sort((a, b) => a[0] - b[0]).map(([px, n]) => `| ${String(px)} px | ${String(n)} |`);
  const tiny = shown.filter((f) => f.px !== null && f.px < 9);
  const solid = scan.fontSizes.filter((f) => f.kind === '3d' || f.kind === 'canvas');
  const fast = scan.animations.filter(fastLight);
  const silent = scan.coverage.filter((c) => c.actions > 0 && c.sound + c.haptic + c.kit === 0).sort((a, b) => b.actions - a.actions);
  const answering = scan.coverage.filter((c) => c.actions > 0 && c.sound + c.haptic + c.kit > 0);
  const lines = (items: string[]) => (items.length === 0 ? '_Yok._' : items.map((i) => `- ${i}`).join('\n'));
  const notes = scan.notifications.map((n) => {
    const body = fillPlaceholders(n.body);
    const title = fillPlaceholders(n.title);
    return `| ${n.source} | ${n.line > 0 ? where(n) : n.file} | ${n.lang} | ${n.kind} | ${title} | ${String(title.length)} | ${String(body.length)} | ${body.length > 40 ? 'evet' : 'hayır'} | ${body.slice(0, 40)}${body.length > 40 ? '…' : ''} |`;
  });

  return `# Statik tarama — ${date}

Kaynak kodda bildirilen değerler. Çalışan arayüzün ulaşamadığı yerler (plan §1.4). Sayılar kullanım yeri sayısıdır, ekranda görünme sayısı değildir.

## Tasarım dili ve ulaşılmamış durumlar (yüzey başına)

4. aşamada (2026-11-13) bir yüzey, dosyaları eski dillerden iz taşımadığında ve her durumuna bir ulaşım yolu olduğunda biter. Sayılar işaret sayısıdır, yani içe aktarmalar ve sınıflar:

- v1: \`ui/kit\`, \`styles.css\` ve \`styles/\` sınıfları (plate, slab, legend, name…), bone/dim/faint renkleri, eski yazı ölçeği (\`text-body/label/caption/micro\`)
- v2: \`v2/kit\`, \`v2/*.css\` sınıfları, \`*-v2-*\`
- kendi CSS'i: ekranın kendi stil dosyasındaki sınıflar (simülatör, Wiki, arena, giriş…)
- kit: \`game-ui\`, \`gk-*\`

Paylaşılan parçalar (\`ui/\`, \`v2/kit/\`) burada sayılmaz; kullanıldıkları yüzeyle birlikte değişirler. Kendi dosyası olmayan yüzey \`—\` gösterir. Tek kelimelik düz bir dize (\`'name'\`) yalnız \`className\` içindeyse sınıf sayılır.

Eski dil (v1, v2 ya da kendi CSS'i) izi kalan yüzey: ${String(rows.filter((r) => r.old).length)} / ${String(rows.filter((r) => r.has).length)}. Ulaşılmamış durum: ${String(rows.reduce((n, r) => n + r.left, 0))}.

| Grup | Yüzey | v1 | v2 | kendi CSS | kit | Ulaşılmamış durumlar |
|---|---|---|---|---|---|---|
${rows.map((r) => r.line).join('\n')}

## Yazı boyutları

### Tema belirteçleri

| Belirteç | Boyut | Kullanım | Dosya |
|---|---|---|---|
${tokenRows.join('\n')}

### Bütün bildirimler, boyuta göre (3D hariç)

| Boyut | Kullanım |
|---|---|
${pxRows.join('\n')}

### 9 px altı

${lines(tiny.map((f) => `${where(f)} — \`${f.raw}\` (${String(f.px)} px)`))}

### Kapsamlı belirteç geçersiz kılmaları

Bir seçicinin içinde belirteci yeniden tanımlayan yerler: o yüzey kendi ölçeğini kullanır.

${lines(scan.overrides.map((o) => `${where(o)} — \`${o.selector}\` ${o.token} → ${String(o.px)} px`))}

### 3D ve canvas metinleri

3D boyutları dünya birimidir; ekrandaki boyut kameraya bağlıdır ve çalışan arayüzde ölçülür.

${lines(solid.map((f) => `${where(f)} — \`${f.raw}\` (${f.kind})`))}

## Hızlı ve ışık değiştiren animasyonlar

Periyodu 333 ms'den kısa, tekrar eden ve opaklık, renk, parlaklık veya ışıma değiştiren kullanımlar. Adı başka kuralda olan süre geçersiz kılmaları da listelenir.

${lines(fast.map((a) => `${where(a)} — \`${a.raw}\` · ${a.name ?? 'ad başka kuralda'} · ${String(a.seconds)} sn · ${a.repeats === null ? 'tekrar başka kuralda' : a.repeats === Infinity ? 'sonsuz' : `${String(a.repeats)} kez`}${a.light === null ? ' · ışık etkisi elle kontrol edilecek' : ''}`))}

## Basılı tutma süreleri

${lines(scan.holds.map((h) => `${where(h)} — \`${h.name}\` ${String(h.ms)} ms`))}

## Ses ve titreşim kapsamı (kaba)

${scan.globalTap ? `Taban: \`${scan.globalTap}\` öğelerinin her tıklaması genel "tap" sesini çalar (\`lib/sound.ts\`). Div'e bağlı dokunmalar, 3D sahne isabetleri ve yalnız pointerdown ile çalışan kontroller bu tabanın dışındadır. Titreşimin genel bir tabanı yoktur.` : 'Genel bir tıklama sesi tabanı bulunamadı.'}

Basma eylemi olan ${String(silent.length + answering.length)} dosyanın ${String(answering.length)} tanesi eyleme özgü ses, titreşim veya kendiliğinden cevap veren bir kit kontrolü kullanıyor. Ayrıntılı inceleme 4. aşamanın kontrol listesine gider.

Eyleme özgü sesi, titreşimi ve cevap veren kit kontrolü olmayanlar:

${lines(silent.map((c) => `${c.file} — ${String(c.actions)} eylem`))}

## Bildirim metinleri

Kilit ekranında gövde ~40 karakterden sonra kesilebilir. Yer tutucular örnek değerlerle dolduruldu (dünya: Kestrel, dakika: 12).

| Kaynak | Yer | Dil | Tür | Başlık | Başlık uz. | Gövde uz. | 40'ı aşıyor | İlk 40 karakter |
|---|---|---|---|---|---|---|---|---|
${notes.join('\n')}
`;
}
