import type { CapacitorConfig } from '@capacitor/cli';
import { isIP } from 'node:net';
import { z } from 'zod';

/** This first wrapper opens the working tree, and must never become a store build. */
if (process.env.ASTERA_MOBILE_DEBUG !== '1') {
  throw new Error('This is a debug-only wrapper. Use pnpm android:sync or pnpm android:apk.');
}

const configuredUrl = process.env.ASTERA_MOBILE_DEV_URL;
const rawUrl = configuredUrl === undefined || configuredUrl === '' ? 'http://localhost:5173' : configuredUrl;
const parsed = z.string().url().safeParse(rawUrl);
const urlError = 'ASTERA_MOBILE_DEV_URL must be a local development URL without credentials, path, query or hash.';
if (!parsed.success) throw new Error(urlError);
const url = new URL(parsed.data);
const octets = isIP(url.hostname) === 4 ? url.hostname.split('.').map(Number) : [];
const localHost = url.hostname === 'localhost' || url.hostname === '[::1]'
  || octets[0] === 127 || octets[0] === 10
  || (octets[0] === 192 && octets[1] === 168)
  || (octets[0] === 172 && octets[1] !== undefined && octets[1] >= 16 && octets[1] <= 31);
if (!localHost || !['http:', 'https:'].includes(url.protocol)
  || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
  throw new Error(urlError);
}

const config: CapacitorConfig = {
  appId: 'space.asteraonline.app.debug',
  appName: 'Astera Local',
  webDir: 'mobile-dev',
  backgroundColor: '#05070D',
  server: { url: rawUrl, cleartext: url.protocol === 'http:' },
  android: { backgroundColor: '#05070D', loggingBehavior: 'debug' },
};

export default config;
