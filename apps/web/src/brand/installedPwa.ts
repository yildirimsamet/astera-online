import { z } from 'zod';

export const INSTALLED_PWA_KEY = 'astera:pwa:confirmed:v1';
const appsSchema = z.array(z.object({
  platform: z.string(),
  id: z.string().optional(),
  url: z.string().optional(),
}));

export function runningAsPwa(): boolean {
  return (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
    || Reflect.get(navigator, 'standalone') === true;
}

/** Historical evidence on this browser, not an inventory of the device's apps. */
export function remembersInstalledPwa(): boolean {
  try { return localStorage.getItem(INSTALLED_PWA_KEY) === '1'; }
  catch { return false; }
}

export function rememberInstalledPwa(): void {
  try { localStorage.setItem(INSTALLED_PWA_KEY, '1'); }
  catch { /* The current session can still suppress installation offers. */ }
}

/** A fresh native install offer supersedes history, including after uninstall. */
export function forgetInstalledPwa(): void {
  try { localStorage.removeItem(INSTALLED_PWA_KEY); }
  catch { /* A browser-provided offer still works without storage. */ }
}

/**
 * Positive evidence only. Unsupported browsers, failures and empty lists do not
 * prove absence: older desktop implementations only check UWP apps, and Android
 * may not find an installation made with a different localized manifest.
 */
export async function findsInstalledPwa(): Promise<boolean> {
  try {
    const check: unknown = Reflect.get(navigator, 'getInstalledRelatedApps');
    if (typeof check !== 'function') return false;
    const response: unknown = await Reflect.apply(check, navigator, []);
    const apps = appsSchema.safeParse(response);
    if (!apps.success) return false;
    const origin = window.location.origin;
    const identity = new URL('/', origin).href;
    return apps.data.some((app) => {
      if (app.platform !== 'webapp') return false;
      try {
        // Every language edition has the same existing, start_url-derived ID.
        if (app.id) return new URL(app.id, origin).href === identity;
        if (!app.url) return false;
        const manifest = new URL(app.url, origin);
        return manifest.origin === origin && /^\/manifest(?:\.(?:tr|de|es|fr|ja))?\.webmanifest$/.test(manifest.pathname);
      } catch { return false; }
    });
  } catch { return false; }
}
