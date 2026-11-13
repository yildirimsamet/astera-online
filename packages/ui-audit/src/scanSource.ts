/**
 * FEED THE STATIC SCANS THE REAL SOURCE TREE.
 *
 * The web client (minus tests, the developer gallery, locale files and the admin screens
 * the owner set aside) and the server's push copy.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { phrases } from './drivers/phrase.js';
import { OUT_OF_SCOPE } from './inventory.js';
import { actionCoverage, animationUses, fontSizes, holdDurations, keyframes, pushCopies, tokenOverrides, typeTokens, type StaticScan } from './static.js';

const LANGS = ['tr', 'en', 'fr', 'de', 'es', 'ja'];

async function sources(root: string, keep: (path: string) => boolean): Promise<{ path: string; text: string }[]> {
  const files = (await readdir(root, { recursive: true })).filter(keep);
  return Promise.all(files.map(async (path) => ({ path, text: await readFile(join(root, path), 'utf8') })));
}

const ADMIN = new Set(Object.entries(OUT_OF_SCOPE).filter(([, why]) => why.startsWith('admin')).map(([file]) => file));

export async function scanSource(repo: string): Promise<StaticScan> {
  const webRoot = join(repo, 'apps/web/src');
  // dev/ holds developer preview pages served beside the gallery, never shipped to players.
  const web = await sources(webRoot, (p) => /\.(css|tsx?)$/.test(p) && !/\.test\.|(^|\/)v2\/gallery\/|^dev\/|(^|\/)i18n\/|\.d\.ts$/.test(p) && !ADMIN.has(p));
  const css = web.filter((f) => f.path.endsWith('.css'));
  const tokens: Record<string, number> = {};
  for (const f of css) Object.assign(tokens, typeTokens(f.text));
  const frames = new Map<string, boolean>();
  for (const f of css) for (const [name, light] of keyframes(f.text)) frames.set(name, (frames.get(name) ?? false) || light);

  /** Kit controls that answer a press themselves, so a screen using them is not silent. */
  const kit = new Set(web
    .filter((f) => /^(v2\/kit|ui)\//.test(f.path) && /\b(playSound|haptic)\(/.test(f.text))
    .flatMap((f) => [...f.text.matchAll(/export (?:function|const) ([A-Z]\w*)/g)].map((m) => m[1] ?? '')));

  const server = await sources(join(repo, 'apps/server/src'), (p) => p.endsWith('.ts') && !p.includes('.test.'));
  const push = server.flatMap((f) => pushCopies(relative(repo, join(repo, 'apps/server/src', f.path)), f.text)).map((c) => ({ ...c, source: 'push' as const }));
  const local = (await Promise.all(LANGS.map(async (lang) => {
    const titles = await phrases(lang, 'notificationCenter', 'notificationCenter.local.title');
    const bodies = await phrases(lang, 'notificationCenter', 'notificationCenter.local.body');
    return Object.entries(bodies).map(([kind, body]) => ({ source: 'local' as const, file: `i18n/${lang}/notificationCenter.ts`, line: 0, lang, kind, title: titles[kind] ?? '—', body }));
  }))).flat();

  const sound = web.find((f) => f.path === 'lib/sound.ts')?.text ?? '';
  const tap = /addEventListener\('click'[\s\S]*?closest\('([^']+)'\)/.exec(sound) ?? /closest\('([^']+)'\)[\s\S]*?play\('tap'/.exec(sound);

  return {
    tokens,
    globalTap: tap?.[1] ?? null,
    overrides: css.flatMap((f) => tokenOverrides(f.path, f.text)),
    fontSizes: web.flatMap((f) => fontSizes(f.path, f.text, tokens)),
    animations: web.flatMap((f) => animationUses(f.path, f.text)).map((a) => ({ ...a, light: a.name === null ? null : (frames.get(a.name) ?? null) })),
    holds: web.flatMap((f) => holdDurations(f.path, f.text)),
    coverage: web.filter((f) => f.path.endsWith('.tsx')).map((f) => actionCoverage(f.path, f.text, kit)),
    notifications: [...push, ...local],
  };
}
