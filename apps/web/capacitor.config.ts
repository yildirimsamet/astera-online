import type { CapacitorConfig } from '@capacitor/cli';
import { isIP } from 'node:net';
import { z } from 'zod';
// Capacitor's CommonJS TS loader resolves source extensions, unlike Vite's bundler.
import { mobileBuild, NATIVE_STARTUP_PATH } from './mobileBuild';

/** This first wrapper opens the working tree, and must never become a store build. */
const mobile = mobileBuild(process.env);
if (mobile.target === 'web' && process.env.ASTERA_MOBILE_DEBUG !== '1') {
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

const config: CapacitorConfig = mobile.target === 'web' ? {
  appId: 'space.asteraonline.app.debug',
  appName: 'Astera Local',
  webDir: 'mobile-dev',
  backgroundColor: '#05070D',
  server: { url: rawUrl, cleartext: url.protocol === 'http:' },
  android: { backgroundColor: '#05070D', loggingBehavior: 'debug' },
  plugins: { App: { disableBackButtonHandler: true }, SystemBars: { hidden: true, style: 'DARK', insetsHandling: 'css' } },
} : {
  appId: mobile.appId, appName: mobile.appName, webDir: mobile.webDir,
  backgroundColor: '#05070D',
  server: { androidScheme: mobile.androidScheme, cleartext: mobile.cleartext, allowNavigation: [], errorPath: NATIVE_STARTUP_PATH },
  android: { backgroundColor: '#05070D', loggingBehavior: 'none', useLegacyBridge: false },
  plugins: { App: { disableBackButtonHandler: true }, SystemBars: { hidden: true, style: 'DARK', insetsHandling: 'css' },
    CapacitorHttp: { enabled: false }, AsteraSession: { apiUrl: mobile.apiUrl, target: mobile.target } },
};

export default config;
