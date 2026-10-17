import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';

const targets = {
  'live-reload': 'space.asteraonline.app.debug',
  'native-local': 'space.asteraonline.app.local',
  'native-staging': 'space.asteraonline.app.staging',
  'native-production': 'space.asteraonline.app',
} as const;
const targetSchema = z.enum(['live-reload', 'native-local', 'native-staging', 'native-production']);

export function installCommands(input: string, applicationId: string, apk: string): string[][] {
  const target = targetSchema.parse(input);
  if (applicationId !== targets[target]) throw new Error('APK applicationId does not match the requested target; rebuild or choose the bundled target');
  return [...(target === 'live-reload' ? [['reverse', 'tcp:5173', 'tcp:5173']]
    : target === 'native-local' ? [['reverse', 'tcp:3100', 'tcp:3100']] : []),
    ['install', '-r', apk], ['shell', 'am', 'start', '-n', `${applicationId}/space.asteraonline.app.debug.MainActivity`]];
}

function main(): void {
  const args = process.argv.slice(2).filter(arg => arg !== '--');
  const target = targetSchema.parse(args.length === 0 ? 'live-reload' : args.length === 1 ? args[0] : undefined);
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const directory = resolve(root, 'out/mobile-artifacts', target);
  const apk = target === 'live-reload' ? resolve(root, 'apps/web/android/app/build/outputs/apk/debug/app-debug.apk')
    : resolve(directory, `astera-${target}.apk`);
  if (target !== 'live-reload') {
    const checksum = readFileSync(resolve(directory, 'SHA256SUMS'), 'utf8').trim().split(/\s+/)[0];
    if (checksum !== createHash('sha256').update(readFileSync(apk)).digest('hex')) throw new Error('Bundled APK checksum mismatch; rebuild before installing');
  }
  const sdk = process.env.ANDROID_HOME ?? resolve(homedir(), 'Android/Sdk');
  const badging = execFileSync(resolve(sdk, 'build-tools/36.0.0/aapt'), ['dump', 'badging', apk], { encoding: 'utf8' });
  const applicationId = /package: name='([^']+)'/.exec(badging)?.[1];
  if (!applicationId) throw new Error('Cannot read APK applicationId');
  for (const args of installCommands(target, applicationId, apk)) {
    const result = spawnSync('adb', args, { stdio: 'inherit' });
    if (result.error || result.status !== 0) throw new Error('ADB install/launch failed; check the connected device');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
