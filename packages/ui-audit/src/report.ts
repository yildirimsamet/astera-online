/**
 * FROM MANY SURFACE AUDITS TO ONE BASELINE THE OWNER CAN READ.
 *
 * Coverage comes first: every way in the inventory names is shown as measured, failed or
 * not run, so a gap in the baseline is visible rather than silent.
 */

import type { AuditedTarget, AuditedText, SurfaceAudit } from './audit.js';
import { contrastVerdict, distinctSizes, edgeBand, fastBlink, gestureZone, shoutedSmall, sizeBucket, slowTransition, targetBand, thinSmall, tightLines, wideLines, type SizeBucket, type TargetBand } from './criteria.js';
import type { Surface } from './inventory.js';
import { words } from './readability.js';

export interface Entry {
  surface: string;
  reach: string;
  lang: string;
  profile: string;
  audit: SurfaceAudit | null;
  error: string | null;
}

/** Languages measured on every criterion; the rest are measured for overflow only. */
export const FULL_LANGUAGES = ['tr', 'en'];

interface Where {
  surface: string;
  reach: string;
  lang: string;
  profile: string;
}

export interface TextHit extends Where {
  text: string;
  size: number;
  label: string;
  detail: string;
}

export interface TargetHit extends Where {
  name: string;
  label: string;
  width: number;
  height: number;
  detail: string;
}

export interface SurfaceRow extends Where {
  texts: number;
  small: number;
  minSize: number | null;
  sizes: number;
  contrastFails: number;
  targets: number;
  smallTargets: number;
  /** Null when the run pressed nothing: press answers are measured on tr/phone only. */
  noFeedback: number | null;
  words: number;
  /** Scroll parts: a screenful each, so words ÷ screens is the text met per screen. */
  screens: number;
  /** Shown text blocks of six words or more: sentences, not names, numbers or labels. */
  longBlocks: number;
  longestSentence: number;
  atesman: number | null;
  hues: number;
  truncated: number;
  overflow: boolean;
  score: number;
}

export interface ProfileSummary {
  entries: number;
  texts: number;
  sizes: Record<SizeBucket, number>;
  contrastFails: TextHit[];
  shouted: TextHit[];
  tight: TextHit[];
  wide: TextHit[];
  thin: TextHit[];
  targets: Record<TargetBand, number>;
  spacingFails: TargetHit[];
  edgeSmall: TargetHit[];
  /** Targets reaching into the Android back-gesture strips or the home bar. */
  gestureZone: TargetHit[];
  iconOnly: number;
  unnamedIcons: TargetHit[];
  /** No name, no text, no icon: a backdrop or a bare tap area. */
  unnamedAreas: TargetHit[];
  iconContrastFails: TargetHit[];
  feedback: Record<'immediate' | 'active' | 'none', number>;
  noFeedback: TargetHit[];
  slowTransitions: (Where & { label: string; seconds: number })[];
  fastBlinks: (Where & { label: string; name: string; seconds: number })[];
  offGrid: { values: number; total: number };
  rows: SurfaceRow[];
}

export interface Summary {
  coverage: { surface: string; reach: string; status: 'measured' | 'error' | 'not-run'; runs: string[]; error: string | null }[];
  phone: ProfileSummary;
  desktop: ProfileSummary;
  overflow: { truncated: TextHit[]; clipped: TextHit[]; pages: (Where & { elements: string[] })[] };
  /** Measurements the part limit stopped before the end of the scroll. */
  capped: (Where & { parts: number })[];
}

const where = (e: Entry): Where => ({ surface: e.surface, reach: e.reach, lang: e.lang, profile: e.profile });
const textHit = (e: Entry, t: AuditedText, detail = ''): TextHit => ({ ...where(e), text: t.text.slice(0, 60), size: t.renderedSize, label: t.key ?? t.label, detail });
const targetHit = (e: Entry, t: AuditedTarget, detail = ''): TargetHit => ({ ...where(e), name: t.name.slice(0, 40), label: t.key ?? t.label, width: t.region?.width ?? 0, height: t.region?.height ?? 0, detail });

