/**
 * RUN MANY VISITS, KEEP EVERY RESULT, LOSE NONE TO ONE FAILURE.
 *
 * Plan §1.6: the phone in Turkish gets every criterion and the press test; English gets
 * every criterion; the other four languages and the 320 px phone are measured for
 * overflow only (a light audit); the desktop in Turkish and English.
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Browser, Page } from 'playwright';
import { auditSurface } from './audit.js';
import type { Reach } from './inventory.js';
import { FULL_LANGUAGES, type Entry } from './report.js';

export interface Profile {
  name: 'phone' | 'desktop' | 'narrow';
  viewport: { width: number; height: number };
  dpr: number;
  touch: boolean;
}

export const PROFILES: Record<Profile['name'], Profile> = {
  phone: { name: 'phone', viewport: { width: 350, height: 812 }, dpr: 2, touch: true },
  desktop: { name: 'desktop', viewport: { width: 1280, height: 900 }, dpr: 1, touch: false },
  narrow: { name: 'narrow', viewport: { width: 320, height: 740 }, dpr: 2, touch: true },
};

export interface Visit {
  surface: string;
  reach: Reach;
  /** Bring the page to the surface, in the language given. */
  open: (page: Page, lang: string) => Promise<void>;
  /** The languages the surface exists in, when not all of them (the wiki is published in two). */
  langs?: readonly string[];
  /** The screens the surface is drawn on, when not all of them (the outline is desktop only). */
  profiles?: readonly Profile['name'][];
}

export interface Job {
  visit: Visit;
  lang: string;
  profile: Profile;
  /** Overflow only: one background frame, a coarser hit grid, no presses. */
  light: boolean;
  feedback: boolean;
}

/** `overflowOnly`: a what-if run (plan §1.3) — overflow on the phones, no presses, no desktop. */
export function planJobs(visits: readonly Visit[], { langs, profiles, overflowOnly = false }: { langs: readonly string[]; profiles: readonly Profile['name'][]; overflowOnly?: boolean }): Job[] {
  const jobs: Job[] = [];
  for (const visit of visits) {
    for (const name of profiles) {
      if (visit.profiles && !visit.profiles.includes(name)) continue;
      const profile = PROFILES[name];
      if (overflowOnly && name === 'desktop') continue;
      for (const lang of langs) {
        if (visit.langs && !visit.langs.includes(lang)) continue;
        const full = !overflowOnly && FULL_LANGUAGES.includes(lang) && name !== 'narrow';
        if (name === 'desktop' && !full) continue;
        jobs.push({ visit, lang, profile, light: !full, feedback: !overflowOnly && name === 'phone' && lang === 'tr' });
      }
    }
  }
  return jobs;
}

export const slug = (reach: string): string => reach.replace(/[^a-z0-9-]+/gi, '-');

export function entryPath(out: string, e: { surface: string; reach: string; lang: string; profile: string }): string {
  return join(out, 'raw', e.profile, e.lang, `${e.surface}__${slug(e.reach)}`);
}

/** A run's summary sits with its raw files in out/, not in git: about 6 MB a baseline (owner, 2026-11-11). */
export const summaryPath = (out: string): string => join(out, 'summary.json');

/** The latest day before `today` among run folders that hold a summary; what-if and device runs are not baselines. */
export function previousRun(folders: readonly string[], today: string): string | null {
  return folders.filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f) && f < today).sort().at(-1) ?? null;
}

const LOCALES: Record<string, string> ={ tr: 'tr-TR', en: 'en-GB', de: 'de-DE', es: 'es-ES', fr: 'fr-FR', ja: 'ja-JP' };

async function runJob(browser: Browser, job: Job, out: string, css: string | undefined): Promise<Entry> {
  const where = { surface: job.visit.surface, reach: job.visit.reach, lang: job.lang, profile: job.profile.name };
  const path = entryPath(out, where);
  await mkdir(dirname(path), { recursive: true });
  const context = await browser.newContext({
    viewport: job.profile.viewport,
    deviceScaleFactor: job.profile.dpr,
    isMobile: job.profile.touch,
    hasTouch: job.profile.touch,
    locale: LOCALES[job.lang] ?? job.lang,
    bypassCSP: true,
  });
  // tsx names every inner function with an `__name(fn, "name")` call; a function sent to the
  // page carries that call with it, and the page has no `__name`.
  await context.addInitScript({ content: 'globalThis.__name ??= (fn) => fn;' });
  if (css) {
    // Into <head> once it exists: a node added earlier is lost when the parser builds the
    // document. Measurement waits seconds after load, so every layout we read has it.
    await context.addInitScript((text: string) => {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = text;
        document.head.append(style);
      }, { once: true });
    }, css);
  }
  const page = await context.newPage();
  page.setDefaultTimeout(45_000);
  try {
    await job.visit.open(page, job.lang);
    const audit = await auditSurface(page, {
      surface: job.visit.surface,
      frames: job.light ? 1 : 2,
      gridStep: job.light ? 4 : 2,
      feedback: job.feedback,
      screenshot: `${path}.png`,
    });
    const entry: Entry = { ...where, audit, error: null };
    await writeFile(`${path}.json`, JSON.stringify(entry));
    await rm(`${path}.error.png`, { force: true });
    return entry;
  } catch (error) {
    const entry: Entry = { ...where, audit: null, error: error instanceof Error ? error.message.split('\n')[0] ?? error.message : String(error) };
    await page.screenshot({ path: `${path}.error.png` }).catch(() => undefined);
    await writeFile(`${path}.json`, JSON.stringify(entry));
    return entry;
  } finally {
    await context.close();
  }
}

/** `css`: a stylesheet put in every page before it runs (the what-if type scale). */
export async function runJobs(browser: Browser, jobs: readonly Job[], { out, concurrency, log, css }: { out: string; concurrency: number; log: (line: string) => void; css?: string }): Promise<Entry[]> {
  const entries: Entry[] = [];
  let next = 0;
  let done = 0;
  const worker = async () => {
    for (let job = jobs[next++]; job; job = jobs[next++]) {
      const started = Date.now();
      const entry = await runJob(browser, job, out, css);
      entries.push(entry);
      done += 1;
      log(`[${String(done)}/${String(jobs.length)}] ${entry.surface} ${entry.reach} ${entry.lang}/${entry.profile} ${entry.error ? `HATA ${entry.error}` : 'ok'} ${String(Math.round((Date.now() - started) / 1000))} sn`);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  return entries;
}
