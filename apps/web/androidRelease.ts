import { readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, sep } from 'node:path';
import { mobileBuild } from './mobileBuild.js';

/** Node-only signing inputs. Passwords never become VITE variables or artifact metadata. */
export function androidRelease(env: Record<string, string | undefined>, repositoryRoot: string) {
  if (env.VITE_ASTERA_PLATFORM !== 'native-production') throw new Error('Android release requires native-production');
  mobileBuild(env);
  const required = (name: string): string => {
    const value = env[name];
    if (!value) throw new Error(`Missing ${name}`);
    return value;
  };
  const code = required('ASTERA_ANDROID_VERSION_CODE');
  if (!/^[1-9]\d*$/.test(code) || Number(code) > 2_100_000_000) throw new Error('Invalid ASTERA_ANDROID_VERSION_CODE');
  const versionName = required('ASTERA_ANDROID_VERSION_NAME');
  if (!versionName.trim() || /[\r\n\0]/.test(versionName)) throw new Error('Invalid ASTERA_ANDROID_VERSION_NAME');
  const keyAlias = required('ASTERA_ANDROID_KEY_ALIAS');
  if (!/^[a-zA-Z0-9._-]{1,64}$/.test(keyAlias)) throw new Error('Invalid ASTERA_ANDROID_KEY_ALIAS');
  const repository = realpathSync(repositoryRoot);
  const privateFile = (name: string): string => {
    const input = required(name);
    if (!isAbsolute(input)) throw new Error(`${name} must be an absolute private file path`);
    let path: string;
    try { path = realpathSync(input); } catch { throw new Error(`Missing ${name} file`); }
    const location = relative(repository, path);
    if (location === '' || !isAbsolute(location) && location !== '..' && !location.startsWith(`..${sep}`)) {
      throw new Error(`${name} must remain outside the repository`);
    }
    const stat = statSync(path);
    if (!stat.isFile()) throw new Error(`${name} must be a regular file`);
    if ((stat.mode & 0o077) !== 0) throw new Error(`${name} requires private permissions (0600)`);
    return path;
  };
  const keystorePath = privateFile('ASTERA_ANDROID_KEYSTORE_PATH');
  const passwordFile = privateFile('ASTERA_ANDROID_PASSWORD_FILE');
  if (!readFileSync(passwordFile, 'utf8').split(/\r?\n/, 1)[0]) throw new Error('Empty ASTERA_ANDROID_PASSWORD_FILE');
  return { versionCode: Number(code), versionName, signing: { keystorePath, passwordFile, keyAlias } };
}
