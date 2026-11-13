/**
 * WHAT A LARGER TYPE SCALE WOULD COST (plan §1.3).
 *
 * The same surfaces measured again with the small type tokens raised by a temporary
 * stylesheet, product code untouched. Only measurements present in both runs are
 * compared, so a failure in one run does not read as a change.
 */

import type { SurfaceAudit } from './audit.js';
import type { Entry } from './report.js';

export const WHAT_IF = {
  A: { micro: 11, caption: 12, body: 14 },
  B: { micro: 11, caption: 12 },
} as const satisfies Record<string, Record<string, number>>;

export type WhatIfName = keyof typeof WHAT_IF;

export const isWhatIf = (name: string): name is WhatIfName => name in WHAT_IF;

/** Root custom properties: unlayered, so they beat Tailwind's `@layer theme` values. */
export function whatIfCss(name: WhatIfName): string {
  return `:root { ${Object.entries(WHAT_IF[name]).map(([token, px]) => `--text-${token}: ${String(px)}px !important;`).join(' ')} }`;
}

export interface Tally {
  truncated: number;
  clipped: number;
  /** Texts set on more than one line. */
  wrapped: number;
  /** Measurements that needed scrolling to see the whole surface. */
  scrolling: number;
  /** Screens of scrolling, summed. */
  parts: number;
  overflowing: number;
}

export interface WhatIfSummary {
  pairs: number;
  before: Tally;
  after: Tally;
  broken: { surface: string; reach: string; lang: string; profile: string; text: string; how: 'truncated' | 'clipped' }[];
}

const keyOf = (e: Entry) => `${e.surface}|${e.reach}|${e.lang}|${e.profile}`;
const textKey = (t: { label: string; text: string }) => `${t.label}|${t.text}`;

function tally(audits: readonly SurfaceAudit[]): Tally {
  const out: Tally = { truncated: 0, clipped: 0, wrapped: 0, scrolling: 0, parts: 0, overflowing: 0 };
  for (const a of audits) {
    for (const t of a.texts) {
      if (t.truncated) out.truncated += 1;
      else if (t.clipped) out.clipped += 1;
      if (t.rendered && t.lines > 1) out.wrapped += 1;
    }
    if (a.parts > 1) out.scrolling += 1;
    out.parts += a.parts;
    if (a.overflow.page) out.overflowing += 1;
  }
  return out;
}

export function whatIfSummary(base: readonly Entry[], raised: readonly Entry[]): WhatIfSummary {
  const before = new Map(base.filter((e) => e.audit).map((e) => [keyOf(e), e]));
  const pairs = raised.flatMap((e) => {
    const b = before.get(keyOf(e));
    return e.audit && b?.audit ? [{ entry: e, before: b.audit, after: e.audit }] : [];
  });
  const broken: WhatIfSummary['broken'] = [];
  for (const { entry, before: b, after } of pairs) {
    const was = new Set(b.texts.filter((t) => t.truncated || t.clipped).map(textKey));
    for (const t of after.texts) {
      if ((t.truncated || t.clipped) && !was.has(textKey(t))) broken.push({ surface: entry.surface, reach: entry.reach, lang: entry.lang, profile: entry.profile, text: t.text, how: t.truncated ? 'truncated' : 'clipped' });
    }
  }
  return { pairs: pairs.length, before: tally(pairs.map((p) => p.before)), after: tally(pairs.map((p) => p.after)), broken };
}

const LIMIT = 60;

const NAMES: WhatIfName[] = ['A', 'B'];

export function renderWhatIf(summaries: Partial<Record<WhatIfName, WhatIfSummary>>): string {
  return NAMES.flatMap((name) => {
    const s = summaries[name];
    if (!s) return [];
    const rows: [string, keyof Tally][] = [['Kesilen metin', 'truncated'], ['Kırpılan metin', 'clipped'], ['Birden çok satıra kırılan metin', 'wrapped'], ['Kaydırma gereken ölçüm', 'scrolling'], ['Toplam ekran (kaydırma parçası)', 'parts'], ['Yana taşan ölçüm', 'overflowing']];
    const scale = Object.entries(WHAT_IF[name]).map(([token, px]) => `${token} → ${String(px)} px`).join(', ');
    const list = s.broken.slice(0, LIMIT).map((b) => `- ${b.surface} · \`${b.reach}\` · ${b.lang}/${b.profile} — "${b.text.slice(0, 60)}" (${b.how === 'truncated' ? 'kesildi' : 'kırpıldı'})`).join('\n');
    return [`### Seçenek ${name}: ${scale}

${String(s.pairs)} ölçüm çifti (aynı yüzey, yol, dil ve ekran iki koşuda da ölçüldü). Yalnız tema belirteçleri yükseltildi; sabit px boyutlar (ör. arena.css) değişmedi.

| | Bugün | Seçenek ${name} |
|---|---|---|
${rows.map(([label, key]) => `| ${label} | ${String(s.before[key])} | ${String(s.after[key])} |`).join('\n')}

Yalnız yükseltilmiş ölçekte bozulan metinler (${String(s.broken.length)}):

${list || '_Yok._'}${s.broken.length > LIMIT ? `\n- … ve ${String(s.broken.length - LIMIT)} tane daha (tamamı JSON'da)` : ''}
`];
  }).join('\n');
}
