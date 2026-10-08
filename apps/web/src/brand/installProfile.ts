import { z } from 'zod';

export type InstallBrowser = 'brave' | 'chrome' | 'edge' | 'safari' | 'firefox' | 'samsung' | 'opera' | 'other';
export type InstallOS = 'ios' | 'android' | 'windows' | 'mac' | 'linux' | 'other';
export interface InstallProfile {
  kind: 'ios' | 'android' | 'desktop' | 'inApp';
  os: InstallOS;
  browser: InstallBrowser;
  firefoxVersion: number | null;
}

const hintsSchema = z.object({
  platform: z.string().optional(),
  brands: z.array(z.object({ brand: z.string(), version: z.string() })).optional(),
});

/**
 * Best-effort identification only chooses manual instructions. A retained real
 * beforeinstallprompt event, never an OS/browser guess, controls the native CTA.
 * Read low-entropy hints when present; Safari/Firefox and privacy modes use UA.
 */
export function installProfile(
  ua = navigator.userAgent,
  touchPoints = navigator.maxTouchPoints,
  clientHints: unknown = Reflect.get(navigator, 'userAgentData'),
  verifiedBrave = false,
): InstallProfile {
  const parsed = hintsSchema.safeParse(clientHints);
  const hints = parsed.success ? parsed.data : undefined;
  const platform = hints?.platform ?? '';
  const system = /^(Android|Windows|macOS|Linux|iOS)$/i.test(platform) ? platform : ua;
  const brands = new Set(hints?.brands?.map(({ brand }) => brand.toLowerCase()));
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && touchPoints > 1) || /^iOS$/i.test(platform);
  const os: InstallOS = ios ? 'ios'
    : /Android/i.test(system) ? 'android'
    : /Windows/i.test(system) ? 'windows'
    : /macOS|Macintosh|Mac OS X/i.test(system) ? 'mac'
    : /Linux/i.test(system) ? 'linux' : 'other';
  const browser: InstallBrowser = verifiedBrave || brands.has('brave') || /\bBrave\b/i.test(ua) ? 'brave'
    : brands.has('microsoft edge') || /Edg(?:A|iOS)?\//i.test(ua) ? 'edge'
    : brands.has('firefox') || /(?:Firefox|FxiOS)\//i.test(ua) ? 'firefox'
    : /SamsungBrowser\//i.test(ua) ? 'samsung'
    : brands.has('opera') || /(?:OPR|OPiOS)\//i.test(ua) ? 'opera'
    : brands.has('google chrome') || /(?:Chrome|Chromium|CriOS)\//i.test(ua) ? 'chrome'
    : /Version\/.*Safari\//i.test(ua) ? 'safari' : 'other';
  const version = Number.parseInt(/(?:Firefox|FxiOS)\/(\d+)/i.exec(ua)?.[1] ?? hints?.brands?.find(({ brand }) => brand.toLowerCase() === 'firefox')?.version ?? '', 10);
  const embedded = /Twitter|FBAN|FBAV|Instagram|Line\/|LinkedInApp|TikTok|musical_ly|Snapchat|;\s*wv\)/i.test(ua);
  return { os, browser, firefoxVersion: Number.isFinite(version) ? version : null,
    kind: embedded ? 'inApp' : os === 'ios' ? 'ios' : os === 'android' ? 'android' : 'desktop' };
}

/** Brave deliberately shares Chrome's UA. Its optional official API can refine the help. */
export async function isBraveBrowser(): Promise<boolean> {
  try {
    const brave: unknown = Reflect.get(navigator, 'brave');
    if (typeof brave !== 'object' || brave === null) return false;
    const check: unknown = Reflect.get(brave, 'isBrave');
    if (typeof check !== 'function') return false;
    const result: unknown = await Reflect.apply(check, brave, []);
    return result === true;
  } catch { return false; }
}
