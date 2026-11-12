/**
 * pnpm ui:audit run    --driver gallery [--surface launch] [--langs tr,en] [--profiles phone] [--concurrency 2]
 * pnpm ui:audit run    --driver client   a local game of its own (stack.ts), taken down after
 * pnpm ui:audit run    --driver client --base http://127.0.0.1:5232 --password …   one already up
 * pnpm ui:audit run    --driver starter  the same, with the starter galaxy on (a game of its own:
 *                                the switch changes the client ways too, so never with client)
 * pnpm ui:audit report [--out out/ui-audit/<date>] [--md reports/ui-audit/baseline-<date>.md]
 *                                the summary JSON goes to <out>/summary.json, out of git
 * pnpm ui:audit static [--md reports/ui-audit/static-<date>.md]
 * pnpm ui:audit run --whatif A   the raised type scale, overflow only, into <out>-whatif-A
 * pnpm ui:audit run --kit [--langs tr]   the game kit's views into out/ui-audit/kit-<date>;
 *                                `report --kit` writes reports/ui-audit/kit-<date>.md, apart from the game
 * pnpm ui:audit vision           colour-blindness sheets of every phone screenshot (R2)
 * pnpm ui:audit flash [--moment prologue-warp]   the bright moments filmed on a held clock (§1.5)
 * pnpm ui:audit competitor --spec reports/ui-audit/competitors-<date>.spec.json
 *                                text and button sizes on competitor screenshots (§1.13)
 *
 * `run` writes one JSON and one screenshot per measurement under <out>/raw; drivers run
 * separately and add to the same folder. `report` reads everything there, so a baseline is
 * built from as many runs as it takes.
 */

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { randomBytes } from 'node:crypto';
import { clientVisits, clientWorld, type ClientWorld } from './drivers/client.js';
import { galleryVisits } from './drivers/gallery.js';
import { publicVisits } from './drivers/public.js';
import { KIT_SURFACES, SURFACES, type Surface } from './inventory.js';
import { compareSummaries, renderComparison, renderReport, summarize, type Entry, type Summary } from './report.js';
import { scanSource } from './scanSource.js';
import { visionSheets } from './visionSheets.js';
import { isScreens, measureScreens } from './competitorSheet.js';
import { flashReport, renderFlash, type FlashResult } from './flash.js';
import { film, holdTime, PHONE_FLASH } from './flashFilm.js';
import { flashMoments, NOT_FILMED } from './flashMoments.js';
import { startStack, type Stack } from './stack.js';
import { renderStatic } from './static.js';
import { isWhatIf, renderWhatIf, whatIfCss, whatIfSummary, type WhatIfName, type WhatIfSummary } from './whatif.js';
import { PROFILES, planJobs, previousRun, runFolder, runJobs, summaryPath, type Profile, type Visit } from './run.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
/** The local calendar day: a run after midnight in Türkiye belongs to that day. */
const today = new Date().toLocaleDateString('sv-SE');

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    driver: { type: 'string', default: 'gallery' },
    base: { type: 'string', default: 'http://127.0.0.1:5231' },
    surface: { type: 'string', multiple: true },
    reach: { type: 'string', multiple: true },
    langs: { type: 'string', default: 'tr,en,fr,de,es,ja' },
    profiles: { type: 'string', default: 'phone,narrow,desktop' },
    concurrency: { type: 'string', default: '2' },
    /** gpu: the machine's GPU through Vulkan (3D sheets draw in time); swiftshader: software, slow. */
    renderer: { type: 'string', default: 'gpu' },
    /** A or B: measure again with the type tokens raised (plan §1.3). */
    whatif: { type: 'string' },
    /** client: the seeded commanders' password on a stack already up at --base; without it the run starts its own. */
    password: { type: 'string' },
    /** flash: film only these moments. */
    moment: { type: 'string', multiple: true },
    /** competitor: the measurement spec; rows go beside it without `.spec`. */
    spec: { type: 'string' },
    /** The game kit as a surface of its own: its own folder and report, never in the game's totals. */
    kit: { type: 'boolean', default: false },
    out: { type: 'string' },
    md: { type: 'string' },
  },
});
const kit = values.kit;
const auditedSurfaces = kit ? KIT_SURFACES : SURFACES;
const mdPath = values.md ?? join(ROOT, 'reports/ui-audit', `${kit ? 'kit' : 'baseline'}-${today}.md`);