const shown = (audit: SurfaceAudit) => audit.texts.filter((t) => t.rendered && !t.placeholder);
const reachable = (audit: SurfaceAudit) => audit.targets.filter((t) => t.region !== null);

function row(e: Entry, audit: SurfaceAudit): SurfaceRow {
  const texts = shown(audit);
  const targets = reachable(audit);
  const small = texts.filter((t) => t.renderedSize < 12).length;
  const contrastFails = texts.filter((t) => contrastVerdict(t) === 'fail').length;
  const smallTargets = targets.filter((t) => t.region && Math.min(t.region.width, t.region.height) < 44).length;
  const pressed = targets.some((t) => t.feedback !== null);
  const noFeedback = pressed ? targets.filter((t) => t.feedback === 'none').length : null;
  const truncated = audit.texts.filter((t) => t.truncated || t.clipped).length;
  return {
    ...where(e),
    texts: texts.length,
    small,
    minSize: texts.length > 0 ? Math.min(...texts.map((t) => t.renderedSize)) : null,
    sizes: distinctSizes(texts),
    contrastFails,
    targets: targets.length,
    smallTargets,
    noFeedback,
    words: audit.stats.words,
    screens: audit.parts,
    longBlocks: texts.filter((t) => words(t.text).length >= 6).length,
    longestSentence: audit.stats.longestSentence,
    atesman: e.lang === 'tr' ? audit.stats.atesman : null,
    hues: audit.hues.length,
    truncated,
    overflow: audit.overflow.page,
    score: small + 3 * contrastFails + 2 * smallTargets + (noFeedback ?? 0) + 3 * truncated + (audit.overflow.page ? 5 : 0),
  };
}

const zeroSizes = (): Record<SizeBucket, number> => ({ '<9': 0, '9–10': 0, '10–11': 0, '11–12': 0, '12–13': 0, '13–14': 0, '≥14': 0 });
const zeroTargets = (): Record<TargetBand, number> => ({ '<24': 0, '24–44': 0, '44–48': 0, '≥48': 0 });

function profileSummary(entries: readonly Entry[], profile: string): ProfileSummary {
  const out: ProfileSummary = {
    entries: 0, texts: 0, sizes: zeroSizes(), contrastFails: [], shouted: [], tight: [], wide: [], thin: [], targets: zeroTargets(),
    spacingFails: [], edgeSmall: [], gestureZone: [], iconOnly: 0, unnamedIcons: [], unnamedAreas: [], iconContrastFails: [], feedback: { immediate: 0, active: 0, none: 0 },
    noFeedback: [], slowTransitions: [], fastBlinks: [], offGrid: { values: 0, total: 0 }, rows: [],
  };
  for (const e of entries) {
    const { audit } = e;
    if (!audit || e.profile !== profile || !FULL_LANGUAGES.includes(e.lang)) continue;
    out.entries += 1;
    for (const t of shown(audit)) {
      out.texts += 1;
      out.sizes[sizeBucket(t.renderedSize)] += 1;
      if (contrastVerdict(t) === 'fail') out.contrastFails.push(textHit(e, t, `p5 ${t.contrast?.p5.toFixed(2) ?? '?'}:1`));
      if (shoutedSmall(t)) out.shouted.push(textHit(e, t));
      if (tightLines(t)) out.tight.push(textHit(e, t, `satır aralığı ${t.lineHeight?.toFixed(2) ?? '?'}`));
      if (wideLines(t)) out.wide.push(textHit(e, t, `${String(t.charsPerLine)} karakter/satır`));
      if (thinSmall(t)) out.thin.push(textHit(e, t, `ağırlık ${String(t.fontWeight)}`));
    }
    for (const t of reachable(audit)) {
      const region = t.region;
      if (!region) continue;
      out.targets[targetBand(region)] += 1;
      if (t.spacingFail) out.spacingFails.push(targetHit(e, t));
      if (Math.min(region.width, region.height) < 44 && edgeBand(region.box, audit.viewport.height) !== 'middle') out.edgeSmall.push(targetHit(e, t, edgeBand(region.box, audit.viewport.height)));
      const zone = gestureZone(region.box, audit.viewport);
      if (zone) out.gestureZone.push(targetHit(e, t, zone));
      if (!t.visibleText && t.hasIcon) {
        out.iconOnly += 1;
        if (!t.name) out.unnamedIcons.push(targetHit(e, t));
      }
      if (!t.visibleText && !t.hasIcon && !t.name) out.unnamedAreas.push(targetHit(e, t));
      if (t.iconContrast && t.iconContrast.p5 < 3) out.iconContrastFails.push(targetHit(e, t, `p5 ${t.iconContrast.p5.toFixed(2)}:1`));
      if (t.feedback) out.feedback[t.feedback] += 1;
      if (t.feedback === 'none') out.noFeedback.push(targetHit(e, t));
    }
    for (const m of audit.motion.transitions) if (slowTransition(m.seconds)) out.slowTransitions.push({ ...where(e), label: m.key ?? m.label, seconds: m.seconds });
    for (const a of audit.motion.animations) if (fastBlink(a)) out.fastBlinks.push({ ...where(e), label: a.key ?? a.label, name: a.name, seconds: a.seconds });
    out.offGrid.values += audit.spacing.offGrid;
    out.offGrid.total += audit.spacing.total;
    out.rows.push(row(e, audit));
  }
  return out;
}

