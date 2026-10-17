import { Capacitor, registerPlugin } from '@capacitor/core';
import { z } from 'zod';
import { claimSchema, okSchema, sessionSchema } from '../api/schemas.js';

const OPERATIONS = {
  '/api/auth/login': 'login',
  '/api/auth/register': 'register',
  '/api/onboarding/claim': 'claim',
  '/api/auth/refresh': 'refresh',
  '/api/auth/logout': 'logout',
} as const;
type SessionPath = keyof typeof OPERATIONS;
export interface AuthTransport {
  request(path: SessionPath, body?: Record<string, unknown>): Promise<Response>;
  clear(): Promise<void>;
}
export interface NativeSessionPlugin {
  request: (input: { operation: typeof OPERATIONS[SessionPath]; body?: Record<string, unknown> }) => Promise<unknown>;
  clear: () => Promise<unknown>;
}

const plugin = registerPlugin<NativeSessionPlugin>('AsteraSession');
const envelope = z.object({ status: z.number().int().min(200).max(599), body: z.unknown(), serverTime: z.string().optional() }).strict();
const errorBody = z.object({ error: z.string(), message: z.string(), params: z.record(z.union([z.string(), z.number()])).optional() });
const unavailable = () => new Response(JSON.stringify({ error: 'UNREACHABLE', message: 'Sign-in is unavailable. Check your connection and try again.' }),
  { status: 503, headers: { 'content-type': 'application/json' } });

async function bounded<T>(operation: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation(), new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => { reject(new Error('Native session bridge timed out')); }, 45_000);
    })]);
  } finally { clearTimeout(timer); }
}

export const isSessionPath = (path: string): path is SessionPath => Object.prototype.hasOwnProperty.call(OPERATIONS, path);

/** Live-reload keeps its web cookie; bundled apps require the explicit native bridge. */
export function createNativeAuthTransport(native: NativeSessionPlugin = plugin): AuthTransport | null {
  if ((import.meta.env.VITE_ASTERA_PLATFORM ?? 'web') === 'web') return null;
  const ready = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('AsteraSession')
    && (Capacitor.getPlatform() !== 'android' || typeof window !== 'undefined' && 'androidBridge' in window);
  return {
    async request(path, body) {
      if (!ready()) return unavailable();
      try {
        const response = envelope.parse(await bounded(() => native.request({ operation: OPERATIONS[path], ...(body ? { body } : {}) })));
        // The native implementation must remove secrets before crossing the bridge.
        if (typeof response.body === 'object' && response.body !== null && ('refreshToken' in response.body || 'nextRefreshToken' in response.body)) return unavailable();
        const schema = response.status >= 400 ? errorBody : path === '/api/onboarding/claim' ? claimSchema
          : path === '/api/auth/logout' ? okSchema : sessionSchema;
        return new Response(JSON.stringify(schema.parse(response.body)), { status: response.status,
          headers: { 'content-type': 'application/json', ...(response.serverTime ? { 'x-server-time': response.serverTime } : {}) } });
      } catch {
        // A bridge failure must never fall back to cross-origin browser cookies.
        return unavailable();
      }
    },
    async clear() {
      if (!ready()) throw new Error('Native session bridge unavailable');
      await bounded(() => native.clear());
    },
  };
}