function parseWhatIf(name: string | undefined): WhatIfName | undefined {
  if (name === undefined) return undefined;
  if (!isWhatIf(name)) throw new Error(`unknown what-if: ${name} (A | B)`);
  return name;
}
const whatIf = parseWhatIf(values.whatif);
const base = resolve(ROOT, values.out ?? join('out/ui-audit', runFolder(today, { kit })));
const out = whatIf ? `${base}-whatif-${whatIf}` : base;

function isProfile(name: string): name is Profile['name'] {
  return name in PROFILES;
}

const DRIVERS: Record<string, (base: string, surfaces: readonly Surface[]) => Visit[]> = { gallery: galleryVisits, public: publicVisits };

/** `--driver gallery,public`: the visits of each, in that order. */
function visitsFor(drivers: readonly string[], world: ClientWorld | undefined): Visit[] {
  const surfaces = auditedSurfaces.filter((s) => !values.surface || values.surface.includes(s.id));
  return drivers.flatMap((name) => {
    if ((name === 'client' || name === 'starter') && world) return clientVisits(world, surfaces);
    const driver = DRIVERS[name];
    if (!driver) throw new Error(`unknown driver: ${name} (${[...Object.keys(DRIVERS), 'client', 'starter'].join(' | ')})`);
    return driver(values.base, surfaces);
  }).filter((v) => !values.reach || values.reach.includes(v.reach));
}

const launch = () => (values.renderer === 'gpu'
  ? chromium.launch({ channel: 'chromium', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=vulkan'] })
  : chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }));

async function run(): Promise<void> {
  const drivers = values.driver.split(',');
  const profiles = values.profiles.split(',').filter(isProfile);
  const browser = await launch();
  let stack: Stack | null = null;
  try {
    let world: ClientWorld | undefined;
    const starter = drivers.includes('starter');
    if (starter && drivers.includes('client')) throw new Error('client and starter need games of their own: run them one at a time');
    if (starter || drivers.includes('client')) {
      const password = values.password ?? randomBytes(12).toString('hex');
      if (!values.password) {
        const logs = join(out, 'stack');
        await mkdir(logs, { recursive: true });
        console.log(`yerel oyun kuruluyor (günlükler: ${logs})`);
        stack = await startStack({ root: ROOT, logs, run: Date.now().toString(36), password, starter });
      }
      world = await clientWorld(browser, stack?.url ?? values.base, password, starter);
    }
    const jobs = planJobs(visitsFor(drivers, world), { langs: values.langs.split(','), profiles, overflowOnly: whatIf !== undefined });
    console.log(`${String(jobs.length)} ölçüm → ${out}`);
    const entries = await runJobs(browser, jobs, { out, concurrency: Number(values.concurrency), log: (line) => { console.log(line); }, ...(whatIf ? { css: whatIfCss(whatIf) } : {}) });
    const failed = entries.filter((e) => e.error);
    console.log(`bitti: ${String(entries.length - failed.length)} ölçüldü, ${String(failed.length)} hata`);
  } finally {
    await browser.close();
    await stack?.stop();
  }
}

/** Our own output, read back: checked for shape at the top, trusted below it. */
function isEntry(value: unknown): value is Entry {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  return ['surface', 'reach', 'lang', 'profile'].every((k) => typeof e[k] === 'string')
    && (e.error === null || typeof e.error === 'string')
    && (e.audit === null || (typeof e.audit === 'object' && Array.isArray((e.audit as Record<string, unknown>).texts)));
}