export function summarize(entries: readonly Entry[], surfaces: readonly Surface[]): Summary {
  const coverage = surfaces.flatMap((surface) =>
    surface.reach.map((reach) => {
      const mine = entries.filter((e) => e.surface === surface.id && e.reach === reach);
      const measured = mine.filter((e) => e.audit !== null);
      const failed = mine.find((e) => e.error !== null);
      const status: 'measured' | 'error' | 'not-run' = measured.length > 0 ? 'measured' : failed ? 'error' : 'not-run';
      return { surface: surface.id, reach, status, runs: measured.map((e) => `${e.lang}/${e.profile}`), error: measured.length > 0 ? null : (failed?.error ?? null) };
    }),
  );

  const overflow: Summary['overflow'] = { truncated: [], clipped: [], pages: [] };
  const capped: Summary['capped'] = [];
  for (const e of entries) {
    if (!e.audit) continue;
    if (e.audit.partsCapped) capped.push({ ...where(e), parts: e.audit.parts });
    for (const t of e.audit.texts) {
      if (t.truncated) overflow.truncated.push(textHit(e, t));
      else if (t.clipped) overflow.clipped.push(textHit(e, t));
    }
    if (e.audit.overflow.page) overflow.pages.push({ ...where(e), elements: e.audit.overflow.elements });
  }

  return { coverage, phone: profileSummary(entries, 'phone'), desktop: profileSummary(entries, 'desktop'), overflow, capped };
}

const pct = (n: number, total: number) => (total === 0 ? '—' : `%${(Math.round((n / total) * 1000) / 10).toLocaleString('tr-TR')}`);
const at = (w: Where) => `${w.surface} · \`${w.reach}\` · ${w.lang}/${w.profile}`;
const LIST_LIMIT = 40;

