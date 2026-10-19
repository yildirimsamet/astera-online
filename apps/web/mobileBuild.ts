import { z } from 'zod';
import { isIP } from 'node:net';

const targetSchema = z.enum(['web', 'native-local', 'native-staging', 'native-production']).default('web');
export const NATIVE_STARTUP_PATH = 'assets/native-startup.html';

/** Shared build-time contract; no secrets or backend credentials belong in VITE_ variables. */
export function mobileBuild(env: Record<string, string | undefined>) {
  const parsed = targetSchema.safeParse(env.VITE_ASTERA_PLATFORM);
  if (!parsed.success) throw new Error('Invalid VITE_ASTERA_PLATFORM build target');
  const target = parsed.data;
  if (target === 'web') return { target } as const;
  const input = z.string().url().safeParse(env.VITE_ASTERA_API_URL);
  if (!input.success) throw new Error('A native build requires a valid VITE_ASTERA_API_URL origin');
  const api = new URL(input.data);
  const local = target === 'native-local';
  if (api.username || api.password || api.pathname !== '/' || api.search || api.hash
    || (local ? api.protocol !== 'http:' || api.hostname !== 'localhost'
      : api.protocol !== 'https:' || api.hostname === 'localhost' || isIP(api.hostname.replace(/^\[|\]$/g, '')) !== 0)) {
    throw new Error('Invalid native API origin: HTTPS domain required; native-local permits only HTTP localhost');
  }
  return {
    target, apiUrl: api.origin, webDir: `mobile-dist/${target}`,
    appId: `space.asteraonline.app${local ? '.local' : target === 'native-staging' ? '.staging' : ''}`,
    appName: local ? 'Astera Bundled Local' : target === 'native-staging' ? 'Astera Staging' : 'Astera Online',
    androidScheme: local ? 'http' : 'https', cleartext: local,
  } as const;
}
