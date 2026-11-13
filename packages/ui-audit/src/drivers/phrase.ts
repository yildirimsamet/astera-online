/**
 * THE GAME'S OWN WORDS, SO A DRIVER PRESSES THE SAME BUTTON IN EVERY LANGUAGE.
 *
 * Reads apps/web/src/i18n/locales/<lang>/<file>.ts; a renamed key fails the run loudly
 * instead of measuring the wrong screen.
 */

const LOCALES = new URL('../../../../apps/web/src/i18n/locales/', import.meta.url);

async function at(lang: string, file: string, path: string): Promise<unknown> {
  let node: unknown = await import(new URL(`${lang}/${file}.ts`, LOCALES).href);
  for (const part of path.split('.')) {
    node = typeof node === 'object' && node !== null && part in node ? (node as Record<string, unknown>)[part] : undefined;
  }
  return node;
}

export async function phrase(lang: string, file: string, path: string): Promise<string> {
  const node = await at(lang, file, path);
  if (typeof node !== 'string') throw new Error(`no phrase ${lang}/${file}: ${path}`);
  return node;
}

/** The string leaves directly under a key, e.g. every local alert title by kind. */
export async function phrases(lang: string, file: string, path: string): Promise<Record<string, string>> {
  const node = await at(lang, file, path);
  if (typeof node !== 'object' || node === null) throw new Error(`no phrases ${lang}/${file}: ${path}`);
  return Object.fromEntries(Object.entries(node).filter((e): e is [string, string] => typeof e[1] === 'string'));
}
