import versions from './planet-assets.json';

/** Static /assets files are cached for a year; a changed skin needs a new URL. */
export const skinAsset = (path: string): string =>
  `/assets/${path}?v=${(versions as Readonly<Record<string, string>>)[path] ?? '0'}`;
