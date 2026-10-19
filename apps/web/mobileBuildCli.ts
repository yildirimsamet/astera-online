import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, X509Certificate } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';
import { mobileBuild, NATIVE_STARTUP_PATH } from './mobileBuild.js';
import { androidRelease } from './androidRelease.js';

const metadataSchema = z.object({ target: z.string(), apiUrl: z.string().url(), bundled: z.literal(true), storeReady: z.literal(false) });

export function assertNativeArtifacts(directory: string, expected: { target: string; apiUrl: string }): void {
  const metadata = metadataSchema.parse(JSON.parse(readFileSync(resolve(directory, 'native-build.json'), 'utf8')));
  if (metadata.target !== expected.target || metadata.apiUrl !== expected.apiUrl) throw new Error('Native artifact metadata/API mismatch');
  for (const entry of readdirSync(directory)) {
    if (!['index.html', 'native-build.json', 'assets', 'icons'].includes(entry)) throw new Error(`Unexpected native artifact: ${entry}`);
  }
  const html = readFileSync(resolve(directory, 'index.html'), 'utf8');
  const startup = resolve(directory, NATIVE_STARTUP_PATH);
  if (!existsSync(startup) || !readFileSync(startup, 'utf8').includes('data-native-startup')) throw new Error('Missing native startup help page');
  if (!html.includes('data-native-compatibility')) throw new Error('Missing native compatibility guard');
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
  const release = args[0] === '--release';
  const targetArgs = release ? args.slice(1) : args;
  const target = z.enum(['native-local', 'native-staging', 'native-production']).parse(targetArgs.length === 1 ? targetArgs[0] : undefined);
  // A debug package is versionCode 1 in Gradle; a release names its own.
  const nativeBuild = release ? process.env.ASTERA_ANDROID_VERSION_CODE : '1';
  const mobile = mobileBuild({ VITE_ASTERA_PLATFORM: target, VITE_ASTERA_NATIVE_BUILD: nativeBuild,
    VITE_ASTERA_API_URL: process.env.VITE_ASTERA_API_URL ?? (target === 'native-local' ? 'http://localhost:3100' : undefined) });
  if (mobile.target === 'web') throw new Error('A bundled target is required');
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const releaseConfig = release ? androidRelease({ ...process.env, VITE_ASTERA_PLATFORM: target, VITE_ASTERA_API_URL: mobile.apiUrl }, root) : undefined;
  const web = resolve(root, 'apps/web');
  const android = resolve(web, 'android');
  const environment = { ...process.env, VITE_ASTERA_PLATFORM: target, VITE_ASTERA_API_URL: mobile.apiUrl, VITE_ASTERA_NATIVE_BUILD: mobile.nativeBuild,
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
  const synced = z.object({ appId: z.literal(mobile.appId), server: z.object({ url: z.never().optional(), cleartext: z.literal(mobile.cleartext), errorPath: z.literal(NATIVE_STARTUP_PATH) }),
    android: z.object({ loggingBehavior: z.literal('none'), useLegacyBridge: z.literal(false) }),
    plugins: z.object({ CapacitorHttp: z.object({ enabled: z.literal(false) }), AsteraSession: z.object({ target: z.literal(target), apiUrl: z.literal(mobile.apiUrl) }) }) });
  synced.parse(JSON.parse(readFileSync(resolve(android, 'app/src/main/assets/capacitor.config.json'), 'utf8')));
  run('./gradlew', ['--no-daemon', '--no-parallel', '--max-workers=1', '-Dorg.gradle.jvmargs=-Xmx1024m -XX:MaxMetaspaceSize=512m',
    ...(releaseConfig ? ['-PasteraStoreRelease=true', ':app:bundleRelease'] : [':app:assembleDebug'])], android);
  if (fingerprint(root) !== sourceHash) throw new Error('Source changed during build; rebuild before using this artifact');
  if (releaseConfig) {
    const aab = resolve(android, 'app/build/outputs/bundle/release/app-release.aab');
    const javaTool = (name: string) => resolve(environment.JAVA_HOME, 'bin', name);
    const verified = execFileSync(javaTool('jarsigner'), ['-J-Duser.language=en', '-verify', aab], { encoding: 'utf8' });
    if (!verified.includes('jar verified.')) throw new Error('Release AAB signature verification failed');
    const certificate = execFileSync(javaTool('keytool'), ['-exportcert', '-rfc', '-keystore', releaseConfig.signing.keystorePath,
      '-storepass:file', releaseConfig.signing.passwordFile, '-alias', releaseConfig.signing.keyAlias], { encoding: 'utf8' });
    const bundledCertificate = execFileSync(javaTool('keytool'), ['-printcert', '-rfc', '-jarfile', aab], { encoding: 'utf8' });
    const fingerprint = new X509Certificate(certificate).fingerprint256;
    if (new X509Certificate(bundledCertificate).fingerprint256 !== fingerprint) throw new Error('Release AAB upload certificate mismatch');
    const destination = resolve(root, 'out/mobile-artifacts', `${target}-release`);
    mkdirSync(destination, { recursive: true });
    const name = `astera-${target}-v${releaseConfig.versionCode}.aab`;
    copyFileSync(aab, resolve(destination, name));
    writeFileSync(resolve(destination, 'native-build.json'), JSON.stringify({
      ...metadataSchema.extend({ sourceHash: z.string(), gitHead: z.string() }).parse(JSON.parse(readFileSync(resolve(output, 'native-build.json'), 'utf8'))),
      buildType: 'release', artifactType: 'aab', versionCode: releaseConfig.versionCode, versionName: releaseConfig.versionName,
      uploadCertificateSha256: fingerprint,
    }, null, 2) + '\n');
    writeFileSync(resolve(destination, 'SHA256SUMS'), createHash('sha256').update(readFileSync(aab)).digest('hex') + `  ${name}\n`);
    console.log(`Signed release AAB: ${resolve(destination, name)}\nSource SHA-256: ${sourceHash}\nStore acceptance gates remain pending.`);
    return;
  }
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
  console.log(`Bundled DEBUG APK: ${exported}\nSource SHA-256: ${sourceHash}\nUse android:release for an explicitly signed AAB.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