function list<T>(items: readonly T[], line: (item: T) => string): string {
  if (items.length === 0) return '_Yok._\n';
  const shownItems = items.slice(0, LIST_LIMIT).map((item) => `- ${line(item)}`).join('\n');
  return `${shownItems}\n${items.length > LIST_LIMIT ? `- … ve ${String(items.length - LIST_LIMIT)} tane daha (tamamı JSON'da)\n` : ''}`;
}

function profileSection(p: ProfileSummary, title: string): string {
  const sizeRows = Object.entries(p.sizes).map(([bucket, n]) => `| ${bucket} px | ${String(n)} | ${pct(n, p.texts)} |`).join('\n');
  const targetTotal = Object.values(p.targets).reduce((a, b) => a + b, 0);
  const targetRows = Object.entries(p.targets).map(([band, n]) => `| ${band} px | ${String(n)} | ${pct(n, targetTotal)} |`).join('\n');
  const feedbackTotal = p.feedback.immediate + p.feedback.active + p.feedback.none;
  return `## ${title}

${String(p.entries)} ölçüm, ${String(p.texts)} görünen metin, ${String(targetTotal)} dokunma hedefi (yalnız tr ve en).

### Yazı boyutu (T1)

| Boyut | Metin | Pay |
|---|---|---|
${sizeRows}

### Kontrast (C1–C3)

Metnin arkasındaki en kötü %5'lik piksel diliminde WCAG oranı: normal metin 4,5:1, büyük metin 3:1.

${String(p.contrastFails.length)} metin kalıyor.

${list(p.contrastFails, (h) => `${at(h)} — "${h.text}" (${String(h.size)} px, ${h.detail})`)}
İkon kontrastı 3:1'in altında: ${String(p.iconContrastFails.length)}

${list(p.iconContrastFails, (h) => `${at(h)} — ${h.name || h.label} (${h.detail})`)}
### Dokunma hedefleri (K1–K5)

| Kısa kenar | Hedef | Pay |
|---|---|---|
${targetRows}

- WCAG 2.5.8 aralık hatası: ${String(p.spacingFails.length)}
- Ekranın üst ve alt %15'inde 44 px'ten küçük hedef: ${String(p.edgeSmall.length)}
- Android hareket alanına (yanlarda 24 px, altta 32 px; varsayılan değerler) uzanan hedef: ${String(p.gestureZone.length)} (sol ${String(p.gestureZone.filter((h) => h.detail === 'left').length)}, sağ ${String(p.gestureZone.filter((h) => h.detail === 'right').length)}, alt ${String(p.gestureZone.filter((h) => h.detail === 'bottom').length)})
- Yalnız ikonlu hedef: ${String(p.iconOnly)}; bunların adı olmayanı: ${String(p.unnamedIcons.length)}
- Adı, metni ve ikonu olmayan dokunulabilir alan (arka plan, boş alan): ${String(p.unnamedAreas.length)}

${list(p.spacingFails, (h) => `${at(h)} — ${h.name || h.label} (${String(h.width)}×${String(h.height)})`)}
Adı olmayan ikon butonları:

${list(p.unnamedIcons, (h) => `${at(h)} — ${h.label} (${String(h.width)}×${String(h.height)})`)}
Adı, metni ve ikonu olmayan dokunulabilir alanlar:

${list(p.unnamedAreas, (h) => `${at(h)} — ${h.label} (${String(h.width)}×${String(h.height)})`)}
### Basma tepkisi (F1)

${feedbackTotal === 0 ? '_Bu ekranda basılmadı; basma tepkisi yalnız tr/telefon koşusunda ölçülür._\n' : `Yalnız tr koşusunda basıldı (tepki dile bağlı değil).

| Tepki | Hedef | Pay |
|---|---|---|
| 100 ms içinde (pointerdown) | ${String(p.feedback.immediate)} | ${pct(p.feedback.immediate, feedbackTotal)} |
| Yalnız CSS :active | ${String(p.feedback.active)} | ${pct(p.feedback.active, feedbackTotal)} |
| Yok | ${String(p.feedback.none)} | ${pct(p.feedback.none, feedbackTotal)} |

${list(p.noFeedback, (h) => `${at(h)} — ${h.name || h.label}`)}`}
### Yazı alışkanlıkları (T2–T6)

- 12 px ve altında, büyük harfli, ikiden fazla kelime: ${String(p.shouted.length)}
- Çok satırlı ve satır aralığı 1,3'ün altında: ${String(p.tight.length)}
- Satır başına 50 karakterden fazla: ${String(p.wide.length)}
- 16 px altında ince ağırlık: ${String(p.thin.length)}

${list(p.shouted, (h) => `${at(h)} — "${h.text}" (${String(h.size)} px)`)}
### Hareket (F2)

- 300 ms'den uzun arayüz geçişi: ${String(p.slowTransitions.length)}
- Saniyede 3'ten hızlı dönen sonsuz animasyon: ${String(p.fastBlinks.length)}

${list(p.fastBlinks, (h) => `${at(h)} — ${h.label} \`${h.name}\` ${String(h.seconds)} sn`)}
### Boşluk ızgarası (L2)

