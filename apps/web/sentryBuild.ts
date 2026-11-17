/**
 * SOURCE MAPS TO SENTRY (plan 2026-11-13, S-3). A crash stack names the real file and line only when
 * the build uploads its maps; the maps carry the source, so they are deleted after the upload and never
 * served. Off without the key (`SENTRY_AUTH_TOKEN`, a BuildKit secret in the image build) or without
 * the commit the crash reports name as their release.
 */
export interface SentryUpload {
  org: string;
  project: 'web' | 'app';
  authToken: string;
  telemetry: false;
  release: { name: string };
  sourcemaps: { filesToDeleteAfterUpload: string[] };
}

export function sentryUpload(at: { token: string | undefined; release: string | undefined; target: string; outDir: string }): SentryUpload | null {
  if (!at.token || !at.release) return null;
  return {
    org: 'asteraonline',
    project: at.target === 'web' ? 'web' : 'app',
    authToken: at.token,
    telemetry: false,
    release: { name: at.release },
    sourcemaps: { filesToDeleteAfterUpload: [`${at.outDir}/**/*.map`] },
  };
}