async function readEntries(dir: string): Promise<Entry[]> {
  const files = (await readdir(dir, { recursive: true })).filter((f) => f.endsWith('.json'));
  const parsed: unknown[] = await Promise.all(files.map(async (f): Promise<unknown> => JSON.parse(await readFile(join(dir, f), 'utf8'))));
  const bad = files.filter((_, i) => !isEntry(parsed[i]));
  if (bad.length > 0) throw new Error(`not an audit entry: ${bad.join(', ')}`);
  return parsed.filter(isEntry);
}

function isSummary(value: unknown): value is Summary {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return Array.isArray(s.coverage) && typeof s.phone === 'object' && s.phone !== null && typeof s.overflow === 'object' && s.overflow !== null;
}

/** The latest baseline before this one, from the run folders beside it in out/, if any. */
async function previousBaseline(): Promise<{ date: string; summary: Summary } | null> {
  const runs = dirname(base);
  if (!existsSync(runs)) return null;
  const date = previousRun((await readdir(runs)).filter((f) => existsSync(summaryPath(join(runs, f)))), today);
  if (!date) return null;
  const parsed: unknown = JSON.parse(await readFile(summaryPath(join(runs, date)), 'utf8'));
  if (!isSummary(parsed)) throw new Error(`${summaryPath(join(runs, date))} is not a summary`);
  return { date, summary: parsed };
}

async function competitor(): Promise<void> {
  if (!values.spec) throw new Error('competitor needs --spec');
  const spec = resolve(ROOT, values.spec);
  const parsed: unknown = JSON.parse(await readFile(spec, 'utf8'));
  if (!isScreens(parsed)) throw new Error(`${spec} is not a competitor spec`);
  const sheet = join(ROOT, 'out', 'competitors', `check-${basename(spec, '.spec.json')}.png`);
  await mkdir(dirname(sheet), { recursive: true });
  const rows = await measureScreens(parsed, { root: ROOT, sheet });
  await writeFile(spec.replace(/\.spec\.json$/, '.json'), `${JSON.stringify(rows, null, 1)}\n`);
  console.log(`${String(rows.length)} ölçüm → ${spec.replace(/\.spec\.json$/, '.json')}; göz kontrolü: ${sheet}`);
}

async function report(): Promise<void> {
  const entries = await readEntries(join(base, 'raw'));
  const summary = summarize(entries, auditedSurfaces);
  const whatIfs: Partial<Record<WhatIfName, WhatIfSummary>> = {};
  for (const name of ['A', 'B'] as const) {
    const dir = join(`${base}-whatif-${name}`, 'raw');
    if (existsSync(dir)) whatIfs[name] = whatIfSummary(entries, await readEntries(dir));
  }
  const md = resolve(ROOT, mdPath);
  const sections = renderWhatIf(whatIfs);
  const previous = kit ? null : await previousBaseline();
  const noPrevious = kit ? '_Kit ölçümü oyun ölçümüyle karşılaştırılmaz._\n' : '_Önceki ölçüm yok: bu ilk baseline._\n';
  await mkdir(dirname(md), { recursive: true });
  await writeFile(md, [
    renderReport(summary, { title: `${kit ? 'Oyun arayüzü kiti ölçümü' : 'UI/UX başlangıç ölçümü'} — ${today}`, date: today }),
    previous ? renderComparison(compareSummaries(previous.summary, summary), previous.date) : noPrevious,
    sections ? `## Ya yazı ölçeği büyüseydi (plan §1.3)\n\n${sections}` : '',
  ].join('\n'));
  await writeFile(summaryPath(base), JSON.stringify({ ...summary, whatIf: whatIfs }));
  console.log(`${String(entries.length)} ölçüm → ${md} (özet: ${summaryPath(base)})`);
}

