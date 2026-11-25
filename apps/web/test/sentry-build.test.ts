// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sentryUpload } from '../sentryBuild.js';
import { nativeReleaseCommit } from '../mobileBuildCli.js';

const root = resolve(import.meta.dirname, '../../..');
const commit = 'a'.repeat(40);

/**
 * SOURCE MAPS GO TO SENTRY AND NOWHERE ELSE (plan 2026-11-13, S-3). A crash stack points at the real
 * file and line only if the build uploads its maps; the maps hold the source, so they leave the
 * build after the upload and are never served. Without the key or the commit nothing is uploaded.
 */
describe('the source map upload', () => {
  it('is off without the key or without the commit', () => {
    expect(sentryUpload({ token: undefined, release: commit, target: 'web', outDir: 'dist' })).toBeNull();
    expect(sentryUpload({ token: '', release: commit, target: 'web', outDir: 'dist' })).toBeNull();
    expect(sentryUpload({ token: 'key', release: '', target: 'web', outDir: 'dist' })).toBeNull();
    expect(sentryUpload({ token: 'key', release: undefined, target: 'web', outDir: 'dist' })).toBeNull();
  });

  it('uploads to the project of the build, under the release a report names, then deletes the maps', () => {
    const web = sentryUpload({ token: 'key', release: commit, target: 'web', outDir: 'dist' });
    expect(web).toEqual({
      org: 'asteraonline', project: 'web', authToken: 'key', telemetry: false,
      release: { name: commit }, sourcemaps: { filesToDeleteAfterUpload: ['dist/**/*.map'] },
    });
    expect(sentryUpload({ token: 'key', release: commit, target: 'android', outDir: 'android-web' })?.project).toBe('app');
    expect(sentryUpload({ token: 'key', release: commit, target: 'android', outDir: 'android-web' })?.sourcemaps.filesToDeleteAfterUpload).toEqual(['android-web/**/*.map']);
  });

  it('names an app build by its commit, and only a clean tree claims one (OTA F1)', () => {
    const head = () => `${commit}\n`;
    expect(nativeReleaseCommit(undefined, head, () => '')).toBe(commit);
    expect(nativeReleaseCommit(undefined, head, () => ' M apps/web/src/main.tsx\n')).toBeUndefined();
    expect(nativeReleaseCommit(undefined, () => 'not a commit', () => '')).toBeUndefined();
    expect(nativeReleaseCommit('b'.repeat(40), head, () => ' M apps/web/src/main.tsx\n')).toBe('b'.repeat(40));
  });

  it('reaches the image build as a secret, never as a build argument or a layer', () => {
    const docker = readFileSync(resolve(root, 'Dockerfile'), 'utf8');
    expect(docker).toContain('RUN --mount=type=secret,id=sentry_auth,env=SENTRY_AUTH_TOKEN pnpm --filter @astera/web build');
    expect(docker).not.toMatch(/ARG SENTRY_AUTH_TOKEN|ENV SENTRY_AUTH_TOKEN/u);
    const deploy = readFileSync(resolve(root, 'deploy/deploy.sh'), 'utf8');
    expect(deploy).toContain('--secret id=sentry_auth,env=SENTRY_AUTH_TOKEN');
    expect(deploy).not.toContain('--build-arg "SENTRY_AUTH_TOKEN');
    expect(deploy).not.toMatch(/echo[^\n]*SENTRY_AUTH_TOKEN/u);
  });
});
