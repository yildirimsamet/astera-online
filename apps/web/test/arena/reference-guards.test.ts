import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repository = resolve(process.cwd(), '../..');

const candidates = [
  'astera-ref-assets/raw/base.apk',
  'apps/web/astera-ref-assets/dist/ship.glb',
  'apps/web/public/__ref/ship.glb',
  'packages/example/__ref/capture.png',
  'assets/example.ref.glb',
];

describe('local reference assets stay outside the public repository', () => {
  it('ignores every reference asset pattern, including accidental copies into public', () => {
    const result = spawnSync('git', ['check-ignore', '--no-index', '--stdin'], {
      cwd: repository, input: candidates.join('\n') + '\n', encoding: 'utf8',
    });
    expect(result.stdout.trim().split('\n').sort()).toEqual([...candidates].sort());
  });

  it('has no tracked reference asset or capture', () => {
    const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: repository, encoding: 'utf8' }).split('\0');
    expect(tracked.filter((path) => /(^|\/)(astera-ref-assets|__ref)\/|\.ref\.glb$/i.test(path)))
      .toEqual([]);
  });

  it('keeps ordinary owned models eligible for version control', () => {
    const result = spawnSync('git', ['check-ignore', '--no-index', '--stdin'], {
      cwd: repository, input: 'apps/web/public/assets/models/owned-ship.glb\n', encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
  });
});