Bloklar arasında 4'ün katı olmayan padding, gap ve dikey margin değeri (kontrol ve çip içi sayılmaz, 2.7): ${String(p.offGrid.values)} / ${String(p.offGrid.total)} (${pct(p.offGrid.values, p.offGrid.total)}).
`;
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length === 0 ? 0 : sorted.length % 2 === 1 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
};
const decimal = (n: number) => (Math.round(n * 10) / 10).toLocaleString('tr-TR');

/** The text budget (owner 2026-11-12, standard 2.3): Whiteout's median words per screen, one long block. */
const WORD_BUDGET = 55;
const BLOCK_BUDGET = 1;
const verdict = (value: number, budget: number) => `${decimal(value)} / ${String(budget)} ${value <= budget ? '✅' : '❌'}`;

/** W1: how much text a Turkish phone player meets per screen; competitors in research §7.3. */
function textLoad(rows: readonly SurfaceRow[]): string {
  const mine = rows.filter((r) => r.lang === 'tr').map((r) => ({ ...r, perScreen: r.words / r.screens, blocksPerScreen: r.longBlocks / r.screens }));
  const heaviest = [...mine].sort((a, b) => b.perScreen - a.perScreen).slice(0, 20);
  const wordMedian = median(mine.map((r) => r.perScreen));
  const blockMedian = median(mine.map((r) => r.blocksPerScreen));
  // Every screen over either budget, not only the wordiest: a few words in long blocks is over it too.
  const over = [...mine].sort((a, b) => b.perScreen - a.perScreen).filter((r) => r.perScreen > WORD_BUDGET || r.blocksPerScreen > BLOCK_BUDGET);
  return `## Metin yükü (W1, telefon, Türkçe)

Ekran başına kelime: yüzeyin kelimesi ÷ kaydırma parçası. Uzun blok: 6 ve daha çok kelimelik metin. Rakip referansı: araştırma §7.3.

${String(mine.length)} ölçüm. Ekran başına kelime ortancası ${decimal(wordMedian)}; ekran başına uzun blok ortancası ${decimal(blockMedian)}.

**Bütçe (2.3):** kelime ortancası ${verdict(wordMedian, WORD_BUDGET)} · uzun blok ortancası ${verdict(blockMedian, BLOCK_BUDGET)}

Bütçeyi aşan ekranlar (ekran başına ${String(WORD_BUDGET)} kelimeden ya da ${String(BLOCK_BUDGET)} uzun bloktan fazla):

${over.length === 0 ? '_Yok._' : over.map((r) => `- ${r.surface} · \`${r.reach}\` · ${decimal(r.perScreen)} kelime/ekran · ${decimal(r.blocksPerScreen)} uzun blok/ekran`).join('\n')}

| Yüzey | Yol | Kelime | Parça | Kelime/ekran | Uzun blok |
|---|---|---|---|---|---|
${heaviest.map((r) => `| ${r.surface} | \`${r.reach}\` | ${String(r.words)} | ${String(r.screens)} | ${decimal(r.perScreen)} | ${String(r.longBlocks)} |`).join('\n')}
`;
}

export function renderReport(summary: Summary, { title, date }: { title: string; date: string }): string {
  const measured = summary.coverage.filter((c) => c.status === 'measured').length;
  const gaps = summary.coverage.filter((c) => c.status !== 'measured');
  const rows = [...summary.phone.rows].sort((a, b) => b.score - a.score).slice(0, 20);
  const surfaceTable = rows.map((r) => `| ${r.surface} | \`${r.reach}\` | ${r.lang} | ${String(r.small)}/${String(r.texts)} | ${r.minSize === null ? '—' : String(r.minSize)} | ${String(r.sizes)} | ${String(r.contrastFails)} | ${String(r.smallTargets)}/${String(r.targets)} | ${r.noFeedback === null ? '—' : String(r.noFeedback)} | ${String(r.truncated)} | ${String(r.words)} | ${String(r.longestSentence)} | ${r.atesman === null ? '—' : r.atesman.toFixed(0)} | ${String(r.hues)} | ${String(r.score)} |`).join('\n');

  return `# ${title}

_${date}_ · Eşikler: \`docs/mobil-ui-ux-arastirmasi-2026-11-11.md\`. Bu bir başlangıç ölçümüdür, standart değildir.

## Kapsam

Envanterdeki ${String(summary.coverage.length)} giriş yolunun ${String(measured)} tanesi ölçüldü.

${gaps.length === 0 ? '_Ölçülmeyen giriş yolu yok._\n' : gaps.map((c) => `- \`${c.reach}\` (${c.surface}): ${c.status === 'error' ? `hata — ${c.error ?? ''}` : 'çalıştırılmadı'}`).join('\n')}

