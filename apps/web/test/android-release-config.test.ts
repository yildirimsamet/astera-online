import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { androidRelease } from '../androidRelease.js';

let directory: string;
let project: string;
let keystore: string;
let passwordFile: string;
let env: Record<string, string | undefined>;
const FIREBASE = 'apps/web/android/app/google-services.json';
const firebase = (pkg: string) => JSON.stringify({ project_info: { project_id: 'fixture' },
  client: [{ client_info: { mobilesdk_app_id: '1:1:android:1', android_client_info: { package_name: pkg } } }] });

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'astera-release-config-'));
  project = join(directory, 'project'); mkdirSync(project);
  keystore = join(directory, 'upload.p12'); passwordFile = join(directory, 'password.txt');
  mkdirSync(join(project, 'apps/web/android/app'), { recursive: true });
  writeFileSync(join(project, FIREBASE), firebase('space.asteraonline.app'));
  // Config tests cover private file boundaries. The actual AAB build must verify the real key.
  writeFileSync(keystore, 'fixture-keystore-not-for-signing', { mode: 0o600 });
  writeFileSync(passwordFile, 'fixture-secret-do-not-export\n', { mode: 0o600 });
  env = { VITE_ASTERA_PLATFORM: 'native-production', VITE_ASTERA_API_URL: 'https://asteraonline.space',
    ASTERA_ANDROID_KEYSTORE_PATH: keystore, ASTERA_ANDROID_PASSWORD_FILE: passwordFile,
    ASTERA_ANDROID_KEY_ALIAS: 'astera-upload', ASTERA_ANDROID_VERSION_CODE: '1', ASTERA_ANDROID_VERSION_NAME: '1.0.0' };
});
afterEach(() => { rmSync(directory, { recursive: true, force: true }); });

it('prepares explicit production release inputs without returning the private password', () => {
  const result = androidRelease(env, project);
  expect(result).toEqual({ versionCode: 1, versionName: '1.0.0', signing: { keystorePath: keystore, passwordFile, keyAlias: 'astera-upload' } });
  expect(JSON.stringify(result)).not.toContain('fixture-secret-do-not-export');
});

it.each(['web', 'native-local', 'native-staging'])('rejects a store release for %s', target => {
  env.VITE_ASTERA_PLATFORM = target;
  if (target === 'native-local') env.VITE_ASTERA_API_URL = 'http://localhost:3100';
  expect(() => androidRelease(env, project)).toThrow(/native-production/);
});

it.each(['http://api.example.com', 'https://user:secret@api.example.com', 'https://api.example.com/path', 'https://api.example.com?token=secret'])('rejects an unsafe production API origin', api => {
  env.VITE_ASTERA_API_URL = api;
  expect(() => androidRelease(env, project)).toThrow(/API|origin|HTTPS/);
});

it.each(['ASTERA_ANDROID_KEYSTORE_PATH', 'ASTERA_ANDROID_PASSWORD_FILE', 'ASTERA_ANDROID_KEY_ALIAS', 'ASTERA_ANDROID_VERSION_CODE', 'ASTERA_ANDROID_VERSION_NAME'])('requires the explicit %s input', field => {
  env[field] = undefined;
  expect(() => androidRelease(env, project)).toThrow(field);
});

it.each(['0', '-1', '1.5', '2100000001', 'NaN', '', '1;unexpected-command'])('rejects a malformed or out-of-range version code: %s', value => {
  env.ASTERA_ANDROID_VERSION_CODE = value;
  expect(() => androidRelease(env, project)).toThrow(/ASTERA_ANDROID_VERSION_CODE/);
});

it('accepts the Play version-code ceiling and preserves the displayed version name', () => {
  env.ASTERA_ANDROID_VERSION_CODE = '2100000000'; env.ASTERA_ANDROID_VERSION_NAME = '1.0.0-beta.1';
  expect(androidRelease(env, project)).toMatchObject({ versionCode: 2100000000, versionName: '1.0.0-beta.1' });
});

it.each(['', '   ', '1.0\ninvalid'])('rejects an empty or multiline version name', version => {
  env.ASTERA_ANDROID_VERSION_NAME = version;
  expect(() => androidRelease(env, project)).toThrow(/ASTERA_ANDROID_VERSION_NAME/);
});

it.each(['ASTERA_ANDROID_KEYSTORE_PATH', 'ASTERA_ANDROID_PASSWORD_FILE'])('rejects a missing private file: %s', field => {
  env[field] = join(directory, 'missing');
  expect(() => androidRelease(env, project)).toThrow(field);
});

it.each(['ASTERA_ANDROID_KEYSTORE_PATH', 'ASTERA_ANDROID_PASSWORD_FILE'])('rejects readable-by-others signing material: %s', field => {
  const path = env[field]; if (!path) throw new Error('Missing fixture path');
  chmodSync(path, 0o644);
  expect(() => androidRelease(env, project)).toThrow(/private|permissions|0600/);
});

it.each(['ASTERA_ANDROID_KEYSTORE_PATH', 'ASTERA_ANDROID_PASSWORD_FILE'])('keeps signing material outside the repository, including symlinks: %s', field => {
  const inside = join(project, 'secret-file'); const link = join(directory, 'outside-link');
  writeFileSync(inside, 'fixture-secret', { mode: 0o600 }); symlinkSync(inside, link); env[field] = link;
  expect(() => androidRelease(env, project)).toThrow(/outside|repository/);
});

it('rejects a directory masquerading as a keystore and an empty password file', () => {
  env.ASTERA_ANDROID_KEYSTORE_PATH = directory;
  expect(() => androidRelease(env, project)).toThrow(/ASTERA_ANDROID_KEYSTORE_PATH/);
  env.ASTERA_ANDROID_KEYSTORE_PATH = keystore; writeFileSync(passwordFile, '');
  expect(() => androidRelease(env, project)).toThrow(/ASTERA_ANDROID_PASSWORD_FILE/);
});

it('does not rewrite password whitespace or mutate the caller environment', () => {
  writeFileSync(passwordFile, '  fixture secret with spaces  \r\n'); const before = { ...env };
  androidRelease(env, project);
  expect(readFileSync(passwordFile, 'utf8')).toBe('  fixture secret with spaces  \r\n');
  expect(env).toEqual(before);
});

// Play v16 (2026-11-26) was built in a checkout without the gitignored Firebase file: the build passed,
// and the app closed on every start the moment it asked for push alerts.
it.each([
  ['missing', null],
  ['empty', ''],
  ['not JSON', '{'],
  ['for another app', firebase('space.asteraonline.app.local')],
])('refuses a store release whose Firebase file is %s', (_case, content) => {
  if (content === null) rmSync(join(project, FIREBASE));
  else writeFileSync(join(project, FIREBASE), content);
  expect(() => androidRelease(env, project)).toThrow(/google-services\.json/);
});