async function staticScan(): Promise<void> {
  const md = resolve(ROOT, mdPath.replace(/baseline-(\d{4}-\d{2}-\d{2})\.md$/, 'static-$1.md'));
  const scan = await scanSource(ROOT);
  await mkdir(dirname(md), { recursive: true });
  await writeFile(md, renderStatic(scan, { date: today }));
  await writeFile(md.replace(/\.md$/, '.json'), JSON.stringify(scan));
  console.log(`${String(scan.fontSizes.length)} yazı boyutu, ${String(scan.animations.length)} animasyon, ${String(scan.notifications.length)} bildirim metni → ${md}`);
}

/** Plan §1.5: each moment on a phone page of its own, filmed at 60 fps of page time. */
async function flash(): Promise<void> {
  const moments = flashMoments(values.base).filter((m) => !values.moment || values.moment.includes(m.id));
  const md = resolve(ROOT, mdPath.replace(/baseline-(\d{4}-\d{2}-\d{2})\.md$/, 'flash-$1.md'));
  const strips = join(base, 'flash');
  await mkdir(strips, { recursive: true });
  const browser = await launch();
  const results: FlashResult[] = [];
  try {
    for (const { id, what, seconds, heldFromLoad = false, open, act } of moments) {
      const context = await browser.newContext({ viewport: { width: 350, height: 812 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'tr-TR' });
      await context.addInitScript({ content: 'globalThis.__name ??= (fn) => fn;' });
      const page = await context.newPage();
      page.setDefaultTimeout(45_000);
      const started = Date.now();
      try {
        await holdTime(page, { held: heldFromLoad });
        await open(page);
        const kept: Buffer[] = [];
        const frames = await film(page, { seconds, shot: (png, frame) => { if (frame % 30 === 0) kept.push(png); }, ...(act ? { act: () => act(page) } : {}) });
        await filmstrip(kept, join(strips, `${id}.png`));
        results.push({ id, what, seconds, report: flashReport(frames, PHONE_FLASH), error: null });
      } catch (error) {
        results.push({ id, what, seconds, report: null, error: error instanceof Error ? error.message.split('\n')[0] ?? error.message : String(error) });
      } finally {
        await context.close();
      }
      const last = results.at(-1);
      console.log(`${id}: ${last?.report ? `${String(last.report.generalPerSecond)} genel, ${String(last.report.redPerSecond)} kırmızı flaş/sn → ${last.report.fails ? 'KALDI' : 'geçti'}` : `HATA ${last?.error ?? ''}`} (${String(Math.round((Date.now() - started) / 1000))} sn)`);
    }
  } finally {
    await browser.close();
  }
  await mkdir(dirname(md), { recursive: true });
  await writeFile(md, renderFlash(results, { date: today, areaThreshold: PHONE_FLASH.areaThreshold, fps: 60, notFilmed: NOT_FILMED }));
  await writeFile(md.replace(/\.md$/, '.json'), `${JSON.stringify(results, null, 1)}\n`);
  console.log(`rapor → ${md}; kareler (yarım saniyede bir) → ${strips}`);
}

/** Every kept frame side by side at a quarter size: what the film saw, for the eye. */
async function filmstrip(pngs: readonly Buffer[], file: string): Promise<void> {
  if (pngs.length === 0) return;
  const tiles = await Promise.all(pngs.map((png) => sharp(png).resize(88, 203).png().toBuffer()));
  await sharp({ create: { width: tiles.length * 90, height: 203, channels: 3, background: '#ffffff' } })
    .composite(tiles.map((input, i) => ({ input, left: i * 90, top: 0 })))
    .png()
    .toFile(file);
}

const command = positionals[0] ?? 'run';
if (command === 'run') await run();
else if (command === 'report') await report();
else if (command === 'static') await staticScan();
else if (command === 'competitor') await competitor();
else if (command === 'flash') await flash();
else if (command === 'vision') console.log(`${String(await visionSheets(base))} renk körlüğü sayfası → ${join(base, 'vision')}`);
else throw new Error(`unknown command: ${command} (run | report | static | vision | competitor)`);