Uzun sayfalar ekran ekran kaydırılarak ölçüldü. Parça sınırına (kaydırma sınırı) takılıp sonu ölçülmeyenler:

${list(summary.capped, (c) => `${at(c)} — ${String(c.parts)} parça`)}
${profileSection(summary.phone, 'Telefon (350×812, DPR 2)')}
## Taşma ve kesilme (T7, L1), bütün diller ve boyutlar

- Üç noktayla kesilen metin: ${String(summary.overflow.truncated.length)}
- Kutusundan taşıp kırpılan metin: ${String(summary.overflow.clipped.length)}
- Sayfanın yana kaydığı ölçüm: ${String(summary.overflow.pages.length)}

${list(summary.overflow.truncated, (h) => `${at(h)} — "${h.text}"`)}
Kırpılanlar:

${list(summary.overflow.clipped, (h) => `${at(h)} — "${h.text}"`)}
Yana taşanlar:

${list(summary.overflow.pages, (p) => `${at(p)} — ${p.elements.join(', ')}`)}
${textLoad(summary.phone.rows)}
## En kötü 20 yüzey (telefon)

Puan: 12 px altı metin + 3 × kontrast hatası + 2 × 44 px altı hedef + tepkisiz hedef + 3 × kesilen metin + 5 × yana taşma. Basma tepkisi yalnız tr'de ölçüldü (dile bağlı değil); başka dilde "—" yazar ve puana girmez.

| Yüzey | Yol | Dil | <12 px | En küçük | Boyut çeşidi | Kontrast | <44 hedef | Tepkisiz | Kesilen | Kelime | En uzun cümle | Ateşman | Ton | Puan |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
${surfaceTable}

${profileSection(summary.desktop, 'Masaüstü (1280×900)')}`;
}

export interface ComparisonRow {
  metric: string;
  before: number;
  after: number;
}

const small = (p: ProfileSummary) => p.sizes['<9'] + p.sizes['9–10'] + p.sizes['10–11'] + p.sizes['11–12'];

/** The headline numbers of two baselines side by side, for "did the last stage move them?". */
export function compareSummaries(before: Summary, after: Summary): ComparisonRow[] {
  const pick: [string, (s: Summary) => number][] = [
    ['Ölçülen giriş yolu', (s) => s.coverage.filter((c) => c.status === 'measured').length],
    ['Görünen metin (telefon)', (s) => s.phone.texts],
    ['12 px altı metin (telefon)', (s) => small(s.phone)],
    ['Kontrastı yetmeyen metin', (s) => s.phone.contrastFails.length],
    ['44 px altı hedef', (s) => s.phone.targets['<24'] + s.phone.targets['24–44']],
    ['WCAG 2.5.8 aralık hatası', (s) => s.phone.spacingFails.length],
    ['Basınca tepkisiz hedef', (s) => s.phone.noFeedback.length],
    ['Kesilen metin (bütün diller)', (s) => s.overflow.truncated.length],
    ['Kırpılan metin (bütün diller)', (s) => s.overflow.clipped.length],
    ['Yana taşan ölçüm', (s) => s.overflow.pages.length],
    ['Hızlı yanıp sönen animasyon', (s) => s.phone.fastBlinks.length],
    ['300 ms üstü geçiş', (s) => s.phone.slowTransitions.length],
  ];
  return pick.map(([metric, of]) => ({ metric, before: of(before), after: of(after) }));
}

export function renderComparison(rows: readonly ComparisonRow[], previousDate: string): string {
  const change = (n: number) => (n === 0 ? '0' : n > 0 ? `+${String(n)}` : `−${String(-n)}`);
  return `## Önceki ölçümle fark (${previousDate})

| Ölçüt | Önce | Şimdi | Fark |
|---|---|---|---|
${rows.map((r) => `| ${r.metric} | ${String(r.before)} | ${String(r.after)} | ${change(r.after - r.before)} |`).join('\n')}
`;
}
