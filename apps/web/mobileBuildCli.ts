import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';
import { mobileBuild } from './mobileBuild.js';

const metadataSchema = z.object({ target: z.string(), apiUrl: z.string().url(), bundled: z.literal(true), storeReady: z.literal(false) });

export function assertNativeArtifacts(directory: string, expected: { target: string; apiUrl: string }): void {
  const metadata = metadataSchema.parse(JSON.parse(readFileSync(resolve(directory, 'native-build.json'), 'utf8')));
  if (metadata.target !== expected.target || metadata.apiUrl !== expected.apiUrl) throw new Error('Native artifact metadata/API mismatch');
  for (const entry of readdirSync(directory)) {
    if (!['index.html', 'native-build.json', 'assets', 'icons'].includes(entry)) throw new Error(`Unexpected native artifact: ${entry}`);
  }
  const html = readFileSync(resolve(directory, 'index.html'), 'utf8');
  if (/__CSP_NONCE__|googlesyndication|googletagmanager|google-analytics|adsbygoogle|localhost:5173/i.test(html)) throw new Error('Web bootstrap remains in native HTML');
  const policy = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html)?.[1];
  if (!policy || !policy.includes("object-src 'none'") && !policy.includes("default-src 'none'")) throw new Error('Missing native CSP');
  const connect = policy.split(';').map(part => part.trim()).find(part => part.startsWith('connect-src '));
  if (connect !== `connect-src 'self' blob: ${expected.apiUrl}`) throw new Error('Native CSP API mismatch');
  const scripts = [...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)];
  if (scripts.length === 0) throw new Error('Missing native entry script');
  for (const script of scripts) {
    const src = script[1] ?? '';
    if (!src.startsWith('/assets/') || src.includes('..') || !existsSync(resolve(directory, src.slice(1)))) throw new Error('Missing or invalid native script');
  }
}

function fingerprint(root: string): string {
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' });
  const hash = createHash('sha256');
  for (const name of files.split('\0').filter(Boolean).sort()) {
    const path = resolve(root, name);
    hash.update(name + '\0');
    hash.update(existsSync(path) ? readFileSync(path) : '<deleted>');
  }
  return hash.digest('hex');
}

function main(): void {
  const args = process.argv.slice(2).filter(arg => arg !== '--');
  const target = z.enum(['native-local', 'native-staging', 'native-production']).parse(args.length === 1 ? args[0] : undefined);
  const mobile = mobileBuild({ VITE_ASTERA_PLATFORM: target,
    VITE_ASTERA_API_URL: process.env.VITE_ASTERA_API_URL ?? (target === 'native-local' ? 'http://localhost:3100' : undefined) });
  if (mobile.target === 'web') throw new Error('A bundled target is required');
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const web = resolve(root, 'apps/web');
  const android = resolve(web, 'android');
  const environment = { ...process.env, VITE_ASTERA_PLATFORM: target, VITE_ASTERA_API_URL: mobile.apiUrl,
    ASTERA_MOBILE_DEBUG: '', ASTERA_MOBILE_DEV_URL: '', NODE_OPTIONS: '--max-old-space-size=4096',
    JAVA_HOME: process.env.JAVA_HOME ?? resolve(homedir(), '.local/share/astera/jdk-21') };
  function run(command: string, commandArgs: string[], cwd: string) {
    const result = spawnSync('nice', ['-n', '10', command, ...commandArgs], { cwd, env: environment, stdio: 'inherit' });
    if (result.error || result.status !== 0) throw new Error(`${command} failed (${result.status ?? result.signal ?? 'spawn'})`);
  }
  const sourceHash = fingerprint(root);
  run('pnpm', ['exec', 'vite', 'build', '--configLoader', 'runner'], web);
  const output = resolve(web, mobile.webDir);
  assertNativeArtifacts(output, mobile);
  writeFileSync(resolve(output, 'native-build.json'), JSON.stringify({ ...metadataSchema.parse(JSON.parse(readFileSync(resolve(output, 'native-build.json'), 'utf8'))),
    sourceHash, gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() }, null, 2) + '\n');
  run('pnpm', ['exec', 'cap', 'sync', 'android'], web);
  const synced = z.object({ appId: z.literal(mobile.appId), server: z.object({ url: z.never().optional(), cleartext: z.literal(mobile.cleartext) }),
    android: z.object({ loggingBehavior: z.literal('none'), useLegacyBridge: z.literal(false) }),
    plugins: z.object({ CapacitorHttp: z.object({ enabled: z.literal(false) }), AsteraSession: z.object({ target: z.literal(target), apiUrl: z.literal(mobile.apiUrl) }) }) });
  synced.parse(JSON.parse(readFileSync(resolve(android, 'app/src/main/assets/capacitor.config.json'), 'utf8')));
  run('./gradlew', ['--no-daemon', '--no-parallel', '--max-workers=1', '-Dorg.gradle.jvmargs=-Xmx1024m -XX:MaxMetaspaceSize=512m', 'assembleDebug'], android);
  if (fingerprint(root) !== sourceHash) throw new Error('Source changed during build; rebuild before using this APK');
  const apk = resolve(android, 'app/build/outputs/apk/debug/app-debug.apk');
  const sdk = process.env.ANDROID_HOME ?? resolve(homedir(), 'Android/Sdk');
  const aapt = resolve(sdk, 'build-tools/36.0.0/aapt');
  const badging = execFileSync(aapt, ['dump', 'badging', apk], { encoding: 'utf8' });
  if (!badging.includes(`package: name='${mobile.appId}'`)) throw new Error('APK applicationId does not match bundled target');
  const destination = resolve(root, 'out/mobile-artifacts', target);
  mkdirSync(destination, { recursive: true });
  const exported = resolve(destination, `astera-${target}.apk`);
  copyFileSync(apk, exported); copyFileSync(resolve(output, 'native-build.json'), resolve(destination, 'native-build.json'));
  writeFileSync(resolve(destination, 'SHA256SUMS'), createHash('sha256').update(readFileSync(apk)).digest('hex') + `  astera-${target}.apk\n`);
  console.log(`Bundled DEBUG APK: ${exported}\nSource SHA-256: ${sourceHash}\nStore release remains disabled.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
