// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('keeps accidentally copied Android private keys and password files out of Git discovery', () => {
  const privatePaths = ['upload.p12', 'keys/upload.pfx', 'upload.jks', 'upload.keystore', 'android-upload.pass', 'keystore.properties'];
  const result = spawnSync('git', ['check-ignore', '--no-index', '--stdin'], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    input: [...privatePaths, 'upload-certificate.pem'].join('\n') + '\n', encoding: 'utf8',
  });
  if (result.error) throw result.error;
  expect([0, 1]).toContain(result.status);
  expect(result.stdout.trim().split('\n').filter(Boolean)).toEqual(privatePaths);
});
